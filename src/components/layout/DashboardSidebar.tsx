// src/components/layout/DashboardSidebar.tsx
'use client';

import { useEffect, useState, useMemo, useSyncExternalStore } from 'react';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Alert, AlertDescription } from '@/components/ui/alerts';

interface DashboardSidebarProps {
  userType?: 'freelancer' | 'client' | 'both';
  onItemClick?: () => void;
}

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | null;
  highlight?: boolean;
}

// Helper functions for useSyncExternalStore to track online status
function subscribe(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function getSnapshot() {
  return navigator.onLine;
}

function getServerSnapshot() {
  return true; // Default to true on the server to avoid hydration flicker
}

export function DashboardSidebar({ 
  userType = 'both', 
  onItemClick 
}: DashboardSidebarProps) {
  const pathname = usePathname();
  
  // FIX: Modern way to handle browser APIs without useEffect/setState
  const isOnline = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  
  const [showKeyboardHelper, setShowKeyboardHelper] = useState(false);
  const [sessionWarning, setSessionWarning] = useState(false);

  // Monitor Shortcuts and Timers
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === '/') {
        e.preventDefault();
        setShowKeyboardHelper((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);

    const sessionTimer = setTimeout(() => {
      setSessionWarning(true);
    }, 30 * 60 * 1000); 

    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      clearTimeout(sessionTimer);
    };
  }, []);

  const navItems = useMemo(() => {
    const common: NavItem[] = [
      { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { title: 'Marketplace', href: '/marketplace', icon: ShoppingBag, badge: 'New' },
      { title: 'Messages', href: '/dashboard/messages', icon: MessageSquare, badge: '3' },
      { title: 'Wallet', href: '/dashboard/wallet', icon: Wallet },
    ];

    const freelancer: NavItem[] = [
      { title: 'My Services', href: '/dashboard/services', icon: ShoppingBag },
      { title: 'Browse Jobs', href: '/dashboard/jobs', icon: Briefcase, badge: 'New' },
      { title: 'My Proposals', href: '/dashboard/proposals', icon: FileText },
      { title: 'Active Orders', href: '/dashboard/orders', icon: Clock, badge: '2' },
      { title: 'Reviews', href: '/dashboard/reviews', icon: Star },
    ];

    const client: NavItem[] = [
      { title: 'Post a Job', href: '/dashboard/jobs/new', icon: PlusCircle, highlight: true },
      { title: 'My Jobs', href: '/dashboard/my-jobs', icon: Briefcase },
      { title: 'Browse Services', href: '/dashboard/browse', icon: ShoppingBag },
      { title: 'Active Orders', href: '/dashboard/orders', icon: Clock, badge: '1' },
      { title: 'Hired Freelancers', href: '/dashboard/freelancers', icon: Users },
    ];

    const analytics: NavItem[] = [
      { title: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
      { title: 'Settings', href: '/dashboard/settings', icon: Settings },
    ];

    let items = [...common];
    if (userType === 'freelancer' || userType === 'both') items = [...items, ...freelancer];
    if (userType === 'client' || userType === 'both') items = [...items, ...client];
    
    return [...items, ...analytics];
  }, [userType]);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
      <div className="shrink-0">
        {sessionWarning && (
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <Alert variant="error" className="py-2 border-red-200 bg-red-50 dark:bg-red-900/10">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-xs text-red-600">
                Session expires in 30m.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {!isOnline && (
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800 animate-in fade-in">
            <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
              <WifiOff className="h-4 w-4" />
              <span className="text-xs font-medium">Offline Mode</span>
            </div>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onItemClick}
              className={cn(
                'group flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200',
                isActive
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700',
                item.highlight && !isActive && 'bg-linear-to-r from-blue-500 to-purple-600 text-white hover:opacity-90'
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
                  className="text-[10px] px-1.5 h-4"
                >
                  {item.badge}
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
            <span>Profile Completion</span>
            <span className="font-semibold">85%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
            <div 
              className="bg-linear-to-r from-blue-500 to-purple-600 h-1.5 rounded-full transition-all duration-500" 
              style={{ width: '85%' }} 
            />
          </div>
        </div>

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
            <TooltipContent side="top">
              <p className="text-xs">Press <kbd className="font-sans font-bold">Ctrl + /</kbd></p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {showKeyboardHelper && (
          <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 animate-in slide-in-from-bottom-2">
            <h4 className="text-[10px] uppercase tracking-wider font-bold mb-2 text-gray-500">
              Quick Navigation
            </h4>
            <div className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
              <div className="flex justify-between">
                <span>Dashboard</span>
                <kbd className="text-[10px] px-1 bg-white dark:bg-gray-800 border rounded">Ctrl+D</kbd>
              </div>
              <div className="flex justify-between">
                <span>Messages</span>
                <kbd className="text-[10px] px-1 bg-white dark:bg-gray-800 border rounded">Ctrl+M</kbd>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}