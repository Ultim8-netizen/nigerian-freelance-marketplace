// src/app/api/verification/liveness/submit/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { applyMiddleware } from '@/lib/api/enhanced-middleware';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const livenessSubmissionSchema = z.object({
  videoId: z.string(), // IndexedDB reference
  challenges: z.array(z.object({
    type: z.enum(['head_turn', 'blink', 'smile', 'head_nod']),
    direction: z.string().optional(),
    count: z.number().optional(),
  })),
  faceDetected: z.boolean(),
  allChallengesPassed: z.boolean(),
  faceConfidence: z.number().min(0).max(1),
  timestamp: z.number(),
});

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await applyMiddleware(request, {
      auth: 'required',
      rateLimit: {
        key: 'livenessVerification',
        max: 3, // Max 3 attempts per day
        window: 86400000,
      },
    });

    if (error) return error;

    const body = await request.json();
    const validated = livenessSubmissionSchema.parse(body);

    const supabase = createClient();

    // Check if already verified
    const { data: profile } = await supabase
      .from('profiles')
      .select('liveness_verified')
      .eq('id', user.id)
      .single();

    if (profile?.liveness_verified) {
      return NextResponse.json({
        success: false,
        error: 'Already verified',
      }, { status: 400 });
    }

    // Validate timestamp (prevent replay attacks)
    const timeDiff = Date.now() - validated.timestamp;
    if (timeDiff > 300000 || timeDiff < 0) { // 5 minutes
      return NextResponse.json({
        success: false,
        error: 'Verification expired',
      }, { status: 400 });
    }

    // Basic validation checks
    if (!validated.faceDetected || !validated.allChallengesPassed) {
      return NextResponse.json({
        success: false,
        error: 'Verification checks failed',
      }, { status: 400 });
    }

    if (validated.faceConfidence < 0.7) {
      return NextResponse.json({
        success: false,
        error: 'Face confidence too low',
      }, { status: 400 });
    }

    // Store verification record (without video data)
    const { data: verification, error: verifyError } = await supabase
      .from('liveness_verifications')
      .insert({
        user_id: user.id,
        video_id: validated.videoId,
        challenges: validated.challenges,
        face_detected: validated.faceDetected,
        all_challenges_passed: validated.allChallengesPassed,
        face_confidence: validated.faceConfidence,
        verification_status: 'approved', // Auto-approve based on checks
        verified_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (verifyError) throw verifyError;

    // Update profile
    await supabase
      .from('profiles')
      .update({
        liveness_verified: true,
        liveness_verified_at: new Date().toISOString(),
        identity_verified: true, // Mark as identity verified
      })
      .eq('id', user.id);

    // Award trust score
    await supabase.rpc('add_trust_score_event', {
      p_user_id: user.id,
      p_event_type: 'liveness_verified',
      p_score_change: 25,
      p_related_entity_type: 'verification',
      p_related_entity_id: verification.id,
      p_notes: 'Completed liveness verification',
    });

    // Send notification
    await supabase.from('notifications').insert({
      user_id: user.id,
      type: 'verification_success',
      title: '🎉 You\'re Verified!',
      message: 'Your identity has been verified. You now have a verified badge.',
      link: '/dashboard/profile',
    });

    logger.info('Liveness verification approved', { 
      userId: user.id, 
      verificationId: verification.id 
    });

    return NextResponse.json({
      success: true,
      message: 'Verification successful',
      data: {
        verified: true,
        trustScoreAwarded: 25,
      },
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: error.errors[0]?.message || 'Invalid data',
      }, { status: 400 });
    }

    logger.error('Liveness verification error', error as Error);
    return NextResponse.json({
      success: false,
      error: 'Verification failed',
    }, { status: 500 });
  }
}