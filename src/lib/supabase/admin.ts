// src/lib/supabase/admin.ts
// Canonical service-role Supabase client — bypasses ALL RLS.
//
// This is the single implementation. service.ts re-exports createAdminClient
// as createServiceClient for backward compatibility; do not duplicate the
// implementation there.
//
// USE ONLY server-side for operations that legitimately require cross-user
// data access or writes to admin-only tables (e.g. security_logs,
// platform_config). Never import in client components or expose the key.

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types'; // consistent with service.ts and @/types/index.ts re-export

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'createAdminClient: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set'
    );
  }

  return createSupabaseClient<Database>(url, key, {
    auth: {
      persistSession:     false,
      autoRefreshToken:   false,
      detectSessionInUrl: false,
    },
  });
}