// src/hooks/useAuth.ts
// Authentication hook with user state management

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { AuthService } from '@/lib/auth/auth-utils';
import type { Profile } from '@/types/database.types';
import type { User, Session } from '@supabase/supabase-js';

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
      } catch (error: any) {
        setState({
          user: null,
          profile: null,
          session: null,
          loading: false,
          error: error.message,
        });
      }
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
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
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const { user, session } = await AuthService.login({ email, password });
      const profile = await AuthService.getProfile();
      
      setState({
        user,
        profile,
        session,
        loading: false,
        error: null,
      });

      return { success: true };
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message,
      }));
      return { success: false, error: error.message };
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
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message,
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
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message,
      }));
      return { success: false, error: error.message };
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