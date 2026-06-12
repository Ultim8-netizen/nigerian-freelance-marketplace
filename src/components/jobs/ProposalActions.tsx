'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Check, X, Loader2, Undo2 } from 'lucide-react';

// ─── ProposalActions (for clients: accept / reject) ─────────────────────────

interface ProposalActionsProps {
  proposalId: string;
  proposalStatus: string;
  jobStatus: string;
  freelancerName: string;
}

type ClientActionState = 'idle' | 'confirming_accept' | 'confirming_reject' | 'loading';

export function ProposalActions({
  proposalId,
  proposalStatus,
  jobStatus,
  freelancerName,
}: ProposalActionsProps) {
  const router = useRouter();
  const [state, setState] = useState<ClientActionState>('idle');
  const [error, setError] = useState<string | null>(null);

  // Only render for pending proposals on open jobs
  if (jobStatus !== 'open' || proposalStatus !== 'pending') return null;

  const dispatch = async (action: 'accept' | 'reject') => {
    setState('loading');
    setError(null);

    try {
      const res = await fetch(`/api/proposals/${proposalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error ?? 'Action failed. Please try again.');
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
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Processing...</span>
      </div>
    );
  }

  if (state === 'confirming_accept') {
    return (
      <div className="space-y-2">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          Hire{' '}
          <span className="font-semibold">{freelancerName}</span>? All other pending
          proposals will be closed.
        </p>
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex gap-2">
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white gap-1"
            onClick={() => dispatch('accept')}
          >
            <Check className="w-3.5 h-3.5" /> Confirm Hire
          </Button>
          <Button size="sm" variant="outline" onClick={() => setState('idle')}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (state === 'confirming_reject') {
    return (
      <div className="space-y-2">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          Reject{' '}
          <span className="font-semibold">{freelancerName}</span>
          &apos;s proposal?
        </p>
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-700 dark:hover:bg-red-900/20 gap-1"
            onClick={() => dispatch('reject')}
          >
            <X className="w-3.5 h-3.5" /> Yes, Reject
          </Button>
          <Button size="sm" variant="outline" onClick={() => setState('idle')}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {error && <p className="text-xs text-red-600 dark:text-red-400 mb-1">{error}</p>}
      <div className="flex gap-2">
        <Button
          size="sm"
          className="bg-green-600 hover:bg-green-700 text-white gap-1"
          onClick={() => setState('confirming_accept')}
        >
          <Check className="w-3.5 h-3.5" /> Accept
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 border-red-300 dark:border-red-700 gap-1"
          onClick={() => setState('confirming_reject')}
        >
          <X className="w-3.5 h-3.5" /> Reject
        </Button>
      </div>
    </div>
  );
}

// ─── WithdrawProposalButton (for freelancers) ────────────────────────────────

interface WithdrawProposalButtonProps {
  proposalId: string;
}

type WithdrawState = 'idle' | 'confirming' | 'loading';

export function WithdrawProposalButton({ proposalId }: WithdrawProposalButtonProps) {
  const router = useRouter();
  const [state, setState] = useState<WithdrawState>('idle');
  const [error, setError] = useState<string | null>(null);

  const withdraw = async () => {
    setState('loading');
    setError(null);

    try {
      const res = await fetch(`/api/proposals/${proposalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'withdraw' }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error ?? 'Failed to withdraw. Please try again.');
        setState('idle');
        return;
      }

      router.refresh();
    } catch {
      setError('Network error.');
      setState('idle');
    }
  };

  if (state === 'loading') {
    return (
      <Button size="sm" variant="outline" disabled>
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      </Button>
    );
  }

  if (state === 'confirming') {
    return (
      <div className="flex flex-col gap-1.5">
        <p className="text-xs text-gray-600 dark:text-gray-400">Withdraw this proposal?</p>
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-700 text-xs"
            onClick={withdraw}
          >
            Yes, Withdraw
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-xs"
            onClick={() => setState('idle')}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className="gap-1 text-gray-600 dark:text-gray-400 text-xs"
      onClick={() => setState('confirming')}
    >
      <Undo2 className="w-3.5 h-3.5" /> Withdraw
    </Button>
  );
}