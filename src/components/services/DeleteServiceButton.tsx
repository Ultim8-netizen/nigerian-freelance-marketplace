'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Trash2, Loader2 } from 'lucide-react';

interface DeleteServiceButtonProps {
  serviceId: string;
  /** True if the service has existing orders — triggers soft-delete (deactivate) instead */
  hasOrders: boolean;
}

type State = 'idle' | 'confirming' | 'loading';

export function DeleteServiceButton({ serviceId, hasOrders }: DeleteServiceButtonProps) {
  const router = useRouter();
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState<string | null>(null);

  const execute = async () => {
    setState('loading');
    setError(null);

    try {
      const res = await fetch(`/api/services/${serviceId}`, { method: 'DELETE' });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error ?? 'Failed to delete service.');
        setState('idle');
        return;
      }

      router.refresh();
    } catch {
      setError('Network error. Please try again.');
      setState('idle');
    }
  };

  if (state === 'loading') {
    return (
      <Button variant="outline" size="sm" className="px-2" disabled>
        <Loader2 className="w-4 h-4 animate-spin" />
      </Button>
    );
  }

  if (state === 'confirming') {
    return (
      <div className="flex flex-col gap-1.5 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-xs min-w-[160px]">
        <p className="text-red-700 dark:text-red-300 font-medium">
          {hasOrders ? 'Deactivate this service?' : 'Delete permanently?'}
        </p>
        {error && <p className="text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-6 text-xs text-red-600 border-red-300 hover:bg-red-100 dark:text-red-400 dark:border-red-700"
            onClick={execute}
          >
            {hasOrders ? 'Deactivate' : 'Delete'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="flex-1 h-6 text-xs"
            onClick={() => { setState('idle'); setError(null); }}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="px-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
      onClick={() => setState('confirming')}
    >
      <Trash2 className="w-4 h-4" />
    </Button>
  );
}