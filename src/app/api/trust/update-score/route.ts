// src/app/api/trust/update-score/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const schema = z.object({
  user_id:              z.string().uuid(),
  event_type:           z.string(),
  score_change:         z.number().int(),
  related_entity_type:  z.string().optional(),
  related_entity_id:    z.string().uuid().optional(),
  notes:                z.string().optional(),
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

    // Security: this endpoint is for self-service trust events only.
    // Cross-user mutations (admin actions, cron jobs, DB triggers) must use
    // createServiceClient().rpc('add_trust_score_event', ...) directly on the
    // server — they must never route through this public endpoint.
    if (validated.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Optional params use ?? undefined — never null — to satisfy RPC arg types
    const { error } = await supabase.rpc('add_trust_score_event', {
      p_user_id:             validated.user_id,
      p_event_type:          validated.event_type,
      p_score_change:        validated.score_change,
      p_related_entity_type: validated.related_entity_type ?? undefined,
      p_related_entity_id:   validated.related_entity_id   ?? undefined,
      p_notes:               validated.notes               ?? undefined,
    });

    if (error) {
      console.error('Trust score update error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // user.id === validated.user_id is guaranteed above — own-user RLS satisfied
    const { data: profile } = await supabase
      .from('profiles')
      .select('trust_score, trust_level')
      .eq('id', user.id)
      .single();

    return NextResponse.json({
      success:  true,
      newScore: profile?.trust_score ?? 0,
      newLevel: profile?.trust_level ?? 'new',
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