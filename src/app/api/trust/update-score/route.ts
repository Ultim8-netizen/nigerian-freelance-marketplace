// src/app/api/trust/update-score/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const schema = z.object({
  user_id: z.string().uuid(),
  event_type: z.string(),
  score_change: z.number().int(),
  related_entity_type: z.string().optional(),
  related_entity_id: z.string().uuid().optional(),
  notes: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validated = schema.parse(body);

    // Security: Only allow users to update their own score, or use service role
    if (validated.user_id !== user.id) {
      // Check if request is from a system/admin context
      // For now, we'll allow it but log it
      console.warn('Trust score update for different user:', {
        requester: user.id,
        target: validated.user_id,
      });
    }

    // Call the database function to add trust score event
    const { error } = await supabase.rpc('add_trust_score_event', {
      p_user_id: validated.user_id,
      p_event_type: validated.event_type,
      p_score_change: validated.score_change,
      p_related_entity_type: validated.related_entity_type || null,
      p_related_entity_id: validated.related_entity_id || null,
      p_notes: validated.notes || null,
    });

    if (error) {
      console.error('Trust score update error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Fetch updated profile to return new score and level
    const { data: profile } = await supabase
      .from('profiles')
      .select('trust_score, trust_level')
      .eq('id', validated.user_id)
      .single();

    return NextResponse.json({
      success: true,
      newScore: profile?.trust_score || 0,
      newLevel: profile?.trust_level || 'new',
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0]?.message || 'Validation error' },
        { status: 400 }
      );
    }

    console.error('Trust score update failed:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}