'use client';

import { useState, useEffect } from 'react';
import { DashboardNav } from '@/components/layout/DashboardNav';
import { DashboardSidebar } from '@/components/layout/DashboardSidebar';
import { DashboardMobileMenu } from '@/components/layout/DashboardMobileMenu';
import { ProgressBar } from '@/components/ui/ProgressBar';
import {
  SessionExpiryWarning,
  ScrollToTop,
  OfflineIndicator,
} from '@/components/layout/DashboardUtilities';

interface DashboardLayoutProps {
  children: React.ReactNode;
  user?: {
    id: string;
    email: string;
  };
  profile?: {
    full_name: string;
    avatar_url?: string;
    wallet_balance: number;
    user_type: 'freelancer' | 'client' | 'both';
  };
}

export function DashboardLayout({
  children,
  user,
  profile,
}: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleMenuToggle = () => {
    if (isMobile) {
      setSidebarOpen(false);
    } else {
      setSidebarOpen(!sidebarOpen);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <ProgressBar />
      <SessionExpiryWarning />
      <OfflineIndicator />
      <ScrollToTop />

      {/* Navigation */}
      <DashboardNav
        user={user || { email: 'user@example.com' }}
        profile={profile || {
          full_name: 'User',
          wallet_balance: 0,
          user_type: 'freelancer',
        }}
        onMenuToggle={handleMenuToggle}
      />

      {/* Main Layout */}
      <div className="flex h-[calc(100vh-64px)]">
        {/* Desktop Sidebar */}
        {!isMobile && sidebarOpen && (
          <aside className="w-64 border-r border-gray-200 dark:border-gray-700 overflow-y-auto hidden lg:block">
            <DashboardSidebar userType={profile?.user_type || 'both'} />
          </aside>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Navigation */}
      <DashboardMobileMenu userType={profile?.user_type || 'both'} />
    </div>
  );
}