// src/lib/supabase/client.ts
// Client-side Supabase singleton instance
// ============================================================================

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { clientEnv } from '@/lib/env';

// Environment variables (extracted for cleaner code)
const supabaseUrl = clientEnv.SUPABASE_URL;
const supabaseAnonKey = clientEnv.SUPABASE_ANON_KEY;

// Singleton instance variable - only held in memory on client-side
let supabaseInstance: unknown = null;

/**
 * Creates or returns the existing Supabase client instance (singleton pattern)
 * Only caches on client-side (browser environment)
 */
export function createClient() {
  // Return existing instance if running in browser and instance exists
  if (typeof window !== 'undefined' && supabaseInstance !== null) {
    return supabaseInstance;
  }

  // Create new client instance
  const client = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  // Cache instance only on client-side
  if (typeof window !== 'undefined') {
    supabaseInstance = client;
  }

  return client;
}

// ✅ SINGLETON: Export pre-instantiated client for direct imports
// Usage: import { supabase } from '@/lib/supabase/client'
export const supabase = createClient();