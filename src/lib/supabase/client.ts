// src/lib/supabase/client.ts
// Client-side Supabase singleton instance with proper typing
// ============================================================================

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { clientEnv } from '@/lib/env';
import type { Database } from '@/types';

// Environment variables (extracted for cleaner code)
const supabaseUrl = clientEnv.SUPABASE_URL;
const supabaseAnonKey = clientEnv.SUPABASE_ANON_KEY;

// Properly typed singleton instance - only held in memory on client-side
let supabaseInstance: SupabaseClient<Database> | null = null;

/**
 * Creates or returns the existing Supabase client instance (singleton pattern)
 * Only caches on client-side (browser environment)
 * 
 * @returns A properly typed SupabaseClient with Database schema
 */
export function createClient(): SupabaseClient<Database> {
  // Return existing instance if running in browser and instance exists
  if (typeof window !== 'undefined' && supabaseInstance !== null) {
    return supabaseInstance;
  }

  // Create new client instance with Database type
  const client = createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey, {
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