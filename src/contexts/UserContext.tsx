// src/contexts/UserContext.tsx
'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { User, AuthChangeEvent, Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone_number?: string;
  user_type: 'freelancer' | 'client' | 'both';
  avatar_url?: string;
  bio?: string;
  university?: string;
  location?: string;
  wallet_balance: number;
  total_earned?: number;
  total_spent?: number;
  rating?: number;
  total_reviews?: number;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

interface UserContextType {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({
  children,
  user: initialUser,
  profile: initialProfile,
}: {
  children: ReactNode;
  user: User | null;
  profile: Profile | null;
}) {
  const [user, setUser] = useState<User | null>(initialUser);
  const [profile, setProfile] = useState<Profile | null>(initialProfile);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();

  // Refresh profile data from database
  const refreshProfile = useCallback(async () => {
    const currentUser = user || (await supabase.auth.getUser()).data.user;
    if (!currentUser?.id) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error refreshing profile:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, supabase]);

  // Update profile
  const updateProfile = useCallback(async (updates: Partial<Profile>) => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [user, supabase]);

  // Listen for auth changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        setUser(session?.user ?? null);
        
        if (session?.user) {
          await refreshProfile();
        } else {
          setProfile(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase.auth, refreshProfile]);

  return (
    <UserContext.Provider
      value={{
        user,
        profile,
        isLoading,
        refreshProfile,
        updateProfile,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

// Custom hook to use the user context
export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}

// Utility hooks for common use cases
export function useProfile() {
  const { profile, isLoading, refreshProfile, updateProfile } = useUser();
  return { profile, isLoading, refreshProfile, updateProfile };
}

export function useWalletBalance() {
  const { profile } = useUser();
  return profile?.wallet_balance ?? 0;
}

export function useUserType() {
  const { profile } = useUser();
  return profile?.user_type;
}

export function useIsFreelancer() {
  const { profile } = useUser();
  return profile?.user_type === 'freelancer' || profile?.user_type === 'both';
}

export function useIsClient() {
  const { profile } = useUser();
  return profile?.user_type === 'client' || profile?.user_type === 'both';
}