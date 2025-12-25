// src/app/(dashboard)/layout.tsx
// OPTIMIZED: Single source of truth for user data, parallel fetching
import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { DashboardNav } from '@/components/layout/DashboardNav';
import { DashboardSidebar } from '@/components/layout/DashboardSidebar';
import { DashboardMobileMenu } from '@/components/layout/DashboardMobileMenu';
import { UserProvider } from '@/contexts/UserContext';
import { Toaster } from '@/components/ui/toaster';
import { AlertCircle } from 'lucide-react';
import {
  SessionExpiryWarning,
  DashboardBreadcrumb,
  ScrollToTop,
  OfflineIndicator,
  KeyboardShortcutsHelper,
} from '@/components/layout/DashboardUtilities';

/**
 * Dashboard Layout Component - OPTIMIZED
 * 
 * Changes from original:
 * 1. Single authentication check (middleware already validated token)
 * 2. Parallel data fetching for better performance
 * 3. Graceful error handling with user-friendly messages
 * 4. Removed redundant onboarding check (handled once)
 */

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default async function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const supabase = await createClient();
  
  // ============================================================================
  // AUTHENTICATION (Single source of truth)
  // ============================================================================
  // Note: Middleware already validated the session token exists
  // This call retrieves the full user object from the session
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    // This should rarely happen since middleware checks token
    // But handle edge cases (expired session, etc.)
    redirect('/login?error=session_expired');
  }

  // ============================================================================
  // PARALLEL DATA FETCHING (Faster than sequential)
  // ============================================================================
  const [profileResult, walletResult] = await Promise.allSettled([
    // Fetch profile with account status
    supabase
      .from('profiles')
      .select('id, user_type, full_name, phone_number, onboarding_completed, account_status, avatar_url')
      .eq('id', user.id)
      .single(),
    
    // Fetch wallet balance
    supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', user.id)
      .single(),
  ]);

  // ============================================================================
  // HANDLE PROFILE FETCH RESULTS
  // ============================================================================
  let profile = null;
  let profileError = null;

  if (profileResult.status === 'fulfilled') {
    profile = profileResult.value.data;
    profileError = profileResult.value.error;
  } else {
    profileError = profileResult.reason;
  }

  // Critical error - profile must exist
  if (profileError || !profile) {
    console.error('Critical: Profile fetch failed', {
      userId: user.id,
      error: profileError,
    });
    
    // Check if profile doesn't exist at all
    if (profileError?.code === 'PGRST116') {
      // No profile found - redirect to profile creation
      redirect('/onboarding?step=create-profile');
    }
    
    // Other errors - show error page
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Unable to Load Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            We encountered an error loading your profile. Please try again.
          </p>
          <div className="flex gap-3 justify-center">
            <a
              href="/login"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Back to Login
            </a>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // HANDLE WALLET BALANCE
  // ============================================================================
  let walletBalance = 0;
  if (walletResult.status === 'fulfilled' && walletResult.value.data) {
    walletBalance = walletResult.value.data.balance || 0;
  }

  // Add wallet balance to profile object
  const profileWithWallet = {
    ...profile,
    wallet_balance: walletBalance,
  };

  // ============================================================================
  // ACCOUNT STATUS CHECK
  // ============================================================================
  if (profile.account_status === 'suspended' || profile.account_status === 'banned') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Account {profile.account_status === 'suspended' ? 'Suspended' : 'Banned'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Your account has been {profile.account_status}. Please contact support for more information.
          </p>
          <a
            href="/support"
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Contact Support
          </a>
        </div>
      </div>
    );
  }

  // ============================================================================
  // ONBOARDING CHECK (Single check, not in middleware)
  // ============================================================================
  if (!profile.onboarding_completed) {
    redirect('/onboarding');
  }

  // ============================================================================
  // PROFILE COMPLETION STATUS
  // ============================================================================
  const needsProfileUpdate = !profile.full_name || !profile.phone_number;

  // ============================================================================
  // SIDEBAR PREFERENCE
  // ============================================================================
  const cookieStore = await cookies();
  const sidebarCollapsed = cookieStore.get('sidebar-collapsed')?.value === 'true';

  // ============================================================================
  // RENDER DASHBOARD
  // ============================================================================
  return (
    <UserProvider user={user} profile={profileWithWallet}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
        {/* Session Expiry Warning */}
        <SessionExpiryWarning />

        {/* Profile Completion Alert */}
        {needsProfileUpdate && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3">
              <div className="flex items-start space-x-3 p-3 rounded-lg border border-yellow-300 dark:border-yellow-700 bg-yellow-100 dark:bg-yellow-900/30">
                <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    Your profile is incomplete. 
                    <a 
                      href="/dashboard/settings/profile" 
                      className="ml-2 font-medium underline hover:no-underline"
                    >
                      Complete your profile
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Top Navigation Bar */}
        <DashboardNav 
          user={user} 
          profile={profileWithWallet}
        />

        <div className="flex relative">
          {/* Desktop Sidebar */}
          <aside 
            className={`
              hidden lg:flex lg:shrink-0 
              transition-all duration-300 ease-in-out
              ${sidebarCollapsed ? 'lg:w-20' : 'lg:w-64'}
            `}
          >
            <div className="flex flex-col w-full border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
              <DashboardSidebar 
                userType={profile.user_type}
              />
            </div>
          </aside>

          {/* Mobile Menu */}
          <DashboardMobileMenu 
            userType={profile.user_type}
          />

          {/* Main Content Area */}
          <main className="flex-1 overflow-y-auto">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
              {/* Breadcrumb */}
              <div className="mb-6">
                <Suspense fallback={<BreadcrumbSkeleton />}>
                  <DashboardBreadcrumb />
                </Suspense>
              </div>

              {/* Page Content */}
              <Suspense fallback={<DashboardLoadingSkeleton />}>
                <div className="animate-fade-in">
                  {children}
                </div>
              </Suspense>
            </div>

            {/* Scroll to Top Button */}
            <ScrollToTop />
          </main>
        </div>

        {/* Global Components */}
        <Toaster />
        <OfflineIndicator />
        <KeyboardShortcutsHelper />
      </div>
    </UserProvider>
  );
}

// ============================================================================
// LOADING SKELETONS
// ============================================================================

function DashboardLoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="relative overflow-hidden">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 animate-pulse" />
      </div>
      
      {/* Stats cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div 
            key={i} 
            className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700"
          >
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 animate-pulse" />
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2 animate-pulse" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4 animate-pulse" />
            </div>
          </div>
        ))}
      </div>

      {/* Content cards skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <div 
            key={i} 
            className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700"
          >
            <div className="space-y-4">
              <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/2 animate-pulse" />
              <div className="space-y-2">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BreadcrumbSkeleton() {
  return (
    <div className="flex items-center space-x-2">
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16 animate-pulse" />
      <span className="text-gray-400">/</span>
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 animate-pulse" />
    </div>
  );
}