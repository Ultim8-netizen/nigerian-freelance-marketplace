// ─────────────────────────────────────────────────────────────────────────────
// src/lib/monnify/client-config.ts
// CLIENT-SAFE: no secret keys, no 'server-only' imports.
// ─────────────────────────────────────────────────────────────────────────────

/** "test" | "live" — driven by NEXT_PUBLIC_MONNIFY_ENV */
export const MONNIFY_ENV =
  (process.env.NEXT_PUBLIC_MONNIFY_ENV as 'test' | 'live') ?? 'test';

/**
 * Client-safe interface for components that need to know the payment
 * environment and render appropriate UI (e.g. "TEST MODE" banners).
 */
export interface MonnifyClientConfig {
  env: 'test' | 'live';
  isTestMode: boolean;
}

export const monnifyClientConfig: MonnifyClientConfig = {
  env: MONNIFY_ENV,
  isTestMode: MONNIFY_ENV !== 'live',
};

/**
 * Generate a client-safe transaction reference.
 * Uses timestamp + Math.random — no crypto, no secrets.
 * Format: F9C-{timestamp}-{9 alphanum chars}
 *
 * Use this in the browser before handing off to the server;
 * the server will overwrite with its own generatePaymentRef() result
 * before sending to Monnify.
 */
export function generateClientTxRef(): string {
  const rand = Math.random().toString(36).substring(2, 11);
  return `F9C-${Date.now()}-${rand}`;
}

// Warn loudly in development if the env flag is missing
if (typeof window !== 'undefined' && !process.env.NEXT_PUBLIC_MONNIFY_ENV) {
  console.error('❌ NEXT_PUBLIC_MONNIFY_ENV is not set. Defaulting to "test".');
}