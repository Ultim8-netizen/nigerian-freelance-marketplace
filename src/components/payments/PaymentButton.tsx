// src/components/payments/PaymentButton.tsx
// Flutterwave payment using inline script (modern approach)

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

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

  useEffect(() => {
    // Load Flutterwave script
    const script = document.createElement('script');
    script.src = 'https://checkout.flutterwave.com/v3.js';
    script.async = true;
    script.onload = () => setIsScriptLoaded(true);
    document.body.appendChild(script);

    return () => {
      // Cleanup
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  const handlePayment = async () => {
    if (!isScriptLoaded) {
      alert('Payment system is loading. Please try again in a moment.');
      return;
    }

    setIsLoading(true);

    try {
      // Generate unique transaction reference
      const txRef = `TX-${Date.now()}-${orderId.slice(0, 8)}`;

      // Make payment
      window.FlutterwaveCheckout({
        public_key: process.env.NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY!,
        tx_ref: txRef,
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
          logo: `${process.env.NEXT_PUBLIC_APP_URL}/logo.png`,
        },
        callback: async (response: any) => {
          console.log('Payment response:', response);
          
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

              const result = await verifyResponse.json();
              
              if (result.success) {
                onSuccess();
              } else {
                alert('Payment verification failed. Please contact support.');
              }
            } catch (error) {
              console.error('Verification error:', error);
              alert('Payment verification failed. Please contact support.');
            }
          }
          
          setIsLoading(false);
        },
        onclose: () => {
          setIsLoading(false);
          onClose?.();
        },
      });
    } catch (error) {
      console.error('Payment error:', error);
      setIsLoading(false);
      alert('Payment failed. Please try again.');
    }
  };

  return (
    <Button
      onClick={handlePayment}
      disabled={isLoading || !isScriptLoaded}
      className="w-full"
    >
      {isLoading ? 'Processing...' : !isScriptLoaded ? 'Loading...' : 'Pay Now'}
    </Button>
  );
}