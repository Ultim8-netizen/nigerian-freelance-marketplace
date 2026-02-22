// src/contexts/UserContext.tsx
'use client';

import { createContext, useContext, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import type { Profile } from '@/types';

/**
 * FIXED: Removed the local Profile interface shadow. Now imports the real
 * Profile type from @/types/extended.types, which correctly uses
 * profile_image_url to match the actual database column.
 * 
 * Extended with:
 *   - wallet_balance: runtime addition from layout.tsx
 *   - avatar_url: alias to profile_image_url for backward compatibility
 *                 (layout.tsx sets avatar_url = profile_image_url so both
 *                 fields coexist; new code reads profile_image_url, old
 *                 code can still read avatar_url without breaking)
 */

interface ProfileWithWallet extends Profile {
  wallet_balance?: number;
  avatar_url?: string | null;
}

interface UserContextType {
  user: User;
  profile: ProfileWithWallet;
}

const UserContext = createContext<UserContextType | null>(null);

interface UserProviderProps {
  user: User;
  profile: ProfileWithWallet;
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