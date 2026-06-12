'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

export function CancelJobButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'confirming' | 'loading'>('idle');
  const [error, setError] = useState<string | null>(null);

  const cancel = async () => {
    setState('loading');
    setError(null);

    try {
      const res = await fetch(`/api/jobs/${jobId}`, { method: 'DELETE' });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error ?? 'Failed to cancel job.');
        setState('idle');
        return;
      }

      router.push('/client/jobs');
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
      setState('idle');
    }
  };

  if (state === 'loading') {
    return (
      <Button disabled variant="outline" className="w-full">
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        Cancelling...
      </Button>
    );
  }

  if (state === 'confirming') {
    return (
      <div className="space-y-2">
        <p className="text-sm text-red-600 dark:text-red-400">
          This will cancel the job and notify all applicants. This cannot be undone.
        </p>
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-700 dark:hover:bg-red-900/20"
            onClick={cancel}
          >
            Yes, Cancel Job
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="flex-1"
            onClick={() => setState('idle')}
          >
            Keep It
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      className="w-full text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 border-red-300 dark:border-red-700"
      onClick={() => setState('confirming')}
    >
      Cancel Job
    </Button>
  );
}