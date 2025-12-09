// src/app/(dashboard)/layout.tsx
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
 * Dashboard Layout Component with Enhanced Features
 * 
 * This is a Server Component that handles:
 * - Server-side authentication with error handling
 * - Responsive sidebar with collapse state persistence
 * - User context provider for client components
 * - Loading states with enhanced skeletons
 * - Profile completion status check
 */

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default async function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const supabase = createClient();
  
  // Authenticate user with detailed error handling
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    // Store intended destination for post-login redirect
    const cookieStore = await cookies();
    const currentPath = cookieStore.get('redirect-after-login')?.value;
    
    redirect(`/login?redirect=${encodeURIComponent(currentPath || '/dashboard')}`);
  }

  // Fetch user profile data with related information
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select(`
      *,
      notifications:notifications(count)
    `)
    .eq('id', user.id)
    .single();

  // Handle profile fetch errors gracefully
  if (profileError) {
    console.error('Profile fetch error:', profileError);
    // Continue with limited functionality
  }

  // Check onboarding completion
  if (profile && !profile.onboarding_completed) {
    redirect('/onboarding');
  }

  // Check if profile needs updates (e.g., incomplete required fields)
  const needsProfileUpdate = profile && (
    !profile.full_name || 
    !profile.phone_number
  );

  // Get sidebar collapse preference from cookies
  const cookieStore = await cookies();
  const sidebarCollapsed = cookieStore.get('sidebar-collapsed')?.value === 'true';

  return (
    <UserProvider user={user} profile={profile}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
        {/* Session Expiry Warning - Client Component */}
        <SessionExpiryWarning />

        {/* Profile Completion Alert */}
        {needsProfileUpdate && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3">
              <div className="flex items-start space-x-3 p-3 rounded-lg border border-yellow-300 dark:border-yellow-700 bg-yellow-100 dark:bg-yellow-900/30">
                <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
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
          profile={profile}
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
                userType={profile?.user_type}
              />
            </div>
          </aside>

          {/* Mobile Menu */}
          <DashboardMobileMenu 
            userType={profile?.user_type}
          />

          {/* Main Content Area with Page Transitions */}
          <main 
            className={`
              flex-1 overflow-y-auto 
              transition-all duration-300 ease-in-out
              ${sidebarCollapsed ? 'lg:ml-0' : 'lg:ml-0'}
            `}
          >
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
              {/* Breadcrumb Area - Client Component */}
              <div className="mb-6">
                <Suspense fallback={<BreadcrumbSkeleton />}>
                  <DashboardBreadcrumb />
                </Suspense>
              </div>

              {/* Page Content with Loading State */}
              <Suspense fallback={<DashboardLoadingSkeleton />}>
                <div className="animate-fade-in">
                  {children}
                </div>
              </Suspense>
            </div>

            {/* Scroll to Top Button - Client Component */}
            <ScrollToTop />
          </main>
        </div>

        {/* Global Toast Notifications */}
        <Toaster />

        {/* Offline Indicator - Client Component */}
        <OfflineIndicator />

        {/* Keyboard Shortcuts Helper - Client Component */}
        <KeyboardShortcutsHelper />
      </div>
    </UserProvider>
  );
}

// ============================================================================
// LOADING SKELETONS (Server Components)
// ============================================================================

/**
 * Enhanced loading skeleton with shimmer effect
 */
function DashboardLoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton with shimmer */}
      <div className="relative overflow-hidden">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
        <div className="absolute inset-0 -translate-x-full animate-shimmer bg-linear-to-r from-transparent via-white/20 to-transparent" />
      </div>
      
      {/* Stats cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div 
            key={i} 
            className="relative overflow-hidden bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700"
          >
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
            </div>
            <div className="absolute inset-0 -translate-x-full animate-shimmer bg-linear-to-r from-transparent via-white/10 to-transparent" />
          </div>
        ))}
      </div>

      {/* Content cards skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <div 
            key={i} 
            className="relative overflow-hidden bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700"
          >
            <div className="space-y-4">
              <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
              <div className="space-y-2">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="h-4 bg-gray-200 dark:bg-gray-700 rounded" />
                ))}
              </div>
            </div>
            <div className="absolute inset-0 -translate-x-full animate-shimmer bg-linear-to-r from-transparent via-white/10 to-transparent" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Breadcrumb skeleton
 */
function BreadcrumbSkeleton() {
  return (
    <div className="flex items-center space-x-2">
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16" />
      <span className="text-gray-400">/</span>
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" />
    </div>
  );
}

// ============================================================================
// STYLES
// ============================================================================

/**
 * Add these to your global CSS or Tailwind config:
 * 
 * @keyframes shimmer {
 *   100% {
 *     transform: translateX(100%);
 *   }
 * }
 * 
 * @keyframes fade-in {
 *   from {
 *     opacity: 0;
 *     transform: translateY(10px);
 *   }
 *   to {
 *     opacity: 1;
 *     transform: translateY(0);
 *   }
 * }
 * 
 * .animate-shimmer {
 *   animation: shimmer 2s infinite;
 * }
 * 
 * .animate-fade-in {
 *   animation: fade-in 0.3s ease-out;
 * }
 */