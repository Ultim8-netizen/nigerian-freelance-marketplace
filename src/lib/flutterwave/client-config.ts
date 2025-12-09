// ============================================================================
// src/lib/flutterwave/client-config.ts
// CLIENT-SAFE: Only public key exposed to browser
// ============================================================================

import { clientEnv } from '@/lib/env';

export const flutterwaveClientConfig = {
  publicKey: clientEnv.FLUTTERWAVE_PUBLIC_KEY,
  environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
} as const;

// Validation - runs ONLY in the browser
if (typeof window !== 'undefined' && !flutterwaveClientConfig.publicKey) {
  console.error('❌ FLUTTERWAVE_PUBLIC_KEY is missing in clientEnv');
}

export interface PaymentData {
  tx_ref: string;
  amount: number;
  currency: string;
  redirect_url: string;
  customer: {
    email: string;
    phone_number: string;
    name: string;
  };
  customizations: {
    title: string;
    description: string;
    logo: string;
  };
}

// Helper function for generating transaction references
export function generateTxRef(prefix = 'TXN'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
