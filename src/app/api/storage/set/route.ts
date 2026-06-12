// src/app/api/storage/set/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { authenticatedApi } from '@/lib/api/enhanced-middleware';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    // --- Middleware Application ---

    const authResult = await authenticatedApi(request);
    if (authResult.error) {
      return authResult.error;
    }
    const user = authResult.user!;

    // --- Start API Logic ---

    const { key, value, shared } = await request.json();

    const supabase = await createClient();

    // Define the type for the returned data
    type ArtifactData = { key: string; value: unknown; shared: boolean };

    const { data, error: queryError } = await supabase
      .from('artifact_storage')
      .upsert({
        key,
        value,
        shared: shared || false,
        user_id: user.id,
      })
      .select<string, ArtifactData>()
      .single();

    if (queryError) throw queryError;

    const result = data;

    return NextResponse.json({
      key: result.key,
      value: result.value,
      shared: result.shared,
    });
  } catch (error) {
    console.error('API Error in /storage/set:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}