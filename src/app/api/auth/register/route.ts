// src/app/api/auth/register/route.ts
// Enhanced user registration with comprehensive validation

import { NextRequest, NextResponse } from 'next/server';
import { applyMiddleware } from '@/lib/api/enhanced-middleware';
import { createClient } from '@/lib/supabase/server';
import { registerSchema } from '@/lib/validations';
import { z } from 'zod';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting by IP (uses the 'register' limit defined in middleware.ts)
    const { error: rateLimitError } = await applyMiddleware(request, {
      auth: 'optional',
      // FIX: We must use the predefined key 'register' from RateLimiterType
      rateLimit: 'register', 
    });

    if (rateLimitError) return rateLimitError;

    const body = await request.json();
    const validatedData = registerSchema.parse(body);
    
    const supabase = await createClient();
    
    // Check if email already exists
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', validatedData.email)
      .single();

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'Email already registered' },
        { status: 409 }
      );
    }

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: validatedData.email,
      password: validatedData.password,
      options: {
        data: {
          full_name: validatedData.full_name,
        },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/verify`,
      },
    });

    if (authError) {
      return NextResponse.json(
        { success: false, error: authError.message },
        { status: 400 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { success: false, error: 'User creation failed' },
        { status: 500 }
      );
    }

    // Create profile
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        email: validatedData.email,
        full_name: validatedData.full_name,
        phone_number: validatedData.phone_number,
        user_type: validatedData.user_type,
        university: validatedData.university,
        location: validatedData.location,
        account_status: 'active',
      });

    if (profileError) {
      // Cleanup auth user if profile creation fails
      await supabase.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { success: false, error: 'Profile creation failed' },
        { status: 500 }
      );
    }

    // Create wallet for freelancers
    if (validatedData.user_type === 'freelancer' || validatedData.user_type === 'both') {
      await supabase.from('wallets').insert({ 
        user_id: authData.user.id,
        balance: 0,
        pending_clearance: 0,
      });
    }

    return NextResponse.json({
      success: true,
      data: { 
        user: authData.user, 
        session: authData.session,
      },
      message: 'Registration successful. Please check your email to verify your account.',
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: error.issues[0].message,
          details: error.issues,
        },
        { status: 400 }
      );
    }

    console.error('Registration error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}