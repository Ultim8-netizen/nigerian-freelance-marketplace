// src/lib/flutterwave/server-service.ts
// ⚠️ SERVER-ONLY: NEVER import this in client components!
// Add this comment at the top to prevent accidental client imports:
// @server-only

import 'server-only';
import { PaymentData } from './client-config';

// Server-side configuration - ONLY used in API routes
const flutterwaveServerConfig = {
  secretKey: process.env.FLUTTERWAVE_SECRET_KEY || '',
  encryptionKey: process.env.FLUTTERWAVE_ENCRYPTION_KEY || '',
} as const;

// Validation on server startup
if (!flutterwaveServerConfig.secretKey) {
  throw new Error('FATAL: FLUTTERWAVE_SECRET_KEY not set');
}

const BASE_URL = 'https://api.flutterwave.com/v3';

export class FlutterwaveServerService {
  private static async fetchWithRetry(
    url: string,
    options: RequestInit,
    retries = 3
  ): Promise<Response> {
    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Retry on server errors
        if (response.status >= 500 && retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          return this.fetchWithRetry(url, options, retries - 1);
        }
        
        throw new Error(errorData.message || 'Request failed');
      }
      
      return response;
    } catch (error) {
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.fetchWithRetry(url, options, retries - 1);
      }
      throw error;
    }
  }

  /**
   * Initialize payment - SERVER ONLY
   * Never call this from client components
   */
  static async initializePayment(data: PaymentData) {
    const response = await this.fetchWithRetry(
      `${BASE_URL}/payments`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${flutterwaveServerConfig.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      }
    );

    return await response.json();
  }

  /**
   * Verify payment - SERVER ONLY
   */
  static async verifyPayment(transactionId: string) {
    const response = await this.fetchWithRetry(
      `${BASE_URL}/transactions/${transactionId}/verify`,
      {
        headers: {
          Authorization: `Bearer ${flutterwaveServerConfig.secretKey}`,
        },
      }
    );

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
    const response = await this.fetchWithRetry(
      `${BASE_URL}/transfers`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${flutterwaveServerConfig.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      }
    );

    return await response.json();
  }

  /**
   * Verify bank account - SERVER ONLY
   */
  static async verifyBankAccount(
    accountNumber: string,
    bankCode: string
  ) {
    const response = await this.fetchWithRetry(
      `${BASE_URL}/accounts/resolve`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${flutterwaveServerConfig.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account_number: accountNumber,
          account_bank: bankCode,
        }),
      }
    );

    return await response.json();
  }

  /**
   * Get Nigerian banks list - SERVER ONLY (caching handled by caller)
   */
  static async getNigerianBanks() {
    const response = await this.fetchWithRetry(
      `${BASE_URL}/banks/NG`,
      {
        headers: {
          Authorization: `Bearer ${flutterwaveServerConfig.secretKey}`,
        },
      }
    );

    return await response.json();
  }
}