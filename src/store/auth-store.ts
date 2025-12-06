// src/store/auth-store.ts
// Global authentication state management with Zustand

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User, Session } from '@supabase/supabase-js';
import type { Profile } from '@/types/database.types';

interface AuthState {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Actions
  setUser: (user: User | null) => void;
  setProfile: (profile: Profile | null) => void;
  setSession: (session: Session | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
  updateProfile: (updates: Partial<Profile>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      profile: null,
      session: null,
      isAuthenticated: false,
      isLoading: true,

      setUser: (user) => 
        set({ 
          user, 
          isAuthenticated: !!user 
        }),

      setProfile: (profile) => 
        set({ profile }),

      setSession: (session) => 
        set({ 
          session,
          isAuthenticated: !!session 
        }),

      setLoading: (loading) => 
        set({ isLoading: loading }),

      logout: () =>
        set({
          user: null,
          profile: null,
          session: null,
          isAuthenticated: false,
        }),

      updateProfile: (updates) => {
        const currentProfile = get().profile;
        if (currentProfile) {
          set({
            profile: { ...currentProfile, ...updates },
          });
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist these fields
        user: state.user,
        profile: state.profile,
        session: state.session,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Selectors for common use cases
export const selectIsFreelancer = (state: AuthState) =>
  state.profile?.user_type === 'freelancer' || 
  state.profile?.user_type === 'both';

export const selectIsClient = (state: AuthState) =>
  state.profile?.user_type === 'client' || 
  state.profile?.user_type === 'both';

export const selectUserType = (state: AuthState) =>
  state.profile?.user_type;

export const selectIsVerified = (state: AuthState) =>
  state.profile?.email_verified && state.profile?.phone_verified;