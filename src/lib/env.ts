// src/lib/env.ts
// Runtime environment variable validation.
//
// FIX 1 (prev session): Server-critical secrets are required fields.
// FIX 2 (prev session): serverEnv is lazy-getter backed by single Zod parse.
// FIX 3 (this session): UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
//   added to _serverSchema. They were missing from boot-time validation — a
//   deployment with no Redis credentials would pass startup cleanly then throw
//   inside the first rate-limited route handler.

import { z } from 'zod';

// ── Schemas ──────────────────────────────────────────────────────────────────

const _publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL:             z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY:        z.string().min(1),
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME:    z.string().min(1),
  NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET: z.string().min(1),
  NEXT_PUBLIC_APP_URL:                  z.string().url(),
  NEXT_PUBLIC_APP_NAME:                 z.string().min(1),
  NEXT_PUBLIC_FLUTTERWAVE_ENV:          z.enum(['test', 'live']),
  NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY:   z.string().min(1).optional(),
});

const _serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY:  z.string().min(1),
  FLUTTERWAVE_SECRET_KEY:     z.string().min(1),
  FLUTTERWAVE_WEBHOOK_SECRET: z.string().min(1),
  FLUTTERWAVE_BASE_URL:       z.string().url().default('https://api.flutterwave.com'),
  CLOUDINARY_API_KEY:         z.string().min(1),
  CLOUDINARY_API_SECRET:      z.string().min(1),
  UPSTASH_REDIS_REST_URL:     z.string().url(),    // required — rate limiter fails without it
  UPSTASH_REDIS_REST_TOKEN:   z.string().min(1),   // required — rate limiter fails without it
});

type ServerEnvShape = z.infer<typeof _serverSchema>;

// ── Server env: lazy, cached, single Zod parse ───────────────────────────────

let _serverCache: ServerEnvShape | null = null;

function _getServerEnv(): ServerEnvShape {
  if (_serverCache) return _serverCache;

  const result = _serverSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(
      `[env] Missing or invalid server environment variables:\n` +
      JSON.stringify(result.error.flatten().fieldErrors, null, 2)
    );
  }

  _serverCache = result.data;
  return _serverCache;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Validates all server environment variables and returns the typed result.
 * Throws with field-level detail on failure.
 */
export function validateServerEnv() {
  return _getServerEnv();
}

/**
 * Client-safe environment variables.
 * Next.js inlines NEXT_PUBLIC_ values at build time. Use process.env directly
 * here — Zod parse must not run in the browser where process.env is a stub.
 */
export const clientEnv = {
  SUPABASE_URL:             process.env.NEXT_PUBLIC_SUPABASE_URL!,
  SUPABASE_ANON_KEY:        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  CLOUDINARY_CLOUD_NAME:    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!,
  CLOUDINARY_UPLOAD_PRESET: process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!,
  APP_URL:                  process.env.NEXT_PUBLIC_APP_URL!,
  APP_NAME:                 process.env.NEXT_PUBLIC_APP_NAME || 'F9',
  FLUTTERWAVE_ENV:          process.env.NEXT_PUBLIC_FLUTTERWAVE_ENV as 'test' | 'live',
  FLUTTERWAVE_PUBLIC_KEY:   process.env.NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY,
  IS_PRODUCTION:            process.env.NODE_ENV === 'production',
  IS_DEVELOPMENT:           process.env.NODE_ENV === 'development',
} as const;

/**
 * Server-only environment variables.
 * Each property is a getter over the single Zod-parsed result — accessing any
 * field when its variable is absent throws immediately with context.
 * NEVER import in client components.
 */
export const serverEnv = {
  get SUPABASE_SERVICE_ROLE_KEY()  { return _getServerEnv().SUPABASE_SERVICE_ROLE_KEY; },
  get FLUTTERWAVE_SECRET_KEY()     { return _getServerEnv().FLUTTERWAVE_SECRET_KEY; },
  get FLUTTERWAVE_WEBHOOK_SECRET() { return _getServerEnv().FLUTTERWAVE_WEBHOOK_SECRET; },
  get FLUTTERWAVE_BASE_URL()       { return _getServerEnv().FLUTTERWAVE_BASE_URL; },
  get CLOUDINARY_API_KEY()         { return _getServerEnv().CLOUDINARY_API_KEY; },
  get CLOUDINARY_API_SECRET()      { return _getServerEnv().CLOUDINARY_API_SECRET; },
  get UPSTASH_REDIS_REST_URL()     { return _getServerEnv().UPSTASH_REDIS_REST_URL; },
  get UPSTASH_REDIS_REST_TOKEN()   { return _getServerEnv().UPSTASH_REDIS_REST_TOKEN; },
};

// Boot-time validation — server only, skipped in client bundle.
if (typeof window === 'undefined') {
  try {
    _getServerEnv();
    console.log('✅ Environment variables validated');
  } catch (error) {
    console.error('Environment validation failed:', error);
    if (process.env.NODE_ENV === 'production') throw error;
  }
}