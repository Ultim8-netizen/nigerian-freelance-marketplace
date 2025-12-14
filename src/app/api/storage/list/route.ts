// src/app/api/storage/list/route.ts
// FIX 1 & 4: Import NextRequest and NextResponse
import { NextRequest, NextResponse } from 'next/server';
// FIX 2: Import the actual exported middleware functions
import { 
  requireAuth, 
  withRateLimit, 
  RateLimiterType 
} from '@/lib/api/middleware'; 
// FIX 3: Import createClient
import { createClient } from '@/lib/supabase/server';

const API_LIMITER_TYPE: RateLimiterType = 'api'; // Define the limiter type

// Next.js API Routes use GET/POST/PUT/DELETE, not POST_LIST. 
// Assuming you intended to use POST since you are reading from the request body.
export async function POST(request: NextRequest) {
  try {
    // --- Middleware Application ---
    
    // 1. Apply Rate Limiting
    const rateLimitResponse = await withRateLimit(API_LIMITER_TYPE, request);
    if (rateLimitResponse) {
      // Return 429 response if rate-limited
      return rateLimitResponse;
    }

    // 2. Require Authentication
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
      // Return 401 response if unauthorized
      return authResult;
    }
    const { user } = authResult; // Authenticated user is available here

    // --- Start API Logic ---

    // Safely parse the request body
    const { prefix, shared } = await request.json();

    const supabase = await createClient();
    
    // Define the type for the returned data to fix error 7006
    type ArtifactKey = { key: string }; 

    let query = supabase
      .from('artifact_storage')
      // FIX 5: Use the defined type for the select statement
      .select<string, ArtifactKey>('key')
      .eq('shared', shared || false)
      // Enforce ownership: only list keys belonging to the authenticated user
      .eq('user_id', user.id); 

    if (prefix) {
      // Case-insensitive LIKE operator
      query = query.ilike('key', `${prefix}%`);
    }

    const { data, error: queryError } = await query;

    if (queryError) throw queryError;

    return NextResponse.json({
      // FIX 5: Explicitly type the map function's parameter
      keys: data.map((d: ArtifactKey) => d.key), 
      prefix,
      shared: shared || false,
    });
  } catch (error) {
    console.error('API Error in /storage/list:', error);
    // FIX 6 & 7: Catch and handle the error, ensuring correct type usage and status
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}