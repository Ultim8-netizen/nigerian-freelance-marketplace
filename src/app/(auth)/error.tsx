// ============================================================================
// src/app/(auth)/error.tsx
// Auth section error boundary

'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Auth error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="max-w-md w-full p-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
          <AlertCircle className="w-8 h-8 text-red-600" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Authentication Error</h1>
        <p className="text-gray-600 mb-6">
          We couldn't complete your authentication request.
        </p>

        <div className="space-y-3">
          <Button onClick={reset} className="w-full">
            Try Again
          </Button>
          <Link href="/" className="block">
            <Button variant="outline" className="w-full">
              Back to Home
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}