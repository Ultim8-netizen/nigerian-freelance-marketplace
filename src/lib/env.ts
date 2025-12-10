// src/lib/env.ts - FIXED VERSION
// Runtime environment variable validation with proper Next.js conventions

import { z } from 'zod';

// Define schema for runtime validation
const envSchema = z.object({
  // Public (client-side) variables
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY: z.string().min(1),
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: z.string().min(1),
  NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_APP_NAME: z.string().min(1),
  
  // Server-only variables (optional for client)
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  FLUTTERWAVE_SECRET_KEY: z.string().min(1).optional(),
  FLUTTERWAVE_ENCRYPTION_KEY: z.string().min(1).optional(),
  CLOUDINARY_API_KEY: z.string().min(1).optional(),
  CLOUDINARY_API_SECRET: z.string().min(1).optional(),
  
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

/**
 * Validates environment variables at runtime
 * Call this in API routes or server components
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
 * Client-safe environment variables
 * Use this in client components
 */
export const clientEnv = {
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  FLUTTERWAVE_PUBLIC_KEY: process.env.NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY!,
  CLOUDINARY_CLOUD_NAME: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!,
  CLOUDINARY_UPLOAD_PRESET: process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!,
  APP_URL: process.env.NEXT_PUBLIC_APP_URL!,
  APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || 'F9',
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  IS_DEVELOPMENT: process.env.NODE_ENV === 'development',
} as const;

/**
 * Server-only environment variables
 * NEVER import this in client components
 */
export const serverEnv = {
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  FLUTTERWAVE_SECRET_KEY: process.env.FLUTTERWAVE_SECRET_KEY!,
  FLUTTERWAVE_ENCRYPTION_KEY: process.env.FLUTTERWAVE_ENCRYPTION_KEY!,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY!,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET!,
} as const;

// Validate on server startup (in API routes)
if (typeof window === 'undefined') {
  try {
    validateServerEnv();
    console.log('✅ Environment variables validated');
  } catch (error) {
    console.error('Environment validation failed:', error);
    // Don't throw in development to allow hot reload
    if (process.env.NODE_ENV === 'production') {
      throw error;
    }
  }
}
