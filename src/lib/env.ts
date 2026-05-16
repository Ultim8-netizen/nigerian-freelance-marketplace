// src/lib/env.ts
// Runtime environment variable validation with proper Next.js conventions

import { z } from 'zod';

const envSchema = z.object({
  // ── Public (client-safe) ──────────────────────────────────────────────────
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: z.string().min(1),
  NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_APP_NAME: z.string().min(1),
  /** "test" | "live" — controls which Flutterwave environment the client targets */
  NEXT_PUBLIC_FLUTTERWAVE_ENV: z.enum(['test', 'live']),
  /** Flutterwave public key (client-safe, used in inline JS SDK if needed) */
  NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY: z.string().min(1).optional(),

  // ── Server-only ───────────────────────────────────────────────────────────
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  /** Flutterwave secret key (server only) */
  FLUTTERWAVE_SECRET_KEY: z.string().min(1).optional(),
  /** Flutterwave webhook secret for signature verification (server only) */
  FLUTTERWAVE_WEBHOOK_SECRET: z.string().min(1).optional(),
  /** Flutterwave base URL — defaults to production endpoint (server only) */
  FLUTTERWAVE_BASE_URL: z.string().url().optional().default('https://api.flutterwave.com'),
  CLOUDINARY_API_KEY: z.string().min(1).optional(),
  CLOUDINARY_API_SECRET: z.string().min(1).optional(),

  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

/**
 * Validates all environment variables at runtime.
 * Call this at the top of API routes or server actions that need Flutterwave.
 */
export function validateServerEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
    throw new Error(
      'Invalid environment variables. Check .env.local against .env.example'
    );
  }

  return parsed.data;
}

/**
 * Client-safe environment variables.
 * Safe to import in client components.
 */
export const clientEnv = {
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  CLOUDINARY_CLOUD_NAME: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!,
  CLOUDINARY_UPLOAD_PRESET: process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!,
  APP_URL: process.env.NEXT_PUBLIC_APP_URL!,
  APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || 'F9',
  /** "test" | "live" */
  FLUTTERWAVE_ENV: process.env.NEXT_PUBLIC_FLUTTERWAVE_ENV as 'test' | 'live',
  FLUTTERWAVE_PUBLIC_KEY: process.env.NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY,
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  IS_DEVELOPMENT: process.env.NODE_ENV === 'development',
} as const;

/**
 * Server-only environment variables.
 * NEVER import this in client components.
 */
export const serverEnv = {
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  FLUTTERWAVE_SECRET_KEY: process.env.FLUTTERWAVE_SECRET_KEY!,
  FLUTTERWAVE_WEBHOOK_SECRET: process.env.FLUTTERWAVE_WEBHOOK_SECRET!,
  FLUTTERWAVE_BASE_URL: process.env.FLUTTERWAVE_BASE_URL || 'https://api.flutterwave.com',
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY!,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET!,
} as const;

// Validate on server startup (skipped on client bundle)
if (typeof window === 'undefined') {
  try {
    validateServerEnv();
    console.log('✅ Environment variables validated');
  } catch (error) {
    console.error('Environment validation failed:', error);
    // Allow hot-reload in development; hard-fail in production
    if (process.env.NODE_ENV === 'production') {
      throw error;
    }
  }
}