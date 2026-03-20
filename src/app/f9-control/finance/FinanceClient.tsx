'use client';

import { useState, useTransition } from 'react';
import { Card } from '@/components/ui/card';
import { Loader2, CheckCircle } from 'lucide-react';
import type { Tables } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type WithdrawalRow = {
  id: string; amount: number; bank_name: string; account_number: string;
  account_name: string; status: string | null; failure_reason: string | null;
  created_at: string | null;
  user_id: { full_name: string | null; trust_score: number | null } | null;
};

type TransactionRow = Pick<
  Tables<'transactions'>,
  'id' | 'transaction_ref' | 'transaction_type' | 'amount' | 'currency' | 'status' | 'order_id' | 'created_at' | 'paid_at'
>;

type EscrowRow = Pick<
  Tables<'escrow'>,
  'id' | 'amount' | 'status' | 'order_id' | 'marketplace_order_id' | 'created_at' | 'released_at'
>;

interface FinanceClientProps {
  withdrawals:          WithdrawalRow[];
  transactions:         TransactionRow[];
  escrowEntries:        EscrowRow[];
  withdrawalsPaused:    boolean;
  onApproveWithdrawal:     (fd: FormData) => Promise<void>;
  onHoldWithdrawal:        (fd: FormData) => Promise<void>;
  onReleaseEscrow:         (fd: FormData) => Promise<void>;
  onFreezeEscrow:          (fd: FormData) => Promise<void>;
  onCancelEscrow:          (fd: FormData) => Promise<void>;
  onUpdateTransactionStatus: (fd: FormData) => Promise<void>;
  onToggleWithdrawalGate:  (fd: FormData) => Promise<void>;
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

/**
 * Inline action button that wraps a hidden-field form and calls a server action.
 * Each button is independently pending-aware.
 */
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

function WithdrawalGateBanner({
  paused,
  onToggle,
}: {
  paused: boolean;
  onToggle: (fd: FormData) => Promise<void>;
}) {
  const [feedback, setFeedback] = useState<RowFeedback>('idle');
  const [isPending, start] = useTransition();

  const handleToggle = () => {
    const fd = new FormData();
    fd.set('enabled', String(!paused)); // current state; action will invert
    setFeedback('pending');
    start(async () => {
      try {
        await onToggle(fd);
        setFeedback('ok');
        setTimeout(() => setFeedback('idle'), 2000);
      } catch {
        setFeedback('error');
      }
    });
  };

  return (
    <div className={`flex items-center justify-between p-4 rounded-lg border-2 ${
      paused ? 'border-red-400 bg-red-50' : 'border-green-400 bg-green-50'
    }`}>
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
      <button
        type="button"
        onClick={handleToggle}
        disabled={isPending}
        className={`flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-lg transition-colors disabled:opacity-60 ${
          paused
            ? 'bg-green-600 hover:bg-green-700 text-white'
            : 'bg-red-600 hover:bg-red-700 text-white'
        }`}
      >
        {isPending && <Loader2 size={13} className="animate-spin" />}
        {paused ? 'Resume Withdrawals' : 'Pause All Withdrawals'}
      </button>
      {feedback === 'ok'    && <span className="text-xs text-green-600 ml-2">Updated</span>}
      {feedback === 'error' && <span className="text-xs text-red-600 ml-2">Failed</span>}
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

// ─── Transactions Tab ─────────────────────────────────────────────────────────

const TX_STATUSES = ['pending', 'completed', 'failed', 'refunded', 'cancelled'];

function TransactionsTab({
  transactions,
  onUpdateStatus,
}: {
  transactions:  TransactionRow[];
  onUpdateStatus: (fd: FormData) => Promise<void>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="bg-gray-50 border-b">
          <tr>
            {['Ref', 'Type', 'Amount', 'Status', 'Created', 'Override Status'].map((h) => (
              <th key={h} className="px-5 py-3 font-medium text-gray-500">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {transactions.length === 0 ? (
            <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-gray-400 italic">No transactions.</td></tr>
          ) : (
            transactions.map((tx) => (
              <tr key={tx.id} className="hover:bg-gray-50">
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
  );
}

function TransactionStatusSelect({
  tx,
  onUpdate,
}: {
  tx: TransactionRow;
  onUpdate: (fd: FormData) => Promise<void>;
}) {
  const [selected, setSelected] = useState(tx.status ?? 'pending');
  const [feedback, setFeedback] = useState<RowFeedback>('idle');
  const [isPending, start] = useTransition();

  const handleChange = (newStatus: string) => {
    setSelected(newStatus);
    const fd = new FormData();
    fd.set('transaction_id', tx.id);
    fd.set('new_status', newStatus);
    setFeedback('pending');
    start(async () => {
      try {
        await onUpdate(fd);
        setFeedback('ok');
        setTimeout(() => setFeedback('idle'), 1500);
      } catch {
        setFeedback('error');
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      <select
        value={selected}
        onChange={(e) => handleChange(e.target.value)}
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
                  <div className="flex gap-2">
                    <RowAction label="Release" variant="success" action={onRelease} hiddenFields={{ escrow_id: e.id }} />
                    <RowAction label="Freeze"  variant="warning" action={onFreeze}  hiddenFields={{ escrow_id: e.id }} />
                    <RowAction label="Cancel"  variant="danger"  action={onCancel}  hiddenFields={{ escrow_id: e.id }} />
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
  onApproveWithdrawal,
  onHoldWithdrawal,
  onReleaseEscrow,
  onFreezeEscrow,
  onCancelEscrow,
  onUpdateTransactionStatus,
  onToggleWithdrawalGate,
}: FinanceClientProps) {
  const [active, setActive] = useState<TabId>('withdrawals');

  return (
    <div className="space-y-4">
      {/* Withdrawal gate banner — always visible */}
      <WithdrawalGateBanner paused={withdrawalsPaused} onToggle={onToggleWithdrawalGate} />

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
              {id === 'withdrawals'  && withdrawals.length  > 0 && (
                <span className="ml-1.5 bg-amber-100 text-amber-700 text-xs font-bold px-1.5 py-0.5 rounded-full">
                  {withdrawals.length}
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