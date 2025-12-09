// src/lib/env.ts
// Runtime environment variable validation

interface EnvConfig {
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  
  // Flutterwave
  NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY: string;
  FLUTTERWAVE_SECRET_KEY: string;
  FLUTTERWAVE_ENCRYPTION_KEY: string;
  
  // Cloudinary
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: string;
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_API_SECRET: string;
  NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET: string;
  
  // App
  NEXT_PUBLIC_APP_URL: string;
  NEXT_PUBLIC_APP_NAME: string;
  NODE_ENV: 'development' | 'production' | 'test';
}

/**
 * Validates that all required environment variables are present
 */
export function validateEnv(): EnvConfig {
  const errors: string[] = [];

  // Required variables
  const required: (keyof EnvConfig)[] = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY',
    'FLUTTERWAVE_SECRET_KEY',
    'NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
    'NEXT_PUBLIC_APP_URL',
  ];

  // Check each required variable
  required.forEach((key) => {
    const value = process.env[key];
    if (!value || value.trim().length === 0) {
      errors.push(`Missing required environment variable: ${key}`);
    }
  });

  // Validate Supabase URL format
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl && !supabaseUrl.startsWith('https://')) {
    errors.push('NEXT_PUBLIC_SUPABASE_URL must start with https://');
  }

  // Validate App URL format
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl && !appUrl.startsWith('http')) {
    errors.push('NEXT_PUBLIC_APP_URL must be a valid URL');
  }

  // If errors exist, throw with helpful message
  if (errors.length > 0) {
    const errorMessage = [
      '❌ Environment Variable Validation Failed:',
      '',
      ...errors.map(e => `  • ${e}`),
      '',
      '📝 Copy .env.example to .env.local and fill in all values',
    ].join('\n');

    throw new Error(errorMessage);
  }

  // Return typed config
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY: process.env.NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY!,
    FLUTTERWAVE_SECRET_KEY: process.env.FLUTTERWAVE_SECRET_KEY!,
    FLUTTERWAVE_ENCRYPTION_KEY: process.env.FLUTTERWAVE_ENCRYPTION_KEY!,
    NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY!,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET!,
    NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET: process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'marketplace_unsigned',
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL!,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || 'F9',
    NODE_ENV: (process.env.NODE_ENV as any) || 'development',
  };
}

/**
 * Validated environment config
 * Use this instead of process.env for type safety
 */
export const env = validateEnv();

/**
 * Client-safe environment variables
 * Only includes NEXT_PUBLIC_* variables
 */
export const clientEnv = {
  SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_ANON_KEY: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  FLUTTERWAVE_PUBLIC_KEY: env.NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY,
  CLOUDINARY_CLOUD_NAME: env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_UPLOAD_PRESET: env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET,
  APP_URL: env.NEXT_PUBLIC_APP_URL,
  APP_NAME: env.NEXT_PUBLIC_APP_NAME,
  IS_PRODUCTION: env.NODE_ENV === 'production',
  IS_DEVELOPMENT: env.NODE_ENV === 'development',
} as const;