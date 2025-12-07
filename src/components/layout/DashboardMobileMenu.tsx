// src/components/layout/DashboardMobileMenu.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Briefcase,
  MessageSquare,
  User,
  Menu,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

interface DashboardMobileMenuProps {
  userType?: 'freelancer' | 'client' | 'both';
}

export function DashboardMobileMenu({ userType = 'both' }: DashboardMobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Close menu on route change
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const bottomNavItems = [
    {
      title: 'Home',
      href: '/dashboard',
      icon: LayoutDashboard,
    },
    {
      title: 'Jobs',
      href: '/dashboard/jobs',
      icon: Briefcase,
    },
    {
      title: 'Messages',
      href: '/dashboard/messages',
      icon: MessageSquare,
      badge: 3,
    },
    {
      title: 'Profile',
      href: '/dashboard/profile',
      icon: User,
    },
  ];

  return (
    <>
      {/* Bottom Navigation for Mobile */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg">
        <nav className="flex justify-around items-center h-16">
          {bottomNavItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center justify-center flex-1 h-full relative transition-colors',
                  isActive
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                )}
              >
                <div className="relative">
                  <Icon className="h-6 w-6" />
                  {item.badge && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className="text-xs mt-1">{item.title}</span>
                {isActive && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-blue-600 dark:bg-blue-400 rounded-b-full" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Add padding to main content to account for bottom nav */}
      <div className="lg:hidden h-16" aria-hidden="true" />
    </>
  );
}

// Alternative: Full Sheet Menu for Mobile (if you prefer hamburger menu instead of bottom nav)
export function DashboardMobileSheet({ userType = 'both' }: DashboardMobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const navItems = [
    { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { title: 'Jobs', href: '/dashboard/jobs', icon: Briefcase },
    { title: 'Messages', href: '/dashboard/messages', icon: MessageSquare },
    { title: 'Profile', href: '/dashboard/profile', icon: User },
  ];

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <div className="flex flex-col h-full">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">Menu</h2>
          </div>
          <nav className="flex-1 overflow-y-auto p-4 space-y-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.title}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </SheetContent>
    </Sheet>
  );
}