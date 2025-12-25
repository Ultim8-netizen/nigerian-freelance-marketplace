// src/components/providers/AuthSyncProvider.tsx
'use client';

import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth.query';
import { useRouter } from 'next/navigation';

/**
 * Component that initializes auth state on mount.
 * Fixed: Removed unused 'isLoading' variable to satisfy ESLint.
 */
export function AuthSyncProvider({ children }: { children: React.ReactNode }) {
  const { error } = useAuth();

  useEffect(() => {
    if (error) {
      console.error('Auth initialization error:', error);
    }
  }, [error]);

  return <>{children}</>;
}

/**
 * Higher-order component for protecting routes.
 * Fixed: Added 'redirectTo' to the dependency array and used next/navigation for better UX.
 */
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  options?: {
    redirectTo?: string;
    requireProfile?: boolean;
  }
) {
  return function AuthGuard(props: P) {
    const { isAuthenticated, profile, isLoading } = useAuth();
    const router = useRouter();
    
    // Memoize or default the redirect path
    const redirectTo = options?.redirectTo || '/login';
    const requireProfile = options?.requireProfile;

    useEffect(() => {
      if (isLoading) return;

      if (!isAuthenticated) {
        router.push(redirectTo);
        return;
      }

      if (
        isAuthenticated &&
        requireProfile &&
        !profile?.onboarding_completed
      ) {
        router.push('/onboarding');
      }
    }, [isAuthenticated, profile, isLoading, redirectTo, requireProfile, router]);

    // Loading State
    if (isLoading) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-background">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            <p className="text-sm text-muted-foreground animate-pulse">Verifying session...</p>
          </div>
        </div>
      );
    }

    // Safety check to prevent flashing protected content before redirect
    if (!isAuthenticated || (requireProfile && !profile?.onboarding_completed)) {
      return null;
    }

    return <Component {...props} />;
  };
}