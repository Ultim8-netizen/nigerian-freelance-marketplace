// src/lib/flutterwave/client-config.ts
// CLIENT-SAFE: Only public key exposed to browser
// ✅ THIS FILE IS SAFE FOR CLIENT COMPONENTS

export const flutterwaveClientConfig = {
  publicKey: process.env.NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY || '',
  environment: (process.env.NEXT_PUBLIC_FLUTTERWAVE_ENV as 'production' | 'sandbox') || 'sandbox',
} as const;

// Validation - runs in browser
if (typeof window !== 'undefined' && !flutterwaveClientConfig.publicKey) {
  console.error('❌ NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY is not set');
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