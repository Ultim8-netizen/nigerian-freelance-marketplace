// src/app/loading.tsx
// Root loading state

import { Spinner } from '@/components/ui/spinner';

export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <Spinner className="mb-4" />
        <p className="text-gray-600 text-sm">Loading...</p>
      </div>
    </div>
  );
}