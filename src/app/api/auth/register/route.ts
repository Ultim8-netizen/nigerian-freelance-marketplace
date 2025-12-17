// src/app/api/auth/register/route.ts
// Optimized Registration: Professional, secure, and ready for progressive verification.

import { NextRequest, NextResponse } from 'next/server';
import { applyMiddleware } from '@/lib/api/enhanced-middleware';
import { createClient } from '@/lib/supabase/server';
import { registerSchema } from '@/lib/validations';
import { z } from 'zod';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    // 1. Rate Limiting
    const { error: rateLimitError } = await applyMiddleware(request, {
      auth: 'optional',
      rateLimit: 'register',
    });

    if (rateLimitError) return rateLimitError;

    // 2. Validation
    const body = await request.json();
    const validatedData = registerSchema.parse(body);

    const supabase = await createClient();

    // 3. Pre-check: Email availability
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

    // 4. Create Auth User
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

    // 5. Create Profile
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        email: validatedData.email,
        full_name: validatedData.full_name,
        phone_number: validatedData.phone_number,
        user_type: validatedData.user_type,
        university: validatedData.university || null,
        location: validatedData.location,
        account_status: 'active',
        trust_score: 0,
        trust_level: 'new',
        identity_verified: false,
        student_verified: false,
        liveness_verified: false,
      });

    if (profileError) {
      // CRITICAL: Rollback auth user if profile creation fails.
      await supabase.auth.admin.deleteUser(authData.user.id);
      
      // Logger call is now clean and type-safe due to logger.ts fix.
      logger.error('Profile creation failed, rolled back user', { 
        userId: authData.user.id, 
        error: profileError 
      });
      
      return NextResponse.json(
        { success: false, error: 'Profile creation failed' },
        { status: 500 }
      );
    }

    // 6. Create Wallet (for freelancers/both)
    if (['freelancer', 'both'].includes(validatedData.user_type)) {
      try {
        await supabase.from('wallets').insert({
          user_id: authData.user.id,
          balance: 0,
          pending_clearance: 0,
        });
      } catch (walletError) {
        // IMPORTANT: Wallet failure is critical for a freelancer. 
        // Log the error but DO NOT roll back the user, as they might be able to manually fix their wallet later.
        // We log with full context and move on.
        logger.error('Wallet creation failed (Non-blocking)', { 
          userId: authData.user.id, 
          error: walletError 
        });
      }
    }

    // 7. Success Logging & Response
    logger.info('User registered successfully', {
      userId: authData.user.id,
      userType: validatedData.user_type,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          user: authData.user,
          session: authData.session,
        },
        message: 'Registration successful. Please check your email to verify your account.',
      },
      { status: 201 }
    );

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

    // Unhandled errors are caught here
    logger.error('Registration unhandled error', error as Error);
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}