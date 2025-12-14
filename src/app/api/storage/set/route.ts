// src/app/api/storage/set/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { 
  requireAuth, 
  withRateLimit, 
  RateLimiterType 
} from '@/lib/api/middleware'; 
// Note: createClient should be awaited, so it's a Promise-returning function
import { createClient } from '@/lib/supabase/server'; 

const API_LIMITER_TYPE: RateLimiterType = 'api';

export async function POST(request: NextRequest) {
  try {
    // --- Middleware Application ---
    
    // 1. Apply Rate Limiting
    const rateLimitResponse = await withRateLimit(API_LIMITER_TYPE, request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // 2. Require Authentication
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    // --- Start API Logic ---

    const { key, value, shared } = await request.json();

    // FIX 1: AWAIT the createClient() call
    const supabase = await createClient();
    
    // Define the type for the returned data
    // Assuming 'value' can be any JSON type, so we use unknown or any here 
    // unless a stricter type is known for the 'value' column.
    type ArtifactData = { key: string; value: unknown; shared: boolean }; 

    const { data, error: queryError } = await supabase
      .from('artifact_storage')
      .upsert({
        key,
        value,
        shared: shared || false,
        user_id: user.id,
        // Removed 'as any' here. If the table schema is inferred correctly 
        // by TypeScript, this cast is often unnecessary.
      })
      // Use the generic type to hint at the shape of the returned data
      .select<string, ArtifactData>() 
      .single();

    if (queryError) throw queryError;

    // FIX 2: Removed 'as ArtifactData' cast after successful type hinting 
    // and ensuring data exists.
    const result = data; 

    return NextResponse.json({ 
      key: result.key, 
      value: result.value, 
      shared: result.shared 
    });
  } catch (error) {
    console.error('API Error in /storage/set:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}