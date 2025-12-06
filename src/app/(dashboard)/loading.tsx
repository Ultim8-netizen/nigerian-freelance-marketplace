// ============================================================================
// src/app/(dashboard)/loading.tsx
// Dashboard loading skeleton

import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';

export default function DashboardLoading() {
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header Skeleton */}
      <div className="mb-8">
        <div className="h-10 bg-gray-200 rounded w-64 mb-2 animate-pulse" />
        <div className="h-4 bg-gray-200 rounded w-96 animate-pulse" />
      </div>

      {/* Stats Grid Skeleton */}
      <div className="grid md:grid-cols-4 gap-6 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-200 rounded-lg animate-pulse" />
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-20 mb-2 animate-pulse" />
                <div className="h-6 bg-gray-200 rounded w-16 animate-pulse" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Content Skeleton */}
      <div className="grid md:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <Card key={i} className="p-6">
            <div className="h-6 bg-gray-200 rounded w-40 mb-4 animate-pulse" />
            <div className="space-y-3">
              <div className="h-10 bg-gray-200 rounded animate-pulse" />
              <div className="h-10 bg-gray-200 rounded animate-pulse" />
              <div className="h-10 bg-gray-200 rounded animate-pulse" />
            </div>
          </Card>
        ))}
      </div>

      {/* Loading Indicator */}
      <div className="fixed bottom-8 right-8">
        <Card className="p-4 shadow-lg">
          <div className="flex items-center gap-3">
            <Spinner />
            <span className="text-sm text-gray-600">Loading dashboard...</span>
          </div>
        </Card>
      </div>
    </div>
  );
}