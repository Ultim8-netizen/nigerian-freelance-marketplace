'use client';

import { useState, useTransition } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, CheckCircle, Users, UserPlus, ScrollText,
  ShieldCheck, SlidersHorizontal, RotateCcw, XCircle,
} from 'lucide-react';
import type { RoleType, StaffWithProfile, ActionLogRow } from './page';
import { ROLE_TYPES } from './page';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StaffClientProps {
  staffRoles:                 StaffWithProfile[];
  actionLog:                  ActionLogRow[];
  caps:                       Record<RoleType, number>;
  activeCounts:               Record<RoleType, number>;
  onAppointStaff:             (fd: FormData) => Promise<void>;
  onRevokeStaff:              (fd: FormData) => Promise<void>;
  onUpdateStaffCap:           (fd: FormData) => Promise<void>;
  onGrantElevatedPermission:  (fd: FormData) => Promise<void>;
  onRevokeElevatedPermission: (fd: FormData) => Promise<void>;
  onReverseAction:            (fd: FormData) => Promise<void>;
}

type RowFeedback = 'idle' | 'pending' | 'ok' | 'error';

// ─── Static metadata ─────────────────────────────────────────────────────────

const ROLE_LABELS: Record<RoleType, string> = {
  moderator:           'Moderator',
  financial_analyst:   'Financial Analyst',
  community_manager:   'Community Manager',
};

const ROLE_COLOURS: Record<RoleType, string> = {
  moderator:           'bg-blue-100 text-blue-800',
  financial_analyst:   'bg-green-100 text-green-800',
  community_manager:   'bg-purple-100 text-purple-800',
};

const ROLE_DESCRIPTIONS: Record<RoleType, string> = {
  moderator:
    'Reviews contest tickets, resolves ambiguous flags and escalated disputes. Default suspension cap: 7 days.',
  financial_analyst:
    'Read-only ledger access. Flags suspicious patterns. One emergency action: 24h wallet freeze that immediately push-notifies you.',
  community_manager:
    'Sends broadcasts and direct messages using templates. Custom messages go through a draft-and-approve queue before sending as F9.',
};

// Elevated permissions per role — moderators only per spec
const ELEVATED_PERMISSIONS: Record<RoleType, { key: string; label: string }[]> = {
  moderator: [
    { key: 'suspensions_30d',     label: 'Suspensions up to 30 days (default: 7)'      },
    { key: 'dispute_500k_escrow', label: 'Resolve disputes up to ₦500,000 escrow value' },
  ],
  financial_analyst:  [],
  community_manager:  [],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dt(s: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
}

// ─── Reusable row-level action button ─────────────────────────────────────────

function RowAction({
  label,
  variant = 'default',
  action,
  hiddenFields,
  icon,
}: {
  label:        string;
  variant?:     'default' | 'danger' | 'success' | 'warning';
  action:       (fd: FormData) => Promise<void>;
  hiddenFields: Record<string, string>;
  icon?:        React.ReactNode;
}) {
  const [feedback, setFeedback] = useState<RowFeedback>('idle');
  const [isPending, start]      = useTransition();

  const colours: Record<string, string> = {
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

  if (feedback === 'ok')
    return <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle size={11} /> Done</span>;
  if (feedback === 'error')
    return <span className="text-xs text-red-600">Failed</span>;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded transition-colors disabled:opacity-60 ${colours[variant]}`}
    >
      {isPending ? <Loader2 size={10} className="animate-spin" /> : icon}
      {label}
    </button>
  );
}

// ─── Tab 1: Active Staff ──────────────────────────────────────────────────────

function ActiveStaffTab({
  staffRoles,
  onRevoke,
}: {
  staffRoles: StaffWithProfile[];
  onRevoke:   (fd: FormData) => Promise<void>;
}) {
  const active   = staffRoles.filter((s) => s.is_active);
  const inactive = staffRoles.filter((s) => !s.is_active);

  return (
    <div>
      {active.length === 0 ? (
        <p className="text-sm text-gray-400 italic py-8 text-center">
          No active staff members yet. Use the &ldquo;Appoint New Staff&rdquo; tab to add your first team member.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Member', 'Role', 'Appointed', 'Status', ''].map((h) => (
                  <th key={h} className="px-5 py-3 text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {active.map((s) => {
                const role = (s.role_type ?? 'moderator') as RoleType;
                return (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-gray-900">
                        {s.user_id_profile?.full_name ?? 'Unknown'}
                      </p>
                      <p className="text-xs text-gray-400">{s.user_id_profile?.email ?? ''}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_COLOURS[role] ?? 'bg-gray-100 text-gray-600'}`}>
                        {ROLE_LABELS[role] ?? role}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-gray-500">{dt(s.created_at)}</td>
                    <td className="px-5 py-4">
                      <Badge variant="success" className="text-xs">Active</Badge>
                    </td>
                    <td className="px-5 py-4">
                      <RowAction
                        label="Revoke"
                        variant="danger"
                        action={onRevoke}
                        hiddenFields={{ staff_role_id: s.id, user_id: s.user_id }}
                        icon={<XCircle size={10} />}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {inactive.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Revoked ({inactive.length})
          </p>
          <div className="space-y-1.5">
            {inactive.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded text-xs text-gray-500"
              >
                <span>
                  {s.user_id_profile?.full_name ?? s.user_id}
                  {' — '}
                  <span className="italic">{s.role_type?.replace(/_/g, ' ')}</span>
                </span>
                <span>{dt(s.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab 2: Appoint New Staff ─────────────────────────────────────────────────

function AppointTab({
  onAppoint,
  caps,
  activeCounts,
}: {
  onAppoint:    (fd: FormData) => Promise<void>;
  caps:         Record<RoleType, number>;
  activeCounts: Record<RoleType, number>;
}) {
  const [email,    setEmail]    = useState('');
  const [role,     setRole]     = useState<RoleType>('moderator');
  const [feedback, setFeedback] = useState<RowFeedback>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [isPending, start]      = useTransition();

  const atCap = activeCounts[role] >= caps[role];

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (atCap) return;
    const fd = new FormData(e.currentTarget);
    setFeedback('pending');
    setErrorMsg('');
    start(async () => {
      try {
        await onAppoint(fd);
        setFeedback('ok');
        setEmail('');
        setTimeout(() => setFeedback('idle'), 3000);
      } catch (err) {
        setFeedback('error');
        setErrorMsg(err instanceof Error ? err.message : 'Failed — check the email and try again.');
      }
    });
  };

  return (
    <div className="max-w-lg space-y-5">
      <p className="text-sm text-gray-500">
        Enter the email of an existing F9 user to appoint them. They will receive an F9 invite
        notification and their console access will be granted immediately. The appointment is
        logged with a 48-hour reversal window.
      </p>

      {/* Capacity overview */}
      <div className="grid grid-cols-3 gap-3">
        {ROLE_TYPES.map((r) => {
          const full = activeCounts[r] >= caps[r];
          return (
            <div
              key={r}
              className={`p-3 rounded-lg border text-center text-xs ${
                full ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'
              }`}
            >
              <p className="font-semibold text-gray-700">{ROLE_LABELS[r]}</p>
              <p className={`text-lg font-bold mt-1 ${full ? 'text-red-600' : 'text-gray-900'}`}>
                {activeCounts[r]} / {caps[r]}
              </p>
              <p className="text-gray-400">active</p>
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">User Email</label>
          <input
            name="user_email_lookup"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="existing-user@example.com"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">
            Must be an existing F9 user. The user ID is resolved server-side from this email.
          </p>
        </div>

        {/* Role */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
          <select
            name="role_type"
            value={role}
            onChange={(e) => setRole(e.target.value as RoleType)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {ROLE_TYPES.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
        </div>

        {/* Role description */}
        <div className="p-3 bg-blue-50 rounded-lg text-xs text-blue-800 space-y-1">
          <p className="font-semibold">{ROLE_LABELS[role]}</p>
          <p>{ROLE_DESCRIPTIONS[role]}</p>
          <p className="text-blue-600 font-medium">Cap: {caps[role]} members</p>
        </div>

        {atCap && (
          <p className="text-xs text-red-600 font-medium">
            Cap reached ({caps[role]}). Increase the cap in the Staff Caps tab or revoke an existing member first.
          </p>
        )}

        {errorMsg && <p className="text-xs text-red-600">{errorMsg}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isPending || atCap}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {isPending ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
            Appoint &amp; Send Invite
          </button>
          {feedback === 'ok' && (
            <span className="text-xs text-green-600 flex items-center gap-1">
              <CheckCircle size={12} /> Appointed — invite sent
            </span>
          )}
        </div>
      </form>
    </div>
  );
}

// ─── Tab 3: Action Log ────────────────────────────────────────────────────────

function ActionLogTab({
  actionLog,
  onReverse,
}: {
  actionLog: ActionLogRow[];
  onReverse: (fd: FormData) => Promise<void>;
}) {
  const [filter, setFilter] = useState('');

  const filtered = filter
    ? actionLog.filter(
        (a) =>
          a.action_type.includes(filter) ||
          (a.reason ?? '').toLowerCase().includes(filter.toLowerCase())
      )
    : actionLog;

  const canReverse = (log: ActionLogRow) =>
    !log.is_reversed &&
    !!log.reversible_until &&
    new Date(log.reversible_until) > new Date();

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Filter by action type or reason…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="w-full max-w-sm px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-400 italic py-4">No staff actions recorded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-gray-50">
              <tr>
                {['Staff', 'Action', 'Details', 'Date', 'Status', ''].map((h) => (
                  <th key={h} className="px-4 py-2 text-xs font-medium text-gray-500 border-b">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">
                    {log.admin_id.slice(0, 8)}…
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold uppercase text-gray-700">
                    {log.action_type.replace(/_/g, ' ')}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">
                    {log.reason ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{dt(log.created_at)}</td>
                  <td className="px-4 py-3">
                    {log.is_reversed ? (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                        Reversed
                      </span>
                    ) : canReverse(log) ? (
                      <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
                        Reversible
                      </span>
                    ) : (
                      <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                        Final
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {canReverse(log) && (
                      <RowAction
                        label="Reverse"
                        variant="warning"
                        action={onReverse}
                        hiddenFields={{ log_id: log.id }}
                        icon={<RotateCcw size={10} />}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Tab 4: Elevated Permissions ─────────────────────────────────────────────

function ElevatedPermissionsTab({
  staffRoles,
  onGrant,
  onRevoke,
}: {
  staffRoles: StaffWithProfile[];
  onGrant:    (fd: FormData) => Promise<void>;
  onRevoke:   (fd: FormData) => Promise<void>;
}) {
  const moderators = staffRoles.filter(
    (s) => s.is_active && s.role_type === 'moderator'
  );

  if (moderators.length === 0) {
    return (
      <p className="text-sm text-gray-400 italic py-8 text-center">
        No active moderators. Elevated permissions apply to moderators only, and are granted
        per individual after 30 days with a clean action record.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        Granted per individual — not per role. Earned after 30 days with a clean action record.
        Revocable instantly. Each grant and revocation is logged.
      </p>

      {moderators.map((s) => {
        const perms = (
          typeof s.permissions === 'object' && s.permissions !== null
            ? s.permissions
            : {}
        ) as Record<string, unknown>;

        return (
          <Card key={s.id} className="p-4">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <p className="font-semibold text-gray-900 text-sm">
                  {s.user_id_profile?.full_name ?? 'Unknown'}
                </p>
                <p className="text-xs text-gray-400">{s.user_id_profile?.email}</p>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_COLOURS.moderator}`}>
                Moderator
              </span>
            </div>

            <div className="space-y-2">
              {ELEVATED_PERMISSIONS.moderator.map((perm) => {
                const isGranted = Boolean(perms[perm.key]);
                return (
                  <div
                    key={perm.key}
                    className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0 gap-4"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-800">{perm.label}</p>
                      <p className="text-xs text-gray-400 font-mono mt-0.5">{perm.key}</p>
                    </div>
                    {isGranted ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-green-600 font-semibold">Granted</span>
                        <RowAction
                          label="Revoke"
                          variant="danger"
                          action={onRevoke}
                          hiddenFields={{
                            staff_role_id:   s.id,
                            user_id:         s.user_id,
                            permission_key:  perm.key,
                          }}
                        />
                      </div>
                    ) : (
                      <RowAction
                        label="Grant"
                        variant="success"
                        action={onGrant}
                        hiddenFields={{
                          staff_role_id:  s.id,
                          user_id:        s.user_id,
                          permission_key: perm.key,
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ─── Tab 5: Staff Caps ────────────────────────────────────────────────────────

function CapRow({
  role,
  currentCap,
  activeCount,
  onUpdate,
}: {
  role:        RoleType;
  currentCap:  number;
  activeCount: number;
  onUpdate:    (fd: FormData) => Promise<void>;
}) {
  const [draft,    setDraft]    = useState(String(currentCap));
  const [editing,  setEditing]  = useState(false);
  const [feedback, setFeedback] = useState<RowFeedback>('idle');
  const [isPending, start]      = useTransition();

  const handleSave = () => {
    const cap = Number(draft);
    if (isNaN(cap) || cap < 1) return;
    const fd = new FormData();
    fd.set('role', role);
    fd.set('cap',  String(cap));
    setFeedback('pending');
    start(async () => {
      try {
        await onUpdate(fd);
        setFeedback('ok');
        setEditing(false);
        setTimeout(() => setFeedback('idle'), 2000);
      } catch {
        setFeedback('error');
      }
    });
  };

  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
      <div>
        <p className="font-semibold text-sm text-gray-900">{ROLE_LABELS[role]}</p>
        <p className="text-xs text-gray-500 mt-0.5">
          {activeCount} active · cap: {currentCap}
        </p>
      </div>

      <div className="flex items-center gap-2">
        {editing ? (
          <>
            <input
              type="number"
              min={1}
              max={20}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter')  handleSave();
                if (e.key === 'Escape') { setEditing(false); setDraft(String(currentCap)); }
              }}
              autoFocus
              className="w-16 px-2 py-1 text-sm border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
            />
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-semibold rounded transition-colors"
            >
              {isPending ? <Loader2 size={11} className="animate-spin" /> : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => { setEditing(false); setDraft(String(currentCap)); }}
              className="px-2.5 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-semibold rounded"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="px-3 py-1.5 bg-white border border-gray-300 hover:border-blue-400 text-gray-700 text-xs font-semibold rounded transition-colors"
          >
            Edit
          </button>
        )}
        {feedback === 'ok'    && <CheckCircle size={13} className="text-green-600" />}
        {feedback === 'error' && <span className="text-xs text-red-600">Failed</span>}
      </div>
    </div>
  );
}

function StaffCapsTab({
  caps,
  activeCounts,
  onUpdateCap,
}: {
  caps:         Record<RoleType, number>;
  activeCounts: Record<RoleType, number>;
  onUpdateCap:  (fd: FormData) => Promise<void>;
}) {
  return (
    <div className="space-y-4 max-w-md">
      <p className="text-xs text-gray-500">
        Adjustable maximum active members per role. Exist to keep the team lean.
        Changes take effect immediately.
      </p>
      {ROLE_TYPES.map((role) => (
        <CapRow
          key={role}
          role={role}
          currentCap={caps[role]}
          activeCount={activeCounts[role]}
          onUpdate={onUpdateCap}
        />
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const TABS = [
  { id: 'active',   label: 'Active Staff',         icon: Users             },
  { id: 'appoint',  label: 'Appoint New Staff',    icon: UserPlus          },
  { id: 'log',      label: 'Action Log',           icon: ScrollText        },
  { id: 'elevated', label: 'Elevated Permissions', icon: ShieldCheck       },
  { id: 'caps',     label: 'Staff Caps',           icon: SlidersHorizontal },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function StaffClient({
  staffRoles,
  actionLog,
  caps,
  activeCounts,
  onAppointStaff,
  onRevokeStaff,
  onUpdateStaffCap,
  onGrantElevatedPermission,
  onRevokeElevatedPermission,
  onReverseAction,
}: StaffClientProps) {
  const [active, setActive] = useState<TabId>('active');

  const activeStaffCount = staffRoles.filter((s) => s.is_active).length;
  const reversibleCount  = actionLog.filter(
    (a) =>
      !a.is_reversed &&
      !!a.reversible_until &&
      new Date(a.reversible_until) > new Date()
  ).length;

  return (
    <Card className="overflow-hidden">
      {/* Tab nav */}
      <div className="flex border-b border-gray-200 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActive(id)}
            className={`shrink-0 flex items-center gap-1.5 px-5 py-3 text-sm font-medium transition-colors ${
              active === id
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <Icon size={14} />
            {label}
            {id === 'active' && activeStaffCount > 0 && (
              <span className="ml-1 bg-blue-100 text-blue-700 text-xs font-bold px-1.5 py-0.5 rounded-full">
                {activeStaffCount}
              </span>
            )}
            {id === 'log' && reversibleCount > 0 && (
              <span className="ml-1 bg-amber-100 text-amber-700 text-xs font-bold px-1.5 py-0.5 rounded-full">
                {reversibleCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab body */}
      <div className="p-6">
        {active === 'active' && (
          <ActiveStaffTab staffRoles={staffRoles} onRevoke={onRevokeStaff} />
        )}
        {active === 'appoint' && (
          <AppointTab onAppoint={onAppointStaff} caps={caps} activeCounts={activeCounts} />
        )}
        {active === 'log' && (
          <ActionLogTab actionLog={actionLog} onReverse={onReverseAction} />
        )}
        {active === 'elevated' && (
          <ElevatedPermissionsTab
            staffRoles={staffRoles}
            onGrant={onGrantElevatedPermission}
            onRevoke={onRevokeElevatedPermission}
          />
        )}
        {active === 'caps' && (
          <StaffCapsTab caps={caps} activeCounts={activeCounts} onUpdateCap={onUpdateStaffCap} />
        )}
      </div>
    </Card>
  );
}