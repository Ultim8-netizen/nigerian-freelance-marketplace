// ============================================================================
// src/hooks/useOrders.ts
// Orders management hook

import { useState, useEffect } from 'react';
import type { Order } from '@/types/database.types';

interface UseOrdersOptions {
  status?: string;
  userType?: 'client' | 'freelancer';
  autoFetch?: boolean;
}

export function useOrders(options: UseOrdersOptions = {}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        ...(options.status && { status: options.status }),
        ...(options.userType && { user_type: options.userType }),
      });

      const response = await fetch(`/api/orders?${params}`);
      const result = await response.json();

      if (result.success) {
        setOrders(result.data);
      } else {
        throw new Error(result.error);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deliverOrder = async (orderId: string, deliveryData: any) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/orders/${orderId}/deliver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deliveryData),
      });

      const result = await response.json();

      if (result.success) {
        await fetchOrders(); // Refresh
        return { success: true };
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

  useEffect(() => {
    if (options.autoFetch !== false) {
      fetchOrders();
    }
  }, [options.status, options.userType]);

  return {
    orders,
    loading,
    error,
    fetchOrders,
    deliverOrder,
    refresh: fetchOrders,
  };
}