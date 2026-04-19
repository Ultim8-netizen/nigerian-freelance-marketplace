import 'server-only';
import { serverEnv } from '@/lib/env';

// ─────────────────────────────────────────────────────────────────────────────
// Typed error
// ─────────────────────────────────────────────────────────────────────────────

export class MonnifyError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly responseBody?: unknown,
  ) {
    super(message);
    this.name = 'MonnifyError';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Request / response shapes
// ─────────────────────────────────────────────────────────────────────────────

export interface MonnifyTransactionInit {
  amount: number;
  currencyCode: 'NGN';
  contractCode: string;
  paymentReference: string;
  paymentDescription: string;
  customerEmail: string;
  customerName: string;
  customerPhone?: string;
  redirectUrl: string;
  paymentMethods: ('ACCOUNT_TRANSFER' | 'CARD' | 'USSD')[];
}

export interface MonnifyTransactionResponse {
  paymentReference: string;
  transactionReference: string;
  checkoutUrl: string;
  status: string;
}

export interface MonnifyVerifyResponse {
  paymentStatus: 'PAID' | 'PENDING' | 'FAILED' | 'PARTIALLY_PAID' | 'OVERPAID';
  amountPaid: number;
  paymentReference: string;
  transactionReference: string;
  paidOn?: string;
}

export interface MonnifyTransferInit {
  amount: number;
  reference: string;
  narration: string;
  destinationBankCode: string;
  destinationAccountNumber: string;
  currency: 'NGN';
  sourceAccountNumber: string;
}

export interface MonnifyTransferResponse {
  status: 'SUCCESS' | 'PENDING' | 'FAILED';
  reference: string;
  disbursementId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal shapes
// ─────────────────────────────────────────────────────────────────────────────

interface MonnifyAuthResponse {
  requestSuccessful: boolean;
  responseMessage: string;
  responseCode: string;
  responseBody: {
    accessToken: string;
    expiresIn: number; // seconds
  };
}

interface MonnifyApiResponse<T> {
  requestSuccessful: boolean;
  responseMessage: string;
  responseCode: string;
  responseBody: T;
}

// ─────────────────────────────────────────────────────────────────────────────
// Module-level token cache (per-process, no Redis/DB)
// ─────────────────────────────────────────────────────────────────────────────

let cachedToken: string | null = null;
let tokenExpiresAt: number = 0; // Unix ms
const TOKEN_EXPIRY_BUFFER_MS = 60_000; // refresh 60 s before actual expiry

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function basicAuthHeader(): string {
  const credentials = Buffer.from(
    `${serverEnv.MONNIFY_API_KEY}:${serverEnv.MONNIFY_SECRET_KEY}`,
  ).toString('base64');
  return `Basic ${credentials}`;
}

function baseUrl(): string {
  return serverEnv.MONNIFY_BASE_URL;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────────────────────
// Core fetch — does NOT retry; callers that need retry wrap this
// ─────────────────────────────────────────────────────────────────────────────

async function monnifyFetch<T>(
  path: string,
  options: RequestInit,
): Promise<T> {
  const url = `${baseUrl()}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const msg =
      (body as MonnifyApiResponse<unknown>)?.responseMessage ??
      `HTTP ${response.status}`;
    throw new MonnifyError(msg, response.status, body);
  }

  const typed = body as MonnifyApiResponse<T>;
  if (!typed.requestSuccessful) {
    throw new MonnifyError(typed.responseMessage, response.status, typed);
  }

  return typed.responseBody;
}

// ─────────────────────────────────────────────────────────────────────────────
// Retrying fetch — exponential backoff, retries on 5xx only
// ─────────────────────────────────────────────────────────────────────────────

async function monnifyFetchWithRetry<T>(
  path: string,
  options: RequestInit,
  maxAttempts = 3,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await monnifyFetch<T>(path, options);
    } catch (err) {
      lastError = err;
      const isRetryable =
        err instanceof MonnifyError && err.statusCode >= 500;
      if (!isRetryable || attempt === maxAttempts) break;
      await sleep(500 * 2 ** (attempt - 1)); // 500 ms, 1 s, 2 s
    }
  }
  throw lastError;
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

export class MonnifyServerService {
  /**
   * Obtain a Bearer access token using OAuth2 Basic-auth login.
   * Token is cached at module level and reused until near-expiry.
   * Retries up to 3 times with exponential backoff.
   */
  static async getAccessToken(): Promise<string> {
    if (cachedToken && Date.now() < tokenExpiresAt) {
      return cachedToken;
    }

    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const url = `${baseUrl()}/api/v1/auth/login`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: basicAuthHeader(),
            'Content-Type': 'application/json',
          },
        });

        let body: unknown;
        try { body = await response.json(); } catch { body = null; }

        if (!response.ok) {
          const msg =
            (body as MonnifyAuthResponse)?.responseMessage ?? `HTTP ${response.status}`;
          throw new MonnifyError(msg, response.status, body);
        }

        const typed = body as MonnifyAuthResponse;
        if (!typed.requestSuccessful) {
          throw new MonnifyError(typed.responseMessage, response.status, typed);
        }

        const { accessToken, expiresIn } = typed.responseBody;
        cachedToken = accessToken;
        tokenExpiresAt = Date.now() + expiresIn * 1000 - TOKEN_EXPIRY_BUFFER_MS;

        return cachedToken;
      } catch (err) {
        lastError = err;
        const isRetryable =
          err instanceof MonnifyError && err.statusCode >= 500;
        if (!isRetryable || attempt === 3) break;
        await sleep(500 * 2 ** (attempt - 1));
      }
    }

    throw lastError;
  }

  /**
   * Initialize a transaction and obtain a hosted checkout URL.
   */
  static async initializeTransaction(
    data: MonnifyTransactionInit,
  ): Promise<MonnifyTransactionResponse> {
    const token = await this.getAccessToken();

    const body = {
      amount: data.amount,
      currencyCode: data.currencyCode,
      contractCode: data.contractCode,
      paymentReference: data.paymentReference,
      paymentDescription: data.paymentDescription,
      customerEmail: data.customerEmail,
      customerName: data.customerName,
      ...(data.customerPhone ? { customerPhone: data.customerPhone } : {}),
      redirectUrl: data.redirectUrl,
      paymentMethods: data.paymentMethods,
    };

    if (process.env.NODE_ENV !== 'production') {
      console.log('[Monnify] initializeTransaction ref:', data.paymentReference);
    }

    return monnifyFetch<MonnifyTransactionResponse>(
      '/api/v1/merchant/transactions/init-transaction',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      },
    );
  }

  /**
   * Verify a transaction by its payment reference.
   * Retries up to 3 times — safe to call from the webhook handler.
   */
  static async verifyTransaction(
    paymentReference: string,
  ): Promise<MonnifyVerifyResponse> {
    const token = await this.getAccessToken();
    const encoded = encodeURIComponent(paymentReference);

    const raw = await monnifyFetchWithRetry<Record<string, unknown>>(
      `/api/v2/transactions/${encoded}`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    // Normalise to the contracted response shape
    return {
      paymentStatus: raw.paymentStatus as MonnifyVerifyResponse['paymentStatus'],
      amountPaid: raw.amountPaid as number,
      paymentReference: raw.paymentReference as string,
      transactionReference: raw.transactionReference as string,
      paidOn: raw.paidOn as string | undefined,
    };
  }

  /**
   * Initiate a single disbursement (freelancer withdrawal payout).
   */
  static async initiateTransfer(
    data: MonnifyTransferInit,
  ): Promise<MonnifyTransferResponse> {
    const token = await this.getAccessToken();

    if (process.env.NODE_ENV !== 'production') {
      console.log('[Monnify] initiateTransfer ref:', data.reference, 'amount:', data.amount);
    }

    const raw = await monnifyFetch<Record<string, unknown>>(
      '/api/v2/disbursements/single',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          amount: data.amount,
          reference: data.reference,
          narration: data.narration,
          destinationBankCode: data.destinationBankCode,
          destinationAccountNumber: data.destinationAccountNumber,
          currency: data.currency,
          sourceAccountNumber: data.sourceAccountNumber,
        }),
      },
    );

    return {
      status: raw.status as MonnifyTransferResponse['status'],
      reference: raw.reference as string,
      disbursementId: raw.disbursementId as string | undefined,
    };
  }

  /**
   * Initiate a refund against a completed transaction.
   * Maps from the previous refundTransaction signature — same call shape.
   */
  static async refundTransaction(
    transactionRef: string,
    amount: number,
  ): Promise<void> {
    const token = await this.getAccessToken();
    const refundReference = `REF-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

    if (process.env.NODE_ENV !== 'production') {
      console.log('[Monnify] refundTransaction txRef:', transactionRef, 'amount:', amount);
    }

    await monnifyFetch<unknown>(
      '/api/v1/refunds/initiate-refund',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          transactionReference: transactionRef,
          refundReference,
          refundAmount: amount,
          refundReason: 'Admin-initiated refund',
          customerNote: 'Your payment has been refunded.',
        }),
      },
    );
  }

  /**
   * Verify a Nigerian bank account number against a bank code.
   */
  static async verifyBankAccount(
    accountNumber: string,
    bankCode: string,
  ): Promise<{ accountName: string; accountNumber: string; bankCode: string }> {
    const token = await this.getAccessToken();
    const params = new URLSearchParams({ accountNumber, bankCode }).toString();

    return monnifyFetch<{ accountName: string; accountNumber: string; bankCode: string }>(
      `/api/v1/disbursements/account/validate?${params}`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      },
    );
  }

  /**
   * Fetch the list of Nigerian banks supported by Monnify.
   * Normalised to { code, name }[] to match the shape consumers already expect.
   */
  static async getNigerianBanks(): Promise<{ code: string; name: string }[]> {
    const token = await this.getAccessToken();

    const raw = await monnifyFetch<{ bankCode: string; bankName: string }[]>(
      '/api/v1/sdk/transactions/banks?currencyCode=NGN',
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    return raw.map(b => ({ code: b.bankCode, name: b.bankName }));
  }

  /**
   * Generate a unique, URL-safe payment reference.
   * Format: F9-{timestamp}-{8 hex chars}
   * Server-side only — contains no secrets but must not run on the client.
   */
  static generatePaymentRef(): string {
    const hex = Array.from(crypto.getRandomValues(new Uint8Array(4)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    return `F9-${Date.now()}-${hex}`;
  }
}