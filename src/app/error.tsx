// src/app/error.tsx
// Root error boundary

'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to error reporting service
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="max-w-md w-full p-8 text-center">
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Something went wrong!</h1>
          <p className="text-gray-600">
            We encountered an unexpected error. Please try again.
          </p>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <details className="mb-6 text-left">
            <summary className="cursor-pointer text-sm text-gray-700 hover:text-gray-900 mb-2">
              Error Details (Development Only)
            </summary>
            <pre className="text-xs bg-gray-100 p-3 rounded overflow-auto max-h-40">
              {error.message}
              {error.digest && `\n\nDigest: ${error.digest}`}
            </pre>
          </details>
        )}

        <div className="space-y-3">
          <Button onClick={reset} className="w-full">
            Try Again
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => window.location.href = '/'}
          >
            Go Home
          </Button>
        </div>

        <p className="text-xs text-gray-500 mt-6">
          If this problem persists, please contact support.
        </p>
      </Card>
    </div>
  );
}