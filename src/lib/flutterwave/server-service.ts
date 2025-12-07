// src/lib/flutterwave/server-service.ts
// SERVER-ONLY: Contains secret key operations
// NEVER import this in client components!

import { PaymentData } from './client-config';

// Server-side configuration - ONLY used in API routes
const flutterwaveServerConfig = {
  secretKey: process.env.FLUTTERWAVE_SECRET_KEY || '',
  encryptionKey: process.env.FLUTTERWAVE_ENCRYPTION_KEY || '',
};

// Validation on server startup
if (!flutterwaveServerConfig.secretKey) {
  console.error('FATAL: FLUTTERWAVE_SECRET_KEY not set');
}

const BASE_URL = 'https://api.flutterwave.com/v3';

export class FlutterwaveServerService {
  /**
   * Initialize payment - SERVER ONLY
   */
  static async initializePayment(data: PaymentData) {
    const response = await fetch(`${BASE_URL}/payments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${flutterwaveServerConfig.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Payment initialization failed');
    }

    return await response.json();
  }

  /**
   * Verify payment - SERVER ONLY
   */
  static async verifyPayment(transactionId: string) {
    const response = await fetch(
      `${BASE_URL}/transactions/${transactionId}/verify`,
      {
        headers: {
          Authorization: `Bearer ${flutterwaveServerConfig.secretKey}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Payment verification failed');
    }

    return await response.json();
  }

  /**
   * Initiate transfer to freelancer - SERVER ONLY
   */
  static async initiateTransfer(data: {
    account_bank: string;
    account_number: string;
    amount: number;
    narration: string;
    currency: string;
    reference: string;
    beneficiary_name: string;
  }) {
    const response = await fetch(`${BASE_URL}/transfers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${flutterwaveServerConfig.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('Transfer initiation failed');
    }

    return await response.json();
  }

  /**
   * Verify bank account - SERVER ONLY
   */
  static async verifyBankAccount(accountNumber: string, bankCode: string) {
    const response = await fetch(`${BASE_URL}/accounts/resolve`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${flutterwaveServerConfig.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        account_number: accountNumber,
        account_bank: bankCode,
      }),
    });

    if (!response.ok) {
      throw new Error('Account verification failed');
    }

    return await response.json();
  }
}