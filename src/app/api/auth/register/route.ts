// src/app/api/auth/register/route.ts
// Optimized Registration: Professional, secure, and ready for progressive verification.
// Profile + wallet creation is handled atomically by the on_auth_user_created DB trigger.
// UPDATED: Post-registration shared-IP fraud check wired in (fire-and-forget).
//          Spec Part 2b: "Same device/IP on two accounts → flag both. No auto-action.
//          Queue for admin review." If a new registrant's IP already appears in
//          user_devices under a different user_id, a 'high'-severity security_logs
//          entry is written for both the new account and each conflicting account so
//          they surface in the Admin Flags & Tickets queue.

import { NextRequest, NextResponse } from 'next/server';
import { applyMiddleware }           from '@/lib/api/enhanced-middleware';
import { createClient }              from '@/lib/supabase/server';
import { createAdminClient }         from '@/lib/supabase/admin';
import { registerSchema }            from '@/lib/validations';
import { checkSharedIpAddress }      from '@/lib/security/fraud-detection';
import { z }                         from 'zod';
import { logger }                    from '@/lib/logger';
import type { Json }                 from '@/types/database.types';

export async function POST(request: NextRequest) {
  try {
    // 1. Rate Limiting
    const { error: rateLimitError } = await applyMiddleware(request, {
      auth:      'optional',
      rateLimit: 'register',
    });

    if (rateLimitError) return rateLimitError;

    // 2. Validation
    const body          = await request.json();
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
      email:    validatedData.email,
      password: validatedData.password,
      options: {
        data: {
          full_name:    validatedData.full_name,
          phone_number: validatedData.phone_number,
          user_type:    validatedData.user_type,
          university:   validatedData.university || null,
          location:     validatedData.location,
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

    const newUserId = authData.user.id;

    // 5. Success Logging & Response
    logger.info('User registered successfully', {
      userId:   newUserId,
      userType: validatedData.user_type,
    });

    // 6. Post-registration shared-IP fraud check (fire-and-forget)
    // Runs after the response is constructed — failures are fully non-fatal
    // and must never delay or block a valid registration.
    //
    // Uses admin client for two reasons:
    //   a) user_devices cross-user reads require service role (own-user RLS)
    //   b) security_logs has no user INSERT policy
    //
    // The new user's IP is recorded in user_devices so future registrations
    // from the same IP are cross-referenceable.
    const ip = (
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown'
    );

    void flagSharedIpOnRegistration({ userId: newUserId, ip });

    return NextResponse.json(
      {
        success: true,
        data: {
          user:    authData.user,
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
          error:   error.issues[0].message,
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

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Registers the new user's IP in user_devices, then cross-references it against
 * all existing rows. If any other user_id shares this IP, inserts a 'high'-severity
 * security_logs entry for the new account AND each conflicting account so both
 * surface in the Admin Flags & Tickets queue.
 *
 * Spec: "Same device/IP on two accounts → flag both. No auto-action."
 *
 * All errors are caught and logged — this function is always fire-and-forget.
 */
async function flagSharedIpOnRegistration({
  userId,
  ip,
}: {
  userId: string;
  ip:     string;
}): Promise<void> {
  try {
    const adminClient = createAdminClient();
    const now         = new Date().toISOString();

    // Record IP for this new user — upsert is safe if trigger already inserted a row.
    // device_fingerprint is namespaced with 'ip:' to avoid collisions with any
    // real browser fingerprints that may be stored in the same column.
    const { error: upsertError } = await adminClient
      .from('user_devices')
      .upsert(
        {
          user_id:            userId,
          device_fingerprint: `ip:${ip}`,
          ip_address:         ip as unknown,
          first_seen_at:      now,
          last_seen_at:       now,
        },
        {
          onConflict:       'device_fingerprint,user_id',
          ignoreDuplicates: false,
        }
      );

    if (upsertError) {
      logger.error('user_devices upsert failed on registration fraud check', upsertError, { userId });
      // Continue — the cross-reference check can still run against existing rows
    }

    // Cross-reference: find other users who registered from the same IP
    const conflictingUserIds = await checkSharedIpAddress(adminClient, userId, ip);

    if (conflictingUserIds.length === 0) return;

    logger.warn('Shared IP detected at registration — flagging both sides', {
      userId,
      conflictingUserIds,
      ip,
    });

    // Build security_log rows — one for the new account, one per conflicting account.
    // Flagging both sides satisfies the spec: "flag both".
    const logRows = [
      {
        user_id:     userId,
        event_type:  'shared_ip_on_registration',
        severity:    'high',
        ip_address:  ip as unknown,
        description: `New account registered from an IP address already associated with ${conflictingUserIds.length} existing account(s). No automatic action taken — queued for admin review.`,
        metadata:    {
          conflicting_user_ids: conflictingUserIds,
          event:                'registration',
        } as Json,
      },
      ...conflictingUserIds.map((conflictId) => ({
        user_id:     conflictId,
        event_type:  'shared_ip_on_registration',
        severity:    'high',
        ip_address:  ip as unknown,
        description: `A new account (${userId}) registered from this account's IP address. No automatic action taken — queued for admin review.`,
        metadata:    {
          new_user_id: userId,
          event:       'registration',
        } as Json,
      })),
    ];

    const { error: logError } = await adminClient
      .from('security_logs')
      .insert(logRows);

    if (logError) {
      logger.error('security_logs insert failed for shared-IP flag on registration', logError, {
        userId,
        conflictingUserIds,
      });
    }
  } catch (err) {
    logger.error('Unexpected error in flagSharedIpOnRegistration', err as Error, { userId });
  }
}