// src/components/marketplace/BuyNowButton.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { ShoppingCart, Loader2, MapPin, Phone, User } from 'lucide-react';
import { NIGERIAN_STATES } from '@/types/location.types';

interface BuyNowButtonProps {
  productId: string;
  className?: string;
}

export function BuyNowButton({ productId, className }: BuyNowButtonProps) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    quantity: 1,
    full_name: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    landmark: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/marketplace/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: productId,
          quantity: formData.quantity,
          delivery_address: {
            full_name: formData.full_name,
            phone: formData.phone,
            address: formData.address,
            city: formData.city,
            state: formData.state,
            landmark: formData.landmark,
          },
          payment_method: 'card',
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Redirect to payment or order confirmation
        router.push(`/marketplace/orders/${result.data.id}/payment`);
      } else {
        setError(result.error || 'Failed to create order');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Button 
        onClick={() => setShowModal(true)} 
        className={className}
        size="lg"
      >
        <ShoppingCart className="w-5 h-5 mr-2" />
        Buy Now
      </Button>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Complete Your Order</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Quantity */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Quantity
                </label>
                <Input
                  type="number"
                  name="quantity"
                  value={formData.quantity}
                  onChange={handleChange}
                  min="1"
                  max="100"
                  required
                />
              </div>

              {/* Delivery Information */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Delivery Information
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <Input
                      name="full_name"
                      value={formData.full_name}
                      onChange={handleChange}
                      placeholder="John Doe"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Phone Number <span className="text-red-500">*</span>
                    </label>
                    <Input
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="08012345678"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Delivery Address <span className="text-red-500">*</span>
                    </label>
                    <Textarea
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      placeholder="Street address"
                      required
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        State <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="state"
                        value={formData.state}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border rounded-md"
                        required
                      >
                        <option value="">Select state</option>
                        {NIGERIAN_STATES.map((state) => (
                          <option key={state} value={state}>
                            {state}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">
                        City <span className="text-red-500">*</span>
                      </label>
                      <Input
                        name="city"
                        value={formData.city}
                        onChange={handleChange}
                        placeholder="Lagos"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Landmark (Optional)
                    </label>
                    <Input
                      name="landmark"
                      value={formData.landmark}
                      onChange={handleChange}
                      placeholder="Near police station, opposite GTBank"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Help the delivery person find you easily
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-6 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowModal(false)}
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Proceed to Payment'
                  )}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </>
  );
}