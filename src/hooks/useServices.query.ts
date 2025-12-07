import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-client';
import type { Service } from '@/types/database.types';

export function useServices(filters?: Record<string, any>) {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.servicesList(filters),
    queryFn: async () => {
      const params = new URLSearchParams(filters);
      const response = await fetch(`/api/services?${params}`);
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      return result;
    },
  });

  const createServiceMutation = useMutation({
    mutationFn: async (serviceData: any) => {
      const response = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serviceData),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.services });
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