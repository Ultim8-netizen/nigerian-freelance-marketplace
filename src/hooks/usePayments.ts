// src/hooks/usePayments.ts
// Payment processing hook

import { useState } from 'react';

/**
 * Helper function to safely extract an error message from an unknown error type.
 * @param error The unknown error object caught in a try/catch block.
 * @returns A string representation of the error message.
 */
const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  // This handles cases where the error might be an object with a 'message' property
  if (typeof error === 'object' && error !== null && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }
  return String(error);
};


interface PaymentData {
  orderId: string;
  amount: number;
  email: string;
  phoneNumber?: string;
  fullName: string;
}

export function usePayments() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initiatePayment = async (data: PaymentData) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/payments/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: data.orderId,
          tx_ref: `TX-${Date.now()}-${data.orderId.slice(0, 8)}`,
        }),
      });

      const result = await response.json();

      if (result.success) {
        return { success: true, data: result.data };
      } else {
        throw new Error(result.error || 'Unknown error during payment initiation.');
      }
    } catch (err: unknown) { // Fixed: Replaced 'any' with 'unknown'
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const verifyPayment = async (transactionId: string, txRef: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_id: transactionId,
          tx_ref: txRef,
        }),
      });

      const result = await response.json();

      if (result.success) {
        return { success: true, data: result.data };
      } else {
        throw new Error(result.error || 'Unknown error during payment verification.');
      }
    } catch (err: unknown) { // Fixed: Replaced 'any' with 'unknown'
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);
      return { success: false, error: errorMessage };
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