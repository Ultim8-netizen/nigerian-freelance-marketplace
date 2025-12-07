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
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface DashboardSidebarProps {
  userType?: 'freelancer' | 'client' | 'both';
}

export function DashboardSidebar({ userType = 'both' }: DashboardSidebarProps) {
  const pathname = usePathname();

  // Navigation items based on user type
  const commonNavItems = [
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

  const freelancerNavItems = [
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

  const clientNavItems = [
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

  const analyticsNavItems = [
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
  const getNavigationItems = () => {
    let items = [...commonNavItems];
    
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
                item.highlight && !isActive && 'bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700'
              )}
            >
              <div className="flex items-center gap-3">
                <Icon className={cn(
                  'h-5 w-5 flex-shrink-0',
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
      <div className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-2">
        <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
          <span>Profile Completion</span>
          <span className="font-semibold">85%</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full" style={{ width: '85%' }} />
        </div>
      </div>
    </div>
  );
}