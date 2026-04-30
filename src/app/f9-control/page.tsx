import { Card } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { Redis } from '@upstash/redis';
import { AlertTriangle, ShieldAlert, DollarSign, Bell } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';

// ─── Types ────────────────────────────────────────────────────────────────────

type HealthStatus = 'healthy' | 'degraded' | 'down';

interface ServiceHealth {
  status: HealthStatus;
  latencyMs?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MS_PER_DAY = 86_400_000;
const HEALTH_TIMEOUT_MS = 4_000;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getSince = () => new Date(Date.now() - MS_PER_DAY).toISOString();

function formatNGN(amount: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
  }).format(amount);
}

const statusDotColors: Record<HealthStatus, string> = {
  healthy:  'bg-green-500',
  degraded: 'bg-amber-400',
  down:     'bg-red-500',
};

const statusTextColors: Record<HealthStatus, string> = {
  healthy:  'text-green-600',
  degraded: 'text-amber-600',
  down:     'text-red-600',
};

const statusLabels: Record<HealthStatus, string> = {
  healthy:  'Healthy',
  degraded: 'Degraded',
  down:     'Down',
};

const cardBorderForHealth: Record<HealthStatus, string> = {
  healthy:  'border-l-green-500',
  degraded: 'border-l-amber-400',
  down:     'border-l-red-500',
};

// ─── Health-check functions ───────────────────────────────────────────────────

/**
 * Supabase — reuses the page's already-authenticated client so we don't open
 * a second cookie session. A single-row read on `profiles` confirms the DB
 * and PostgREST layer are reachable.
 */
async function checkSupabase(supabase: SupabaseClient): Promise<ServiceHealth> {
  const t0 = Date.now();
  const { error } = await supabase.from('profiles').select('id').limit(1);
  const latencyMs = Date.now() - t0;
  if (error) return { status: 'down', latencyMs };
  return { status: latencyMs > 2_000 ? 'degraded' : 'healthy', latencyMs };
}

/**
 * Upstash Redis — PING -> expects "PONG".
 * Reads UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN from env —
 * the same vars already used by the rate-limiter middleware.
 */
async function checkRedis(): Promise<ServiceHealth> {
  const redis = Redis.fromEnv();
  const t0 = Date.now();
  const pong = await redis.ping();
  const latencyMs = Date.now() - t0;
  if (pong !== 'PONG') return { status: 'degraded', latencyMs };
  return { status: latencyMs > 1_000 ? 'degraded' : 'healthy', latencyMs };
}

/**
 * Monnify — hits the public /api/v1/banks endpoint (no auth required).
 * Any HTTP response confirms the API gateway is reachable; we only verify
 * connectivity, not authorisation. Network error or timeout = 'down'.
 * A 5xx from Monnify means their servers are struggling = 'degraded'.
 */
async function checkMonnify(): Promise<ServiceHealth> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  const t0 = Date.now();
  try {
    const res = await fetch('https://api.monnify.com/api/v1/banks', {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timer);
    const latencyMs = Date.now() - t0;
    if (res.status >= 500) return { status: 'degraded', latencyMs };
    return { status: latencyMs > 2_500 ? 'degraded' : 'healthy', latencyMs };
  } catch {
    clearTimeout(timer);
    const latencyMs = Date.now() - t0;
    return { status: 'down', latencyMs };
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DailyDigest() {
  // ── Supabase clients ────────────────────────────────────────────────────────
  // `supabase`        — anon/cookie client, respects RLS. Used for all
  //                     user-scoped data (profiles, orders, escrow, etc.).
  // `serviceSupabase` — service-role client, bypasses RLS. Required for
  //                     security_logs which only has SELECT user_id=auth.uid()
  //                     (no admin ALL policy) — the admin's UUID never matches
  //                     the flagged user's UUID stored in that column.
  const supabase        = await createClient();
  const serviceSupabase = createServiceClient();
  const since           = getSince();

  // Run all health checks and data queries in a single concurrent batch.
  const [
    supabaseHealth,
    redisHealth,
    monnifyHealth,

    { count: ticketsCount },
    { count: newUsers },

    // Both security_logs queries use serviceSupabase — RLS on this table is
    // user-scoped (SELECT user_id=auth.uid()), not admin-scoped, so the cookie
    // client would return 0 rows for every admin session.
    { data: overnightActions },
    { data: criticalLogs },

    // Escalated disputes: TODO — wire this up once the cron job that
    // transitions disputes to the admin queue has been built. Until then
    // this returns no rows and the section is hidden from the UI.
    { data: escalatedDisputes, count: escalatedCount },

    { data: completedTx },

    // escrow.status CHECK: held|released_to_freelancer|refunded_to_client|disputed
    // 'funded' is not a valid value — query uses 'held' only.
    { data: activeEscrow },

    { data: revenueRows },
    { data: pendingWithdrawals, count: pendingWithdrawalsCount },
    { data: pendingBroadcasts, count: broadcastCount },
  ] = await Promise.all([

    // ── Health checks ─────────────────────────────────────────────────────────
    checkSupabase(supabase).catch((): ServiceHealth => ({ status: 'down' })),
    checkRedis()           .catch((): ServiceHealth => ({ status: 'down' })),
    checkMonnify()         .catch((): ServiceHealth => ({ status: 'down' })),

    // ── Data queries ──────────────────────────────────────────────────────────
    supabase
      .from('contest_tickets')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),

    supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', since),

    serviceSupabase
      .from('security_logs')
      .select('id, event_type, description, severity, created_at')
      .gte('created_at', since)
      .neq('severity', 'critical')
      .order('created_at', { ascending: false })
      .limit(10),

    serviceSupabase
      .from('security_logs')
      .select('id, event_type, description, created_at')
      .eq('severity', 'critical')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(10),

    // TODO: replace 'placeholder_pending_cron' with the real status value the
    // dispute-escalation cron sets once that cron is built. This intentionally
    // returns 0 rows until then.
    serviceSupabase
      .from('disputes')
      .select('id, reason, description, created_at', { count: 'exact' })
      .eq('status', 'placeholder_pending_cron')
      .order('created_at', { ascending: false })
      .limit(5),

    supabase
      .from('transactions')
      .select('amount')
      .eq('status', 'completed')
      .gte('created_at', since),

    supabase
      .from('escrow')
      .select('amount')
      .eq('status', 'held'),

    supabase
      .from('platform_revenue')
      .select('amount')
      .gte('created_at', since),

    supabase
      .from('withdrawals')
      .select('amount', { count: 'exact' })
      .eq('status', 'pending'),

    supabase
      .from('notifications')
      .select('id, type, title, message, created_at', { count: 'exact' })
      .eq('is_read', false)
      .in('type', [
        'level_1_advisory',
        'account_suspended',
        'account_frozen',
        'withdrawal_held',
        'new_review',
      ])
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(8),
  ]);

  // ─── Derived values ─────────────────────────────────────────────────────────

  const healthChecks: { label: string; result: ServiceHealth }[] = [
    { label: 'Database',            result: supabaseHealth },
    { label: 'Payments (Monnify)', result: monnifyHealth  },
    { label: 'Redis (Rate limits)', result: redisHealth    },
  ];

  const overallHealth: HealthStatus =
    healthChecks.some(h => h.result.status === 'down')     ? 'down'     :
    healthChecks.some(h => h.result.status === 'degraded') ? 'degraded' :
    'healthy';

  // escalatedCount will be 0 until the cron is built — safe to include in
  // totalCritical; it simply adds nothing until the TODO above is resolved.
  const totalCritical  = (criticalLogs?.length ?? 0) + (escalatedCount ?? 0);
  const actionRequired = (ticketsCount ?? 0) > 0 || totalCritical > 0;

  const txVolume24h        = (completedTx       ?? []).reduce((s, t) => s + (t.amount ?? 0), 0);
  const escrowTotal        = (activeEscrow       ?? []).reduce((s, e) => s + (e.amount ?? 0), 0);
  const revenue24h         = (revenueRows        ?? []).reduce((s, r) => s + (r.amount ?? 0), 0);
  const withdrawalsPending = (pendingWithdrawals ?? []).reduce((s, w) => s + (w.amount ?? 0), 0);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold text-gray-900">Daily Digest</h1>

      {/* ── Row 1: Platform Health · Action Required · 24h Summary ── */}
      <div className="grid grid-cols-3 gap-6">

        {/* Platform Health */}
        <Card className={`p-6 border-l-4 ${cardBorderForHealth[overallHealth]} shadow-sm`}>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Platform Health
          </h3>
          <div className="space-y-3">
            {healthChecks.map(({ label, result }) => (
              <div key={label} className="flex justify-between items-center">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`shrink-0 w-2 h-2 rounded-full ${statusDotColors[result.status]}`} />
                  <span className="text-sm font-medium truncate">{label}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {result.latencyMs !== undefined && (
                    <span className="text-xs text-gray-400">{result.latencyMs}ms</span>
                  )}
                  <span className={`text-xs font-semibold ${statusTextColors[result.status]}`}>
                    {statusLabels[result.status]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Action Required */}
        <Card
          className={`p-6 border-2 shadow-sm ${
            actionRequired
              ? 'border-red-500 bg-red-50/30'
              : 'border-green-500 bg-green-50/30'
          }`}
        >
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Action Required
          </h3>
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
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
            24h Summary
          </h3>
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
                      {new Date(log.created_at ?? '').toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
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
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              Critical Flags
            </h3>
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
                  <p className="text-xs font-semibold text-red-700 uppercase mb-2">
                    Security Incidents
                  </p>
                  <ul className="space-y-2">
                    {criticalLogs.map((log) => (
                      <li key={log.id} className="text-sm bg-red-50 rounded p-2">
                        <p className="font-mono text-xs font-semibold text-red-800 uppercase">
                          {log.event_type.replace(/_/g, ' ')}
                        </p>
                        {log.description && (
                          <p className="text-red-700 text-xs mt-0.5 line-clamp-2">
                            {log.description}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {escalatedDisputes && escalatedDisputes.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-red-700 uppercase mb-2">
                    Escalated Disputes
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

      {/* ── Row 3: Financial Snapshot · Pending Broadcasts ── */}
      <div className="grid grid-cols-2 gap-6">

        {/* Financial Snapshot */}
        <Card className="p-6 shadow-sm border-l-4 border-l-blue-500">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign size={16} className="text-blue-500" />
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              Financial Snapshot
            </h3>
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
                <span className="text-sm font-bold text-amber-700">
                  {formatNGN(withdrawalsPending)}
                </span>
                {(pendingWithdrawalsCount ?? 0) > 0 && (
                  <p className="text-xs text-gray-400">
                    {pendingWithdrawalsCount} request{pendingWithdrawalsCount === 1 ? '' : 's'}
                  </p>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Pending Broadcasts */}
        <Card className="p-6 shadow-sm border-l-4 border-l-purple-500">
          <div className="flex items-center gap-2 mb-4">
            <Bell size={16} className="text-purple-500" />
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              Pending Broadcasts
            </h3>
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
                      {new Date(n.created_at ?? '').toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
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