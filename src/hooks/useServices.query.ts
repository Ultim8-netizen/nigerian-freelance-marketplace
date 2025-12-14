import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-client';
// import type { Service } from '@/types/database.types'; // Removed: 'Service' is defined but never used.

interface PaginatedData<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
  error?: string;
}

// Placeholder type for service data being sent/received
type ServiceData = Record<string, unknown>;

export function useServices(filters?: Record<string, unknown>) { // Fixed: Replaced 'any' with 'unknown'
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<PaginatedData<ServiceData>>({
    queryKey: queryKeys.servicesList(filters),
    queryFn: async () => {
      // Create search parameters, ensuring values are converted to string
      const searchParams = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            searchParams.append(key, String(value));
          }
        });
      }
      
      const response = await fetch(`/api/services?${searchParams.toString()}`);
      const result = await response.json();
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to fetch services.');
      }
      return result;
    },
  });

  const createServiceMutation = useMutation({
    mutationFn: async (serviceData: ServiceData) => { // Fixed: Replaced 'any' with explicit type
      const response = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serviceData),
      });
      const result = await response.json();
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to create service.');
      }
      return result.data;
    },
    onSuccess: () => {
      // Invalidate the services list query to automatically refetch the new list
      queryClient.invalidateQueries({ queryKey: queryKeys.servicesList() }); 
    },
  });

  return {
    services: data?.data || [],
    pagination: data?.pagination,
    isLoading,
    error,
    createService: createServiceMutation.mutate,
    isCreating: createServiceMutation.isPending,
  };
}