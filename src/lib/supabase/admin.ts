// src/lib/supabase/admin.ts
// Service-role Supabase client — bypasses RLS.
// USE ONLY in server-side API routes for operations that legitimately require
// cross-user data access (e.g. device fingerprint cross-reference) or writes
// to tables with no user-facing INSERT policy (e.g. security_logs).
// Never import this in client components or expose the service role key.

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

export function createAdminClient() {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'createAdminClient: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set'
    );
  }

  return createSupabaseClient<Database>(url, key, {
    auth: {
      // Disable auto session persistence — this client is request-scoped
      persistSession:     false,
      autoRefreshToken:   false,
      detectSessionInUrl: false,
    },
  });
}