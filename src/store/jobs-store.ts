// src/store/jobs-store.ts
// Jobs and proposals state management

import { create } from 'zustand';
import type { Job, Proposal } from '@/types/database.types';

interface JobsState {
  jobs: Job[];
  selectedJob: Job | null;
  myProposals: Proposal[];
  filters: {
    category?: string;
    budget_type?: string;
    experience_level?: string;
    status?: string;
  };
  isLoading: boolean;
  error: string | null;
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
  
  // Actions
  setJobs: (jobs: Job[]) => void;
  setSelectedJob: (job: Job | null) => void;
  setMyProposals: (proposals: Proposal[]) => void;
  setFilters: (filters: Partial<JobsState['filters']>) => void;
  clearFilters: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setPagination: (pagination: Partial<JobsState['pagination']>) => void;
  addJob: (job: Job) => void;
  updateJob: (id: string, updates: Partial<Job>) => void;
  removeJob: (id: string) => void;
  addProposal: (proposal: Proposal) => void;
  updateProposal: (id: string, updates: Partial<Proposal>) => void;
}

export const useJobsStore = create<JobsState>((set, get) => ({
  jobs: [],
  selectedJob: null,
  myProposals: [],
  filters: {},
  isLoading: false,
  error: null,
  pagination: {
    page: 1,
    per_page: 20,
    total: 0,
    total_pages: 0,
  },

  setJobs: (jobs) => 
    set({ jobs }),

  setSelectedJob: (job) => 
    set({ selectedJob: job }),

  setMyProposals: (proposals) =>
    set({ myProposals: proposals }),

  setFilters: (newFilters) =>
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
    })),

  clearFilters: () =>
    set({ filters: {} }),

  setLoading: (loading) =>
    set({ isLoading: loading }),

  setError: (error) =>
    set({ error }),

  setPagination: (pagination) =>
    set((state) => ({
      pagination: { ...state.pagination, ...pagination },
    })),

  addJob: (job) =>
    set((state) => ({
      jobs: [job, ...state.jobs],
    })),

  updateJob: (id, updates) =>
    set((state) => ({
      jobs: state.jobs.map((job) =>
        job.id === id ? { ...job, ...updates } : job
      ),
      selectedJob:
        state.selectedJob?.id === id
          ? { ...state.selectedJob, ...updates }
          : state.selectedJob,
    })),

  removeJob: (id) =>
    set((state) => ({
      jobs: state.jobs.filter((job) => job.id !== id),
      selectedJob:
        state.selectedJob?.id === id ? null : state.selectedJob,
    })),

  addProposal: (proposal) =>
    set((state) => ({
      myProposals: [proposal, ...state.myProposals],
    })),

  updateProposal: (id, updates) =>
    set((state) => ({
      myProposals: state.myProposals.map((proposal) =>
        proposal.id === id ? { ...proposal, ...updates } : proposal
      ),
    })),
}));

// Selectors
export const selectJobById = (state: JobsState, id: string) =>
  state.jobs.find((job) => job.id === id);

export const selectProposalByJobId = (state: JobsState, jobId: string) =>
  state.myProposals.find((proposal) => proposal.job_id === jobId);

export const selectHasApplied = (state: JobsState, jobId: string) =>
  state.myProposals.some((proposal) => proposal.job_id === jobId);

export const selectActiveProposals = (state: JobsState) =>
  state.myProposals.filter((p) => p.status === 'pending');