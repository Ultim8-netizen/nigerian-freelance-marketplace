// src/hooks/useServices.ts
// Services management hook

import { useState, useEffect, useCallback } from 'react';
import type { Service } from '@/types';

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

interface UseServicesOptions {
  category?: string;
  state?: string;
  minPrice?: number;
  maxPrice?: number;
  autoFetch?: boolean;
}

export function useServices(options: UseServicesOptions = {}) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 20,
    total: 0,
    total_pages: 0,
  });

  // Use useCallback to memoize fetchServices, resolving the exhaustive-deps warning later
  const fetchServices = useCallback(async (page: number = 1) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        per_page: pagination.per_page.toString(),
        ...(options.category && { category: options.category }),
        ...(options.state && { state: options.state }),
        // Convert number filters to string for URLSearchParams
        ...(options.minPrice && { min_price: options.minPrice.toString() }),
        ...(options.maxPrice && { max_price: options.maxPrice.toString() }),
      });

      const response = await fetch(`/api/services?${params}`);
      const result = await response.json();

      if (result.success) {
        setServices(result.data);
        setPagination(result.pagination);
      } else {
        throw new Error(result.error || 'Failed to fetch services.');
      }
    } catch (err: unknown) { // Fixed: Replaced 'any' with 'unknown'
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [
    pagination.per_page, 
    options.category, 
    options.state, 
    options.minPrice, 
    options.maxPrice
  ]);

  // Fixed: Replaced 'any' with Record<string, unknown> for serviceData type
  const createService = async (serviceData: Record<string, unknown>) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serviceData),
      });

      const result = await response.json();

      if (result.success) {
        await fetchServices(); // Refresh list
        return { success: true, data: result.data };
      } else {
        throw new Error(result.error || 'Failed to create service.');
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
    // Fixed: Added fetchServices and options.autoFetch as dependencies
    if (options.autoFetch !== false) {
      fetchServices();
    }
  }, [fetchServices, options.autoFetch]); 

  return {
    services,
    loading,
    error,
    pagination,
    fetchServices,
    createService,
    nextPage: () => fetchServices(pagination.page + 1),
    prevPage: () => fetchServices(pagination.page - 1),
    refresh: () => fetchServices(pagination.page),
  };
}