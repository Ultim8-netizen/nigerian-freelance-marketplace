// src/lib/flutterwave/client-config.ts
// CLIENT-SAFE: Only public key exposed to browser

export const flutterwaveClientConfig = {
  publicKey: process.env.NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY || '',
};

// Validation
if (!flutterwaveClientConfig.publicKey && typeof window !== 'undefined') {
  console.error('NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY is not set');
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

// Type for client-side payment initialization
export interface ClientPaymentInit {
  orderId: string;
  amount: number;
  email: string;
  phoneNumber: string;
  fullName: string;
}