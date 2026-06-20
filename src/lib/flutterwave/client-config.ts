// src/lib/flutterwave/client-config.ts
// CLIENT-SAFE: no secret keys, no 'server-only' imports.
//
// FIX: renamed every Monnify* symbol to Flutterwave* — leftover naming from
// before the payment provider migration. NOTE: nothing in the codebase
// currently imports this file (PaymentButton.tsx and usePayments.ts post
// straight to /api/payments/initiate, which generates its own ref
// server-side). This is a naming/compile fix, not new integration — flagging
// this honestly rather than pretending it's wired up somewhere it isn't.

/** "test" | "live" — driven by NEXT_PUBLIC_FLUTTERWAVE_ENV */
export const FLUTTERWAVE_ENV =
  (process.env.NEXT_PUBLIC_FLUTTERWAVE_ENV as 'test' | 'live') ?? 'test';

/**
 * Client-safe interface for components that need to know the payment
 * environment and render appropriate UI (e.g. "TEST MODE" banners).
 */
export interface FlutterwaveClientConfig {
  env: 'test' | 'live';
  isTestMode: boolean;
}

export const flutterwaveClientConfig: FlutterwaveClientConfig = {
  env: FLUTTERWAVE_ENV,
  isTestMode: FLUTTERWAVE_ENV !== 'live',
};

/**
 * Generate a client-safe transaction reference.
 * Uses timestamp + Math.random — no crypto, no secrets.
 * Format: F9C-{timestamp}-{9 alphanum chars}
 *
 * Not currently consumed by any checkout flow — the server always
 * generates and persists its own ref via
 * FlutterwaveServerService.generatePaymentRef() in /api/payments/initiate.
 * Kept for any future client-initiated flow that needs a provisional ref
 * before the server round-trip resolves.
 */
export function generateClientTxRef(): string {
  const rand = Math.random().toString(36).substring(2, 11);
  return `F9C-${Date.now()}-${rand}`;
}

// Warn loudly in development if the env flag is missing
if (typeof window !== 'undefined' && !process.env.NEXT_PUBLIC_FLUTTERWAVE_ENV) {
  console.warn('NEXT_PUBLIC_FLUTTERWAVE_ENV is not set. Defaulting to "test".');
}