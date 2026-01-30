// src/hooks/useAuth.query.ts
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import type { Profile } from '@/types/index';

// Profile type is now imported from auto-generated types
// This ensures it always stays in sync with the database schema

// Query keys for consistency
export const authQueryKeys = {
  session: ['auth', 'session'] as const,
  user: ['auth', 'user'] as const,
  profile: (userId?: string) => ['auth', 'profile', userId] as const,
  wallet: (userId?: string) => ['auth', 'wallet', userId] as const,
};

/**
 * Core authentication hook - Single source of truth for auth state
 * Replaces the old UserContext pattern
 */
export function useAuth() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  // Query for current session
  const {
    data: session,
    isLoading: isSessionLoading,
    error: sessionError,
  } = useQuery({
    queryKey: authQueryKeys.session,
    queryFn: async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      return data.session;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes (formerly cacheTime)
  });

  const user = session?.user ?? null;

  // Query for user profile
  const {
    data: profile,
    isLoading: isProfileLoading,
    error: profileError,
  } = useQuery({
    queryKey: authQueryKeys.profile(user?.id),
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      return data as Profile;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 2, // 2 minutes for profile data
  });

  // Query for user wallet
  const {
    data: wallet,
    isLoading: isWalletLoading,
    error: walletError,
  } = useQuery({
    queryKey: authQueryKeys.wallet(user?.id),
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        // If wallet doesn't exist, return null instead of throwing
        if (error.code === 'PGRST116') return null;
        throw error;
      }
      return data;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 2, // 2 minutes for wallet data
  });

  // Listen to Supabase auth changes and sync with React Query
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, newSession: Session | null) => {
        console.log('Auth state changed:', event);

        // Update session in cache immediately
        queryClient.setQueryData(authQueryKeys.session, newSession);

        // Handle different auth events
        switch (event) {
          case 'SIGNED_IN':
          case 'TOKEN_REFRESHED':
          case 'USER_UPDATED':
            // Invalidate profile to refetch with new session
            if (newSession?.user?.id) {
              queryClient.invalidateQueries({
                queryKey: authQueryKeys.profile(newSession.user.id),
              });
            }
            break;

          case 'SIGNED_OUT':
            // Clear all auth-related data
            queryClient.setQueryData(authQueryKeys.session, null);
            queryClient.removeQueries({
              queryKey: authQueryKeys.profile(undefined),
            });
            queryClient.removeQueries({
              queryKey: authQueryKeys.wallet(undefined),
            });
            break;

          case 'PASSWORD_RECOVERY':
            // Handle password recovery if needed
            break;
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase.auth, queryClient]);

  // Refresh profile mutation
  const refreshProfileMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('No user logged in');

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      return data as Profile;
    },
    onSuccess: (data) => {
      // Update cache immediately
      queryClient.setQueryData(authQueryKeys.profile(user?.id), data);
    },
  });

  // Refresh wallet mutation
  const refreshWalletMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('No user logged in');

      const { data, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Update cache immediately
      queryClient.setQueryData(authQueryKeys.wallet(user?.id), data);
    },
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (updates: Partial<Profile>) => {
      if (!user?.id) throw new Error('No user logged in');

      const { data, error } = await supabase
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;
      return data as Profile;
    },
    onMutate: async (updates) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: authQueryKeys.profile(user?.id),
      });

      // Snapshot previous value
      const previousProfile = queryClient.getQueryData<Profile>(
        authQueryKeys.profile(user?.id)
      );

      // Optimistically update
      if (previousProfile) {
        queryClient.setQueryData<Profile>(
          authQueryKeys.profile(user?.id),
          { ...previousProfile, ...updates }
        );
      }

      return { previousProfile };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousProfile) {
        queryClient.setQueryData(
          authQueryKeys.profile(user?.id),
          context.previousProfile
        );
      }
    },
    onSuccess: (data) => {
      // Update with server data
      queryClient.setQueryData(authQueryKeys.profile(user?.id), data);
    },
  });

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const { data, error } = await supabase.auth.signInWithPassword(credentials);
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(authQueryKeys.session, data.session);
      if (data.session?.user?.id) {
        queryClient.invalidateQueries({
          queryKey: authQueryKeys.profile(data.session.user.id),
        });
      }
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },
    onSuccess: () => {
      // Clear all cached data
      queryClient.clear();
    },
  });

  // Signup mutation
  const signupMutation = useMutation({
    mutationFn: async (credentials: {
      email: string;
      password: string;
      full_name: string;
      user_type: 'freelancer' | 'client' | 'both';
    }) => {
      const { data, error } = await supabase.auth.signUp({
        email: credentials.email,
        password: credentials.password,
        options: {
          data: {
            full_name: credentials.full_name,
            user_type: credentials.user_type,
          },
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(authQueryKeys.session, data.session);
      if (data.session?.user?.id) {
        queryClient.invalidateQueries({
          queryKey: authQueryKeys.profile(data.session.user.id),
        });
      }
    },
  });

  // Callback versions for backward compatibility
  const refreshProfile = useCallback(async () => {
    return refreshProfileMutation.mutateAsync();
  }, [refreshProfileMutation]);

  const updateProfile = useCallback(
    async (updates: Partial<Profile>) => {
      return updateProfileMutation.mutateAsync(updates);
    },
    [updateProfileMutation]
  );

  const refreshWallet = useCallback(async () => {
    return refreshWalletMutation.mutateAsync();
  }, [refreshWalletMutation]);

  return {
    // Auth state
    user,
    session,
    profile,
    wallet,
    isLoading: isSessionLoading || isProfileLoading,
    isAuthenticated: !!session,
    error: sessionError || profileError,

    // Mutations
    login: loginMutation.mutate,
    loginAsync: loginMutation.mutateAsync,
    logout: logoutMutation.mutate,
    logoutAsync: logoutMutation.mutateAsync,
    signup: signupMutation.mutate,
    signupAsync: signupMutation.mutateAsync,
    
    // Profile operations
    refreshProfile,
    updateProfile,

    // Wallet operations
    refreshWallet,

    // Loading states
    isLoggingIn: loginMutation.isPending,
    isLoggingOut: logoutMutation.isPending,
    isSigningUp: signupMutation.isPending,
    isUpdatingProfile: updateProfileMutation.isPending,
    isRefreshingProfile: refreshProfileMutation.isPending,
    isLoadingWallet: isWalletLoading,
    isRefreshingWallet: refreshWalletMutation.isPending,

    // Errors
    loginError: loginMutation.error,
    logoutError: logoutMutation.error,
    signupError: signupMutation.error,
    updateProfileError: updateProfileMutation.error,
    walletError,
  };
}

/**
 * Utility hooks for common use cases
 * These provide backward compatibility with the old UserContext API
 */

export function useUser() {
  const { user, profile, isLoading, refreshProfile, updateProfile } = useAuth();
  return { user, profile, isLoading, refreshProfile, updateProfile };
}

export function useProfile() {
  const { profile, isLoading, refreshProfile, updateProfile } = useAuth();
  return { profile, isLoading, refreshProfile, updateProfile };
}

export function useWallet() {
  const { wallet, isLoadingWallet, refreshWallet, walletError } = useAuth();
  return { 
    wallet, 
    isLoading: isLoadingWallet, 
    refreshWallet, 
    error: walletError 
  };
}

export function useWalletBalance() {
  const { wallet } = useAuth();
  return wallet?.balance ?? 0;
}

export function useUserType() {
  const { profile } = useAuth();
  return profile?.user_type as 'freelancer' | 'client' | 'both' | null | undefined;
}

export function useIsFreelancer() {
  const { profile } = useAuth();
  return profile?.user_type === 'freelancer' || profile?.user_type === 'both';
}

export function useIsClient() {
  const { profile } = useAuth();
  return profile?.user_type === 'client' || profile?.user_type === 'both';
}

export function useSession() {
  const { session, isLoading } = useAuth();
  return { session, isLoading };
}