// src/lib/query-client.ts
// Unified state management using React Query (TanStack Query)
// This replaces both Zustand stores AND custom hooks

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (was cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Query keys for type-safety and consistency
export const queryKeys = {
  // Auth
  auth: ['auth'] as const,
  profile: ['profile'] as const,
  
  // Services
  services: ['services'] as const,
  servicesList: (filters?: Record<string, unknown>) => 
    ['services', 'list', filters] as const,
  serviceDetail: (id: string) => 
    ['services', 'detail', id] as const,
  myServices: ['services', 'my'] as const,
  
  // Jobs
  jobs: ['jobs'] as const,
  jobsList: (filters?: Record<string, unknown>) => 
    ['jobs', 'list', filters] as const,
  jobDetail: (id: string) => 
    ['jobs', 'detail', id] as const,
  myJobs: ['jobs', 'my'] as const,
  
  // Orders
  orders: ['orders'] as const,
  ordersList: (status?: string, userType?: string) => 
    ['orders', 'list', { status, userType }] as const,
  orderDetail: (id: string) => 
    ['orders', 'detail', id] as const,
  
  // Proposals
  proposals: ['proposals'] as const,
  myProposals: ['proposals', 'my'] as const,
  jobProposals: (jobId: string) => 
    ['proposals', 'job', jobId] as const,
  
  // Wallet
  wallet: ['wallet'] as const,
  transactions: ['transactions'] as const,
  
  // Notifications
  notifications: ['notifications'] as const,
  unreadCount: ['notifications', 'unread-count'] as const,
};