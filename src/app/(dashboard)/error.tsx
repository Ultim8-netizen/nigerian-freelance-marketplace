// ============================================================================
// src/app/(dashboard)/error.tsx
// Dashboard error boundary

'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard error:', error);
  }, [error]);

  return (
    <div className="container mx-auto px-4 py-16">
      <Card className="max-w-md mx-auto p-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
          <AlertCircle className="w-8 h-8 text-red-600" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Dashboard Error</h1>
        <p className="text-gray-600 mb-6">
          We couldn&apos;t load your dashboard. This might be a temporary issue.
        </p>

        <div className="space-y-3">
          <Button onClick={reset} className="w-full">
            Reload Dashboard
          </Button>
          <Link href="/" className="block">
            <Button variant="outline" className="w-full">
              Back to Home
            </Button>
          </Link>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <details className="mt-6 text-left">
            <summary className="cursor-pointer text-sm text-gray-700">
              Error Details
            </summary>
            <pre className="text-xs bg-gray-100 p-3 rounded overflow-auto max-h-40 mt-2">
              {error.message}
            </pre>
          </details>
        )}
      </Card>
    </div>
  );
}