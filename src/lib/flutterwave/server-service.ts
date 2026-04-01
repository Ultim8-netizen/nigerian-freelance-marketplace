// src/lib/flutterwave/server-service.ts
// ⚠️  SERVER-ONLY: NEVER import this in client components.
//
// ─────────────────────────────────────────────────────────────────────────────
// TODO [MONNIFY MIGRATION]: This entire file is scheduled for replacement.
//   Flutterwave will be removed once the admin profile work is complete.
//   Migration target: Monnify (https://developers.monnify.com)
//
//   Swap checklist:
//     1. Replace env vars:
//          FLUTTERWAVE_SECRET_KEY      → MONNIFY_API_KEY
//          FLUTTERWAVE_ENCRYPTION_KEY  → MONNIFY_SECRET_KEY
//          FLUTTERWAVE_PUBLIC_KEY      → (unused by Monnify server SDK)
//     2. Replace BASE_URL with https://api.monnify.com
//     3. Monnify uses Basic-Auth (base64 API_KEY:SECRET_KEY) for most endpoints,
//        not Bearer tokens — update all request headers accordingly.
//     4. Replace initializePayment   → POST /api/v1/merchant/transactions/init-transaction
//     5. Replace verifyPayment       → GET  /api/v2/merchant/transactions/query?paymentReference=...
//     6. Replace initiateTransfer    → POST /api/v1/disbursements/single (requires separate disbursement auth)
//     7. Replace verifyBankAccount   → POST /api/v1/disbursements/account/validate
//     8. Replace getNigerianBanks    → GET  /api/v1/sdk/transactions/banks?currencyCode=NGN
//     9. Replace refundTransaction   → POST /api/v1/refunds/initiate-refund (see placeholder below)
//    10. Delete this file; create src/lib/monnify/server-service.ts instead.
// ─────────────────────────────────────────────────────────────────────────────

import 'server-only';
import { PaymentData } from './client-config';

// TODO [MONNIFY MIGRATION]: Replace with MONNIFY_API_KEY / MONNIFY_SECRET_KEY.
const flutterwaveServerConfig = {
  secretKey:     process.env.FLUTTERWAVE_SECRET_KEY     || '',
  encryptionKey: process.env.FLUTTERWAVE_ENCRYPTION_KEY || '',
} as const;

if (!flutterwaveServerConfig.secretKey) {
  throw new Error('FATAL: FLUTTERWAVE_SECRET_KEY not set');
}

// TODO [MONNIFY MIGRATION]: Replace with https://api.monnify.com
const BASE_URL = 'https://api.flutterwave.com/v3';

export class FlutterwaveServerService {
  private static async fetchWithRetry(
    url: string,
    options: RequestInit,
    retries = 3,
  ): Promise<Response> {
    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (response.status >= 500 && retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          return this.fetchWithRetry(url, options, retries - 1);
        }

        throw new Error((errorData as { message?: string }).message || 'Request failed');
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
   * Initialize payment — SERVER ONLY.
   *
   * TODO [MONNIFY MIGRATION]:
   *   Endpoint: POST https://api.monnify.com/api/v1/merchant/transactions/init-transaction
   *   Auth:     Authorization: Basic base64(API_KEY:SECRET_KEY)
   *   Body shape changes — map PaymentData fields to Monnify's
   *   { totalAmount, customerName, customerEmail, paymentReference,
   *     paymentDescription, currencyCode, contractCode, redirectUrl }
   */
  static async initializePayment(data: PaymentData) {
    const response = await this.fetchWithRetry(
      `${BASE_URL}/payments`,
      {
        method: 'POST',
        headers: {
          Authorization:  `Bearer ${flutterwaveServerConfig.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      },
    );
    return await response.json();
  }

  /**
   * Verify payment — SERVER ONLY.
   *
   * TODO [MONNIFY MIGRATION]:
   *   Endpoint: GET https://api.monnify.com/api/v2/merchant/transactions/query
   *             ?paymentReference={reference}
   *   Auth:     Basic base64(API_KEY:SECRET_KEY)
   *   `transactionId` will become a Monnify paymentReference string.
   */
  static async verifyPayment(transactionId: string) {
    const response = await this.fetchWithRetry(
      `${BASE_URL}/transactions/${transactionId}/verify`,
      {
        headers: {
          Authorization: `Bearer ${flutterwaveServerConfig.secretKey}`,
        },
      },
    );
    return await response.json();
  }

  /**
   * Initiate transfer to freelancer — SERVER ONLY.
   *
   * TODO [MONNIFY MIGRATION]:
   *   Endpoint: POST https://api.monnify.com/api/v1/disbursements/single
   *   Auth:     Monnify requires a SEPARATE disbursement auth token obtained via
   *             POST /api/v1/auth/login with disbursement credentials.
   *   Body maps to: { amount, reference, narration, destinationBankCode,
   *                   destinationAccountNumber, currency, destinationAccountName }
   */
  static async initiateTransfer(data: {
    account_bank:     string;
    account_number:   string;
    amount:           number;
    narration:        string;
    currency:         string;
    reference:        string;
    beneficiary_name: string;
  }) {
    const response = await this.fetchWithRetry(
      `${BASE_URL}/transfers`,
      {
        method: 'POST',
        headers: {
          Authorization:  `Bearer ${flutterwaveServerConfig.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      },
    );
    return await response.json();
  }

  /**
   * Verify bank account — SERVER ONLY.
   *
   * TODO [MONNIFY MIGRATION]:
   *   Endpoint: POST https://api.monnify.com/api/v1/disbursements/account/validate
   *   Auth:     Disbursement auth token (separate from transaction auth)
   *   Body:     { accountNumber, bankCode }
   */
  static async verifyBankAccount(accountNumber: string, bankCode: string) {
    const response = await this.fetchWithRetry(
      `${BASE_URL}/accounts/resolve`,
      {
        method: 'POST',
        headers: {
          Authorization:  `Bearer ${flutterwaveServerConfig.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account_number: accountNumber,
          account_bank:   bankCode,
        }),
      },
    );
    return await response.json();
  }

  /**
   * Get Nigerian banks list — SERVER ONLY.
   *
   * TODO [MONNIFY MIGRATION]:
   *   Endpoint: GET https://api.monnify.com/api/v1/sdk/transactions/banks
   *             ?currencyCode=NGN
   *   Auth:     Basic base64(API_KEY:SECRET_KEY)
   *   Response shape differs — normalise to { code, name }[] before returning.
   */
  static async getNigerianBanks() {
    const response = await this.fetchWithRetry(
      `${BASE_URL}/banks/NG`,
      {
        headers: {
          Authorization: `Bearer ${flutterwaveServerConfig.secretKey}`,
        },
      },
    );
    return await response.json();
  }

  /**
   * Refund a transaction — SERVER ONLY.
   *
   * ⚠️  PLACEHOLDER — Flutterwave refund call.
   *     This will be replaced during the Monnify migration.
   *
   * Current (FLW):
   *   Endpoint: POST https://api.flutterwave.com/v3/transactions/{flw_tx_id}/refund
   *   Auth:     Bearer FLUTTERWAVE_SECRET_KEY
   *   Body:     { amount } — omit for full refund
   *
   * TODO [MONNIFY MIGRATION]:
   *   Endpoint: POST https://api.monnify.com/api/v1/refunds/initiate-refund
   *   Auth:     Basic base64(API_KEY:SECRET_KEY)
   *   Body:     { transactionReference, refundReference, refundAmount,
   *               refundReason, customerNote, destinationAccountNumber,
   *               destinationAccountBankCode }
   *   Note:     `flwTxRef` will become a Monnify `transactionReference`.
   *             Generate a unique `refundReference` (e.g. `REF-${Date.now()}`).
   *
   * @param flwTxRef  - Flutterwave transaction reference (flutterwave_tx_ref column)
   * @param reason    - Admin-supplied reason, forwarded to the gateway as a note
   * @param amount    - Optional partial refund amount in NGN; omit for full refund
   */
  static async refundTransaction(
    flwTxRef: string,
    reason:   string,
    amount?:  number,
  ): Promise<{ status: string; message: string; data: unknown }> {
    // TODO [MONNIFY MIGRATION]: Replace body + endpoint + auth below.
    const body: Record<string, unknown> = { comment: reason };
    if (amount !== undefined) body.amount = amount;

    const response = await this.fetchWithRetry(
      `${BASE_URL}/transactions/${flwTxRef}/refund`,
      {
        method: 'POST',
        headers: {
          Authorization:  `Bearer ${flutterwaveServerConfig.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );
    return await response.json();
  }
}