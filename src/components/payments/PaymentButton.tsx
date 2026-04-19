'use client';

// src/components/payments/PaymentButton.tsx
// Initiates a Monnify hosted-checkout session and redirects the browser.
// No external scripts are loaded. No modal is mounted.
// The Monnify payment page handles the full checkout flow.

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export interface PaymentButtonProps {
  orderId:   string;
  amount:    number;
  onSuccess?: () => void;
  onError?:   (message: string) => void;
}

export function PaymentButton({
  orderId,
  amount,
  onSuccess,
  onError,
}: PaymentButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePayment = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/payments/initiate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          order_id:     orderId,
          redirect_url: `${window.location.origin}/payment/callback`,
        }),
      });

      const result = await response.json() as {
        success: boolean;
        error?:  string;
        data?:   { checkout_url: string; payment_ref: string };
      };

      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || 'Payment initialisation failed');
      }

      // Notify the parent that initiation was successful before leaving the page
      onSuccess?.();

      // Redirect to Monnify's hosted checkout page.
      // Monnify will redirect back to /payment/callback when done.
      window.location.href = result.data.checkout_url;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'An unknown error occurred';
      setError(message);
      onError?.(message);
      setIsLoading(false);
    }
    // Note: setIsLoading(false) is intentionally omitted on the success path —
    // the page is navigating away, so keeping the loading state prevents a
    // flicker from the button reverting before the redirect completes.
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
          {error}
        </div>
      )}

      <Button
        onClick={handlePayment}
        disabled={isLoading}
        className="w-full"
      >
        {isLoading ? 'Redirecting to payment…' : `Pay ₦${amount.toLocaleString()}`}
      </Button>
    </div>
  );
}