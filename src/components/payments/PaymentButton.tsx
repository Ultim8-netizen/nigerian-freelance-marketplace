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

// --- Flutterwave Type Definitions to resolve 'any' errors ---

/** Defines the structure of the data returned by the Flutterwave callback. */
interface FlutterwaveResponse {
  status: 'successful' | 'pending' | 'cancelled' | string;
  transaction_id: number;
  tx_ref: string;
  amount: number;
  currency: string;
}

/** Defines the required configuration object for window.FlutterwaveCheckout. */
interface FlutterwaveConfig {
  public_key: string;
  tx_ref: string;
  amount: number;
  currency: 'NGN' | string;
  payment_options: string;
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
  callback: (response: FlutterwaveResponse) => void;
  onclose: () => void;
}

declare global {
  interface Window {
    FlutterwaveCheckout: (config: FlutterwaveConfig) => void;
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

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Payment initialization failed');
      }

      // Configure the payment object using the defined interface
      const config: FlutterwaveConfig = {
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
        // Use typed response for the callback
        callback: async (response: FlutterwaveResponse) => {
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
      };

      // Use inline checkout with client-safe public key
      window.FlutterwaveCheckout(config);
      
    } catch (error: unknown) { // Use unknown for the catch error
      console.error('Payment error:', error);
      // Safely extract error message
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('An unknown payment failure occurred.');
      }
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