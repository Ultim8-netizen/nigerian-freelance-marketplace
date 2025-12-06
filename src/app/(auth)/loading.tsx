// ============================================================================
// src/app/(auth)/loading.tsx
// Auth section loading state

import { Spinner } from '@/components/ui/spinner';

export default function AuthLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <Spinner className="mb-4" />
        <p className="text-gray-600 text-sm">Loading authentication...</p>
      </div>
    </div>
  );
}