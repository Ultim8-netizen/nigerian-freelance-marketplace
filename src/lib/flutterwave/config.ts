// src/lib/flutterwave/config.ts
// Flutterwave payment integration

interface FlutterwaveConfig {
  publicKey: string;
  secretKey: string;
  encryptionKey: string;
}

export const flutterwaveConfig: FlutterwaveConfig = {
  publicKey: process.env.NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY || '',
  secretKey: process.env.FLUTTERWAVE_SECRET_KEY || '',
  encryptionKey: process.env.FLUTTERWAVE_ENCRYPTION_KEY || '',
};

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

export class FlutterwaveService {
  private static baseUrl = 'https://api.flutterwave.com/v3';

  /**
   * Initialize payment
   */
  static async initializePayment(data: PaymentData) {
    const response = await fetch(`${this.baseUrl}/payments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${flutterwaveConfig.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('Payment initialization failed');
    }

    return await response.json();
  }

  /**
   * Verify payment
   */
  static async verifyPayment(transactionId: string) {
    const response = await fetch(
      `${this.baseUrl}/transactions/${transactionId}/verify`,
      {
        headers: {
          'Authorization': `Bearer ${flutterwaveConfig.secretKey}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Payment verification failed');
    }

    return await response.json();
  }

  /**
   * Initiate transfer to freelancer
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
    const response = await fetch(`${this.baseUrl}/transfers`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${flutterwaveConfig.secretKey}`,
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
   * Verify bank account
   */
  static async verifyBankAccount(accountNumber: string, bankCode: string) {
    const response = await fetch(
      `${this.baseUrl}/accounts/resolve`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${flutterwaveConfig.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account_number: accountNumber,
          account_bank: bankCode,
        }),
      }
    );

    if (!response.ok) {
      throw new Error('Account verification failed');
    }

    return await response.json();
  }
}