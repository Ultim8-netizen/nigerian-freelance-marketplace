// src/app/api/storage/delete/route.ts
import { NextRequest, NextResponse } from 'next/server';
// FIX: Import the functions that ARE exported from the middleware file.
import { 
  requireAuth, 
  withRateLimit, 
  RateLimiterType // Optional, but good practice
} from '@/lib/api/middleware'; 
import { createClient } from '@/lib/supabase/server';

const API_LIMITER_TYPE: RateLimiterType = 'api'; // Use the 'api' limiter

export async function POST(request: NextRequest) {
  try {
    // 1. Apply Rate Limiting
    const rateLimitResponse = await withRateLimit(API_LIMITER_TYPE, request);
    // If the response is not null, it means the request was rate-limited.
    if (rateLimitResponse) {
      // FIX: Ensure rate-limit headers are included in the final response
      // by using the original response.
      return rateLimitResponse;
    }

    // 2. Require Authentication
    const authResult = await requireAuth();
    // Check if requireAuth returned a NextResponse (i.e., failed authentication)
    if (authResult instanceof NextResponse) {
      return authResult; 
    }
    const { user } = authResult; // Now we can safely destructure the user

    // --- Start API Logic ---
    const { key, shared } = await request.json();

    const supabase = await createClient();
    const { error: deleteError } = await supabase
      .from('artifact_storage')
      .delete()
      .eq('key', key)
      // The logic here enforces ownership: 
      // 1. The record must belong to the authenticated user.
      .eq('user_id', user.id) 
      // 2. The 'shared' status must match the provided value (defaulting to false).
      .eq('shared', shared || false);

    if (deleteError) throw deleteError;

    return NextResponse.json({ key, deleted: true, shared: shared || false });
  } catch (error) {
    console.error('DELETE /api/storage error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}