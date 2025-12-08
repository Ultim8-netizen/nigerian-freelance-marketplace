// src/components/layout/DashboardSidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Briefcase,
  FileText,
  ShoppingBag,
  MessageSquare,
  Wallet,
  BarChart3,
  Settings,
  Users,
  Star,
  Clock,
  PlusCircle,
  WifiOff,
  AlertCircle,
  Keyboard,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useEffect, useState } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Alert, AlertDescription } from '@/components/ui/alerts';

interface DashboardSidebarProps {
  userType?: 'freelancer' | 'client' | 'both';
}

// Properly typed navigation item interface
interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | null;
  highlight?: boolean;
}

export function DashboardSidebar({ userType = 'both' }: DashboardSidebarProps) {
  const pathname = usePathname();
  const [isOnline, setIsOnline] = useState(true);
  const [showKeyboardHelper, setShowKeyboardHelper] = useState(false);
  const [sessionWarning, setSessionWarning] = useState(false);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Session expiry warning (simulate - 30 minutes before expiry)
    const sessionTimer = setTimeout(() => {
      setSessionWarning(true);
    }, 30 * 60 * 1000); // 30 minutes

    // Keyboard shortcut listener
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === '/') {
        e.preventDefault();
        setShowKeyboardHelper(!showKeyboardHelper);
      }
    };

    window.addEventListener('keydown', handleKeyPress);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('keydown', handleKeyPress);
      clearTimeout(sessionTimer);
    };
  }, [showKeyboardHelper]);

  // Navigation items based on user type
  const commonNavItems: NavItem[] = [
    {
      title: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      title: 'Messages',
      href: '/dashboard/messages',
      icon: MessageSquare,
      badge: '3',
    },
    {
      title: 'Wallet',
      href: '/dashboard/wallet',
      icon: Wallet,
      badge: null,
    },
  ];

  const freelancerNavItems: NavItem[] = [
    {
      title: 'My Services',
      href: '/dashboard/services',
      icon: ShoppingBag,
      badge: null,
    },
    {
      title: 'Browse Jobs',
      href: '/dashboard/jobs',
      icon: Briefcase,
      badge: 'New',
    },
    {
      title: 'My Proposals',
      href: '/dashboard/proposals',
      icon: FileText,
      badge: null,
    },
    {
      title: 'Active Orders',
      href: '/dashboard/orders',
      icon: Clock,
      badge: '2',
    },
    {
      title: 'Reviews',
      href: '/dashboard/reviews',
      icon: Star,
      badge: null,
    },
  ];

  const clientNavItems: NavItem[] = [
    {
      title: 'Post a Job',
      href: '/dashboard/jobs/new',
      icon: PlusCircle,
      badge: null,
      highlight: true,
    },
    {
      title: 'My Jobs',
      href: '/dashboard/my-jobs',
      icon: Briefcase,
      badge: null,
    },
    {
      title: 'Browse Services',
      href: '/dashboard/browse',
      icon: ShoppingBag,
      badge: null,
    },
    {
      title: 'Active Orders',
      href: '/dashboard/orders',
      icon: Clock,
      badge: '1',
    },
    {
      title: 'Hired Freelancers',
      href: '/dashboard/freelancers',
      icon: Users,
      badge: null,
    },
  ];

  const analyticsNavItems: NavItem[] = [
    {
      title: 'Analytics',
      href: '/dashboard/analytics',
      icon: BarChart3,
      badge: null,
    },
    {
      title: 'Settings',
      href: '/dashboard/settings',
      icon: Settings,
      badge: null,
    },
  ];

  // Combine navigation based on user type
  const getNavigationItems = (): NavItem[] => {
    let items: NavItem[] = [...commonNavItems];
    
    if (userType === 'freelancer' || userType === 'both') {
      items = [...items, ...freelancerNavItems];
    }
    
    if (userType === 'client' || userType === 'both') {
      items = [...items, ...clientNavItems];
    }
    
    items = [...items, ...analyticsNavItems];
    
    return items;
  };

  const navItems = getNavigationItems();

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
      {/* Session Expiry Warning */}
      {sessionWarning && (
        <div className="p-3 border-b border-gray-200 dark:border-gray-700">
          <Alert variant="error" className="py-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Your session will expire in 30 minutes. Save your work.
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Offline Indicator */}
      {!isOnline && (
        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800">
          <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
            <WifiOff className="h-4 w-4" />
            <span className="text-xs font-medium">You are offline</span>
          </div>
        </div>
      )}

      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200',
                isActive
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700',
                item.highlight && !isActive && 'bg-linear-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700'
              )}
            >
              <div className="flex items-center gap-3">
                <Icon className={cn(
                  'h-5 w-5 shrink-0',
                  isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300',
                  item.highlight && !isActive && 'text-white'
                )} />
                <span>{item.title}</span>
              </div>
              {item.badge && (
                <Badge
                  variant={isActive ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {item.badge}
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Quick Stats Footer */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
            <span>Profile Completion</span>
            <span className="font-semibold">85%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div className="bg-linear-to-r from-blue-500 to-purple-600 h-2 rounded-full" style={{ width: '85%' }} />
          </div>
        </div>

        {/* Keyboard Shortcuts Helper Toggle */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setShowKeyboardHelper(!showKeyboardHelper)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <Keyboard className="h-4 w-4" />
                <span>Shortcuts</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Press Ctrl+/ to toggle shortcuts</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Keyboard Shortcuts Helper Panel */}
        {showKeyboardHelper && (
          <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
            <h4 className="text-xs font-semibold mb-2 text-gray-900 dark:text-gray-100">
              Keyboard Shortcuts
            </h4>
            <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
              <div className="flex justify-between">
                <span>Dashboard</span>
                <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded">
                  Ctrl+D
                </kbd>
              </div>
              <div className="flex justify-between">
                <span>Messages</span>
                <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded">
                  Ctrl+M
                </kbd>
              </div>
              <div className="flex justify-between">
                <span>Search</span>
                <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded">
                  Ctrl+K
                </kbd>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}