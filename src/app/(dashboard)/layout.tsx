// src/app/(dashboard)/layout.tsx
import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { DashboardNav } from '@/components/layout/DashboardNav';
import { DashboardSidebar } from '@/components/layout/DashboardSidebar';
import { DashboardMobileMenu } from '@/components/layout/DashboardMobileMenu';
import { DashboardErrorFallback } from '@/components/layout/DashboardErrorFallback';
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
import type { Profile } from '@/types';

/**
 * Dashboard Layout Component - FULLY OPTIMIZED & HYDRATION-SAFE
 *
 * Key optimizations:
 * 1. Single authentication check with early redirect
 * 2. Parallel data fetching (Promise.allSettled) for better performance
 * 3. Graceful error handling with user-friendly messages
 * 4. Profile completion warning alert system
 * 5. Proper type coercion for user_type and account_status to literal types
 * 6. Improved loading skeletons for better UX
 * 7. FIXED: Proper HTML structure to prevent hydration errors
 * 8. FIXED: All interactive components properly wrapped in Suspense
 * 9. FIXED: Handle nullable onboarding_completed field with default value
 * 10. FIXED: Spread entire profile object to include all required fields
 * 11. FIXED: Properly type user_type, account_status as literal union types
 * 12. FIXED: Removed fabricated avatar_url entirely — DashboardNav now reads
 *     profile_image_url directly, matching the actual DB column and Profile type.
 *     profileWithWallet is a clean Profile & { wallet_balance } with no extra props,
 *     so UserProvider receives exactly the shape it declares.
 */

interface DashboardLayoutProps {
  children: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Extend Profile with the single extra runtime field we attach in this layout.
// This is the ONLY type we pass to both UserProvider and DashboardNav.
// ---------------------------------------------------------------------------
type ProfileWithWallet = Profile & { wallet_balance: number };

export default async function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const supabase = await createClient();

  // ============================================================================
  // AUTHENTICATION
  // ============================================================================
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/login?error=session_expired');
  }

  // ============================================================================
  // PARALLEL DATA FETCHING
  // ============================================================================
  const [profileResult, walletResult] = await Promise.allSettled([
    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single(),

    supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', user.id)
      .single(),
  ]);

  // ============================================================================
  // HANDLE PROFILE RESULTS
  // ============================================================================
  let profile = null;
  let profileError = null;

  if (profileResult.status === 'fulfilled') {
    profile = profileResult.value.data;
    profileError = profileResult.value.error;
  } else {
    profileError = profileResult.reason;
  }

  if (profileError || !profile) {
    console.error('Critical: Profile fetch failed', {
      userId: user.id,
      error: profileError,
    });

    if (profileError?.code === 'PGRST116') {
      redirect('/onboarding?step=create-profile');
    }

    return (
      <DashboardErrorFallback
        message="We encountered an error loading your profile. Please refresh the page."
      />
    );
  }

  // ============================================================================
  // HANDLE WALLET BALANCE
  // ============================================================================
  let walletBalance = 0;
  if (walletResult.status === 'fulfilled' && walletResult.value.data) {
    walletBalance = walletResult.value.data.balance || 0;
  }

  // ============================================================================
  // NORMALIZE PROFILE DATA
  // ============================================================================

  // Type-safe user_type coercion to literal union type
  const validUserTypes = {
    client: 'client' as const,
    both: 'both' as const,
    freelancer: 'freelancer' as const,
  };

  const userType: 'client' | 'both' | 'freelancer' =
    (profile.user_type &&
      validUserTypes[
        profile.user_type.toLowerCase() as keyof typeof validUserTypes
      ]) ||
    'freelancer';

  // Type-safe account_status coercion to literal union type
  const validAccountStatuses = {
    active: 'active' as const,
    suspended: 'suspended' as const,
    banned: 'banned' as const,
  };

  const accountStatus: 'active' | 'suspended' | 'banned' =
    (profile.account_status &&
      validAccountStatuses[
        profile.account_status.toLowerCase() as keyof typeof validAccountStatuses
      ]) ||
    'active';

  // Normalize onboarding_completed — default to false if null
  const onboardingCompleted = profile.onboarding_completed ?? false;

  // Build the normalised Profile, property by property, so every literal union
  // is already the correct narrow type.  No `as` casts needed.
  const normalizedProfile: Profile = {
    id: profile.id,
    email: profile.email,
    full_name: profile.full_name,
    user_type: userType,
    account_status: accountStatus,
    onboarding_completed: onboardingCompleted,
    phone_number: profile.phone_number,
    location: profile.location,
    bio: profile.bio,
    profile_image_url: profile.profile_image_url, // string | null — stays as-is
    university: profile.university,
    phone_verified: profile.phone_verified,
    email_verified: profile.email_verified,
    student_verified: profile.student_verified,
    identity_verified: profile.identity_verified,
    liveness_verified: profile.liveness_verified,
    liveness_verified_at: profile.liveness_verified_at,
    client_rating: profile.client_rating,
    freelancer_rating: profile.freelancer_rating,
    trust_score: profile.trust_score,
    trust_level: profile.trust_level,
    total_jobs_posted: profile.total_jobs_posted,
    total_jobs_completed: profile.total_jobs_completed,
    notification_settings: profile.notification_settings,
    theme_preference: profile.theme_preference,
    suspension_reason: profile.suspension_reason,
    created_at: profile.created_at,
    updated_at: profile.updated_at,
  };

  // Attach wallet_balance — the only addition.  No avatar_url, no casts.
  const profileWithWallet: ProfileWithWallet = {
    ...normalizedProfile,
    wallet_balance: walletBalance,
  };

  // ============================================================================
  // ACCOUNT STATUS CHECK
  // ============================================================================
  if (
    normalizedProfile.account_status === 'suspended' ||
    normalizedProfile.account_status === 'banned'
  ) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Account{' '}
            {normalizedProfile.account_status === 'suspended'
              ? 'Suspended'
              : 'Banned'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Your account has been {normalizedProfile.account_status}. Please
            contact support for more information.
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
  // ONBOARDING CHECK
  // ============================================================================
  if (!onboardingCompleted) {
    redirect('/onboarding');
  }

  // ============================================================================
  // PROFILE COMPLETION STATUS
  // ============================================================================
  const needsProfileUpdate =
    !normalizedProfile.full_name || !normalizedProfile.phone_number;

  // ============================================================================
  // SIDEBAR PREFERENCE
  // ============================================================================
  const cookieStore = await cookies();
  const sidebarCollapsed =
    cookieStore.get('sidebar-collapsed')?.value === 'true';

  // ============================================================================
  // RENDER
  // ============================================================================
  return (
    <UserProvider user={user} profile={profileWithWallet}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
        {/* Session Expiry Warning */}
        <Suspense fallback={null}>
          <SessionExpiryWarning />
        </Suspense>

        {/* Profile Completion Alert */}
        {needsProfileUpdate && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3">
              <div className="flex items-start space-x-3 p-3 rounded-lg border border-yellow-300 dark:border-yellow-700 bg-yellow-100 dark:bg-yellow-900/30">
                <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <span className="text-sm text-yellow-800 dark:text-yellow-200">
                    Your profile is incomplete.{' '}
                    <a
                      href="/dashboard/settings/profile"
                      className="font-medium underline hover:no-underline"
                    >
                      Complete your profile
                    </a>
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Top Navigation Bar */}
        <DashboardNav user={user} profile={profileWithWallet} />

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
              <DashboardSidebar userType={userType} />
            </div>
          </aside>

          {/* Mobile Menu */}
          <DashboardMobileMenu userType={userType} />

          {/* Main Content Area */}
          <main className="flex-1 overflow-y-auto">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
              <Suspense fallback={<BreadcrumbSkeleton />}>
                <DashboardBreadcrumb />
              </Suspense>

              <div className="mt-6">
                <Suspense fallback={<DashboardLoadingSkeleton />}>
                  <div className="animate-fade-in">{children}</div>
                </Suspense>
              </div>
            </div>

            <Suspense fallback={null}>
              <ScrollToTop />
            </Suspense>
          </main>
        </div>

        {/* Global Components */}
        <Toaster />
        <Suspense fallback={null}>
          <OfflineIndicator />
        </Suspense>
        <Suspense fallback={null}>
          <KeyboardShortcutsHelper />
        </Suspense>
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
      <div className="relative overflow-hidden">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 animate-pulse" />
      </div>

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
                  <div
                    key={j}
                    className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
                  />
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
    <div
      className="flex items-center space-x-2"
      role="status"
      aria-label="Loading breadcrumb"
    >
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16 animate-pulse" />
      <span className="text-gray-400" aria-hidden="true">
        /
      </span>
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 animate-pulse" />
    </div>
  );
}