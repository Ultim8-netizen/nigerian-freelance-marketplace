// src/hooks/useJobs.ts
// Jobs management hook

import { useState, useEffect, useCallback } from 'react';
import type { Job, PaginatedResponse } from '@/types/database.types'; // Removed unused 'Proposal' type

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

interface UseJobsOptions {
  category?: string;
  status?: string;
  state?: string;
  autoFetch?: boolean;
}

export function useJobs(options: UseJobsOptions = {}) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 20,
    total: 0,
    total_pages: 0,
  });

  // Wrapped fetchJobs in useCallback to create a stable function reference
  const fetchJobs = useCallback(async (page: number = 1) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        per_page: pagination.per_page.toString(),
        ...(options.category && { category: options.category }),
        ...(options.status && { status: options.status }),
        ...(options.state && { state: options.state }),
      });

      const response = await fetch(`/api/jobs?${params}`);
      const result: PaginatedResponse<Job> = await response.json();

      if (result.data) {
        setJobs(result.data);
        setPagination(result.pagination);
      } else {
        throw new Error('Failed to fetch jobs');
      }
    } catch (err: unknown) { // Fixed: Replaced 'any' with 'unknown'
      setError(getErrorMessage(err)); // Fixed: Using getErrorMessage helper
    } finally {
      setLoading(false);
    }
  }, [
    pagination.per_page, 
    options.category, 
    options.status, 
    options.state, 
    // Note: options.autoFetch is not needed here as it only controls initial call
  ]);

  // Fixed: Replaced 'any' with a safer type for the payload
  const createJob = async (jobData: Record<string, unknown>) => { 
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jobData),
      });

      const result = await response.json();

      if (result.success) {
        await fetchJobs(); // Refresh list
        return { success: true, data: result.data };
      } else {
        throw new Error(result.error);
      }
    } catch (err: unknown) { // Fixed: Replaced 'any' with 'unknown'
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Fixed: Replaced 'any' with a safer type for the payload
  const submitProposal = async (proposalData: Record<string, unknown>) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(proposalData),
      });

      const result = await response.json();

      if (result.success) {
        return { success: true, data: result.data };
      } else {
        throw new Error(result.error);
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
    // Fixed: Included fetchJobs and options.autoFetch as dependencies
    if (options.autoFetch !== false) {
      fetchJobs();
    }
  }, [fetchJobs, options.autoFetch]); 

  return {
    jobs,
    loading,
    error,
    pagination,
    fetchJobs,
    createJob,
    submitProposal,
    nextPage: () => fetchJobs(pagination.page + 1),
    prevPage: () => fetchJobs(pagination.page - 1),
    refresh: () => fetchJobs(pagination.page),
  };
}