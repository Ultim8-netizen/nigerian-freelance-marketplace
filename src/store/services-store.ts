// src/store/services-store.ts
// Services state management

import { create } from 'zustand';
import type { Service, SearchFilters } from '@/types/database.types';

interface ServicesState {
  services: Service[];
  selectedService: Service | null;
  filters: SearchFilters;
  isLoading: boolean;
  error: string | null;
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
  
  // Actions
  setServices: (services: Service[]) => void;
  setSelectedService: (service: Service | null) => void;
  setFilters: (filters: Partial<SearchFilters>) => void;
  clearFilters: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setPagination: (pagination: Partial<ServicesState['pagination']>) => void;
  addService: (service: Service) => void;
  updateService: (id: string, updates: Partial<Service>) => void;
  removeService: (id: string) => void;
}

const defaultFilters: SearchFilters = {
  category: undefined,
  min_price: undefined,
  max_price: undefined,
  delivery_days: undefined,
  rating_min: undefined,
  verified_only: false,
  sort_by: 'recent',
  page: 1,
  per_page: 20,
};

export const useServicesStore = create<ServicesState>((set, get) => ({
  services: [],
  selectedService: null,
  filters: defaultFilters,
  isLoading: false,
  error: null,
  pagination: {
    page: 1,
    per_page: 20,
    total: 0,
    total_pages: 0,
  },

  setServices: (services) => 
    set({ services }),

  setSelectedService: (service) => 
    set({ selectedService: service }),

  setFilters: (newFilters) =>
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
    })),

  clearFilters: () =>
    set({ filters: defaultFilters }),

  setLoading: (loading) =>
    set({ isLoading: loading }),

  setError: (error) =>
    set({ error }),

  setPagination: (pagination) =>
    set((state) => ({
      pagination: { ...state.pagination, ...pagination },
    })),

  addService: (service) =>
    set((state) => ({
      services: [service, ...state.services],
    })),

  updateService: (id, updates) =>
    set((state) => ({
      services: state.services.map((service) =>
        service.id === id ? { ...service, ...updates } : service
      ),
      selectedService:
        state.selectedService?.id === id
          ? { ...state.selectedService, ...updates }
          : state.selectedService,
    })),

  removeService: (id) =>
    set((state) => ({
      services: state.services.filter((service) => service.id !== id),
      selectedService:
        state.selectedService?.id === id ? null : state.selectedService,
    })),
}));

// Selectors
export const selectFilteredServices = (state: ServicesState) => {
  let filtered = state.services;

  // Apply client-side filters if needed
  if (state.filters.verified_only) {
    filtered = filtered.filter(
      (s) => s.freelancer?.identity_verified
    );
  }

  return filtered;
};

export const selectActiveFiltersCount = (state: ServicesState) => {
  let count = 0;
  if (state.filters.category) count++;
  if (state.filters.min_price) count++;
  if (state.filters.max_price) count++;
  if (state.filters.delivery_days) count++;
  if (state.filters.rating_min) count++;
  if (state.filters.verified_only) count++;
  return count;
};