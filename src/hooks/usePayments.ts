// src/hooks/usePayments.ts
// Payment processing hook — Monnify edition.
// initiatePayment  → POST /api/payments/initiate → returns { checkout_url, payment_ref }
// verifyPayment    → POST /api/payments/verify   → accepts payment_ref

import { useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface InitiatePaymentData {
  orderId:      string;
  redirectUrl?: string;
}

interface InitiatePaymentResult {
  checkout_url: string;
  payment_ref:  string;
}

interface VerifyPaymentResult {
  transaction: Record<string, unknown>;
  order:       Record<string, unknown> | null;
}

// ── Helper ────────────────────────────────────────────────────────────────────

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message;
  }
  return String(error);
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function usePayments() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  /**
   * Initialise a Monnify transaction for the given order.
   * Returns { checkout_url, payment_ref } — caller is responsible for
   * redirecting to checkout_url.
   */
  const initiatePayment = async (
    data: InitiatePaymentData,
  ): Promise<
    | { success: true;  data: InitiatePaymentResult }
    | { success: false; error: string }
  > => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/payments/initiate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          order_id:     data.orderId,
          redirect_url: data.redirectUrl,
        }),
      });

      const result = await response.json() as {
        success: boolean;
        error?:  string;
        data?:   InitiatePaymentResult;
      };

      if (result.success && result.data) {
        return { success: true, data: result.data };
      }

      throw new Error(result.error || 'Unknown error during payment initiation.');
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Manually verify a payment by its Monnify payment reference.
   * Used as a fallback when the webhook has not yet fired.
   * Idempotent: safe to call multiple times.
   *
   * Returns `message: 'Payment already verified'` when the webhook already
   * settled this transaction — the callback page uses this to render the
   * `already_paid` state without re-running side effects.
   */
  const verifyPayment = async (
    paymentRef: string,
  ): Promise<
    | { success: true;  data: VerifyPaymentResult; message?: string }
    | { success: false; error: string }
  > => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/payments/verify', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ payment_ref: paymentRef }),
      });

      const result = await response.json() as {
        success:  boolean;
        error?:   string;
        message?: string;
        data?:    VerifyPaymentResult;
      };

      if (result.success && result.data) {
        return {
          success: true,
          data:    result.data,
          message: result.message, // 'Payment already verified' on idempotent hit
        };
      }

      throw new Error(result.error || 'Unknown error during payment verification.');
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    initiatePayment,
    verifyPayment,
  };
}