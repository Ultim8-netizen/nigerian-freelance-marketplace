// ============================================================================
// src/hooks/useServices.ts
// Services management hook

import { useState, useEffect } from 'react';
import type { Service } from '@/types/database.types';

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

  const fetchServices = async (page: number = 1) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        per_page: pagination.per_page.toString(),
        ...(options.category && { category: options.category }),
        ...(options.state && { state: options.state }),
        ...(options.minPrice && { min_price: options.minPrice.toString() }),
        ...(options.maxPrice && { max_price: options.maxPrice.toString() }),
      });

      const response = await fetch(`/api/services?${params}`);
      const result = await response.json();

      if (result.success) {
        setServices(result.data);
        setPagination(result.pagination);
      } else {
        throw new Error(result.error);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createService = async (serviceData: any) => {
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
      fetchServices();
    }
  }, [options.category, options.state, options.minPrice, options.maxPrice]);

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