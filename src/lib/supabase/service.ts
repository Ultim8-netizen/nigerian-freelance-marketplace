// src/lib/supabase/service.ts
//
// Service role client — bypasses ALL RLS policies.
//
// RULES:
//   1. NEVER import this in any file that runs client-side or in API routes
//      that serve authenticated user requests. Use createClient() for those.
//   2. ONLY use this for:
//      - Cron jobs (automation routes called by the scheduler)
//      - Server-to-server webhooks (e.g. Flutterwave webhook handler)
//      - Background tasks that have no user session
//   3. NEVER expose SUPABASE_SERVICE_ROLE_KEY in any client bundle.
//      This key has full database access with zero row-level restrictions.

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types';

export function createServiceClient() {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      '[createServiceClient] NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set. ' +
      'Add SUPABASE_SERVICE_ROLE_KEY to your .env.local (never prefix it with NEXT_PUBLIC_).'
    );
  }

  return createClient<Database>(url, key, {
    auth: {
      // Disable auto session refresh — there is no user session in cron context
      autoRefreshToken:    false,
      persistSession:      false,
      detectSessionInUrl:  false,
    },
  });
}