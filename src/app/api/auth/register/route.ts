// src/app/api/auth/register/route.ts
// Optimized Registration: Professional, secure, and ready for progressive verification.
// Profile + wallet creation is handled atomically by the on_auth_user_created DB trigger.
// UPDATED: Post-registration shared-IP fraud check wired in (fire-and-forget).
//          Spec Part 2b: "Same device/IP on two accounts → flag both. No auto-action.
//          Queue for admin review." If a new registrant's IP already appears in
//          user_devices under a different user_id, a 'high'-severity security_logs
//          entry is written for both the new account and each conflicting account so
//          they surface in the Admin Flags & Tickets queue.
//
// CONFIG-DRIVEN: The shared-IP rule is now fully controlled by platform_config:
//   • shared_ip_check_enabled  — On/Off toggle (1 = on, 0 = off).
//   • shared_ip_min_accounts   — Minimum number of conflicting accounts required
//                                before the flag fires. Default: 1.
// Both values are read once per request from the DB (with hardcoded fallbacks)
// before the fire-and-forget is dispatched, so an admin can disable or tune the
// rule without a code deployment.

import { NextRequest, NextResponse } from 'next/server';
import { applyMiddleware }           from '@/lib/api/enhanced-middleware';
import { createClient }              from '@/lib/supabase/server';
import { createAdminClient }         from '@/lib/supabase/admin';
import { registerSchema }            from '@/lib/validations';
import { checkSharedIpAddress }      from '@/lib/security/fraud-detection';
import { getPlatformConfigs, CONFIG_KEYS } from '@/lib/platform-config';
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
    // Config is fetched here (in the request context) using the already-
    // instantiated adminClient so the fire-and-forget closure receives plain
    // booleans/numbers — no async config resolution inside the background task.
    const ip = (
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown'
    );

    const adminClient = createAdminClient();

    const config = await getPlatformConfigs(adminClient, [
      CONFIG_KEYS.SHARED_IP_CHECK_ENABLED,
      CONFIG_KEYS.SHARED_IP_MIN_ACCOUNTS,
    ]);

    // Treat any non-zero value of SHARED_IP_CHECK_ENABLED as enabled.
    const sharedIpEnabled    = config[CONFIG_KEYS.SHARED_IP_CHECK_ENABLED] !== 0;
    const sharedIpMinAccounts = config[CONFIG_KEYS.SHARED_IP_MIN_ACCOUNTS];

    if (sharedIpEnabled) {
      void flagSharedIpOnRegistration({
        userId:      newUserId,
        ip,
        adminClient,
        minAccounts: sharedIpMinAccounts,
      });
    } else {
      logger.info('Shared-IP check skipped — disabled via platform_config', { userId: newUserId });
    }

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
 * all existing rows. If the number of other accounts sharing this IP meets or
 * exceeds `minAccounts`, inserts a 'high'-severity security_logs entry for the
 * new account AND each conflicting account so both surface in the Admin Flags &
 * Tickets queue.
 *
 * Spec: "Same device/IP on two accounts → flag both. No auto-action."
 *
 * The rule is only called when SHARED_IP_CHECK_ENABLED !== 0 (checked by the
 * caller). `minAccounts` maps to the SHARED_IP_MIN_ACCOUNTS platform_config key.
 *
 * All errors are caught and logged — this function is always fire-and-forget.
 */
async function flagSharedIpOnRegistration({
  userId,
  ip,
  adminClient,
  minAccounts,
}: {
  userId:      string;
  ip:          string;
  adminClient: ReturnType<typeof createAdminClient>;
  minAccounts: number;
}): Promise<void> {
  try {
    const now = new Date().toISOString();

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

    // Only fire if the number of conflicting accounts meets the configured threshold.
    if (conflictingUserIds.length < minAccounts) return;

    logger.warn('Shared IP detected at registration — flagging both sides', {
      userId,
      conflictingUserIds,
      ip,
      minAccounts,
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
          min_accounts_config:  minAccounts,
        } as Json,
      },
      ...conflictingUserIds.map((conflictId) => ({
        user_id:     conflictId,
        event_type:  'shared_ip_on_registration',
        severity:    'high',
        ip_address:  ip as unknown,
        description: `A new account (${userId}) registered from this account's IP address. No automatic action taken — queued for admin review.`,
        metadata:    {
          new_user_id:         userId,
          event:               'registration',
          min_accounts_config: minAccounts,
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