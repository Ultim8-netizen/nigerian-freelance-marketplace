'use client';

import { useState, useTransition } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrustBadge, type TrustLevel } from '@/components/ui/TrustBadge';
import { AlertTriangle, ShieldOff, Ban, Lock, Sliders, CheckCircle, Loader2 } from 'lucide-react';
import type { Tables } from '@/types';

// ─── Prop types ───────────────────────────────────────────────────────────────

export interface UserProfileTabsProps {
  profile:      Tables<'profiles'>;
  orders:       Tables<'orders'>[];
  disputes:     Tables<'disputes'>[];
  wallet:       Tables<'wallets'> | null;
  withdrawals:  Tables<'withdrawals'>[];
  securityLogs: Tables<'security_logs'>[];
  trustEvents:  Tables<'trust_score_events'>[];
  devices:      Tables<'user_devices'>[];
  auditLogs:    Tables<'audit_logs'>[];
  adminNotes:   Tables<'admin_action_logs'>[];
  // Server actions — bound to the specific userId in the server component
  onWarn:          (fd: FormData) => Promise<void>;
  onSuspend:       (fd: FormData) => Promise<void>;
  onBan:           (fd: FormData) => Promise<void>;
  onFreeze:        (fd: FormData) => Promise<void>;
  onOverrideTrust: (fd: FormData) => Promise<void>;
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatNGN(v: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency', currency: 'NGN', minimumFractionDigits: 0,
  }).format(v);
}

function dt(s: string | null) {
  if (!s) return 'N/A';
  return new Date(s).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

// ─── Inline action panel ─────────────────────────────────────────────────────

interface ActionPanelProps {
  label:       string;
  icon:        React.ReactNode;
  colour:      string;           // Tailwind bg + text classes
  action:      (fd: FormData) => Promise<void>;
  fields?:     { name: string; label: string; type?: string; min?: number; max?: number }[];
  confirmText: string;
}

function ActionPanel({ label, icon, colour, action, fields = [], confirmText }: ActionPanelProps) {
  const [open, setOpen]         = useState(false);
  const [feedback, setFeedback] = useState<'ok' | 'err' | null>(null);
  const [isPending, start]      = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      try {
        await action(fd);
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
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="px-4 py-3 bg-gray-50 border-t border-gray-200 space-y-3">
          {fields.map((f) => (
            <div key={f.name}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
              <input
                name={f.name}
                type={f.type ?? 'text'}
                min={f.min}
                max={f.max}
                required
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
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
            {feedback === 'ok'  && <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle size={12} /> Done</span>}
            {feedback === 'err' && <span className="text-xs text-red-600">Failed — try again</span>}
          </div>
        </form>
      )}
    </div>
  );
}

// ─── Tab sections ─────────────────────────────────────────────────────────────

function OverviewTab({ p }: { p: Tables<'profiles'> }) {
  const fields: [string, string | number | boolean | null][] = [
    ['Email',             p.email],
    ['Phone',             p.phone_number ?? '—'],
    ['Role',              p.user_type],
    ['Location',          p.location ?? '—'],
    ['University',        p.university ?? '—'],
    ['Account status',    p.account_status],
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
    ['Suspension reason', p.suspension_reason ?? '—'],
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
      {fields.map(([label, value]) => (
        <div key={label} className="flex justify-between py-2 border-b border-gray-100 text-sm">
          <span className="text-gray-500">{label}</span>
          <span className="font-medium text-gray-900 text-right">{String(value)}</span>
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
                  <p className="font-medium capitalize">{d.reason} — <span className="font-normal text-gray-600">{d.status}</span></p>
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

function FinancialsTab({
  wallet, withdrawals,
}: {
  wallet:      Tables<'wallets'> | null;
  withdrawals: Tables<'withdrawals'>[];
}) {
  return (
    <div className="space-y-6">
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
              <li key={log.id} className={`flex items-start gap-3 p-3 rounded text-sm ${log.severity === 'critical' ? 'bg-red-50' : 'bg-gray-50'}`}>
                <span className={`shrink-0 w-2 h-2 rounded-full mt-1.5 ${log.severity === 'critical' ? 'bg-red-500' : 'bg-amber-400'}`} />
                <div className="min-w-0">
                  <p className="font-mono text-xs font-semibold uppercase text-gray-800">
                    {log.event_type.replace(/_/g, ' ')}
                    {log.severity === 'critical' && (
                      <span className="ml-2 text-red-600 normal-case font-sans">• critical</span>
                    )}
                  </p>
                  {log.description && <p className="text-gray-500 text-xs mt-0.5">{log.description}</p>}
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
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Registered Devices ({devices.length})</h4>
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
                  <span className="font-mono text-xs font-semibold uppercase text-gray-800">
                    {a.action}
                  </span>
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

function AdminNotesTab({ notes }: { notes: Tables<'admin_action_logs'>[] }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-700 mb-3">Admin Actions ({notes.length})</h4>
      {notes.length === 0 ? (
        <p className="text-sm text-gray-400 italic">No admin actions recorded for this user.</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
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
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function UserProfileTabs({
  profile,
  orders,
  disputes,
  wallet,
  withdrawals,
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
}: UserProfileTabsProps) {
  const [active, setActive] = useState<Tab>('Overview');

  return (
    <div className="space-y-6">
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
                {profile.user_type}{profile.university ? ` · ${profile.university}` : ''}{profile.location ? ` · ${profile.location}` : ''}
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
          />
          <ActionPanel
            label="Suspend Account"
            icon={<ShieldOff size={15} />}
            colour="bg-orange-50 hover:bg-orange-100 text-orange-800"
            action={onSuspend}
            fields={[{ name: 'reason', label: 'Suspension reason' }]}
            confirmText="Suspend"
          />
          <ActionPanel
            label="Ban Account"
            icon={<Ban size={15} />}
            colour="bg-red-50 hover:bg-red-100 text-red-800"
            action={onBan}
            fields={[{ name: 'reason', label: 'Ban reason' }]}
            confirmText="Ban User"
          />
          <ActionPanel
            label="Freeze Wallet"
            icon={<Lock size={15} />}
            colour="bg-blue-50 hover:bg-blue-100 text-blue-800"
            action={onFreeze}
            fields={[{ name: 'reason', label: 'Freeze reason' }]}
            confirmText="Freeze"
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
          />
        </div>
      </Card>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        {/* Tab nav */}
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

        {/* Tab body */}
        <div className="p-6">
          {active === 'Overview'       && <OverviewTab   p={profile} />}
          {active === 'Activity'       && <ActivityTab   orders={orders} disputes={disputes} />}
          {active === 'Financials'     && <FinancialsTab wallet={wallet} withdrawals={withdrawals} />}
          {active === 'Flags & History'&& <FlagsTab      securityLogs={securityLogs} trustEvents={trustEvents} />}
          {active === 'Security'       && <SecurityTab   devices={devices} auditLogs={auditLogs} />}
          {active === 'Admin Notes'    && <AdminNotesTab notes={adminNotes} />}
        </div>
      </Card>
    </div>
  );
}