// src/components/payments/PaymentButton.tsx
// Flutterwave payment integration component

'use client';

import { useState } from 'react';
import { useFlutterwave, closePaymentModal } from 'flutterwave-react-v3';
import { Button } from '@/components/ui/button';
import { flutterwaveConfig } from '@/lib/flutterwave/config';

interface PaymentButtonProps {
  orderId: string;
  amount: number;
  email: string;
  phoneNumber: string;
  fullName: string;
  onSuccess: () => void;
  onClose?: () => void;
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

  const config = {
    public_key: flutterwaveConfig.publicKey,
    tx_ref: `TX-${Date.now()}-${orderId}`,
    amount,
    currency: 'NGN',
    payment_options: 'card,mobilemoney,ussd,banktransfer',
    customer: {
      email,
      phone_number: phoneNumber,
      name: fullName,
    },
    customizations: {
      title: 'Nigerian Freelance Marketplace',
      description: 'Payment for freelance services',
      logo: `${process.env.NEXT_PUBLIC_APP_URL}/logo.png`,
    },
  };

  const handleFlutterPayment = useFlutterwave(config);

  const handlePayment = () => {
    setIsLoading(true);
    handleFlutterPayment({
      callback: async (response) => {
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
            }
          } catch (error) {
            console.error('Payment verification failed:', error);
          }
        }
        
        closePaymentModal();
        setIsLoading(false);
      },
      onClose: () => {
        setIsLoading(false);
        onClose?.();
      },
    });
  };

  return (
    <Button
      onClick={handlePayment}
      disabled={isLoading}
      className="w-full"
    >
      {isLoading ? 'Processing...' : 'Pay Now'}
    </Button>
  );
}