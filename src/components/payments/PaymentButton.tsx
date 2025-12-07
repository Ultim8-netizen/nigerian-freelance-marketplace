// src/components/payments/PaymentButton.tsx
// Fixed: Uses only client-safe config

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { flutterwaveClientConfig } from '@/lib/flutterwave/client-config';

interface PaymentButtonProps {
  orderId: string;
  amount: number;
  email: string;
  phoneNumber: string;
  fullName: string;
  onSuccess: () => void;
  onClose?: () => void;
}

declare global {
  interface Window {
    FlutterwaveCheckout: (config: any) => void;
  }
}

export function PaymentButton({
  orderId,
  amount,
  email,
  phoneNumber,
  fullName,
  onSuccess,
  onClose,
}: PaymentButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load Flutterwave script
    const script = document.createElement('script');
    script.src = 'https://checkout.flutterwave.com/v3.js';
    script.async = true;
    script.onload = () => setIsScriptLoaded(true);
    script.onerror = () => setError('Failed to load payment system');
    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  const handlePayment = async () => {
    if (!isScriptLoaded) {
      setError('Payment system is loading. Please try again.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Call API to get payment link (server-side generation)
      const response = await fetch('/api/payments/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: orderId,
          redirect_url: `${window.location.origin}/payment/callback`,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Payment initialization failed');
      }

      // Use inline checkout with client-safe public key
      window.FlutterwaveCheckout({
        public_key: flutterwaveClientConfig.publicKey,
        tx_ref: result.data.tx_ref,
        amount: amount,
        currency: 'NGN',
        payment_options: 'card,banktransfer,ussd,mobilemoney',
        customer: {
          email: email,
          phone_number: phoneNumber,
          name: fullName,
        },
        customizations: {
          title: 'Nigerian Freelance Marketplace',
          description: 'Payment for freelance services',
          logo: `${window.location.origin}/logo.png`,
        },
        callback: async (response: any) => {
          if (response.status === 'successful') {
            // Verify payment on backend
            try {
              const verifyResponse = await fetch('/api/payments/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  transaction_id: response.transaction_id,
                  tx_ref: response.tx_ref,
                }),
              });

              const verifyResult = await verifyResponse.json();

              if (verifyResult.success) {
                onSuccess();
              } else {
                setError('Payment verification failed. Contact support.');
              }
            } catch (error) {
              console.error('Verification error:', error);
              setError('Payment verification failed. Contact support.');
            }
          } else {
            setError('Payment was not successful');
          }

          setIsLoading(false);
        },
        onclose: () => {
          setIsLoading(false);
          onClose?.();
        },
      });
    } catch (error: any) {
      console.error('Payment error:', error);
      setError(error.message || 'Payment failed');
      setIsLoading(false);
    }
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
        disabled={isLoading || !isScriptLoaded}
        className="w-full"
      >
        {isLoading
          ? 'Processing...'
          : !isScriptLoaded
          ? 'Loading...'
          : `Pay ₦${amount.toLocaleString()}`}
      </Button>
    </div>
  );
}