// src/hooks/useAuth.ts
// Authentication hook with user state management

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { AuthService } from '@/lib/auth/auth-utils';
import type { Profile } from '@/types/database.types';
import type { User, Session } from '@supabase/supabase-js';

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

interface AuthState {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
}

export function useAuth() {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    session: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    // Get initial session
    const initAuth = async () => {
      try {
        const session = await AuthService.getSession();
        
        if (session) {
          const profile = await AuthService.getProfile();
          setState({
            user: session.user,
            profile,
            session,
            loading: false,
            error: null,
          });
        } else {
          setState({
            user: null,
            profile: null,
            session: null,
            loading: false,
            error: null,
          });
        }
      } catch (error: unknown) { // Fixed: changed 'any' to 'unknown'
        setState({
          user: null,
          profile: null,
          session: null,
          loading: false,
          error: getErrorMessage(error), // Fixed: using helper function
        });
      }
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session) {
          try {
            const profile = await AuthService.getProfile();
            setState({
              user: session.user,
              profile,
              session,
              loading: false,
              error: null,
            });
          } catch (profileError: unknown) {
             // Handle profile fetch error during auth change
             setState(prev => ({
              ...prev,
              loading: false,
              error: `Auth successful but profile fetch failed: ${getErrorMessage(profileError)}`,
            }));
          }
        } else {
          setState({
            user: null,
            profile: null,
            session: null,
            loading: false,
            error: null,
          });
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [router]); // Added router to dependency array for completeness

  const login = async (email: string, password: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      // Assuming AuthService.login returns { user, session }
      const { user, session } = await AuthService.login({ email, password });
      
      // Ensure user and session are present before continuing
      if (!user || !session) {
        throw new Error("Login failed: User or session data is missing.");
      }

      const profile = await AuthService.getProfile();
      
      setState({
        user,
        profile,
        session,
        loading: false,
        error: null,
      });

      return { success: true };
    } catch (error: unknown) { // Fixed: changed 'any' to 'unknown'
      const errorMessage = getErrorMessage(error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));
      return { success: false, error: errorMessage };
    }
  };

  const logout = async () => {
    setState(prev => ({ ...prev, loading: true }));
    
    try {
      await AuthService.logout();
      setState({
        user: null,
        profile: null,
        session: null,
        loading: false,
        error: null,
      });
      router.push('/login');
    } catch (error: unknown) { // Fixed: changed 'any' to 'unknown'
      const errorMessage = getErrorMessage(error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));
    }
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const updatedProfile = await AuthService.updateProfile(updates);
      setState(prev => ({
        ...prev,
        profile: updatedProfile,
        loading: false,
      }));
      return { success: true };
    } catch (error: unknown) { // Fixed: changed 'any' to 'unknown'
      const errorMessage = getErrorMessage(error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));
      return { success: false, error: errorMessage };
    }
  };

  return {
    ...state,
    login,
    logout,
    updateProfile,
    isAuthenticated: !!state.user,
    isFreelancer: state.profile?.user_type === 'freelancer' || state.profile?.user_type === 'both',
    isClient: state.profile?.user_type === 'client' || state.profile?.user_type === 'both',
  };
}