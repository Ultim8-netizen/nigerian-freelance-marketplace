// src/app/api/storage/list/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { authenticatedApi } from '@/lib/api/enhanced-middleware';
import { createClient } from '@/lib/supabase/server';

// Next.js API Routes use GET/POST/PUT/DELETE, not POST_LIST.
// Using POST since we're reading from the request body.
export async function POST(request: NextRequest) {
  try {
    // --- Middleware Application ---

    const authResult = await authenticatedApi(request);
    if (authResult.error) {
      // Return 401 (auth) or 429 (rate limit) response
      return authResult.error;
    }
    const user = authResult.user!; // Authenticated user is available here

    // --- Start API Logic ---

    // Safely parse the request body
    const { prefix, shared } = await request.json();

    const supabase = await createClient();

    // Define the type for the returned data to fix error 7006
    type ArtifactKey = { key: string };

    let query = supabase
      .from('artifact_storage')
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
      keys: data.map((d: ArtifactKey) => d.key),
      prefix,
      shared: shared || false,
    });
  } catch (error) {
    console.error('API Error in /storage/list:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}