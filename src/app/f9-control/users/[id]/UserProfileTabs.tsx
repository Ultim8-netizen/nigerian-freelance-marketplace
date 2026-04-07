'use client';

import { useState, useTransition } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrustBadge, type TrustLevel } from '@/components/ui/TrustBadge';
import {
  AlertTriangle, ShieldOff, Ban, Lock, Sliders,
  CheckCircle, Loader2, ShieldCheck, MessageSquare,
} from 'lucide-react';
import type { Tables } from '@/types';
import { useStepUpAuth } from '@/components/admin/StepUpAuth';

// ─── Prop types ───────────────────────────────────────────────────────────────

export interface UserProfileTabsProps {
  profile:      Tables<'profiles'>;
  orders:       Tables<'orders'>[];
  disputes:     Tables<'disputes'>[];
  wallet:       Tables<'wallets'> | null;
  withdrawals:  Tables<'withdrawals'>[];
  /** Full transaction history — both legs (recipient + order-linked). */
  transactions: Tables<'transactions'>[];
  securityLogs: Tables<'security_logs'>[];
  trustEvents:  Tables<'trust_score_events'>[];
  devices:      Tables<'user_devices'>[];
  auditLogs:    Tables<'audit_logs'>[];
  adminNotes:   Tables<'admin_action_logs'>[];
  onWarn:          (fd: FormData) => Promise<void>;
  onSuspend:       (fd: FormData) => Promise<void>;
  onBan:           (fd: FormData) => Promise<void>;
  onFreeze:        (fd: FormData) => Promise<void>;
  onOverrideTrust: (fd: FormData) => Promise<void>;
  /** Appends a freeform private note to admin_action_logs. Never visible to the target user. */
  onAddNote:       (fd: FormData) => Promise<void>;
}

// ─── Tab config ───────────────────────────────────────────────────────────────

const TABS = [
  'Overview',
  'Activity',
  'Financials',
  'Flags & History',
  'Security',
  'Admin Notes',
] as const;

type Tab = (typeof TABS)[number];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatNGN(v: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency', currency: 'NGN', minimumFractionDigits: 0,
  }).format(v);
}

function dt(s: string | null | undefined) {
  if (!s) return 'N/A';
  return new Date(s).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

// ─── ActionPanel ──────────────────────────────────────────────────────────────

interface FieldConfig {
  name:         string;
  label:        string;
  type?:        string;
  min?:         number;
  max?:         number;
  defaultValue?: string | number;
  hint?:        string;
}

interface ActionPanelProps {
  label:        string;
  icon:         React.ReactNode;
  colour:       string;
  action:       (fd: FormData) => Promise<void>;
  fields?:      FieldConfig[];
  confirmText:  string;
  hiddenValues?: Record<string, string>;
  requireStepUp?: (action: () => Promise<void>) => Promise<void>;
  nuclear?: boolean;
}

function ActionPanel({
  label, icon, colour, action, fields = [], confirmText,
  hiddenValues = {}, requireStepUp, nuclear,
}: ActionPanelProps) {
  const [open, setOpen]         = useState(false);
  const [feedback, setFeedback] = useState<'ok' | 'err' | null>(null);
  const [isPending, start]      = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      try {
        const run = () => action(fd);
        if (requireStepUp) {
          await requireStepUp(run);
        } else {
          await run();
        }
        setFeedback('ok');
        setTimeout(() => { setFeedback(null); setOpen(false); }, 1500);
      } catch {
        setFeedback('err');
      }
    });
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setFeedback(null); }}
        className={`w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-colors ${colour}`}
      >
        {icon}
        {label}
        {nuclear && (
          <span className="ml-auto flex items-center gap-1 text-xs opacity-70">
            <ShieldCheck size={11} /> Step-Up
          </span>
        )}
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="px-4 py-3 bg-gray-50 border-t border-gray-200 space-y-3">
          {Object.entries(hiddenValues).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}

          {fields.map((f) => (
            <div key={f.name}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
              <input
                name={f.name}
                type={f.type ?? 'text'}
                min={f.min}
                max={f.max}
                defaultValue={f.defaultValue}
                required
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {f.hint && (
                <p className="mt-1 text-xs text-gray-400">{f.hint}</p>
              )}
            </div>
          ))}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-xs font-semibold rounded transition-colors"
            >
              {isPending && <Loader2 size={12} className="animate-spin" />}
              {confirmText}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-semibold rounded"
            >
              Cancel
            </button>
            {feedback === 'ok'  && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle size={12} /> Done
              </span>
            )}
            {feedback === 'err' && (
              <span className="text-xs text-red-600">Failed — try again</span>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

// ─── NotePanel ────────────────────────────────────────────────────────────────

/**
 * Dedicated "Add Private Note" panel.
 *
 * Separated from ActionPanel because:
 *  - It needs a <textarea> rather than a single-line <input>
 *  - It uses a neutral (non-destructive) submit colour
 *  - The privacy callout needs to be prominent and persistent
 *
 * The note is written directly to admin_action_logs with action_type =
 * 'private_note'. It is never surfaced to the target user.
 */
interface NotePanelProps {
  action:       (fd: FormData) => Promise<void>;
  hiddenValues: Record<string, string>;
}

function NotePanel({ action, hiddenValues }: NotePanelProps) {
  const [open, setOpen]         = useState(false);
  const [feedback, setFeedback] = useState<'ok' | 'err' | null>(null);
  const [isPending, start]      = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const note = (fd.get('note') as string)?.trim();
    if (!note) return;
    start(async () => {
      try {
        await action(fd);
        setFeedback('ok');
        // Reset the textarea by closing and reopening the panel
        setTimeout(() => { setFeedback(null); setOpen(false); }, 1500);
      } catch {
        setFeedback('err');
      }
    });
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setFeedback(null); }}
        className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-colors bg-gray-50 hover:bg-gray-100 text-gray-700"
      >
        <MessageSquare size={15} />
        Add Private Note
        <span className="ml-auto text-xs font-normal text-gray-400 italic">
          never visible to user
        </span>
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="px-4 py-3 bg-gray-50 border-t border-gray-200 space-y-3">
          {/* Privacy callout */}
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            This note is stored in admin_action_logs and is strictly isolated from
            the user. It will never appear in their notifications, profile, or any
            user-facing surface.
          </p>

          {Object.entries(hiddenValues).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Note
            </label>
            <textarea
              name="note"
              rows={4}
              required
              placeholder="Add internal context, observations, or follow-up reminders…"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-800 disabled:opacity-60 text-white text-xs font-semibold rounded transition-colors"
            >
              {isPending && <Loader2 size={12} className="animate-spin" />}
              Save Note
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-semibold rounded"
            >
              Cancel
            </button>
            {feedback === 'ok' && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle size={12} /> Note saved
              </span>
            )}
            {feedback === 'err' && (
              <span className="text-xs text-red-600">Failed — try again</span>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

// ─── Tab sections ─────────────────────────────────────────────────────────────

function OverviewTab({ p }: { p: Tables<'profiles'> }) {
  const suspendedUntil = (p as unknown as Record<string, unknown>).suspended_until as string | null | undefined;

  const fields: [string, string | number | boolean | null | undefined][] = [
    ['Email',             p.email],
    ['Phone',             p.phone_number ?? '—'],
    ['Role',              p.user_type],
    ['Location',          p.location ?? '—'],
    ['University',        p.university ?? '—'],
    ['Account status',    p.account_status],
    ['Suspended until',   suspendedUntil ? dt(suspendedUntil) : p.account_status === 'suspended' ? 'Indefinite' : '—'],
    ['Suspension reason', p.suspension_reason ?? '—'],
    ['Onboarding done',   p.onboarding_completed ? 'Yes' : 'No'],
    ['Email verified',    p.email_verified ? 'Yes' : 'No'],
    ['Phone verified',    p.phone_verified ? 'Yes' : 'No'],
    ['Liveness verified', p.liveness_verified ? 'Yes' : 'No'],
    ['Identity verified', p.identity_verified ? 'Yes' : 'No'],
    ['Student verified',  p.student_verified  ? 'Yes' : 'No'],
    ['Trust score',       p.trust_score ?? 0],
    ['Trust level',       p.trust_level ?? 'new'],
    ['Freelancer rating', p.freelancer_rating ?? '—'],
    ['Jobs completed',    p.total_jobs_completed ?? 0],
    ['Jobs posted',       p.total_jobs_posted    ?? 0],
    ['Member since',      dt(p.created_at)],
    ['Last updated',      dt(p.updated_at)],
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
      {fields.map(([label, value]) => (
        <div key={label} className="flex justify-between py-2 border-b border-gray-100 text-sm">
          <span className="text-gray-500">{label}</span>
          <span className={`font-medium text-right ${
            label === 'Suspended until' && value !== '—'
              ? 'text-orange-600'
              : 'text-gray-900'
          }`}>
            {String(value ?? '—')}
          </span>
        </div>
      ))}
      {p.bio && (
        <div className="col-span-2 py-2 border-b border-gray-100 text-sm">
          <p className="text-gray-500 mb-1">Bio</p>
          <p className="text-gray-900">{p.bio}</p>
        </div>
      )}
    </div>
  );
}

function ActivityTab({
  orders, disputes,
}: {
  orders:   Tables<'orders'>[];
  disputes: Tables<'disputes'>[];
}) {
  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Orders ({orders.length})</h4>
        {orders.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No orders found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-gray-50">
                <tr>
                  {['#', 'Title', 'Amount', 'Status', 'Role', 'Created'].map((h) => (
                    <th key={h} className="px-4 py-2 text-xs font-medium text-gray-500 border-b">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-xs text-gray-500">{o.order_number}</td>
                    <td className="px-4 py-2 font-medium">{o.title}</td>
                    <td className="px-4 py-2">{formatNGN(o.amount)}</td>
                    <td className="px-4 py-2 capitalize">{o.status ?? '—'}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">
                      {o.client_id === o.freelancer_id ? 'both' : o.client_id ? 'client' : 'freelancer'}
                    </td>
                    <td className="px-4 py-2 text-gray-500 text-xs">{dt(o.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Disputes ({disputes.length})</h4>
        {disputes.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No disputes found.</p>
        ) : (
          <div className="space-y-2">
            {disputes.map((d) => (
              <div key={d.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded text-sm">
                <span className="shrink-0 w-2 h-2 rounded-full bg-red-400 mt-1.5" />
                <div>
                  <p className="font-medium capitalize">
                    {d.reason} — <span className="font-normal text-gray-600">{d.status}</span>
                  </p>
                  <p className="text-gray-500 text-xs mt-0.5 line-clamp-2">{d.description}</p>
                  <p className="text-gray-400 text-xs mt-0.5">{dt(d.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Transaction status badge colour helper ───────────────────────────────────

function txStatusColour(status: string | null): string {
  switch (status) {
    case 'successful': return 'text-green-700 bg-green-50';
    case 'pending':    return 'text-amber-700 bg-amber-50';
    case 'failed':     return 'text-red-700 bg-red-50';
    default:           return 'text-gray-600 bg-gray-100';
  }
}

function FinancialsTab({
  wallet, withdrawals, transactions,
}: {
  wallet:       Tables<'wallets'> | null;
  withdrawals:  Tables<'withdrawals'>[];
  transactions: Tables<'transactions'>[];
}) {
  return (
    <div className="space-y-6">

      {/* ── Wallet ──────────────────────────────────────────────────────── */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Wallet</h4>
        {!wallet ? (
          <p className="text-sm text-gray-400 italic">No wallet record found.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Balance',           value: formatNGN(wallet.balance ?? 0) },
              { label: 'Pending Clearance', value: formatNGN(wallet.pending_clearance ?? 0) },
              { label: 'Total Earned',      value: formatNGN(wallet.total_earned ?? 0) },
              { label: 'Total Withdrawn',   value: formatNGN(wallet.total_withdrawn ?? 0) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500">{label}</p>
                <p className="text-lg font-bold text-gray-900 mt-1">{value}</p>
              </div>
            ))}
          </div>
        )}
        {wallet && (wallet.account_name || wallet.bank_name) && (
          <div className="mt-3 p-3 bg-blue-50 rounded text-sm space-y-1">
            <p className="text-xs font-semibold text-blue-700 uppercase mb-1">Bank Details</p>
            <p><span className="text-gray-500">Account name:</span> {wallet.account_name ?? '—'}</p>
            <p><span className="text-gray-500">Account number:</span> {wallet.account_number ?? '—'}</p>
            <p><span className="text-gray-500">Bank:</span> {wallet.bank_name ?? '—'}</p>
          </div>
        )}
      </div>

      {/* ── Transaction History ─────────────────────────────────────────── */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">
          Transaction History ({transactions.length})
        </h4>
        {transactions.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No transactions found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-gray-50">
                <tr>
                  {['Ref', 'Type', 'Amount', 'Method', 'Status', 'Paid At', 'Created'].map((h) => (
                    <th key={h} className="px-4 py-2 text-xs font-medium text-gray-500 border-b whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50">
                    {/* Ref — truncated for display; full value in title tooltip */}
                    <td className="px-4 py-2 font-mono text-xs text-gray-500 max-w-[120px]">
                      <span title={tx.transaction_ref} className="block truncate">
                        {tx.transaction_ref}
                      </span>
                      {tx.flutterwave_tx_ref && (
                        <span title={tx.flutterwave_tx_ref} className="block truncate text-gray-400 mt-0.5">
                          flw: {tx.flutterwave_tx_ref}
                        </span>
                      )}
                    </td>
                    {/* Type */}
                    <td className="px-4 py-2 capitalize whitespace-nowrap">
                      {tx.transaction_type.replace(/_/g, ' ')}
                    </td>
                    {/* Amount */}
                    <td className="px-4 py-2 font-medium whitespace-nowrap">
                      {formatNGN(tx.amount)}
                      {tx.currency && tx.currency !== 'NGN' && (
                        <span className="ml-1 text-xs text-gray-400">{tx.currency}</span>
                      )}
                    </td>
                    {/* Method */}
                    <td className="px-4 py-2 text-xs text-gray-500 capitalize whitespace-nowrap">
                      {tx.payment_method ?? '—'}
                    </td>
                    {/* Status badge */}
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold capitalize ${txStatusColour(tx.status)}`}>
                        {tx.status ?? '—'}
                      </span>
                    </td>
                    {/* Paid at */}
                    <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">
                      {dt(tx.paid_at)}
                    </td>
                    {/* Created */}
                    <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">
                      {dt(tx.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Withdrawals ─────────────────────────────────────────────────── */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Withdrawals ({withdrawals.length})</h4>
        {withdrawals.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No withdrawals found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-gray-50">
                <tr>
                  {['Amount', 'Bank', 'Status', 'Failure / Hold', 'Date'].map((h) => (
                    <th key={h} className="px-4 py-2 text-xs font-medium text-gray-500 border-b">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {withdrawals.map((w) => (
                  <tr key={w.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium">{formatNGN(w.amount)}</td>
                    <td className="px-4 py-2 text-xs">{w.bank_name} / {w.account_number}</td>
                    <td className="px-4 py-2 capitalize">{w.status ?? '—'}</td>
                    <td className="px-4 py-2 text-xs text-gray-500 max-w-xs truncate">{w.failure_reason ?? '—'}</td>
                    <td className="px-4 py-2 text-gray-500 text-xs">{dt(w.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function FlagsTab({
  securityLogs, trustEvents,
}: {
  securityLogs: Tables<'security_logs'>[];
  trustEvents:  Tables<'trust_score_events'>[];
}) {
  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Security Logs ({securityLogs.length})</h4>
        {securityLogs.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No security logs.</p>
        ) : (
          <ul className="space-y-2">
            {securityLogs.map((log) => (
              <li
                key={log.id}
                className={`flex items-start gap-3 p-3 rounded text-sm ${
                  log.severity === 'critical' ? 'bg-red-50' : 'bg-gray-50'
                }`}
              >
                <span className={`shrink-0 w-2 h-2 rounded-full mt-1.5 ${
                  log.severity === 'critical' ? 'bg-red-500' : 'bg-amber-400'
                }`} />
                <div className="min-w-0">
                  <p className="font-mono text-xs font-semibold uppercase text-gray-800">
                    {log.event_type.replace(/_/g, ' ')}
                    {log.severity === 'critical' && (
                      <span className="ml-2 text-red-600 normal-case font-sans">• critical</span>
                    )}
                  </p>
                  {log.description && (
                    <p className="text-gray-500 text-xs mt-0.5">{log.description}</p>
                  )}
                  <p className="text-gray-400 text-xs mt-0.5">{dt(log.created_at)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Trust Score History ({trustEvents.length})</h4>
        {trustEvents.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No trust score events.</p>
        ) : (
          <ul className="space-y-2">
            {trustEvents.map((e) => (
              <li key={e.id} className="flex items-center justify-between py-2 border-b border-gray-100 text-sm">
                <div>
                  <p className="font-medium capitalize">{e.event_type.replace(/_/g, ' ')}</p>
                  {e.notes && <p className="text-xs text-gray-500">{e.notes}</p>}
                  <p className="text-xs text-gray-400">{dt(e.created_at)}</p>
                </div>
                <div className="text-right shrink-0 pl-4">
                  <span className={`font-bold text-sm ${e.score_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {e.score_change >= 0 ? '+' : ''}{e.score_change}
                  </span>
                  <p className="text-xs text-gray-500">{e.previous_score} → {e.new_score}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function SecurityTab({
  devices, auditLogs,
}: {
  devices:   Tables<'user_devices'>[];
  auditLogs: Tables<'audit_logs'>[];
}) {
  return (
    <div className="space-y-6">
      <div>
        {/* Spec: last 5 login sessions. The parent page enforces .limit(5) on the query. */}
        <h4 className="text-sm font-semibold text-gray-700 mb-3">
          Recent Login Sessions — last {devices.length} of 5
        </h4>
        {devices.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No devices recorded.</p>
        ) : (
          <ul className="space-y-2">
            {devices.map((d) => (
              <li key={d.id} className="p-3 bg-gray-50 rounded text-sm">
                <p className="font-mono text-xs text-gray-700">{d.device_fingerprint}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  First seen: {dt(d.first_seen_at)} · Last seen: {dt(d.last_seen_at)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Audit Log ({auditLogs.length})</h4>
        {auditLogs.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No audit entries.</p>
        ) : (
          <ul className="space-y-1">
            {auditLogs.map((a) => (
              <li key={a.id} className="flex items-start justify-between py-2 border-b border-gray-100 text-sm gap-4">
                <div className="min-w-0">
                  <span className="font-mono text-xs font-semibold uppercase text-gray-800">{a.action}</span>
                  {a.resource_type && (
                    <span className="ml-2 text-xs text-gray-500">{a.resource_type}</span>
                  )}
                </div>
                <p className="text-xs text-gray-400 shrink-0">{dt(a.created_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * AdminNotesTab
 *
 * Shows all admin_action_logs entries for this user, with private_note entries
 * visually distinguished from enforcement actions. The "Add Private Note" panel
 * lives at the top of this tab so the admin can write and review in one place.
 */
function AdminNotesTab({
  notes,
  onAddNote,
  userId,
}: {
  notes:      Tables<'admin_action_logs'>[];
  onAddNote:  (fd: FormData) => Promise<void>;
  userId:     string;
}) {
  // Separate freeform notes from enforcement actions for clarity
  const freeformNotes   = notes.filter((n) => n.action_type === 'private_note');
  const enforcementLogs = notes.filter((n) => n.action_type !== 'private_note');

  return (
    <div className="space-y-6">
      {/* ── Add note panel ────────────────────────────────────────────────── */}
      <NotePanel action={onAddNote} hiddenValues={{ user_id: userId }} />

      {/* ── Private notes ─────────────────────────────────────────────────── */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">
          Private Notes ({freeformNotes.length})
        </h4>
        {freeformNotes.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No private notes yet.</p>
        ) : (
          <ul className="space-y-2">
            {freeformNotes.map((n) => (
              <li key={n.id} className="p-3 bg-amber-50 border border-amber-100 rounded text-sm space-y-1">
                <div className="flex items-center gap-2">
                  <MessageSquare size={12} className="text-amber-500 shrink-0" />
                  <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                    Private Note
                  </span>
                  <span className="ml-auto text-xs text-gray-400">{dt(n.created_at)}</span>
                </div>
                <p className="text-gray-700 text-sm whitespace-pre-wrap">{n.reason}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Enforcement actions ───────────────────────────────────────────── */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">
          Enforcement Actions ({enforcementLogs.length})
        </h4>
        {enforcementLogs.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No admin actions recorded for this user.</p>
        ) : (
          <ul className="space-y-2">
            {enforcementLogs.map((n) => (
              <li key={n.id} className="p-3 bg-gray-50 rounded text-sm space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold uppercase text-gray-800">
                    {n.action_type.replace(/_/g, ' ')}
                  </span>
                  {n.is_reversed && (
                    <Badge variant="outline" className="text-xs">Reversed</Badge>
                  )}
                </div>
                {n.reason && <p className="text-gray-600 text-xs">{n.reason}</p>}
                <p className="text-gray-400 text-xs">{dt(n.created_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function UserProfileTabs({
  profile,
  orders,
  disputes,
  wallet,
  withdrawals,
  transactions,
  securityLogs,
  trustEvents,
  devices,
  auditLogs,
  adminNotes,
  onWarn,
  onSuspend,
  onBan,
  onFreeze,
  onOverrideTrust,
  onAddNote,
}: UserProfileTabsProps) {
  const [active, setActive] = useState<Tab>('Overview');
  const { requireStepUp, StepUpModal } = useStepUpAuth();

  const userId = profile.id;

  return (
    <div className="space-y-6">
      {StepUpModal}

      {/* ── Profile header ─────────────────────────────────────────────── */}
      <Card className="p-6">
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-2xl font-bold text-blue-600 shrink-0">
              {profile.full_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-gray-900">{profile.full_name}</h2>
                <TrustBadge
                  level={(profile.trust_level ?? 'new') as TrustLevel}
                  score={profile.trust_score ?? 0}
                  size="sm"
                />
                <Badge
                  variant={profile.account_status === 'active' ? 'success' : 'destructive'}
                  className="capitalize"
                >
                  {profile.account_status}
                </Badge>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">{profile.email}</p>
              <p className="text-xs text-gray-400 mt-0.5 capitalize">
                {profile.user_type}
                {profile.university ? ` · ${profile.university}` : ''}
                {profile.location   ? ` · ${profile.location}`   : ''}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Action buttons ────────────────────────────────────────────────── */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
          Admin Actions
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <ActionPanel
            label="Warn User"
            icon={<AlertTriangle size={15} />}
            colour="bg-amber-50 hover:bg-amber-100 text-amber-800"
            action={onWarn}
            fields={[{ name: 'reason', label: 'Warning reason' }]}
            confirmText="Send Warning"
            hiddenValues={{ user_id: userId }}
          />
          <ActionPanel
            label="Suspend Account"
            icon={<ShieldOff size={15} />}
            colour="bg-orange-50 hover:bg-orange-100 text-orange-800"
            action={onSuspend}
            fields={[
              {
                name:         'duration_days',
                label:        'Duration (days)',
                type:         'number',
                min:          1,
                defaultValue: 7,
                hint:         'Moderators are capped at 30 days server-side. Set 0 for indefinite (admin only).',
              },
              { name: 'reason', label: 'Suspension reason' },
            ]}
            confirmText="Suspend"
            hiddenValues={{ user_id: userId }}
          />
          <ActionPanel
            label="Ban Account"
            icon={<Ban size={15} />}
            colour="bg-red-50 hover:bg-red-100 text-red-800"
            action={onBan}
            fields={[{ name: 'reason', label: 'Ban reason' }]}
            confirmText="Ban User"
            hiddenValues={{ user_id: userId }}
            requireStepUp={requireStepUp}
            nuclear
          />
          <ActionPanel
            label="Freeze Wallet"
            icon={<Lock size={15} />}
            colour="bg-blue-50 hover:bg-blue-100 text-blue-800"
            action={onFreeze}
            fields={[{ name: 'reason', label: 'Freeze reason' }]}
            confirmText="Freeze"
            hiddenValues={{ user_id: userId }}
            requireStepUp={requireStepUp}
            nuclear
          />
          <ActionPanel
            label="Override Trust Score"
            icon={<Sliders size={15} />}
            colour="bg-purple-50 hover:bg-purple-100 text-purple-800"
            action={onOverrideTrust}
            fields={[
              { name: 'score_change', label: 'Score change (e.g. -10 or +15)', type: 'number', min: -100, max: 100 },
              { name: 'reason',       label: 'Reason / notes' },
            ]}
            confirmText="Apply Override"
            hiddenValues={{ user_id: userId }}
          />
        </div>
      </Card>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActive(tab)}
              className={`shrink-0 px-5 py-3 text-sm font-medium transition-colors ${
                active === tab
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="p-6">
          {active === 'Overview'        && <OverviewTab   p={profile} />}
          {active === 'Activity'        && <ActivityTab   orders={orders} disputes={disputes} />}
          {active === 'Financials'      && (
            <FinancialsTab
              wallet={wallet}
              withdrawals={withdrawals}
              transactions={transactions}
            />
          )}
          {active === 'Flags & History' && <FlagsTab      securityLogs={securityLogs} trustEvents={trustEvents} />}
          {active === 'Security'        && <SecurityTab   devices={devices} auditLogs={auditLogs} />}
          {active === 'Admin Notes'     && (
            <AdminNotesTab
              notes={adminNotes}
              onAddNote={onAddNote}
              userId={userId}
            />
          )}
        </div>
      </Card>
    </div>
  );
}