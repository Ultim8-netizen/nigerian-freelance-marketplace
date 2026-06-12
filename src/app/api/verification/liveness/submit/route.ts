// src/app/api/verification/liveness/submit/route.ts
//
// FIX applied:
//  Notification INSERT was using the user-session supabase client.
//  The notifications table has SELECT and UPDATE policies for authenticated
//  users but NO INSERT policy. The insert was silently dropped by RLS on
//  every verification — meaning users never received their "You're Verified"
//  notification. The notification step now uses createAdminClient() to
//  bypass RLS with the service role key.
//
// All other operations remain on the user-session client because their
// RLS policies are correctly configured:
//   • liveness_verifications INSERT: Users can create own liveness verifications ✓
//   • profiles UPDATE: Users can update own profile ✓
//   • add_trust_score_event RPC: SECURITY DEFINER ✓

import { NextRequest, NextResponse } from 'next/server';
import { createClient }              from '@/lib/supabase/server';
import { createAdminClient }         from '@/lib/supabase/admin';
import { logger }                    from '@/lib/logger';
import { Ratelimit }                 from '@upstash/ratelimit';
import { Redis }                     from '@upstash/redis';
import { z }                         from 'zod';

// ── Rate limiter ──────────────────────────────────────────────────────────────

const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// 3 verification attempts per 24 hours per user.
const ratelimit = new Ratelimit({
  redis,
  limiter:   Ratelimit.slidingWindow(3, '24 h'),
  analytics: true,
  prefix:    'liveness_verification',
});

// ── Validation schema ─────────────────────────────────────────────────────────

const livenessSubmissionSchema = z.object({
  videoId: z.string().uuid('Invalid video ID format'),
  challenges: z
    .array(
      z.object({
        type:      z.enum(['head_turn', 'blink', 'smile', 'head_nod']),
        direction: z.string().optional(),
        count:     z.number().optional(),
      })
    )
    .min(1, 'At least one challenge required')
    .max(5, 'Too many challenges'),
  faceDetected:        z.boolean(),
  allChallengesPassed: z.boolean(),
  faceConfidence:      z.number().min(0).max(1),
  timestamp:           z.number(),
});

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // ── 1. Authentication ────────────────────────────────────────────────────
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      logger.warn('Liveness verification attempted without authentication');
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // ── 2. Rate limiting ─────────────────────────────────────────────────────
    const identifier = `user:${user.id}`;
    const { success: rateLimitSuccess, limit, remaining, reset } =
      await ratelimit.limit(identifier);

    if (!rateLimitSuccess) {
      const resetDate = new Date(reset);
      logger.warn('Rate limit exceeded for liveness verification', {
        userId:  user.id,
        resetAt: resetDate.toISOString(),
      });

      return NextResponse.json(
        {
          success: false,
          error:   'Too many verification attempts',
          message: `You have used all 3 verification attempts. Please try again after ${resetDate.toLocaleString()}.`,
          rateLimit: { limit, remaining, reset: resetDate.toISOString() },
        },
        { status: 429 }
      );
    }

    logger.info('Rate limit check passed', { userId: user.id, remaining, limit });

    // ── 3. Request validation ────────────────────────────────────────────────
    const body      = await request.json();
    const validated = livenessSubmissionSchema.parse(body);

    // ── 4. Already-verified check ────────────────────────────────────────────
    const { data: profile } = await supabase
      .from('profiles')
      .select('liveness_verified, full_name')
      .eq('id', user.id)
      .single();

    if (profile?.liveness_verified) {
      logger.info('User already verified, skipping', { userId: user.id });
      return NextResponse.json(
        {
          success: false,
          error:   'Already verified',
          message: 'You are already verified. No need to verify again.',
        },
        { status: 400 }
      );
    }

    // ── 5. Replay-attack prevention (5-minute timestamp window) ─────────────
    const timeDiff      = Date.now() - validated.timestamp;
    const FIVE_MINUTES  = 5 * 60 * 1000;

    if (timeDiff > FIVE_MINUTES || timeDiff < 0) {
      logger.warn('Verification timestamp invalid', { userId: user.id, timeDiff });
      return NextResponse.json(
        {
          success: false,
          error:   'Verification expired',
          message: 'Verification session expired. Please try again.',
        },
        { status: 400 }
      );
    }

    // ── 6. Face quality gates ────────────────────────────────────────────────
    if (!validated.faceDetected) {
      logger.info('Verification failed: No face detected', { userId: user.id });
      return NextResponse.json(
        {
          success: false,
          error:   'No face detected',
          message: 'We could not detect a face in your video. Please ensure good lighting and try again.',
        },
        { status: 400 }
      );
    }

    if (!validated.allChallengesPassed) {
      logger.info('Verification failed: Challenges not completed', { userId: user.id });
      return NextResponse.json(
        {
          success: false,
          error:   'Challenges incomplete',
          message: 'Not all challenges were completed successfully. Please try again.',
        },
        { status: 400 }
      );
    }

    if (validated.faceConfidence < 0.7) {
      logger.info('Verification failed: Low confidence', {
        userId:     user.id,
        confidence: validated.faceConfidence,
      });
      return NextResponse.json(
        {
          success: false,
          error:   'Low confidence',
          message:
            'Face detection confidence too low. Please ensure your face is clearly visible and try again.',
        },
        { status: 400 }
      );
    }

    // ── 7. Atomic database writes ────────────────────────────────────────────

    // Step 1: Store verification record
    // liveness_verifications has: INSERT WITH CHECK (user_id = auth.uid()) ✓
    const { data: verification, error: verifyError } = await supabase
      .from('liveness_verifications')
      .insert({
        user_id:              user.id,
        video_id:             validated.videoId,
        challenges:           validated.challenges,
        face_detected:        validated.faceDetected,
        all_challenges_passed: validated.allChallengesPassed,
        face_confidence:      validated.faceConfidence,
        verification_status:  'approved',
        verified_at:          new Date().toISOString(),
      })
      .select()
      .single();

    if (verifyError) {
      logger.error('Failed to store verification record', verifyError, { userId: user.id });
      throw verifyError;
    }

    // Step 2: Update profile
    // profiles has: UPDATE USING (auth.uid() = id) ✓
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        liveness_verified:    true,
        liveness_verified_at: new Date().toISOString(),
        identity_verified:    true,
      })
      .eq('id', user.id);

    if (profileError) {
      logger.error('Failed to update profile', profileError, { userId: user.id });
      throw profileError;
    }

    // Step 3: Award trust score (SECURITY DEFINER — user session client is fine)
    const { error: trustError } = await supabase.rpc('add_trust_score_event', {
      p_user_id:              user.id,
      p_event_type:           'liveness_verified',
      p_score_change:         25,
      p_related_entity_type:  'verification',
      p_related_entity_id:    verification.id,
      p_notes:                'Completed liveness verification successfully',
    });

    if (trustError) {
      // Non-fatal — user is still verified even if trust score fails.
      logger.error('Failed to award trust score', trustError, { userId: user.id });
    }

    // Step 4: Send notification
    // FIX: notifications has no user INSERT policy — use adminClient (service role).
    const adminClient = createAdminClient();
    const { error: notificationError } = await adminClient.from('notifications').insert({
      user_id:         user.id,
      type:            'verification_success',
      title:           "🎉 You're Verified!",
      message:         'Your identity has been verified. You now have a verified badge on your profile.',
      link:            '/dashboard/profile',
      delivery_method: 'both',
    });

    if (notificationError) {
      // Non-fatal — verification is complete; notify failure is a UX issue only.
      logger.warn('Failed to insert verification notification', {
        userId: user.id,
        error:  notificationError.message,
      });
    }

    // ── 8. Success ───────────────────────────────────────────────────────────
    logger.info('Liveness verification approved', {
      userId:           user.id,
      verificationId:   verification.id,
      trustScoreAwarded: !trustError,
    });

    return NextResponse.json({
      success: true,
      message: 'Verification successful',
      data: {
        verified:         true,
        trustScoreAwarded: 25,
        verificationId:   verification.id,
      },
      rateLimit: { limit, remaining: remaining - 1 },
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Liveness verification validation failed', { errors: error.issues });
      return NextResponse.json(
        {
          success: false,
          error:   'Invalid verification data',
          details: error.issues[0]?.message ?? 'Validation failed',
        },
        { status: 400 }
      );
    }

    logger.error('Liveness verification error', error as Error);
    return NextResponse.json(
      {
        success: false,
        error:   'Verification failed',
        message: 'Something went wrong. Please try again.',
      },
      { status: 500 }
    );
  }
}