// src/app/api/storage/get/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { applyMiddleware } from '@/lib/api/enhanced-middleware';
import { createClient } from '@/lib/supabase/server';

// Define a type for the expected user object from applyMiddleware
// You might need to adjust this type based on what applyMiddleware returns
type User = {
  id: string; // Assuming 'user.id' is a string
  // ... other user properties
};

// Define a type for the enhanced-middleware result
type MiddlewareResult = {
  user?: User; // 'user' can be undefined if 'auth: required' fails
  error: NextResponse | null; // The error response from middleware, or null
};

export async function POST(request: NextRequest) {
  try {
    const middlewareResult = (await applyMiddleware(request, {
      auth: 'required',
      rateLimit: 'api',
    })) as MiddlewareResult; // Cast the result

    if (middlewareResult.error) {
      return middlewareResult.error;
    }
    
    // Type Narrowing: If error is null, 'user' must be defined because 'auth: required' was set.
    // We can confidently assert that 'user' exists here.
    const user = middlewareResult.user as User;

    const { key, shared } = await request.json();

    const supabase = await createClient();
    const { data, error: queryError } = await supabase
      .from('artifact_storage')
      .select('*')
      .eq('key', key)
      .eq('shared', shared || false)
      // The logic here is complex and can be simplified for safety and clarity:
      // 1. If 'shared' is true, check that the record 'shared' column is true.
      // 2. If 'shared' is false (or undefined/null), check that 'user_id' matches the authenticated user's ID.
      .eq(shared ? 'shared' : 'user_id', shared ? true : user.id)
      .single();

    if (queryError) throw queryError;

    return NextResponse.json({ key: data.key, value: data.value, shared: data.shared });
  } catch (error) { // Removed ': any'
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 404 });
  }
}