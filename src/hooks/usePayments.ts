// ============================================================================
// src/hooks/usePayments.ts
// Payment processing hook

import { useState } from 'react';

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
        throw new Error(result.error);
      }
    } catch (err: any) {
      setError(err.message);
      return { success: false, error: err.message };
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
        throw new Error(result.error);
      }
    } catch (err: any) {
      setError(err.message);
      return { success: false, error: err.message };
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