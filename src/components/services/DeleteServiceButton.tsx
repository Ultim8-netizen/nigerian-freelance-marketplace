// src/components/services/DeleteServiceButton.tsx
// Client button calling DELETE /api/services/:id.
// Soft-deletes if the service has orders (sets is_active=false),
// hard-deletes otherwise. Inline confirmation prevents accidents.

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Trash2, Loader2, AlertTriangle } from 'lucide-react';

interface DeleteServiceButtonProps {
  serviceId: string;
}

export function DeleteServiceButton({ serviceId }: DeleteServiceButtonProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const handleDelete = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/services/${serviceId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to delete service.');
        setConfirming(false);
        return;
      }
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  };

  if (confirming) {
    return (
      <div className="flex flex-col gap-1.5 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
        <p className="text-xs text-red-800 dark:text-red-300 font-medium flex items-center gap-1">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          Delete this service?
        </p>
        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
            className="h-7 px-2 text-xs"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Delete'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setConfirming(false)}
            disabled={loading}
            className="h-7 px-2 text-xs"
          >
            Keep
          </Button>
        </div>
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="px-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20 border-gray-200 dark:border-gray-700"
      onClick={() => setConfirming(true)}
    >
      <Trash2 className="w-4 h-4" />
    </Button>
  );
}