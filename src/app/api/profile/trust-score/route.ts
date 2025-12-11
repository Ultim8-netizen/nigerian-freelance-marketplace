// src/app/api/profile/trust-score/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { applyMiddleware } from '@/lib/api/enhanced-middleware';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await applyMiddleware(request, {
      auth: 'required',
      rateLimit: 'api',
    });

    if (error) return error;

    const supabase = createClient();

    // Get profile with trust data
    const { data: profile } = await supabase
      .from('profiles')
      .select('trust_score, trust_level, total_jobs_completed, freelancer_rating')
      .eq('id', user.id)
      .single();

    // Get recent trust score events
    const { data: events } = await supabase
      .from('trust_score_events')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    // Get requirements for next level
    const { data: requirements } = await supabase
      .rpc('get_trust_level_requirements', { 
        p_trust_level: getNextLevel(profile?.trust_level) 
      });

    return NextResponse.json({
      success: true,
      data: {
        currentScore: profile?.trust_score || 0,
        currentLevel: profile?.trust_level || 'new',
        totalJobsCompleted: profile?.total_jobs_completed || 0,
        rating: profile?.freelancer_rating || 0,
        recentEvents: events || [],
        nextLevel: requirements?.[0] || null,
      },
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch trust score',
    }, { status: 500 });
  }
}

function getNextLevel(currentLevel?: string): string {
  const levels = ['new', 'verified', 'trusted', 'top_rated', 'elite'];
  const currentIndex = levels.indexOf(currentLevel || 'new');
  return levels[Math.min(currentIndex + 1, levels.length - 1)];
}