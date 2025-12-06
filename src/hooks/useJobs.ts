// ============================================================================
// src/hooks/useJobs.ts
// Jobs management hook

import { useState, useEffect } from 'react';
import type { Job, Proposal, PaginatedResponse } from '@/types/database.types';

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

  const fetchJobs = async (page: number = 1) => {
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
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createJob = async (jobData: any) => {
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
    } catch (err: any) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const submitProposal = async (proposalData: any) => {
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
    } catch (err: any) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (options.autoFetch !== false) {
      fetchJobs();
    }
  }, [options.category, options.status, options.state]);

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