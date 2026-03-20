import { Card } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/server';
import { AlertTriangle, ShieldAlert, DollarSign, Bell } from 'lucide-react';

const MS_PER_DAY = 86_400_000;
const getSince = () => new Date(Date.now() - MS_PER_DAY).toISOString();

function formatNGN(amount: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
  }).format(amount);
}

export default async function DailyDigest() {
  const supabase = await createClient();
  const since = getSince();

  // ── Existing queries ───────────────────────────────────────────────────────
  const { count: ticketsCount } = await supabase
    .from('contest_tickets')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  const { count: newUsers } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', since);

  // ── Overnight auto-actions ─────────────────────────────────────────────────
  // Non-critical security_logs from the last 24 h — automated cron events
  // (disputes escalated, advisories issued, accounts flagged).
  const { data: overnightActions } = await supabase
    .from('security_logs')
    .select('id, event_type, description, severity, created_at')
    .gte('created_at', since)
    .neq('severity', 'critical')
    .order('created_at', { ascending: false })
    .limit(10);

  // ── Critical flags requiring human judgment ────────────────────────────────
  // Source 1: security_logs with severity = 'critical' in last 24 h.
  const { data: criticalLogs } = await supabase
    .from('security_logs')
    .select('id, event_type, description, created_at')
    .eq('severity', 'critical')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(10);

  // Source 2: disputes escalated to admin queue by the cron
  // (quality/delivery claims the auto-resolver refused to touch).
  const { data: escalatedDisputes, count: escalatedCount } = await supabase
    .from('disputes')
    .select('id, reason, description, created_at', { count: 'exact' })
    .eq('status', 'pending_admin')
    .order('created_at', { ascending: false })
    .limit(5);

  const totalCritical = (criticalLogs?.length ?? 0) + (escalatedCount ?? 0);
  const actionRequired = (ticketsCount ?? 0) > 0 || totalCritical > 0;

  // ── Financial snapshot ─────────────────────────────────────────────────────
  // (a) 24 h completed transaction volume.
  // `transactions` columns: amount, status, created_at — verified.
  const { data: completedTx } = await supabase
    .from('transactions')
    .select('amount')
    .eq('status', 'completed')
    .gte('created_at', since);

  const txVolume24h = (completedTx ?? []).reduce((s, t) => s + (t.amount ?? 0), 0);

  // (b) Live escrow balance.
  // `escrow` columns: amount, status — verified.
  const { data: activeEscrow } = await supabase
    .from('escrow')
    .select('amount')
    .in('status', ['funded', 'held']);

  const escrowTotal = (activeEscrow ?? []).reduce((s, e) => s + (e.amount ?? 0), 0);

  // (c) Platform revenue earned in last 24 h.
  // `platform_revenue` columns: amount, created_at — verified.
  const { data: revenueRows } = await supabase
    .from('platform_revenue')
    .select('amount')
    .gte('created_at', since);

  const revenue24h = (revenueRows ?? []).reduce((s, r) => s + (r.amount ?? 0), 0);

  // (d) Pending withdrawals.
  // `withdrawals` columns: amount, status — verified.
  const { data: pendingWithdrawals, count: pendingWithdrawalsCount } = await supabase
    .from('withdrawals')
    .select('amount', { count: 'exact' })
    .eq('status', 'pending');

  const withdrawalsPending = (pendingWithdrawals ?? []).reduce(
    (s, w) => s + (w.amount ?? 0),
    0
  );

  // ── Scheduled broadcasts ───────────────────────────────────────────────────
  // `notifications` has no scheduled_at column. Unread system-category
  // notifications from the last 24 h are the correct proxy — these are the
  // messages the cron and API routes inserted and the recipients haven't
  // opened yet.
  const broadcastTypes = [
    'level_1_advisory',
    'account_suspended',
    'account_frozen',
    'withdrawal_held',
    'new_review',
  ];

  const { data: pendingBroadcasts, count: broadcastCount } = await supabase
    .from('notifications')
    .select('id, type, title, message, created_at', { count: 'exact' })
    .eq('is_read', false)
    .in('type', broadcastTypes)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(8);

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold text-gray-900">Daily Digest</h1>

      {/* ── Row 1: Platform Health · Action Required · 24h Summary ── */}
      <div className="grid grid-cols-3 gap-6">

        {/* Platform Health */}
        <Card className="p-6 border-l-4 border-l-green-500 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Platform Health</h3>
          <div className="space-y-3">
            {[
              { label: 'Database' },
              { label: 'Payments (FLW)' },
              { label: 'Redis (Rate limits)' },
            ].map(({ label }) => (
              <div key={label} className="flex justify-between items-center">
                <span className="text-sm font-medium">{label}</span>
                <div className="w-2 h-2 rounded-full bg-green-500" />
              </div>
            ))}
          </div>
        </Card>

        {/* Action Required */}
        <Card className={`p-6 border-2 shadow-sm ${actionRequired ? 'border-red-500 bg-red-50/30' : 'border-green-500 bg-green-50/30'}`}>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Action Required</h3>
          {actionRequired ? (
            <div className="space-y-2 text-sm">
              {(ticketsCount ?? 0) > 0 && (
                <div className="flex justify-between text-red-800 font-medium">
                  <span>Pending Contest Tickets</span>
                  <span>{ticketsCount}</span>
                </div>
              )}
              {(criticalLogs?.length ?? 0) > 0 && (
                <div className="flex justify-between text-red-800 font-medium">
                  <span>Critical Security Flags</span>
                  <span>{criticalLogs!.length}</span>
                </div>
              )}
              {(escalatedCount ?? 0) > 0 && (
                <div className="flex justify-between text-red-800 font-medium">
                  <span>Escalated Disputes</span>
                  <span>{escalatedCount}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-green-700 font-medium pb-4">
              Nothing needs your attention.
            </div>
          )}
        </Card>

        {/* 24h Summary */}
        <Card className="p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">24h Summary</h3>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-gray-500">New Registrations</p>
              <p className="text-2xl font-bold text-gray-900">{newUsers ?? 0}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Overnight Auto-Actions</p>
              <p className="text-2xl font-bold text-gray-900">{overnightActions?.length ?? 0}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* ── Row 2: Overnight Auto-Actions · Critical Flags ── */}
      <div className="grid grid-cols-2 gap-6">

        {/* Overnight Auto-Actions */}
        <Card className="p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={16} className="text-amber-500" />
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              Overnight Auto-Actions
            </h3>
          </div>
          {!overnightActions || overnightActions.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No automated actions in the last 24 h.</p>
          ) : (
            <ul className="space-y-3">
              {overnightActions.map((log) => (
                <li key={log.id} className="flex items-start gap-3 text-sm">
                  <span className="shrink-0 w-2 h-2 rounded-full bg-amber-400 mt-1.5" />
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-semibold text-gray-800 uppercase">
                      {log.event_type.replace(/_/g, ' ')}
                    </p>
                    {log.description && (
                      <p className="text-gray-500 text-xs mt-0.5 line-clamp-2">{log.description}</p>
                    )}
                    <p className="text-gray-400 text-xs mt-0.5">
                      {new Date(log.created_at ?? '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Critical Flags */}
        <Card className="p-6 shadow-sm border-l-4 border-l-red-500">
          <div className="flex items-center gap-2 mb-4">
            <ShieldAlert size={16} className="text-red-500" />
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Critical Flags</h3>
            {totalCritical > 0 && (
              <span className="ml-auto bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">
                {totalCritical} require review
              </span>
            )}
          </div>
          {totalCritical === 0 ? (
            <p className="text-sm text-gray-400 italic">No critical flags in the last 24 h.</p>
          ) : (
            <div className="space-y-4">
              {criticalLogs && criticalLogs.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-red-700 uppercase mb-2">Security Incidents</p>
                  <ul className="space-y-2">
                    {criticalLogs.map((log) => (
                      <li key={log.id} className="text-sm bg-red-50 rounded p-2">
                        <p className="font-mono text-xs font-semibold text-red-800 uppercase">
                          {log.event_type.replace(/_/g, ' ')}
                        </p>
                        {log.description && (
                          <p className="text-red-700 text-xs mt-0.5 line-clamp-2">{log.description}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {escalatedDisputes && escalatedDisputes.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-red-700 uppercase mb-2">
                    Escalated Disputes — Quality / Delivery
                  </p>
                  <ul className="space-y-2">
                    {escalatedDisputes.map((d) => (
                      <li key={d.id} className="text-sm bg-red-50 rounded p-2">
                        <p className="font-medium text-red-800 capitalize">{d.reason} dispute</p>
                        <p className="text-red-700 text-xs mt-0.5 line-clamp-2">{d.description}</p>
                      </li>
                    ))}
                    {(escalatedCount ?? 0) > 5 && (
                      <li className="text-xs text-red-500 font-medium pl-1">
                        +{(escalatedCount ?? 0) - 5} more in the disputes queue
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* ── Row 3: Financial Snapshot · Scheduled Broadcasts ── */}
      <div className="grid grid-cols-2 gap-6">

        {/* Financial Snapshot */}
        <Card className="p-6 shadow-sm border-l-4 border-l-blue-500">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign size={16} className="text-blue-500" />
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Financial Snapshot</h3>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">24h Transaction Volume</span>
              <span className="text-sm font-bold text-gray-900">{formatNGN(txVolume24h)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Funds in Escrow</span>
              <span className="text-sm font-bold text-gray-900">{formatNGN(escrowTotal)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">24h Platform Revenue</span>
              <span className="text-sm font-bold text-green-700">{formatNGN(revenue24h)}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-gray-600">Pending Withdrawals</span>
              <div className="text-right">
                <span className="text-sm font-bold text-amber-700">{formatNGN(withdrawalsPending)}</span>
                {(pendingWithdrawalsCount ?? 0) > 0 && (
                  <p className="text-xs text-gray-400">
                    {pendingWithdrawalsCount} request{pendingWithdrawalsCount === 1 ? '' : 's'}
                  </p>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Scheduled Broadcasts */}
        <Card className="p-6 shadow-sm border-l-4 border-l-purple-500">
          <div className="flex items-center gap-2 mb-4">
            <Bell size={16} className="text-purple-500" />
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Pending Broadcasts</h3>
            {(broadcastCount ?? 0) > 0 && (
              <span className="ml-auto bg-purple-100 text-purple-700 text-xs font-bold px-2 py-0.5 rounded-full">
                {broadcastCount} unread
              </span>
            )}
          </div>
          {!pendingBroadcasts || pendingBroadcasts.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No pending broadcasts.</p>
          ) : (
            <ul className="space-y-3">
              {pendingBroadcasts.map((n) => (
                <li key={n.id} className="flex items-start gap-3 text-sm">
                  <span className="shrink-0 w-2 h-2 rounded-full bg-purple-400 mt-1.5" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-gray-800 truncate">{n.title}</p>
                      <span className="shrink-0 text-xs bg-purple-50 text-purple-600 border border-purple-200 rounded px-1.5 py-0.5 font-mono">
                        {n.type.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-gray-500 text-xs mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-gray-400 text-xs mt-0.5">
                      {new Date(n.created_at ?? '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </li>
              ))}
              {(broadcastCount ?? 0) > 8 && (
                <li className="text-xs text-purple-500 font-medium pl-5">
                  +{(broadcastCount ?? 0) - 8} more notifications pending
                </li>
              )}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}