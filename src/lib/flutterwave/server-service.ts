import 'server-only';
import { serverEnv } from '@/lib/env';

// ─────────────────────────────────────────────────────────────────────────────
// Typed error
// ─────────────────────────────────────────────────────────────────────────────

export class FlutterwaveError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly responseBody?: unknown,
  ) {
    super(message);
    this.name = 'FlutterwaveError';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Request / response shapes
// ─────────────────────────────────────────────────────────────────────────────

export interface FlutterwaveTransactionInit {
  amount: number;
  currency: 'NGN';
  txRef: string;
  paymentDescription: string;
  customerEmail: string;
  customerName: string;
  customerPhone?: string;
  redirectUrl: string;
  /** Defaults to card,banktransfer,ussd if omitted */
  paymentOptions?: string;
  meta?: Record<string, unknown>;
}

export interface FlutterwaveTransactionResponse {
  txRef: string;
  checkoutUrl: string;
}

export interface FlutterwaveVerifyResponse {
  /** "successful" | "pending" | "failed" */
  paymentStatus: 'successful' | 'pending' | 'failed';
  amountPaid: number;
  txRef: string;
  /** Flutterwave internal transaction ID (stringified for consistency) */
  transactionId: string;
  flwRef: string;
  paidOn?: string;
}

export interface FlutterwaveTransferInit {
  amount: number;
  reference: string;
  narration: string;
  destinationBankCode: string;
  destinationAccountNumber: string;
  currency: 'NGN';
}

export interface FlutterwaveTransferResponse {
  /** "NEW" | "PENDING" | "SUCCESSFUL" | "FAILED" */
  status: string;
  reference: string;
  transferId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal shapes
// ─────────────────────────────────────────────────────────────────────────────

interface FlutterwaveApiResponse<T> {
  status: 'success' | 'error';
  message: string;
  data: T;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function baseUrl(): string {
  return `${serverEnv.FLUTTERWAVE_BASE_URL}/v3`;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────────────────────
// Core fetch — no token exchange; secret key sent on every request
// ─────────────────────────────────────────────────────────────────────────────

async function flutterwaveFetch<T>(
  path: string,
  options: RequestInit,
): Promise<T> {
  const url = `${baseUrl()}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serverEnv.FLUTTERWAVE_SECRET_KEY}`,
      ...options.headers,
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
      (body as FlutterwaveApiResponse<unknown>)?.message ?? `HTTP ${response.status}`;
    throw new FlutterwaveError(msg, response.status, body);
  }

  const typed = body as FlutterwaveApiResponse<T>;
  if (typed.status !== 'success') {
    throw new FlutterwaveError(typed.message, response.status, typed);
  }

  return typed.data;
}

// ─────────────────────────────────────────────────────────────────────────────
// Retrying fetch — exponential backoff, retries on 5xx only
// ─────────────────────────────────────────────────────────────────────────────

async function flutterwaveFetchWithRetry<T>(
  path: string,
  options: RequestInit,
  maxAttempts = 3,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await flutterwaveFetch<T>(path, options);
    } catch (err) {
      lastError = err;
      const isRetryable =
        err instanceof FlutterwaveError && err.statusCode >= 500;
      if (!isRetryable || attempt === maxAttempts) break;
      await sleep(500 * 2 ** (attempt - 1)); // 500 ms, 1 s, 2 s
    }
  }
  throw lastError;
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

export class FlutterwaveServerService {
  /**
   * Initialize a transaction and obtain a hosted checkout URL.
   * Flutterwave: POST /v3/payments
   */
  static async initializeTransaction(
    data: FlutterwaveTransactionInit,
  ): Promise<FlutterwaveTransactionResponse> {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[Flutterwave] initializeTransaction txRef:', data.txRef);
    }

    const raw = await flutterwaveFetch<{ link: string }>(
      '/payments',
      {
        method: 'POST',
        body: JSON.stringify({
          tx_ref:          data.txRef,
          amount:          data.amount,
          currency:        data.currency,
          redirect_url:    data.redirectUrl,
          payment_options: data.paymentOptions ?? 'card,banktransfer,ussd',
          customer: {
            email: data.customerEmail,
            name:  data.customerName,
            ...(data.customerPhone ? { phonenumber: data.customerPhone } : {}),
          },
          customizations: {
            title:       'F9',
            description: data.paymentDescription,
            logo:        `${process.env.NEXT_PUBLIC_APP_URL}/logo.png`,
          },
          ...(data.meta ? { meta: data.meta } : {}),
        }),
      },
    );

    return {
      txRef:       data.txRef,
      checkoutUrl: raw.link,
    };
  }

  /**
   * Verify a transaction by its Flutterwave numeric transaction ID.
   * Retries up to 3 times — safe to call from the webhook handler.
   * Flutterwave: GET /v3/transactions/{id}/verify
   */
  static async verifyTransaction(
    transactionId: number | string,
  ): Promise<FlutterwaveVerifyResponse> {
    const raw = await flutterwaveFetchWithRetry<Record<string, unknown>>(
      `/transactions/${transactionId}/verify`,
      { method: 'GET' },
    );

    return {
      paymentStatus: raw.status as FlutterwaveVerifyResponse['paymentStatus'],
      amountPaid:    raw.amount_settled as number,
      txRef:         raw.tx_ref as string,
      transactionId: String(raw.id),
      flwRef:        raw.flw_ref as string,
      paidOn:        raw.created_at as string | undefined,
    };
  }

  /**
   * Verify a transaction by tx_ref when the numeric ID is not available.
   *
   * Uses the dedicated verification endpoint rather than the list endpoint —
   * response is a single object (not an array), validates status, amount, and
   * currency server-side before returning.
   *
   * Flutterwave: GET /v3/transactions/verify_by_txref?tx_ref={ref}
   */
  static async verifyTransactionByRef(
    txRef: string,
  ): Promise<FlutterwaveVerifyResponse> {
    const raw = await flutterwaveFetchWithRetry<Record<string, unknown>>(
      `/transactions/verify_by_txref?tx_ref=${encodeURIComponent(txRef)}`,
      { method: 'GET' },
    );

    // Validate the three critical fields Flutterwave requires us to check
    // before trusting a webhook/manual verify call:
    //   1. status === 'successful'
    //   2. currency === 'NGN'
    //   3. amount is present (amount_settled is the settled figure post-fees)
    //
    // Callers receive paymentStatus and can make their own trust decisions.
    // We do NOT throw on non-successful here — the caller checks paymentStatus.
    if (raw.currency !== 'NGN') {
      throw new FlutterwaveError(
        `Unexpected currency from Flutterwave: ${String(raw.currency)}`,
        422,
        raw,
      );
    }

    return {
      paymentStatus: raw.status as FlutterwaveVerifyResponse['paymentStatus'],
      amountPaid:    raw.amount_settled as number,
      txRef:         raw.tx_ref as string,
      transactionId: String(raw.id),
      flwRef:        raw.flw_ref as string,
      paidOn:        raw.created_at as string | undefined,
    };
  }

  /**
   * Initiate a single disbursement (freelancer withdrawal payout).
   * Flutterwave: POST /v3/transfers
   */
  static async initiateTransfer(
    data: FlutterwaveTransferInit,
  ): Promise<FlutterwaveTransferResponse> {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[Flutterwave] initiateTransfer ref:', data.reference, 'amount:', data.amount);
    }

    const raw = await flutterwaveFetch<Record<string, unknown>>(
      '/transfers',
      {
        method: 'POST',
        body: JSON.stringify({
          account_bank:         data.destinationBankCode,
          account_number:       data.destinationAccountNumber,
          amount:               data.amount,
          narration:            data.narration,
          currency:             data.currency,
          reference:            data.reference,
          debit_currency:       data.currency,
        }),
      },
    );

    return {
      status:     raw.status as string,
      reference:  raw.reference as string,
      transferId: raw.id !== undefined ? String(raw.id) : undefined,
    };
  }

  /**
   * Initiate a refund against a completed transaction.
   * Flutterwave: POST /v3/transactions/{id}/refunds
   * Pass the numeric Flutterwave transaction ID (not tx_ref).
   */
  static async refundTransaction(
    transactionId: number | string,
    amount: number,
  ): Promise<void> {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[Flutterwave] refundTransaction id:', transactionId, 'amount:', amount);
    }

    await flutterwaveFetch<unknown>(
      `/transactions/${transactionId}/refunds`,
      {
        method: 'POST',
        body: JSON.stringify({ amount }),
      },
    );
  }

  /**
   * Verify a Nigerian bank account number against a bank code.
   * Flutterwave: GET /v3/accounts/resolve
   */
  static async verifyBankAccount(
    accountNumber: string,
    bankCode: string,
  ): Promise<{ accountName: string; accountNumber: string; bankCode: string }> {
    const params = new URLSearchParams({
      account_number: accountNumber,
      account_bank:   bankCode,
    }).toString();

    const raw = await flutterwaveFetch<Record<string, unknown>>(
      `/accounts/resolve?${params}`,
      { method: 'GET' },
    );

    return {
      accountName:   raw.account_name as string,
      accountNumber: raw.account_number as string,
      bankCode,
    };
  }

  /**
   * Fetch the list of Nigerian banks supported by Flutterwave.
   * Normalised to { code, name }[] to match the shape consumers already expect.
   * Flutterwave: GET /v3/banks/NG
   */
  static async getNigerianBanks(): Promise<{ code: string; name: string }[]> {
    const raw = await flutterwaveFetch<{ code: string; name: string }[]>(
      '/banks/NG',
      { method: 'GET' },
    );

    return raw.map(b => ({ code: b.code, name: b.name }));
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