// src/lib/hooks/useVerificationStatus.ts
// Custom hook for checking verification status
import { useState, useEffect } from 'react';

interface VerificationStatus {
  is_verified: boolean;
  status: string;
  cost: number;
  isLoading: boolean;
  refresh: () => void;
}

export function useVerificationStatus(): VerificationStatus {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/verification/nin/status');
      const result = await response.json();
      
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch verification status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  return {
    is_verified: data?.is_verified || false,
    status: data?.status || 'not_started',
    cost: data?.cost || 150,
    isLoading,
    refresh: fetchStatus,
  };
}