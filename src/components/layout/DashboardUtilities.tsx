// src/components/layout/DashboardUtilities.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ArrowUp, WifiOff, AlertCircle, Keyboard, ChevronRight, Home } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialogue';

/**
 * Session Expiry Warning Component
 * Displays a warning when user session is about to expire
 * Uses localStorage to track session start time
 */
export function SessionExpiryWarning() {
  const [showWarning, setShowWarning] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    // Initialize session start time if not exists
    if (typeof window !== 'undefined' && !localStorage.getItem('session-start')) {
      localStorage.setItem('session-start', Date.now().toString());
    }

    // Check session expiry (30 minutes session duration)
    const checkSessionExpiry = () => {
      if (typeof window === 'undefined') return;

      const sessionStart = localStorage.getItem('session-start');
      if (sessionStart) {
        const elapsed = Date.now() - parseInt(sessionStart);
        const sessionDuration = 30 * 60 * 1000; // 30 minutes
        const remaining = sessionDuration - elapsed;
        
        // Show warning 5 minutes before expiry
        if (remaining > 0 && remaining < 5 * 60 * 1000) {
          setShowWarning(true);
          setTimeLeft(Math.floor(remaining / 1000));
        } else if (remaining <= 0) {
          // Session expired - could redirect to login here
          setShowWarning(false);
        } else {
          setShowWarning(false);
        }
      }
    };

    checkSessionExpiry();
    const interval = setInterval(checkSessionExpiry, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, []);

  const handleExtendSession = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('session-start', Date.now().toString());
      setShowWarning(false);
    }
  };

  if (!showWarning) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="fixed top-20 right-4 z-50 max-w-sm animate-in slide-in-from-top">
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg shadow-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
          <div className="flex-1">
            <h4 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-1">
              Session Expiring Soon
            </h4>
            <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-3">
              Your session will expire in {minutes}:{seconds.toString().padStart(2, '0')}
            </p>
            <button
              onClick={handleExtendSession}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 dark:bg-yellow-500 dark:hover:bg-yellow-600 rounded-md transition-colors"
            >
              Stay Logged In
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Breadcrumb Navigation Component
 * Generates breadcrumbs based on current pathname
 * Uses useMemo to optimize performance and avoid cascading renders
 */
export function DashboardBreadcrumb() {
  const pathname = usePathname();

  // Use useMemo to calculate breadcrumbs during render
  // This avoids the cascading render issue of useState + useEffect
  const breadcrumbs = useMemo(() => {
    if (!pathname) return [];
    
    const segments = pathname.split('/').filter(Boolean);
    
    return segments.map((segment, index) => {
      const label = segment
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      const href = '/' + segments.slice(0, index + 1).join('/');
      const isLast = index === segments.length - 1;
      
      return { label, href, isLast };
    });
  }, [pathname]);

  if (breadcrumbs.length === 0) return null;

  return (
    <nav className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400" aria-label="Breadcrumb">
      <Link 
        href="/dashboard" 
        className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1"
      >
        <Home className="h-4 w-4" />
        <span>Dashboard</span>
      </Link>
      
      {breadcrumbs.slice(1).map((crumb) => (
        <div key={crumb.href} className="flex items-center space-x-2">
          <ChevronRight className="h-4 w-4" />
          {crumb.isLast ? (
            <span className="font-medium text-gray-900 dark:text-white capitalize">
              {crumb.label}
            </span>
          ) : (
            <Link 
              href={crumb.href}
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors capitalize"
            >
              {crumb.label}
            </Link>
          )}
        </div>
      ))}
    </nav>
  );
}

/**
 * Scroll to Top Button
 * Shows when user scrolls down, scrolls page to top when clicked
 */
export function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.scrollY > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    // Set initial state
    toggleVisibility();

    window.addEventListener('scroll', toggleVisibility);
    return () => window.removeEventListener('scroll', toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  if (!isVisible) return null;

  return (
    <button
      onClick={scrollToTop}
      className="fixed bottom-8 right-8 z-40 p-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all duration-200 hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-500 dark:hover:bg-blue-600"
      aria-label="Scroll to top"
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
}

/**
 * Offline Indicator
 * Shows when user loses internet connection
 * Initializes with actual navigator.onLine value to avoid setState in useEffect
 */
export function OfflineIndicator() {
  // Initialize state with the actual navigator.onLine value
  // This avoids direct setState in useEffect
  const [isOnline, setIsOnline] = useState(() => {
    // Use a function initializer to get the initial online status
    if (typeof window !== 'undefined') {
      return navigator.onLine;
    }
    return true; // Default to online during SSR
  });

  useEffect(() => {
    // Only set up event listeners, don't call setState directly
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-red-600 text-white p-3 shadow-lg">
      <div className="container mx-auto flex items-center justify-center gap-2">
        <WifiOff className="w-5 h-5" />
        <span className="font-medium text-sm sm:text-base">
          You are currently offline. Some features may not work.
        </span>
      </div>
    </div>
  );
}

/**
 * Keyboard Shortcuts Helper
 * Shows available keyboard shortcuts when triggered
 * Uses useMemo for stable shortcuts array to prevent unnecessary re-renders
 */
export function KeyboardShortcutsHelper() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Toggle shortcuts modal with Ctrl+/ or Cmd+/
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      // Close with Escape
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  // Use useMemo to create stable shortcuts array
  const shortcuts = useMemo(
    () => [
      { key: 'Ctrl+K or ⌘K', description: 'Open search' },
      { key: 'Ctrl+D or ⌘D', description: 'Go to dashboard' },
      { key: 'Ctrl+M or ⌘M', description: 'Open messages' },
      { key: 'Ctrl+/ or ⌘/', description: 'Toggle keyboard shortcuts' },
      { key: 'Ctrl+B or ⌘B', description: 'Toggle sidebar' },
      { key: 'Esc', description: 'Close dialogs' },
    ],
    []
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Use these shortcuts to navigate faster
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {shortcuts.map((shortcut) => (
            <div 
              key={shortcut.key}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
            >
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {shortcut.description}
              </span>
              <kbd className="px-3 py-1.5 text-xs font-semibold text-gray-800 bg-white dark:bg-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded shadow-sm">
                {shortcut.key}
              </kbd>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            Press <kbd className="px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded">Esc</kbd> or click outside to close
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}