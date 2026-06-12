// src/app/api/auth/register/route.ts
//
// FIX applied:
//  The user_devices upsert used onConflict: 'device_fingerprint,user_id'.
//  The live schema has NO UNIQUE constraint on (device_fingerprint, user_id)
//  — only a primary key on id. PostgreSQL rejects upsert when no matching
//  unique/exclusion constraint exists, so every registration threw an error
//  inside flagSharedIpOnRegistration, silently aborting the fraud check.
//
//  Fix: replaced the upsert with an explicit check-then-insert pattern.
//  This works correctly regardless of whether a unique constraint is added
//  later, and avoids the PostgreSQL "no unique constraint" error.
//
// All other logic is unchanged.

import { NextRequest, NextResponse }                    from 'next/server';
import { applyMiddleware }                              from '@/lib/api/enhanced-middleware';
import { createClient }                                 from '@/lib/supabase/server';
import { createAdminClient }                            from '@/lib/supabase/admin';
import { registerSchema }                               from '@/lib/validations';
import { checkSharedIpAddress }                         from '@/lib/security/fraud-detection';
import { getPlatformConfigs, CONFIG_KEYS }              from '@/lib/platform-config';
import { z }                                            from 'zod';
import { logger }                                       from '@/lib/logger';
import type { Json }                                    from '@/types/database.types';

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
    // profiles has SELECT: true (public read) so the anon client can check.
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

    // 3b. Referral code validation
    let referredById: string | null = null;

    if (validatedData.referral_code) {
      const { data: referrer } = await supabase
        .from('profiles')
        .select('id')
        .eq('referral_code', validatedData.referral_code)
        .single();

      if (!referrer) {
        return NextResponse.json(
          { success: false, error: 'Invalid referral code provided.' },
          { status: 400 }
        );
      }

      referredById = referrer.id;
    }

    // 4. Create Auth User
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email:    validatedData.email,
      password: validatedData.password,
      options: {
        data: {
          full_name:    validatedData.full_name,
          phone_number: validatedData.phone_number,
          user_type:    validatedData.user_type,
          university:   validatedData.university ?? null,
          location:     validatedData.location,
          referred_by:  referredById,
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

    // 5. Success logging
    logger.info('User registered successfully', {
      userId:      newUserId,
      userType:    validatedData.user_type,
      hasReferral: referredById !== null,
    });

    // 6. Post-registration shared-IP fraud check (fire-and-forget)
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

    const sharedIpEnabled     = config[CONFIG_KEYS.SHARED_IP_CHECK_ENABLED] !== 0;
    const sharedIpMinAccounts = config[CONFIG_KEYS.SHARED_IP_MIN_ACCOUNTS];

    if (sharedIpEnabled) {
      void flagSharedIpOnRegistration({
        userId:      newUserId,
        ip,
        adminClient,
        minAccounts: sharedIpMinAccounts,
      });
    } else {
      logger.info('Shared-IP check skipped — disabled via platform_config', {
        userId: newUserId,
      });
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          user:    authData.user,
          session: authData.session,
        },
        message:
          'Registration successful. Please check your email to verify your account.',
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

// ── Helper ────────────────────────────────────────────────────────────────────

/**
 * Records the new user's registration IP in user_devices, then cross-references
 * it against existing rows. If the number of OTHER accounts sharing this IP meets
 * or exceeds `minAccounts`, inserts a 'high'-severity security_logs entry for
 * the new account AND each conflicting account.
 *
 * FIX: The previous implementation used adminClient.from('user_devices').upsert()
 * with onConflict: 'device_fingerprint,user_id'. The live schema has no UNIQUE
 * constraint on (device_fingerprint, user_id) — only a primary key on id.
 * PostgreSQL raises "there is no unique or exclusion constraint matching the
 * ON CONFLICT specification", silently aborting the entire fraud check.
 *
 * The fix uses an explicit SELECT-then-INSERT-or-UPDATE pattern which is safe
 * regardless of constraint state and matches the intended logic exactly.
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
    const now               = new Date().toISOString();
    const deviceFingerprint = `ip:${ip}`;

    // ── FIX: check-then-insert instead of broken upsert ───────────────────
    const { data: existingDevice, error: selectError } = await adminClient
      .from('user_devices')
      .select('id')
      .eq('user_id', userId)
      .eq('device_fingerprint', deviceFingerprint)
      .single();

    if (selectError && selectError.code !== 'PGRST116') {
      // PGRST116 = row not found — that's expected on first registration.
      // Any other error is a real problem; log and continue to cross-reference.
      logger.error('user_devices select failed on registration fraud check', selectError, {
        userId,
      });
    }

    if (existingDevice) {
      // Row exists — update last_seen_at only.
      const { error: updateError } = await adminClient
        .from('user_devices')
        .update({ last_seen_at: now })
        .eq('id', existingDevice.id);

      if (updateError) {
        logger.error('user_devices update failed on registration fraud check', updateError, {
          userId,
        });
      }
    } else {
      // Row does not exist — insert.
      const { error: insertError } = await adminClient.from('user_devices').insert({
        user_id:            userId,
        device_fingerprint: deviceFingerprint,
        ip_address:         ip as unknown,
        first_seen_at:      now,
        last_seen_at:       now,
      });

      if (insertError) {
        logger.error('user_devices insert failed on registration fraud check', insertError, {
          userId,
        });
        // Continue — the cross-reference check can still run against existing rows.
      }
    }

    // ── Cross-reference: find other users who share this IP ──────────────
    const conflictingUserIds = await checkSharedIpAddress(adminClient, userId, ip);

    if (conflictingUserIds.length < minAccounts) return;

    logger.warn('Shared IP detected at registration — flagging both sides', {
      userId,
      conflictingUserIds,
      ip,
      minAccounts,
    });

    // Flag the new account AND each conflicting account.
    const logRows = [
      {
        user_id:     userId,
        event_type:  'shared_ip_on_registration',
        severity:    'high',
        ip_address:  ip as unknown,
        description: `New account registered from an IP address already associated with ${conflictingUserIds.length} existing account(s). No automatic action taken — queued for admin review.`,
        metadata: {
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
        metadata: {
          new_user_id:         userId,
          event:               'registration',
          min_accounts_config: minAccounts,
        } as Json,
      })),
    ];

    const { error: logError } = await adminClient.from('security_logs').insert(logRows);

    if (logError) {
      logger.error(
        'security_logs insert failed for shared-IP flag on registration',
        logError,
        { userId, conflictingUserIds }
      );
    }
  } catch (err) {
    logger.error('Unexpected error in flagSharedIpOnRegistration', err as Error, { userId });
  }
}