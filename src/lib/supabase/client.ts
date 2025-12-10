// src/lib/supabase/client.ts - FIXED VERSION
// Client-side Supabase instance for browser operations
// ============================================================================

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { clientEnv } from '@/lib/env'; // ✅ FIXED: Use clientEnv instead of env

const supabaseUrl = clientEnv.SUPABASE_URL;
const supabaseAnonKey = clientEnv.SUPABASE_ANON_KEY;

export function createClient() {
  return createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

// Optional: singleton instance
export const supabase = createClient();