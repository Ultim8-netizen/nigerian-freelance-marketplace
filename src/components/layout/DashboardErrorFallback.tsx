'use client';

import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function DashboardErrorFallback({
  message = "We couldn't load your dashboard. This might be a temporary issue.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Dashboard Error
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          {message}
        </p>
        <div className="flex gap-3">
          <Button 
            onClick={handleRetry} 
            className="flex-1"
          >
            Try Again
          </Button>
          <Button
            variant="outline"
            onClick={() => (window.location.href = '/')}
            className="flex-1"
          >
            Back Home
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ProfileMissingFallback() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 text-center">
        <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Profile Setup Required
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Let&apos;s get your profile set up to access the dashboard.
        </p>
        <Button
          onClick={() => (window.location.href = '/onboarding')}
          className="w-full"
        >
          Complete Profile Setup
        </Button>
      </div>
    </div>
  );
}