// src/components/layout/DashboardUtilities.tsx
'use client';

import { useEffect, useState, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { AlertCircle, WifiOff, ArrowUp } from 'lucide-react';

/**
 * Session expiry warning component
 * Displays a warning when user session is about to expire
 */
export function SessionExpiryWarning() {
  const [showWarning, setShowWarning] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    // Initialize session start time if not exists
    if (typeof window !== 'undefined' && !localStorage.getItem('session-start')) {
      localStorage.setItem('session-start', Date.now().toString());
    }

    // Check session expiry (example: 30 minutes = 1800 seconds)
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
          // Session expired, could redirect to login
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
    <div className="bg-orange-50 dark:bg-orange-900/20 border-b border-orange-200 dark:border-orange-800">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            <p className="text-sm text-orange-800 dark:text-orange-200">
              Your session will expire in {minutes}:{seconds.toString().padStart(2, '0')}
            </p>
          </div>
          <button
            onClick={handleExtendSession}
            className="text-sm font-medium text-orange-600 dark:text-orange-400 hover:underline"
          >
            Extend Session
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Breadcrumb navigation component
 * Generates breadcrumbs based on current pathname using useMemo
 */
export function DashboardBreadcrumb() {
  const pathname = usePathname();

  // ✅ Use useMemo to calculate breadcrumbs during render
  // This avoids the cascading render issue of useState + useEffect
  const breadcrumbs = useMemo(() => {
    if (!pathname) return [];
    return pathname.split('/').filter(Boolean);
  }, [pathname]);

  if (breadcrumbs.length === 0) return null;

  return (
    <nav className="flex items-center space-x-2 text-sm" aria-label="Breadcrumb">
      {breadcrumbs.map((crumb, index) => (
        <div key={index} className="flex items-center space-x-2">
          {index > 0 && <span className="text-gray-400">/</span>}
          <span 
            className={`capitalize ${
              index === breadcrumbs.length - 1
                ? 'text-gray-900 dark:text-gray-100 font-medium'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {crumb.replace(/-/g, ' ')}
          </span>
        </div>
      ))}
    </nav>
  );
}

/**
 * Scroll to top button
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
      className="fixed bottom-8 right-8 z-50 p-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      aria-label="Scroll to top"
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
}

/**
 * Offline indicator
 * Shows when user loses internet connection
 */
export function OfflineIndicator() {
  // ✅ Initialize state with the actual navigator.onLine value
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
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
      <div className="flex items-center space-x-2 bg-red-600 text-white px-4 py-2 rounded-full shadow-lg">
        <WifiOff className="h-4 w-4" />
        <span className="text-sm font-medium">You are offline</span>
      </div>
    </div>
  );
}

/**
 * Keyboard shortcuts helper
 * Shows available keyboard shortcuts when triggered
 */
export function KeyboardShortcutsHelper() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Toggle shortcuts modal with Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
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

  // ✅ Use useMemo to create stable shortcuts array
  const shortcuts = useMemo(
    () => [
      { keys: ['Ctrl', 'K'], description: 'Toggle keyboard shortcuts' },
      { keys: ['Ctrl', 'B'], description: 'Toggle sidebar' },
      { keys: ['Ctrl', 'N'], description: 'New item' },
      { keys: ['Ctrl', 'S'], description: 'Save' },
      { keys: ['Esc'], description: 'Close modal' },
    ],
    []
  );

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={() => setIsOpen(false)}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Keyboard Shortcuts
          </h3>
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="space-y-3">
          {shortcuts.map((shortcut, index) => (
            <div key={index} className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {shortcut.description}
              </span>
              <div className="flex items-center space-x-1">
                {shortcut.keys.map((key, i) => (
                  <kbd
                    key={i}
                    className="px-2 py-1 text-xs font-semibold text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded"
                  >
                    {key}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            Press <kbd className="px-1 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded">Esc</kbd> or click outside to close
          </p>
        </div>
      </div>
    </div>
  );
}