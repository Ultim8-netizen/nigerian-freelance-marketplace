'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  MessageSquare,
  User,
  Menu,
  X,
  PlusSquare,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { DashboardSidebar } from './DashboardSidebar';

export interface DashboardMobileMenuProps {
  userType?: 'freelancer' | 'client' | 'both';
}

/**
 * Bottom Navigation Bar for Mobile
 * FIXED: utilized userType to provide a dynamic, role-based navigation experience.
 */
export function DashboardMobileMenu({ userType = 'both' }: DashboardMobileMenuProps) {
  const pathname = usePathname();

  // Define dynamic items based on user role
  const bottomNavItems = [
    { title: 'Home', href: '/dashboard', icon: LayoutDashboard },
    
    // Role-based logic for the second slot
    userType === 'client' 
      ? { title: 'Post Job', href: '/dashboard/jobs/create', icon: PlusSquare }
      : { title: 'Find Work', href: '/dashboard/jobs', icon: Search },

    { title: 'Messages', href: '/dashboard/messages', icon: MessageSquare, badge: 3 },
    { title: 'Profile', href: '/dashboard/profile', icon: User },
  ];

  return (
    <>
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg">
        <nav className="flex justify-around items-center h-16">
          {bottomNavItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`));
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
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center font-semibold">
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
      <div className="lg:hidden h-16" aria-hidden="true" />
    </>
  );
}

/**
 * Optimized Sheet Menu
 */
export function DashboardMobileSheet({ userType = 'both' }: DashboardMobileMenuProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [prevPathname, setPrevPathname] = useState(pathname);

  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setIsOpen(false);
  }

  const closeMenu = useCallback(() => setIsOpen(false), []);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Menu</h2>
            <Button variant="ghost" size="icon" onClick={closeMenu} aria-label="Close menu">
              <X className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <DashboardSidebar userType={userType} onItemClick={closeMenu} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Optimized Custom Drawer
 */
export function DashboardMobileDrawer({ userType = 'both' }: DashboardMobileMenuProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [prevPathname, setPrevPathname] = useState(pathname);

  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setIsOpen(false);
  }

  const closeMenu = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(true)}
        aria-label="Open menu"
        className="lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden animate-in fade-in duration-200"
          onClick={closeMenu}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed top-0 left-0 bottom-0 z-50 w-64 bg-white dark:bg-gray-900',
          'transform transition-transform duration-300 ease-in-out lg:hidden',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Menu</h2>
            <Button variant="ghost" size="icon" onClick={closeMenu} aria-label="Close menu">
              <X className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <DashboardSidebar userType={userType} onItemClick={closeMenu} />
          </div>
        </div>
      </aside>
    </>
  );
}