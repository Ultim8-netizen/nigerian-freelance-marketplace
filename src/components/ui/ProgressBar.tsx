// src/components/ui/ProgressBar.tsx
'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export function ProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const start = setTimeout(() => setIsLoading(true), 0);
    const stop = setTimeout(() => setIsLoading(false), 500);

    return () => {
      clearTimeout(start);
      clearTimeout(stop);
    };
  }, [pathname, searchParams]);

  if (!isLoading) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-blue-600 animate-pulse" />
  );
}
