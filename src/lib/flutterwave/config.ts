// src/lib/flutterwave/config.ts
// Enhanced Flutterwave payment integration with innovative features

interface FlutterwaveConfig {
  publicKey: string;
  secretKey: string;
  encryptionKey: string;
  environment: 'production' | 'sandbox';
}

export const flutterwaveConfig: FlutterwaveConfig = {
  publicKey: process.env.NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY || '',
  secretKey: process.env.FLUTTERWAVE_SECRET_KEY || '',
  encryptionKey: process.env.FLUTTERWAVE_ENCRYPTION_KEY || '',
  environment: (process.env.NEXT_PUBLIC_FLUTTERWAVE_ENV as 'production' | 'sandbox') || 'sandbox',
};

// Import BRAND from your existing brand configuration
// Assuming BRAND is defined elsewhere in your codebase
// import { BRAND } from '@/config/brand' or wherever it's defined

// Enhanced type definitions
export interface PaymentData {
  tx_ref: string;
  amount: number;
  currency: string;
  redirect_url: string;
  payment_options?: string; // e.g., "card,banktransfer,ussd"
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
  meta?: Record<string, any>;
  payment_plan?: string;
  subaccounts?: Array<{
    id: string;
    transaction_split_ratio?: number;
    transaction_charge_type?: string;
    transaction_charge?: number;
  }>;
}

// Note: When creating PaymentData, use BRAND like this:
// customizations: {
//   title: BRAND.NAME,
//   description: BRAND.DESCRIPTION,
//   logo: `${BRAND.APP_URL}/logo.png`,
// }

export interface PaymentResponse {
  status: 'success' | 'error';
  message: string;
  data?: {
    link: string;
    tx_ref: string;
    transaction_id: string;
  };
}

export interface VerificationResponse {
  status: 'success' | 'error';
  message: string;
  data?: {
    id: number;
    tx_ref: string;
    flw_ref: string;
    amount: number;
    currency: string;
    charged_amount: number;
    status: 'successful' | 'failed' | 'pending';
    payment_type: string;
    customer: {
      email: string;
      name: string;
      phone_number: string;
    };
    created_at: string;
  };
}

export interface TransferData {
  account_bank: string;
  account_number: string;
  amount: number;
  narration: string;
  currency: string;
  reference: string;
  beneficiary_name: string;
  debit_currency?: string;
  meta?: Record<string, any>;
}

// Custom error class for better error handling
export class FlutterwaveError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number,
    public data?: any
  ) {
    super(message);
    this.name = 'FlutterwaveError';
  }
}

// Event emitter for payment lifecycle hooks
type PaymentEventType = 'initiated' | 'verified' | 'failed' | 'transferred';
type PaymentEventCallback = (data: any) => void | Promise<void>;

class PaymentEventEmitter {
  private listeners: Map<PaymentEventType, Set<PaymentEventCallback>> = new Map();

  on(event: PaymentEventType, callback: PaymentEventCallback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => this.off(event, callback);
  }

  off(event: PaymentEventType, callback: PaymentEventCallback) {
    this.listeners.get(event)?.delete(callback);
  }

  async emit(event: PaymentEventType, data: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      await Promise.all(Array.from(callbacks).map(cb => cb(data)));
    }
  }
}

export class FlutterwaveService {
  private static baseUrl = 'https://api.flutterwave.com/v3';
  private static eventEmitter = new PaymentEventEmitter();
  private static requestCache = new Map<string, { data: any; timestamp: number }>();
  private static readonly CACHE_TTL = 60000; // 1 minute

  /**
   * Subscribe to payment events
   */
  static on(event: PaymentEventType, callback: PaymentEventCallback) {
    return this.eventEmitter.on(event, callback);
  }

  /**
   * Enhanced fetch with retry logic and better error handling
   */
  private static async fetchWithRetry(
    url: string,
    options: RequestInit,
    retries = 3,
    backoff = 1000
  ): Promise<Response> {
    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new FlutterwaveError(
          errorData.message || 'Request failed',
          errorData.code,
          response.status,
          errorData
        );
      }
      
      return response;
    } catch (error) {
      if (retries > 0 && error instanceof FlutterwaveError && error.statusCode && error.statusCode >= 500) {
        await new Promise(resolve => setTimeout(resolve, backoff));
        return this.fetchWithRetry(url, options, retries - 1, backoff * 2);
      }
      throw error;
    }
  }

  /**
   * Initialize payment with progress tracking
   */
  static async initializePayment(
    data: PaymentData,
    onProgress?: (stage: string) => void
  ): Promise<PaymentResponse> {
    try {
      onProgress?.('validating');
      
      // Validate required fields
      if (!data.tx_ref || !data.amount || !data.customer.email) {
        throw new FlutterwaveError('Missing required payment fields', 'VALIDATION_ERROR');
      }

      onProgress?.('processing');

      const response = await this.fetchWithRetry(
        `${this.baseUrl}/payments`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${flutterwaveConfig.secretKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        }
      );

      const result = await response.json();
      
      onProgress?.('completed');
      
      await this.eventEmitter.emit('initiated', { tx_ref: data.tx_ref, result });
      
      return result;
    } catch (error) {
      await this.eventEmitter.emit('failed', { tx_ref: data.tx_ref, error });
      throw error;
    }
  }

  /**
   * Verify payment with caching
   */
  static async verifyPayment(
    transactionId: string,
    useCache = true
  ): Promise<VerificationResponse> {
    const cacheKey = `verify_${transactionId}`;
    
    // Check cache
    if (useCache) {
      const cached = this.requestCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.data;
      }
    }

    try {
      const response = await this.fetchWithRetry(
        `${this.baseUrl}/transactions/${transactionId}/verify`,
        {
          headers: {
            'Authorization': `Bearer ${flutterwaveConfig.secretKey}`,
          },
        }
      );

      const result = await response.json();
      
      // Cache successful verification
      if (result.status === 'success') {
        this.requestCache.set(cacheKey, { data: result, timestamp: Date.now() });
      }
      
      await this.eventEmitter.emit('verified', { transactionId, result });
      
      return result;
    } catch (error) {
      await this.eventEmitter.emit('failed', { transactionId, error });
      throw error;
    }
  }

  /**
   * Batch payment verification (innovative feature)
   */
  static async verifyPaymentBatch(
    transactionIds: string[]
  ): Promise<Map<string, VerificationResponse>> {
    const results = new Map<string, VerificationResponse>();
    
    // Process in parallel with concurrency limit
    const concurrencyLimit = 5;
    for (let i = 0; i < transactionIds.length; i += concurrencyLimit) {
      const batch = transactionIds.slice(i, i + concurrencyLimit);
      const batchResults = await Promise.allSettled(
        batch.map(id => this.verifyPayment(id))
      );
      
      batchResults.forEach((result, index) => {
        const txId = batch[index];
        if (result.status === 'fulfilled') {
          results.set(txId, result.value);
        } else {
          results.set(txId, {
            status: 'error',
            message: result.reason?.message || 'Verification failed',
          });
        }
      });
    }
    
    return results;
  }

  /**
   * Initiate transfer with webhook simulation
   */
  static async initiateTransfer(
    data: TransferData,
    webhookUrl?: string
  ) {
    try {
      const payload: any = { ...data };
      
      if (webhookUrl) {
        payload.callback_url = webhookUrl;
      }

      const response = await this.fetchWithRetry(
        `${this.baseUrl}/transfers`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${flutterwaveConfig.secretKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      const result = await response.json();
      
      await this.eventEmitter.emit('transferred', { reference: data.reference, result });
      
      return result;
    } catch (error) {
      await this.eventEmitter.emit('failed', { reference: data.reference, error });
      throw error;
    }
  }

  /**
   * Verify bank account with enhanced validation
   */
  static async verifyBankAccount(
    accountNumber: string,
    bankCode: string
  ) {
    // Basic validation
    if (!/^\d{10}$/.test(accountNumber)) {
      throw new FlutterwaveError(
        'Invalid account number format',
        'VALIDATION_ERROR'
      );
    }

    const response = await this.fetchWithRetry(
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

    return await response.json();
  }

  /**
   * Get list of Nigerian banks (useful for UI)
   */
  static async getNigerianBanks() {
    const cacheKey = 'banks_ng';
    const cached = this.requestCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < 86400000) { // 24 hours
      return cached.data;
    }

    const response = await this.fetchWithRetry(
      `${this.baseUrl}/banks/NG`,
      {
        headers: {
          'Authorization': `Bearer ${flutterwaveConfig.secretKey}`,
        },
      }
    );

    const result = await response.json();
    this.requestCache.set(cacheKey, { data: result, timestamp: Date.now() });
    
    return result;
  }

  /**
   * Payment status polling helper (innovative feature)
   */
  static async pollPaymentStatus(
    transactionId: string,
    options: {
      interval?: number;
      maxAttempts?: number;
      onUpdate?: (status: string) => void;
    } = {}
  ): Promise<VerificationResponse> {
    const { interval = 3000, maxAttempts = 20, onUpdate } = options;
    let attempts = 0;

    while (attempts < maxAttempts) {
      const result = await this.verifyPayment(transactionId, false);
      
      if (result.data?.status) {
        onUpdate?.(result.data.status);
        
        if (result.data.status === 'successful' || result.data.status === 'failed') {
          return result;
        }
      }
      
      attempts++;
      await new Promise(resolve => setTimeout(resolve, interval));
    }

    throw new FlutterwaveError('Payment verification timeout', 'TIMEOUT');
  }

  /**
   * Clear cache (useful for testing)
   */
  static clearCache() {
    this.requestCache.clear();
  }

  /**
   * Get cache statistics
   */
  static getCacheStats() {
    return {
      size: this.requestCache.size,
      entries: Array.from(this.requestCache.keys()),
    };
  }
}

// Utility function for generating transaction references
export function generateTxRef(prefix = 'TXN'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Utility function for formatting currency
export function formatCurrency(amount: number, currency = 'NGN'): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
  }).format(amount);
}