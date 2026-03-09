// src/app/api/auth/register/route.ts
// Optimized Registration: Professional, secure, and ready for progressive verification.
// Profile + wallet creation is handled atomically by the on_auth_user_created DB trigger.

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
    // All registration metadata is passed via options.data so the
    // on_auth_user_created trigger can read from raw_user_meta_data
    // and atomically create the profile + wallet in the same transaction.
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: validatedData.email,
      password: validatedData.password,
      options: {
        data: {
          full_name: validatedData.full_name,
          phone_number: validatedData.phone_number,
          user_type: validatedData.user_type,
          university: validatedData.university || null,
          location: validatedData.location,
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

    // 5. Success Logging & Response
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

    logger.error('Registration unhandled error', error as Error);

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}