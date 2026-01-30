// src/hooks/useOrders.ts
// Orders management hook

import { useState, useEffect, useCallback } from 'react';
import type { Order } from '@/types';

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

interface UseOrdersOptions {
  status?: string;
  userType?: 'client' | 'freelancer';
  autoFetch?: boolean;
}

export function useOrders(options: UseOrdersOptions = {}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use useCallback to create a stable fetchOrders function, resolving dependency warnings
  const fetchOrders = useCallback(async () => {
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
        throw new Error(result.error || 'Unknown error fetching orders.');
      }
    } catch (err: unknown) { // Fixed: Replaced 'any' with 'unknown'
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [options.status, options.userType]); // Dependencies for fetchOrders

  // Fixed: Replaced 'any' with Record<string, unknown> for type safety
  const deliverOrder = async (orderId: string, deliveryData: Record<string, unknown>) => {
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
        throw new Error(result.error || 'Unknown error during order delivery.');
      }
    } catch (err: unknown) { // Fixed: Replaced 'any' with 'unknown'
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (options.autoFetch !== false) {
      fetchOrders();
    }
  }, [fetchOrders, options.autoFetch]); // Fixed: Added fetchOrders and options.autoFetch as dependencies

  return {
    orders,
    loading,
    error,
    fetchOrders,
    deliverOrder,
    refresh: fetchOrders,
  };
}