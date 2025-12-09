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
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top">
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg shadow-lg p-4 max-w-sm">
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
 * Breadcrumb navigation component
 * Generates breadcrumbs based on current pathname using useMemo
 */
export function DashboardBreadcrumb() {
  const pathname = usePathname();

  // ✅ Use useMemo to calculate breadcrumbs during render
  // This avoids the cascading render issue of useState + useEffect
  const breadcrumbs = useMemo(() => {
    if (!pathname) return [];
    return pathname
      .split('/')
      .filter(Boolean)
      .map(segment => ({
        label: segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' '),
        path: segment,
      }));
  }, [pathname]);

  if (breadcrumbs.length === 0) return null;

  return (
    <nav className="flex items-center space-x-2 text-sm" aria-label="Breadcrumb">
      {breadcrumbs.map((crumb, index) => (
        <div key={index} className="flex items-center space-x-2">
          {index > 0 && <span className="text-gray-400 dark:text-gray-600">/</span>}
          <span 
            className={`capitalize ${
              index === breadcrumbs.length - 1
                ? 'text-gray-900 dark:text-gray-100 font-medium'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            {crumb.label}
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
      className="fixed bottom-8 right-8 z-40 p-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-500 dark:hover:bg-blue-600"
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
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 
            id="shortcuts-title"
            className="text-xl font-bold text-gray-900 dark:text-gray-100"
          >
            Keyboard Shortcuts
          </h3>
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="space-y-3">
          {shortcuts.map((shortcut, index) => (
            <div key={index} className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {shortcut.description}
              </span>
              <div className="flex items-center space-x-1">
                {shortcut.keys.map((key, i) => (
                  <kbd
                    key={i}
                    className="px-2 py-1 text-xs font-semibold text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded shadow-sm"
                  >
                    {key}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            Press <kbd className="px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded">Esc</kbd> or click outside to close
          </p>
        </div>
      </div>
    </div>
  );
}