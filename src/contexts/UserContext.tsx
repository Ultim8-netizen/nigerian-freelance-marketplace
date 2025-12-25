// src/contexts/UserContext.tsx
'use client';

import { createContext, useContext, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';

interface Profile {
  id: string;
  user_type: 'freelancer' | 'client' | 'both';
  full_name: string | null;
  phone_number: string | null;
  onboarding_completed: boolean;
  account_status: 'active' | 'suspended' | 'banned';
  avatar_url: string | null;
  wallet_balance?: number;
}

interface UserContextType {
  user: User;
  profile: Profile;
}

const UserContext = createContext<UserContextType | null>(null);

interface UserProviderProps {
  user: User;
  profile: Profile;
  children: ReactNode;
}

export function UserProvider({ user, profile, children }: UserProviderProps) {
  return (
    <UserContext.Provider value={{ user, profile }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}