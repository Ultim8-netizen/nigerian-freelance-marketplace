'use client';

import { useState, useTransition, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Loader2, CheckCircle, Search, X } from 'lucide-react';
import type { Tables } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type WithdrawalRow = {
  id: string; amount: number; bank_name: string; account_number: string;
  account_name: string; status: string | null; failure_reason: string | null;
  created_at: string | null;
  user_id: { full_name: string | null; trust_score: number | null } | null;
};

// Extended with recipient_user_id join — recipient may be null for system transactions
type TransactionRow = Pick<
  Tables<'transactions'>,
  'id' | 'transaction_ref' | 'transaction_type' | 'amount' | 'currency' | 'status' | 'order_id' | 'created_at' | 'paid_at'
> & {
  recipient_user_id: { full_name: string | null; email: string | null } | null;
};

type EscrowRow = Pick<
  Tables<'escrow'>,
  'id' | 'amount' | 'status' | 'order_id' | 'marketplace_order_id' | 'created_at' | 'released_at'
>;

// Filter shape — mirrors URL search params applied in page.tsx
export type FilterValues = {
  q:          string; // user name / email search
  type:       string; // transaction_type exact match
  status:     string; // status exact match
  date_from:  string; // ISO date string
  date_to:    string; // ISO date string
  amount_min: string;
  amount_max: string;
};

interface FinanceClientProps {
  withdrawals:          WithdrawalRow[];
  transactions:         TransactionRow[];
  escrowEntries:        EscrowRow[];
  withdrawalsPaused:    boolean;
  // ₦ amount above which withdrawals are held for manual review; 0 = gate disabled
  withdrawalGateThreshold: number;
  onApproveWithdrawal:     (fd: FormData) => Promise<void>;
  onHoldWithdrawal:        (fd: FormData) => Promise<void>;
  onReleaseEscrow:         (fd: FormData) => Promise<void>;
  onFreezeEscrow:          (fd: FormData) => Promise<void>;
  onCancelEscrow:          (fd: FormData) => Promise<void>;
  onUpdateTransactionStatus:    (fd: FormData) => Promise<void>;
  onToggleWithdrawalGate:       (fd: FormData) => Promise<void>;
  onSetWithdrawalGateThreshold: (fd: FormData) => Promise<void>;
  // Known transaction_type values for the filter datalist (derived server-side)
  transactionTypes:     string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dt(s: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
}

function ngn(v: number) {
  return `₦${v.toLocaleString('en-NG')}`;
}

type RowFeedback = 'idle' | 'pending' | 'ok' | 'error';

// ─── RowAction ────────────────────────────────────────────────────────────────

function RowAction({
  label,
  variant = 'default',
  action,
  hiddenFields,
}: {
  label: string;
  variant?: 'default' | 'danger' | 'success' | 'warning';
  action: (fd: FormData) => Promise<void>;
  hiddenFields: Record<string, string>;
}) {
  const [feedback, setFeedback] = useState<RowFeedback>('idle');
  const [isPending, start] = useTransition();

  const colours = {
    default: 'bg-gray-100 hover:bg-gray-200 text-gray-700',
    danger:  'bg-red-100 hover:bg-red-200 text-red-700',
    success: 'bg-green-100 hover:bg-green-200 text-green-700',
    warning: 'bg-amber-100 hover:bg-amber-200 text-amber-700',
  };

  const handleClick = () => {
    const fd = new FormData();
    Object.entries(hiddenFields).forEach(([k, v]) => fd.set(k, v));
    setFeedback('pending');
    start(async () => {
      try {
        await action(fd);
        setFeedback('ok');
        setTimeout(() => setFeedback('idle'), 2000);
      } catch {
        setFeedback('error');
        setTimeout(() => setFeedback('idle'), 3000);
      }
    });
  };

  if (feedback === 'ok')    return <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle size={12} /> Done</span>;
  if (feedback === 'error') return <span className="text-xs text-red-600">Failed</span>;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded transition-colors disabled:opacity-60 ${colours[variant]}`}
    >
      {isPending && <Loader2 size={10} className="animate-spin" />}
      {label}
    </button>
  );
}

// ─── Withdrawal Gate Banner ───────────────────────────────────────────────────

/**
 * Two-control banner:
 *   Row 1 — binary pause toggle (existing behaviour).
 *   Row 2 — configurable ₦ threshold: withdrawals above this amount are
 *            automatically held for manual review. Set to 0 to disable.
 */
function WithdrawalGateBanner({
  paused,
  onToggle,
  threshold,
  onSetThreshold,
}: {
  paused:       boolean;
  onToggle:     (fd: FormData) => Promise<void>;
  threshold:    number;
  onSetThreshold: (fd: FormData) => Promise<void>;
}) {
  // ── Pause toggle state ────────────────────────────────────────────────────
  const [toggleFeedback, setToggleFeedback] = useState<RowFeedback>('idle');
  const [isTogglePending, startToggle]      = useTransition();

  const handleToggle = () => {
    const fd = new FormData();
    fd.set('enabled', String(!paused));
    setToggleFeedback('pending');
    startToggle(async () => {
      try {
        await onToggle(fd);
        setToggleFeedback('ok');
        setTimeout(() => setToggleFeedback('idle'), 2000);
      } catch {
        setToggleFeedback('error');
        setTimeout(() => setToggleFeedback('idle'), 3000);
      }
    });
  };

  // ── Threshold state ───────────────────────────────────────────────────────
  const [thresholdInput,     setThresholdInput]     = useState(threshold > 0 ? String(threshold) : '');
  const [thresholdFeedback,  setThresholdFeedback]  = useState<RowFeedback>('idle');
  const [isThresholdPending, startThreshold]        = useTransition();

  const handleSetThreshold = () => {
    const value = parseFloat(thresholdInput) || 0;
    const fd = new FormData();
    fd.set('threshold', String(value < 0 ? 0 : value));
    setThresholdFeedback('pending');
    startThreshold(async () => {
      try {
        await onSetThreshold(fd);
        setThresholdFeedback('ok');
        setTimeout(() => setThresholdFeedback('idle'), 2000);
      } catch {
        setThresholdFeedback('error');
        setTimeout(() => setThresholdFeedback('idle'), 3000);
      }
    });
  };

  return (
    <div className={`p-4 rounded-lg border-2 ${
      paused ? 'border-red-400 bg-red-50' : 'border-green-400 bg-green-50'
    }`}>
      {/* Row 1 — pause toggle */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className={`font-bold text-sm ${paused ? 'text-red-800' : 'text-green-800'}`}>
            Withdrawal Gate: {paused ? 'PAUSED' : 'ACTIVE'}
          </p>
          <p className="text-xs text-gray-600 mt-0.5">
            {paused
              ? 'All withdrawal processing is currently suspended.'
              : 'Withdrawals are processing normally.'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleToggle}
            disabled={isTogglePending}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-lg transition-colors disabled:opacity-60 ${
              paused
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
          >
            {isTogglePending && <Loader2 size={13} className="animate-spin" />}
            {paused ? 'Resume Withdrawals' : 'Pause All Withdrawals'}
          </button>
          {toggleFeedback === 'ok'    && <span className="text-xs text-green-600">Updated</span>}
          {toggleFeedback === 'error' && <span className="text-xs text-red-600">Failed</span>}
        </div>
      </div>

      {/* Row 2 — threshold gate */}
      <div className="mt-3 pt-3 border-t border-gray-200/60 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-gray-700">Manual Review Threshold</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {threshold > 0
              ? `Withdrawals above ₦${threshold.toLocaleString('en-NG')} are held for admin approval`
              : 'No threshold — large withdrawals are not auto-held'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-500 select-none">
              ₦
            </span>
            <input
              type="number"
              min={0}
              step={1000}
              value={thresholdInput}
              onChange={(e) => setThresholdInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSetThreshold(); }}
              placeholder="0 = disabled"
              disabled={isThresholdPending}
              className="pl-6 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg w-36 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
            />
          </div>
          <button
            type="button"
            onClick={handleSetThreshold}
            disabled={isThresholdPending}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-60"
          >
            {isThresholdPending && <Loader2 size={10} className="animate-spin" />}
            Set Threshold
          </button>
          {thresholdFeedback === 'ok'    && <CheckCircle size={13} className="text-green-600" />}
          {thresholdFeedback === 'error' && <span className="text-xs text-red-600">Failed</span>}
        </div>
      </div>
    </div>
  );
}

// ─── Withdrawals Tab ──────────────────────────────────────────────────────────

function WithdrawalsTab({
  withdrawals,
  onApprove,
  onHold,
}: {
  withdrawals:  WithdrawalRow[];
  onApprove:    (fd: FormData) => Promise<void>;
  onHold:       (fd: FormData) => Promise<void>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="bg-gray-50 border-b">
          <tr>
            {['User', 'Amount', 'Bank Details', 'Trust', 'Requested', 'Actions'].map((h) => (
              <th key={h} className="px-5 py-3 font-medium text-gray-500">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {withdrawals.length === 0 ? (
            <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-gray-400 italic">No pending withdrawals.</td></tr>
          ) : (
            withdrawals.map((w) => (
              <tr key={w.id} className="hover:bg-gray-50">
                <td className="px-5 py-4 font-medium">{w.user_id?.full_name ?? 'Unknown'}</td>
                <td className="px-5 py-4 font-bold">{ngn(w.amount)}</td>
                <td className="px-5 py-4 text-xs">
                  <p className="font-semibold">{w.bank_name}</p>
                  <p className="text-gray-500">{w.account_number}</p>
                  <p className="text-gray-400">{w.account_name}</p>
                </td>
                <td className="px-5 py-4">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                    (w.user_id?.trust_score ?? 0) < 40
                      ? 'bg-red-100 text-red-800'
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {w.user_id?.trust_score ?? 0}
                  </span>
                </td>
                <td className="px-5 py-4 text-xs text-gray-500">{dt(w.created_at)}</td>
                <td className="px-5 py-4">
                  <div className="flex gap-2">
                    <RowAction label="Approve" variant="success" action={onApprove} hiddenFields={{ withdrawal_id: w.id }} />
                    <RowAction label="Hold 24h" variant="warning" action={onHold}    hiddenFields={{ withdrawal_id: w.id }} />
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Transaction Filters ──────────────────────────────────────────────────────

const TX_STATUSES = ['pending', 'completed', 'failed', 'refunded', 'cancelled'];

/**
 * Filter bar for the transactions ledger.
 * Reads current filter values from URL search params (via useSearchParams) and
 * pushes updates back to the URL so page.tsx re-runs the Supabase query.
 *
 * Text/number inputs use onBlur + Enter key to avoid a URL push on every keystroke.
 * Dropdown inputs push immediately on change.
 */
function TransactionFilters({ transactionTypes }: { transactionTypes: string[] }) {
  const router    = useRouter();
  const pathname  = usePathname();
  const params    = useSearchParams();
  const [, start] = useTransition();

  const current: FilterValues = {
    q:          params.get('q')          ?? '',
    type:       params.get('type')       ?? '',
    status:     params.get('status')     ?? '',
    date_from:  params.get('date_from')  ?? '',
    date_to:    params.get('date_to')    ?? '',
    amount_min: params.get('amount_min') ?? '',
    amount_max: params.get('amount_max') ?? '',
  };

  const push = useCallback((updates: Partial<FilterValues>) => {
    const next = new URLSearchParams(params.toString());
    // Preserve non-filter params (e.g. active tab if ever stored in URL)
    (Object.entries(updates) as [keyof FilterValues, string][]).forEach(([k, v]) => {
      if (v) { next.set(k, v); } else { next.delete(k); }
    });
    start(() => {
      router.push(`${pathname}?${next.toString()}`, { scroll: false });
    });
  }, [params, pathname, router]);

  const hasFilters = Object.values(current).some(Boolean);

  const clearAll = () => {
    // Strip all filter keys, keep any unrelated params
    const next = new URLSearchParams(params.toString());
    (Object.keys(current) as (keyof FilterValues)[]).forEach(k => next.delete(k));
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  };

  return (
    <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex flex-wrap gap-3 items-end">
      {/* User search */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-500">User</label>
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            defaultValue={current.q}
            placeholder="Name or email…"
            className="pl-6 pr-2 py-1.5 text-xs border border-gray-300 rounded w-44 focus:outline-none focus:ring-1 focus:ring-blue-500"
            onBlur={(e) => push({ q: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') push({ q: (e.target as HTMLInputElement).value });
            }}
          />
        </div>
      </div>

      {/* Transaction type */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-500">Type</label>
        <input
          type="text"
          list="tx-types-list"
          defaultValue={current.type}
          placeholder="Any type…"
          className="px-2 py-1.5 text-xs border border-gray-300 rounded w-40 focus:outline-none focus:ring-1 focus:ring-blue-500"
          onBlur={(e) => push({ type: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') push({ type: (e.target as HTMLInputElement).value });
          }}
        />
        <datalist id="tx-types-list">
          {transactionTypes.map(t => <option key={t} value={t} />)}
        </datalist>
      </div>

      {/* Status */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-500">Status</label>
        <select
          value={current.status}
          onChange={(e) => push({ status: e.target.value })}
          className="px-2 py-1.5 text-xs border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">All statuses</option>
          {TX_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Date from */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-500">From</label>
        <input
          type="date"
          value={current.date_from}
          onChange={(e) => push({ date_from: e.target.value })}
          className="px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Date to */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-500">To</label>
        <input
          type="date"
          value={current.date_to}
          onChange={(e) => push({ date_to: e.target.value })}
          className="px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Amount min */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-500">Min ₦</label>
        <input
          type="number"
          min={0}
          defaultValue={current.amount_min}
          placeholder="0"
          className="px-2 py-1.5 text-xs border border-gray-300 rounded w-28 focus:outline-none focus:ring-1 focus:ring-blue-500"
          onBlur={(e) => push({ amount_min: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') push({ amount_min: (e.target as HTMLInputElement).value });
          }}
        />
      </div>

      {/* Amount max */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-500">Max ₦</label>
        <input
          type="number"
          min={0}
          defaultValue={current.amount_max}
          placeholder="∞"
          className="px-2 py-1.5 text-xs border border-gray-300 rounded w-28 focus:outline-none focus:ring-1 focus:ring-blue-500"
          onBlur={(e) => push({ amount_max: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') push({ amount_max: (e.target as HTMLInputElement).value });
          }}
        />
      </div>

      {/* Clear */}
      {hasFilters && (
        <button
          type="button"
          onClick={clearAll}
          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-200 hover:bg-gray-300 rounded text-gray-700 transition-colors self-end"
        >
          <X size={11} /> Clear filters
        </button>
      )}
    </div>
  );
}

// ─── Transactions Tab ─────────────────────────────────────────────────────────

function TransactionsTab({
  transactions,
  onUpdateStatus,
  transactionTypes,
}: {
  transactions:    TransactionRow[];
  onUpdateStatus:  (fd: FormData) => Promise<void>;
  transactionTypes: string[];
}) {
  return (
    <div>
      <TransactionFilters transactionTypes={transactionTypes} />
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 border-b">
            <tr>
              {['User', 'Ref', 'Type', 'Amount', 'Status', 'Created', 'Override Status'].map((h) => (
                <th key={h} className="px-5 py-3 font-medium text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-sm text-gray-400 italic">
                  No transactions match the current filters.
                </td>
              </tr>
            ) : (
              transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-gray-50">
                  <td className="px-5 py-4 text-xs text-gray-700">
                    {tx.recipient_user_id?.full_name ?? <span className="italic text-gray-400">—</span>}
                  </td>
                  <td className="px-5 py-4 font-mono text-xs text-gray-600">{tx.transaction_ref}</td>
                  <td className="px-5 py-4 capitalize text-xs">{tx.transaction_type}</td>
                  <td className="px-5 py-4 font-bold">{ngn(tx.amount)}</td>
                  <td className="px-5 py-4">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold capitalize ${
                      tx.status === 'completed' ? 'bg-green-100 text-green-800' :
                      tx.status === 'failed'    ? 'bg-red-100 text-red-800' :
                      tx.status === 'pending'   ? 'bg-amber-100 text-amber-800' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {tx.status ?? '—'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-xs text-gray-500">{dt(tx.created_at)}</td>
                  <td className="px-5 py-4">
                    <TransactionStatusSelect tx={tx} onUpdate={onUpdateStatus} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Status override control.
 *
 * Selecting a new status transitions into a reason-capture state before submitting.
 * This satisfies the server-side guard in updateTransactionStatus which rejects
 * requests with no reason. The confirm button is disabled until reason is non-empty.
 */
function TransactionStatusSelect({
  tx,
  onUpdate,
}: {
  tx: TransactionRow;
  onUpdate: (fd: FormData) => Promise<void>;
}) {
  const [currentStatus, setCurrentStatus] = useState(tx.status ?? 'pending');
  const [pendingStatus, setPendingStatus]  = useState<string | null>(null);
  const [reason,        setReason]         = useState('');
  const [feedback,      setFeedback]       = useState<RowFeedback>('idle');
  const [isPending,     start]             = useTransition();

  const handleSelectChange = (newStatus: string) => {
    if (newStatus === currentStatus) return;
    // Transition to reason-capture state — don't submit yet
    setPendingStatus(newStatus);
    setReason('');
    setFeedback('idle');
  };

  const handleConfirm = () => {
    if (!pendingStatus || !reason.trim()) return;
    const fd = new FormData();
    fd.set('transaction_id', tx.id);
    fd.set('new_status',     pendingStatus);
    fd.set('reason',         reason.trim());
    setFeedback('pending');
    start(async () => {
      try {
        await onUpdate(fd);
        setCurrentStatus(pendingStatus);
        setPendingStatus(null);
        setReason('');
        setFeedback('ok');
        setTimeout(() => setFeedback('idle'), 1500);
      } catch {
        setFeedback('error');
        setTimeout(() => {
          setPendingStatus(null);
          setFeedback('idle');
        }, 3000);
      }
    });
  };

  const handleCancel = () => {
    setPendingStatus(null);
    setReason('');
    setFeedback('idle');
  };

  // Reason-capture state: show text input + confirm/cancel
  if (pendingStatus !== null) {
    return (
      <div className="space-y-1.5 min-w-[180px]">
        <p className="text-xs text-gray-600">
          Reason to set&nbsp;
          <span className="font-semibold capitalize">{pendingStatus}</span>:
        </p>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); if (e.key === 'Escape') handleCancel(); }}
          placeholder="Enter reason…"
          autoFocus
          className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!reason.trim() || isPending}
            className="flex items-center gap-1 px-2.5 py-0.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50 transition-colors"
          >
            {isPending && <Loader2 size={10} className="animate-spin" />}
            Confirm
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={isPending}
            className="px-2.5 py-0.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
          >
            Cancel
          </button>
        </div>
        {feedback === 'error' && (
          <p className="text-xs text-red-600">Override failed — check logs.</p>
        )}
      </div>
    );
  }

  // Default: dropdown showing current status
  return (
    <div className="flex items-center gap-2">
      <select
        value={currentStatus}
        onChange={(e) => handleSelectChange(e.target.value)}
        disabled={isPending}
        className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white disabled:opacity-60"
      >
        {TX_STATUSES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      {isPending && <Loader2 size={12} className="animate-spin text-gray-400" />}
      {feedback === 'ok'    && <CheckCircle size={12} className="text-green-600" />}
      {feedback === 'error' && <span className="text-xs text-red-600">Err</span>}
    </div>
  );
}

// ─── Escrow Cancel With Reason ────────────────────────────────────────────────

/**
 * Inline cancel control for an escrow entry.
 * Mirrors the TransactionStatusSelect reason-capture pattern: the initial
 * "Cancel" button expands into a reason input + Confirm/Abort before submitting,
 * satisfying the spec's "with reason field" requirement and the server-side
 * reason guard in cancelEscrow.
 */
function EscrowCancelWithReason({
  escrowId,
  onCancel,
}: {
  escrowId: string;
  onCancel: (fd: FormData) => Promise<void>;
}) {
  const [expanded,  setExpanded]  = useState(false);
  const [reason,    setReason]    = useState('');
  const [feedback,  setFeedback]  = useState<RowFeedback>('idle');
  const [isPending, start]        = useTransition();

  const handleOpen  = () => { setExpanded(true); setReason(''); setFeedback('idle'); };
  const handleAbort = () => { setExpanded(false); setReason(''); setFeedback('idle'); };

  const handleConfirm = () => {
    if (!reason.trim()) return;
    const fd = new FormData();
    fd.set('escrow_id', escrowId);
    fd.set('reason',    reason.trim());
    setFeedback('pending');
    start(async () => {
      try {
        await onCancel(fd);
        setFeedback('ok');
        // Keep "Done" visible; row will disappear on revalidation
      } catch {
        setFeedback('error');
        setTimeout(() => { setExpanded(false); setFeedback('idle'); }, 3000);
      }
    });
  };

  if (feedback === 'ok') {
    return <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle size={12} /> Cancelled</span>;
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded transition-colors bg-red-100 hover:bg-red-200 text-red-700"
      >
        Cancel
      </button>
    );
  }

  return (
    <div className="space-y-1.5 min-w-[180px]">
      <p className="text-xs text-gray-600 font-medium">Reason for cancellation:</p>
      <input
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); if (e.key === 'Escape') handleAbort(); }}
        placeholder="Enter reason…"
        autoFocus
        className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500"
      />
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!reason.trim() || isPending}
          className="flex items-center gap-1 px-2.5 py-0.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded disabled:opacity-50 transition-colors"
        >
          {isPending && <Loader2 size={10} className="animate-spin" />}
          Confirm
        </button>
        <button
          type="button"
          onClick={handleAbort}
          disabled={isPending}
          className="px-2.5 py-0.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
        >
          Abort
        </button>
      </div>
      {feedback === 'error' && <p className="text-xs text-red-600">Cancel failed — check logs.</p>}
    </div>
  );
}

// ─── Escrow Tab ───────────────────────────────────────────────────────────────

function EscrowTab({
  escrowEntries,
  onRelease,
  onFreeze,
  onCancel,
}: {
  escrowEntries: EscrowRow[];
  onRelease:     (fd: FormData) => Promise<void>;
  onFreeze:      (fd: FormData) => Promise<void>;
  onCancel:      (fd: FormData) => Promise<void>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="bg-gray-50 border-b">
          <tr>
            {['Amount', 'Status', 'Order', 'Created', 'Released', 'Actions'].map((h) => (
              <th key={h} className="px-5 py-3 font-medium text-gray-500">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {escrowEntries.length === 0 ? (
            <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-gray-400 italic">No active escrow entries.</td></tr>
          ) : (
            escrowEntries.map((e) => (
              <tr key={e.id} className="hover:bg-gray-50">
                <td className="px-5 py-4 font-bold">{ngn(e.amount)}</td>
                <td className="px-5 py-4">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold capitalize ${
                    e.status === 'funded' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {e.status ?? '—'}
                  </span>
                </td>
                <td className="px-5 py-4 font-mono text-xs text-gray-500">
                  {e.order_id?.slice(0, 8) ?? e.marketplace_order_id?.slice(0, 8) ?? '—'}…
                </td>
                <td className="px-5 py-4 text-xs text-gray-500">{dt(e.created_at)}</td>
                <td className="px-5 py-4 text-xs text-gray-500">{dt(e.released_at)}</td>
                <td className="px-5 py-4">
                  {/* Release and Freeze carry no reason requirement per spec */}
                  <div className="flex flex-wrap gap-2 items-start">
                    <RowAction label="Release" variant="success" action={onRelease} hiddenFields={{ escrow_id: e.id }} />
                    <RowAction label="Freeze"  variant="warning" action={onFreeze}  hiddenFields={{ escrow_id: e.id }} />
                    <EscrowCancelWithReason escrowId={e.id} onCancel={onCancel} />
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const TABS = [
  { id: 'withdrawals',  label: 'Withdrawals'  },
  { id: 'transactions', label: 'Transactions' },
  { id: 'escrow',       label: 'Escrow'       },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function FinanceClient({
  withdrawals,
  transactions,
  escrowEntries,
  withdrawalsPaused,
  withdrawalGateThreshold,
  onApproveWithdrawal,
  onHoldWithdrawal,
  onReleaseEscrow,
  onFreezeEscrow,
  onCancelEscrow,
  onUpdateTransactionStatus,
  onToggleWithdrawalGate,
  onSetWithdrawalGateThreshold,
  transactionTypes,
}: FinanceClientProps) {
  const [active, setActive] = useState<TabId>('withdrawals');

  return (
    <div className="space-y-4">
      {/* Withdrawal gate banner — always visible */}
      <WithdrawalGateBanner
        paused={withdrawalsPaused}
        onToggle={onToggleWithdrawalGate}
        threshold={withdrawalGateThreshold}
        onSetThreshold={onSetWithdrawalGateThreshold}
      />

      <Card className="overflow-hidden">
        {/* Tab nav */}
        <div className="flex border-b border-gray-200">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActive(id)}
              className={`shrink-0 px-6 py-3 text-sm font-medium transition-colors ${
                active === id
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {label}
              {id === 'withdrawals' && withdrawals.length > 0 && (
                <span className="ml-1.5 bg-amber-100 text-amber-700 text-xs font-bold px-1.5 py-0.5 rounded-full">
                  {withdrawals.length}
                </span>
              )}
              {id === 'transactions' && (
                <span className="ml-1.5 bg-gray-100 text-gray-500 text-xs font-medium px-1.5 py-0.5 rounded-full">
                  {transactions.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {active === 'withdrawals' && (
          <WithdrawalsTab
            withdrawals={withdrawals}
            onApprove={onApproveWithdrawal}
            onHold={onHoldWithdrawal}
          />
        )}
        {active === 'transactions' && (
          <TransactionsTab
            transactions={transactions}
            onUpdateStatus={onUpdateTransactionStatus}
            transactionTypes={transactionTypes}
          />
        )}
        {active === 'escrow' && (
          <EscrowTab
            escrowEntries={escrowEntries}
            onRelease={onReleaseEscrow}
            onFreeze={onFreezeEscrow}
            onCancel={onCancelEscrow}
          />
        )}
      </Card>
    </div>
  );
}