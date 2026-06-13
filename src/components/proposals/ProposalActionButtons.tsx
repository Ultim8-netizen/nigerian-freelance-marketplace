// src/components/proposals/ProposalActionButtons.tsx
// Client components for proposal status transitions.
//
// Exports:
//   ProposalActionButtons — accept/reject for job clients (client/jobs/[id]/page)
//   WithdrawProposalButton — withdraw for freelancers (freelancer/proposals/page)

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Undo2, Loader2 } from 'lucide-react';

// ── Accept / Reject ───────────────────────────────────────────────────────────

interface ProposalActionButtonsProps {
  proposalId: string;
  jobStatus: string;
  proposalStatus: string;
}

export function ProposalActionButtons({
  proposalId,
  jobStatus,
  proposalStatus,
}: ProposalActionButtonsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<'accept' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Only render when there is something actionable
  if (jobStatus !== 'open' || proposalStatus !== 'pending') return null;

  const handleAction = async (action: 'accept' | 'reject') => {
    setLoading(action);
    setError(null);
    try {
      const res = await fetch(`/api/proposals/${proposalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Action failed. Please try again.');
        return;
      }
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1.5">
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400 text-right">{error}</p>
      )}
      <div className="flex gap-2">
        <Button
          size="sm"
          className="bg-green-600 hover:bg-green-700 text-white gap-1.5 min-w-[90px]"
          onClick={() => handleAction('accept')}
          disabled={loading !== null}
        >
          {loading === 'accept' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <CheckCircle className="w-3.5 h-3.5" />
          )}
          Accept
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-700 dark:hover:bg-red-900/20 gap-1.5 min-w-[90px]"
          onClick={() => handleAction('reject')}
          disabled={loading !== null}
        >
          {loading === 'reject' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <XCircle className="w-3.5 h-3.5" />
          )}
          Reject
        </Button>
      </div>
    </div>
  );
}

// ── Withdraw ──────────────────────────────────────────────────────────────────

interface WithdrawProposalButtonProps {
  proposalId: string;
}

export function WithdrawProposalButton({ proposalId }: WithdrawProposalButtonProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleWithdraw = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/proposals/${proposalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'withdraw' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to withdraw. Please try again.');
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
      <div className="flex flex-col gap-1.5">
        <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
          Withdraw this proposal?
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 text-xs h-7 px-2"
            onClick={handleWithdraw}
            disabled={loading}
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Yes, withdraw'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-xs h-7 px-2"
            onClick={() => setConfirming(false)}
            disabled={loading}
          >
            Cancel
          </Button>
        </div>
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        size="sm"
        variant="ghost"
        className="text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 gap-1.5 text-xs h-7 px-2"
        onClick={() => setConfirming(true)}
      >
        <Undo2 className="w-3 h-3" />
        Withdraw
      </Button>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}