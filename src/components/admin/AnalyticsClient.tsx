'use client';
// src/components/admin/AnalyticsClient.tsx
// Client component — owns all chart rendering, date-range filtering, and
// CSV export for the F9 Analytics dashboard.
//
// Sections:
//   1. User Growth      — line chart + onboarding completion rate
//   2. Marketplace      — bar/area charts + AOV, popular categories,
//                         repeat user rate
//   3. Financial Flow   — area chart + escrow turnover, avg payment-to-
//                         release time
//   4. Trust & Safety   — bar (disputes) + pie (trust levels) +
//                         verification completion rates + flag volume
//   5. Geography        — user count by state (horizontal bar) +
//                         transaction volume by state (horizontal bar)
//
// Dependency: recharts

import { useState, useMemo } from 'react';
import {
  LineChart, Line,
  BarChart, Bar,
  AreaChart, Area,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ─── Exported row types (consumed by page.tsx) ────────────────────────────────

export type ProfileRow = {
  created_at:     string;
  user_type:      string;
  location:       string | null;
  account_status: string;
};

export type MarketplaceOrderRow = {
  created_at: string;
  status:     string;
};

export type TransactionRow = {
  created_at:       string;
  amount:           number;
  transaction_type: string;
  status:           string;
};

export type WithdrawalRow = {
  created_at: string;
  amount:     number;
  status:     string;
};

export type DisputeRow = {
  created_at: string;
  status:     string;
};

export type ContestTicketRow = {
  created_at: string;
  status:     string;
};

// order row from the orders table with service join for category.
// service_id is returned as an object when Supabase resolves the FK join.
export type OrderRow = {
  created_at: string;
  status:     string;
  amount:     number;
  client_id:  string;
  cleared_at: string | null;
  service_id: { category: string } | null;
};

// escrow row for turnover + payment-to-release timing.
export type EscrowRow = {
  created_at:  string;
  released_at: string | null;
  status:      string | null;
  amount:      number;
};

// security_log row for flag volume over time.
export type SecurityLogRow = {
  created_at: string;
  event_type: string;
  severity:   string | null;
};

// Transaction row joined to the recipient's profile location.
// Used exclusively in the Geography section to produce transaction volume
// by Nigerian state.
//
// Supabase resolves the recipient_user_id FK join as a nested object:
//   { location: string | null } | null
// null outer  = transaction has no recipient_user_id (e.g. wallet top-up)
// null inner  = recipient profile has no location set
export type GeoTransactionRow = {
  created_at:        string;
  amount:            number;
  recipient_user_id: { location: string | null } | null;
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface AllProfileSnapshot {
  trust_level:          string | null;
  onboarding_completed: boolean | null;
  identity_verified:    boolean | null;
  liveness_verified:    boolean | null;
  phone_verified:       boolean | null;
  student_verified:     boolean | null;
  account_status:       string;
}

interface Props {
  profiles:          ProfileRow[];
  marketplaceOrders: MarketplaceOrderRow[];
  transactions:      TransactionRow[];
  withdrawals:       WithdrawalRow[];
  disputes:          DisputeRow[];
  contestTickets:    ContestTicketRow[];
  // Carries all verification columns for the Trust & Safety section snapshot.
  allProfiles:       AllProfileSnapshot[];
  orders:            OrderRow[];
  escrowEntries:     EscrowRow[];
  securityLogs:      SecurityLogRow[];
  // Transactions joined to recipient profile location — Geography section.
  geoTransactions:   GeoTransactionRow[];
}

// ─── Date range ───────────────────────────────────────────────────────────────

type DateRange = '30d' | '90d' | '180d' | '365d';

const RANGE_LABELS: Record<DateRange, string> = {
  '30d':  '30 Days',
  '90d':  '90 Days',
  '180d': '6 Months',
  '365d': '1 Year',
};

function getCutoff(range: DateRange): Date {
  const days: Record<DateRange, number> = {
    '30d': 30, '90d': 90, '180d': 180, '365d': 365,
  };
  return new Date(Date.now() - days[range] * 24 * 60 * 60 * 1000);
}

// ─── Aggregation helpers ──────────────────────────────────────────────────────

/**
 * Returns the label for a time bucket.
 * ≤ 30 days  → daily   "Apr 01"
 * > 30 days  → weekly  "Apr W1" (Monday of the week)
 */
function getBucketKey(date: Date, range: DateRange): string {
  if (range === '30d') {
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  }
  const d   = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function filterByRange<T extends { created_at: string }>(
  rows: T[],
  range: DateRange,
): T[] {
  const cutoff = getCutoff(range);
  return rows.filter((r) => new Date(r.created_at) >= cutoff);
}

function groupByBucket<T extends { created_at: string }>(
  rows: T[],
  range: DateRange,
  value: (row: T) => number = () => 1,
): Array<{ period: string; value: number }> {
  const filtered = filterByRange(rows, range);
  const map      = new Map<string, number>();
  for (const row of filtered) {
    const key = getBucketKey(new Date(row.created_at), range);
    map.set(key, (map.get(key) ?? 0) + value(row));
  }
  return Array.from(map.entries()).map(([period, value]) => ({ period, value }));
}

// ─── CSV export ───────────────────────────────────────────────────────────────

function downloadCSV(data: Record<string, unknown>[], filename: string) {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);
  const rows    = data.map((row) =>
    headers.map((h) => JSON.stringify(row[h] ?? '')).join(','),
  );
  const csv  = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), {
    href: url, download: filename,
  });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Shared UI atoms ──────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?:  string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">
        {label}
      </p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function SectionHeader({
  title,
  onExport,
}: {
  title:    string;
  onExport: () => void;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
      <Button
        variant="outline"
        size="sm"
        onClick={onExport}
        className="text-xs gap-1.5"
      >
        <Download className="w-3.5 h-3.5" />
        Export CSV
      </Button>
    </div>
  );
}

function SubHeader({ title }: { title: string }) {
  return (
    <p className="text-xs text-gray-500 mb-2 font-medium">{title}</p>
  );
}

const CHART_COLORS = {
  blue:    '#3b82f6',
  emerald: '#10b981',
  amber:   '#f59e0b',
  red:     '#ef4444',
  violet:  '#8b5cf6',
  pink:    '#ec4899',
  slate:   '#64748b',
  teal:    '#14b8a6',
  orange:  '#f97316',
};

const TRUST_COLORS: Record<string, string> = {
  elite:     CHART_COLORS.violet,
  top_rated: CHART_COLORS.blue,
  trusted:   CHART_COLORS.emerald,
  verified:  CHART_COLORS.amber,
  new:       CHART_COLORS.slate,
};

function fmt(n: number): string {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `₦${(n / 1_000).toFixed(1)}K`;
  return `₦${n.toLocaleString()}`;
}

function fmtTooltip(value: number | string | ReadonlyArray<number | string> | undefined): string {
  return typeof value === 'number' ? fmt(value) : String(value ?? '');
}

function fmtHours(hours: number): string {
  if (hours < 24)  return `${Math.round(hours)}h`;
  if (hours < 168) return `${Math.round(hours / 24)}d`;
  return `${Math.round(hours / 168)}w`;
}

function pct(numerator: number, denominator: number): string {
  if (!denominator) return '—';
  return `${Math.round((numerator / denominator) * 100)}%`;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AnalyticsClient({
  profiles,
  marketplaceOrders,
  transactions,
  withdrawals,
  disputes,
  contestTickets,
  allProfiles,
  orders,
  escrowEntries,
  securityLogs,
  geoTransactions,
}: Props) {
  const [range, setRange] = useState<DateRange>('90d');

  // ══════════════════════════════════════════════════════════════════════════
  // 1. USER GROWTH
  // ══════════════════════════════════════════════════════════════════════════

  const userGrowthData = useMemo(
    () => groupByBucket(profiles, range),
    [profiles, range],
  );

  const profilesInRange = useMemo(
    () => filterByRange(profiles, range),
    [profiles, range],
  );

  const freelancerCount = profilesInRange.filter(
    (p) => p.user_type === 'freelancer' || p.user_type === 'both',
  ).length;

  const clientCount = profilesInRange.filter(
    (p) => p.user_type === 'client' || p.user_type === 'both',
  ).length;

  // Onboarding completion rate — computed from the allProfiles snapshot
  // (current state, not date-filtered, because onboarding_completed is a
  // profile flag that reflects the user's current state, not a time-series).
  const onboardingTotal     = allProfiles.length;
  const onboardingCompleted = allProfiles.filter((p) => p.onboarding_completed).length;
  const onboardingRate      = pct(onboardingCompleted, onboardingTotal);

  // ══════════════════════════════════════════════════════════════════════════
  // 2. MARKETPLACE HEALTH
  // ══════════════════════════════════════════════════════════════════════════

  const ordersInRange = useMemo(
    () => filterByRange(orders, range),
    [orders, range],
  );

  const marketplaceOrdersInRange = useMemo(
    () => filterByRange(marketplaceOrders, range),
    [marketplaceOrders, range],
  );

  const orderVolumeData = useMemo(
    () => groupByBucket(orders, range),
    [orders, range],
  );

  const orderStatusData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const o of marketplaceOrdersInRange) {
      map[o.status] = (map[o.status] ?? 0) + 1;
    }
    return Object.entries(map).map(([status, count]) => ({ status, count }));
  }, [marketplaceOrdersInRange]);

  const completedOrders = marketplaceOrdersInRange.filter(
    (o) => o.status === 'delivered',
  ).length;
  const cancelledOrders = marketplaceOrdersInRange.filter(
    (o) => o.status === 'cancelled',
  ).length;
  const cancelRate = marketplaceOrdersInRange.length
    ? Math.round((cancelledOrders / marketplaceOrdersInRange.length) * 100)
    : 0;

  // Average order value — gross amount across all orders in range.
  const aov = useMemo(() => {
    if (!ordersInRange.length) return 0;
    const total = ordersInRange.reduce((s, o) => s + (Number(o.amount) || 0), 0);
    return Math.round(total / ordersInRange.length);
  }, [ordersInRange]);

  // Popular categories — derived from the service_id join on orders.
  const popularCategoriesData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const o of ordersInRange) {
      const cat = o.service_id?.category;
      if (!cat) continue;
      map[cat] = (map[cat] ?? 0) + 1;
    }
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([category, orders]) => ({ category, orders }));
  }, [ordersInRange]);

  // Repeat user rate — % of clients who placed > 1 order in the period.
  const repeatUserRate = useMemo(() => {
    const countByClient = new Map<string, number>();
    for (const o of ordersInRange) {
      countByClient.set(o.client_id, (countByClient.get(o.client_id) ?? 0) + 1);
    }
    const total  = countByClient.size;
    const repeat = Array.from(countByClient.values()).filter((c) => c > 1).length;
    return pct(repeat, total);
  }, [ordersInRange]);

  // ══════════════════════════════════════════════════════════════════════════
  // 3. FINANCIAL FLOW
  // ══════════════════════════════════════════════════════════════════════════

  const txInRange = useMemo(
    () => filterByRange(transactions, range),
    [transactions, range],
  );

  const wdInRange = useMemo(
    () => filterByRange(withdrawals, range),
    [withdrawals, range],
  );

  const txVolumeData = useMemo(
    () => groupByBucket(transactions, range, (r) => Number(r.amount) || 0),
    [transactions, range],
  );

  const wdVolumeData = useMemo(
    () => groupByBucket(withdrawals, range, (r) => Number(r.amount) || 0),
    [withdrawals, range],
  );

  const financialData = useMemo(() => {
    const map = new Map<
      string,
      { period: string; transactions: number; withdrawals: number }
    >();
    for (const { period, value } of txVolumeData) {
      map.set(period, { period, transactions: value, withdrawals: 0 });
    }
    for (const { period, value } of wdVolumeData) {
      if (map.has(period)) {
        map.get(period)!.withdrawals = value;
      } else {
        map.set(period, { period, transactions: 0, withdrawals: value });
      }
    }
    return Array.from(map.values());
  }, [txVolumeData, wdVolumeData]);

  const totalTxVolume = txInRange.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const totalWdVolume = wdInRange.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  // Escrow turnover — total ₦ released from escrow within the period.
  const escrowInRange = useMemo(
    () => filterByRange(escrowEntries, range),
    [escrowEntries, range],
  );

  const escrowTurnover = useMemo(() => {
    return escrowInRange
      .filter((e) => e.status === 'released')
      .reduce((s, e) => s + (Number(e.amount) || 0), 0);
  }, [escrowInRange]);

  const escrowTurnoverCount = useMemo(
    () => escrowInRange.filter((e) => e.status === 'released').length,
    [escrowInRange],
  );

  // Average payment-to-release time — mean of (released_at - created_at) in
  // hours, for escrow entries that have both timestamps in the period.
  const avgPaymentToRelease = useMemo(() => {
    const released = escrowInRange.filter(
      (e) => e.status === 'released' && e.released_at,
    );
    if (!released.length) return null;
    const totalMs = released.reduce((s, e) => {
      const created    = new Date(e.created_at).getTime();
      const releasedAt = new Date(e.released_at!).getTime();
      return s + Math.max(0, releasedAt - created);
    }, 0);
    return totalMs / released.length / (1000 * 60 * 60); // → hours
  }, [escrowInRange]);

  // Escrow volume over time — for chart.
  const escrowVolumeData = useMemo(
    () =>
      groupByBucket(
        escrowInRange.filter((e) => e.status === 'released'),
        range,
        (e) => Number(e.amount) || 0,
      ),
    [escrowInRange, range],
  );

  // ══════════════════════════════════════════════════════════════════════════
  // 4. TRUST & SAFETY
  // ══════════════════════════════════════════════════════════════════════════

  const disputesInRange = useMemo(
    () => filterByRange(disputes, range),
    [disputes, range],
  );

  const ticketsInRange = useMemo(
    () => filterByRange(contestTickets, range),
    [contestTickets, range],
  );

  const disputeStatusData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of disputesInRange) {
      map[d.status] = (map[d.status] ?? 0) + 1;
    }
    return Object.entries(map).map(([status, count]) => ({ status, count }));
  }, [disputesInRange]);

  const trustLevelData = useMemo(() => {
    const order = ['elite', 'top_rated', 'trusted', 'verified', 'new'];
    const map: Record<string, number> = {};
    for (const p of allProfiles) {
      const lvl = p.trust_level ?? 'new';
      map[lvl] = (map[lvl] ?? 0) + 1;
    }
    return order
      .filter((lvl) => map[lvl])
      .map((name) => ({ name, value: map[name] }));
  }, [allProfiles]);

  const openDisputes    = disputesInRange.filter((d) => d.status === 'open').length;
  const pendingTickets  = ticketsInRange.filter((t) => t.status === 'pending').length;
  const reversedTickets = ticketsInRange.filter((t) => t.status === 'reversed').length;

  // Verification completion rates — proportion of active profiles with each
  // verification flag set to true (current platform state snapshot).
  const verificationData = useMemo(() => {
    const total = allProfiles.length;
    if (!total) return [];
    return [
      { label: 'Onboarding',  count: allProfiles.filter((p) => p.onboarding_completed).length },
      { label: 'Phone',       count: allProfiles.filter((p) => p.phone_verified).length },
      { label: 'Identity',    count: allProfiles.filter((p) => p.identity_verified).length },
      { label: 'Liveness',    count: allProfiles.filter((p) => p.liveness_verified).length },
      { label: 'Student',     count: allProfiles.filter((p) => p.student_verified).length },
    ].map(({ label, count }) => ({
      label,
      count,
      rate: Math.round((count / total) * 100),
    }));
  }, [allProfiles]);

  // Flag volume over time — security_log events bucketed by period.
  const securityLogsInRange = useMemo(
    () => filterByRange(securityLogs, range),
    [securityLogs, range],
  );

  const flagVolumeData = useMemo(
    () => groupByBucket(securityLogsInRange, range),
    [securityLogsInRange, range],
  );

  // Top flag types — supplementary breakdown bar chart.
  const flagTypeData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const l of securityLogsInRange) {
      map[l.event_type] = (map[l.event_type] ?? 0) + 1;
    }
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([event_type, count]) => ({ event_type, count }));
  }, [securityLogsInRange]);

  // ══════════════════════════════════════════════════════════════════════════
  // 5. GEOGRAPHY
  // ══════════════════════════════════════════════════════════════════════════

  // ── User count by state ───────────────────────────────────────────────────
  // Derived from profiles.location (free-text field, normalised to trim).
  // Top 10 states by new-user registrations in the selected period.
  const geoData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of profilesInRange) {
      const loc = (p.location ?? '').trim();
      if (!loc) continue;
      map[loc] = (map[loc] ?? 0) + 1;
    }
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([location, users]) => ({ location, users }));
  }, [profilesInRange]);

  const uniqueLocations = useMemo(() => {
    const s = new Set(profilesInRange.map((p) => p.location).filter(Boolean));
    return s.size;
  }, [profilesInRange]);

  // ── Transaction volume by state ───────────────────────────────────────────
  // Derived from geoTransactions — each row is a successful transaction joined
  // to its recipient profile's location. We aggregate ₦ volume per state and
  // also track transaction count for the tooltip / CSV.
  //
  // Date-range filter applied client-side (same pattern as all other series).
  // Rows where recipient_user_id or recipient_user_id.location is null are
  // excluded — they represent transactions with no locatable recipient (e.g.
  // platform fee captures, unlinked top-ups).
  const geoTxData = useMemo(() => {
    const cutoff = getCutoff(range);
    const volMap:   Record<string, number> = {};
    const countMap: Record<string, number> = {};

    for (const row of geoTransactions) {
      if (new Date(row.created_at) < cutoff) continue;
      const loc = row.recipient_user_id?.location?.trim();
      if (!loc) continue;
      volMap[loc]   = (volMap[loc]   ?? 0) + (Number(row.amount) || 0);
      countMap[loc] = (countMap[loc] ?? 0) + 1;
    }

    return Object.entries(volMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([location, volume]) => ({
        location,
        volume,
        count: countMap[location] ?? 0,
      }));
  }, [geoTransactions, range]);

  const totalGeoTxVolume = useMemo(
    () => geoTxData.reduce((s, r) => s + r.volume, 0),
    [geoTxData],
  );

  const topTxState = geoTxData[0] ?? null;

  // ── CSV export payloads ───────────────────────────────────────────────────

  function exportUserGrowth() {
    downloadCSV(
      [
        ...userGrowthData.map((d) => ({ period: d.period, new_users: d.value })),
        { period: 'SUMMARY_onboarding_rate', new_users: onboardingRate },
      ],
      `f9_user_growth_${range}.csv`,
    );
  }

  function exportMarketplace() {
    downloadCSV(
      [
        ...popularCategoriesData.map((d) => ({
          section: 'popular_category',
          label:   d.category,
          count:   d.orders,
        })),
        ...orderStatusData.map((d) => ({
          section: 'order_status',
          label:   d.status,
          count:   d.count,
        })),
        { section: 'summary', label: 'aov',              count: aov          },
        { section: 'summary', label: 'repeat_user_rate', count: repeatUserRate },
      ],
      `f9_marketplace_${range}.csv`,
    );
  }

  function exportFinancial() {
    downloadCSV(
      [
        ...financialData.map((d) => ({
          period:       d.period,
          transactions: d.transactions,
          withdrawals:  d.withdrawals,
        })),
        ...escrowVolumeData.map((d) => ({
          period:          d.period,
          escrow_released: d.value,
          withdrawals:     0,
        })),
      ],
      `f9_financial_flow_${range}.csv`,
    );
  }

  function exportTrustSafety() {
    downloadCSV(
      [
        ...disputeStatusData.map((d) => ({
          type: 'dispute', label: d.status, count: d.count,
        })),
        ...trustLevelData.map((d) => ({
          type: 'trust_level', label: d.name, count: d.value,
        })),
        ...verificationData.map((d) => ({
          type: 'verification', label: d.label, count: d.count, rate_pct: d.rate,
        })),
        ...flagTypeData.map((d) => ({
          type: 'flag_event_type', label: d.event_type, count: d.count,
        })),
      ],
      `f9_trust_safety_${range}.csv`,
    );
  }

  // Geography CSV now includes both user-count and transaction-volume sheets.
  function exportGeography() {
    downloadCSV(
      [
        // User registrations by state
        ...geoData.map((d) => ({
          sheet:    'user_registrations',
          location: d.location,
          users:    d.users,
          volume:   '',
          tx_count: '',
        })),
        // Transaction volume by state
        ...geoTxData.map((d) => ({
          sheet:    'transaction_volume',
          location: d.location,
          users:    '',
          volume:   d.volume,
          tx_count: d.count,
        })),
      ],
      `f9_geography_${range}.csv`,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">

      {/* ── Page header + date range selector ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Platform-wide metrics. All figures for the selected window.
          </p>
        </div>

        <div className="flex rounded-lg border border-gray-200 overflow-hidden bg-white shadow-sm">
          {(Object.keys(RANGE_LABELS) as DateRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                range === r
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* 1. USER GROWTH                                                  */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <SectionHeader title="User Growth" onExport={exportUserGrowth} />

        <div className="grid grid-cols-4 gap-4 mb-6">
          <StatCard label="New Users"           value={profilesInRange.length} />
          <StatCard label="Freelancers"         value={freelancerCount}        />
          <StatCard label="Clients / Buyers"    value={clientCount}            />
          <StatCard
            label="Onboarding Complete"
            value={onboardingRate}
            sub={`${onboardingCompleted} of ${onboardingTotal} active users`}
          />
        </div>

        {userGrowthData.length === 0 ? (
          <Empty label="No registration data in this period." />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart
              data={userGrowthData}
              margin={{ top: 4, right: 16, bottom: 0, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="period" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="value"
                name="New Users"
                stroke={CHART_COLORS.blue}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </section>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* 2. MARKETPLACE HEALTH                                           */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <SectionHeader title="Marketplace Health" onExport={exportMarketplace} />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total Orders"      value={ordersInRange.length}       />
          <StatCard label="Delivered"         value={completedOrders}            />
          <StatCard label="Cancellation Rate" value={`${cancelRate}%`}           />
          <StatCard label="Avg Order Value"   value={fmt(aov)}     sub="gross"   />
        </div>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <StatCard
            label="Repeat User Rate"
            value={repeatUserRate}
            sub="clients with > 1 order in period"
          />
          <StatCard
            label="Top Category"
            value={popularCategoriesData[0]?.category ?? '—'}
            sub={
              popularCategoriesData[0]
                ? `${popularCategoriesData[0].orders} orders`
                : undefined
            }
          />
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <SubHeader title="Order Volume Over Time" />
            {orderVolumeData.length === 0 ? (
              <Empty label="No order data." />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart
                  data={orderVolumeData}
                  margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="value"
                    name="Orders"
                    stroke={CHART_COLORS.emerald}
                    fill={`${CHART_COLORS.emerald}22`}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          <div>
            <SubHeader title="Orders by Status" />
            {orderStatusData.length === 0 ? (
              <Empty label="No order data." />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={orderStatusData}
                  layout="vertical"
                  margin={{ top: 4, right: 16, bottom: 0, left: 60 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#f1f5f9"
                    horizontal={false}
                  />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="status" tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar
                    dataKey="count"
                    name="Orders"
                    fill={CHART_COLORS.emerald}
                    radius={[0, 3, 3, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div>
          <SubHeader title="Popular Categories (by order count)" />
          {popularCategoriesData.length === 0 ? (
            <Empty label="No category data in this period." />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={popularCategoriesData}
                layout="vertical"
                margin={{ top: 4, right: 16, bottom: 0, left: 110 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#f1f5f9"
                  horizontal={false}
                />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="category" tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar
                  dataKey="orders"
                  name="Orders"
                  fill={CHART_COLORS.teal}
                  radius={[0, 3, 3, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* 3. FINANCIAL FLOW                                               */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <SectionHeader title="Financial Flow" onExport={exportFinancial} />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Transaction Volume"
            value={fmt(totalTxVolume)}
            sub="successful only"
          />
          <StatCard label="Withdrawal Volume" value={fmt(totalWdVolume)} />
          <StatCard
            label="Net Retained"
            value={fmt(Math.max(0, totalTxVolume - totalWdVolume))}
          />
          <StatCard
            label="Escrow Turnover"
            value={fmt(escrowTurnover)}
            sub={`${escrowTurnoverCount} releases`}
          />
        </div>

        <div className="mb-6">
          <StatCard
            label="Avg Payment-to-Release"
            value={avgPaymentToRelease !== null ? fmtHours(avgPaymentToRelease) : '—'}
            sub="mean escrow hold duration (created → released)"
          />
        </div>

        <div className="mb-6">
          <SubHeader title="Transaction & Withdrawal Volume Over Time" />
          {financialData.length === 0 ? (
            <Empty label="No financial data in this period." />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart
                data={financialData}
                margin={{ top: 4, right: 16, bottom: 0, left: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis
                  tickFormatter={(v: number) => fmt(v)}
                  tick={{ fontSize: 10 }}
                  width={72}
                />
                <Tooltip formatter={fmtTooltip} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="transactions"
                  name="Transactions"
                  stroke={CHART_COLORS.blue}
                  fill={`${CHART_COLORS.blue}22`}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="withdrawals"
                  name="Withdrawals"
                  stroke={CHART_COLORS.amber}
                  fill={`${CHART_COLORS.amber}22`}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div>
          <SubHeader title="Escrow Released Over Time" />
          {escrowVolumeData.length === 0 ? (
            <Empty label="No released escrow data in this period." />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart
                data={escrowVolumeData}
                margin={{ top: 4, right: 16, bottom: 0, left: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis
                  tickFormatter={(v: number) => fmt(v)}
                  tick={{ fontSize: 10 }}
                  width={72}
                />
                <Tooltip formatter={fmtTooltip} />
                <Area
                  type="monotone"
                  dataKey="value"
                  name="Escrow Released"
                  stroke={CHART_COLORS.emerald}
                  fill={`${CHART_COLORS.emerald}22`}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* 4. TRUST & SAFETY                                               */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <SectionHeader title="Trust & Safety" onExport={exportTrustSafety} />

        <div className="grid grid-cols-3 gap-4 mb-6">
          <StatCard label="Open Disputes"    value={openDisputes}    />
          <StatCard label="Pending Tickets"  value={pendingTickets}  />
          <StatCard label="Reversed Tickets" value={reversedTickets} />
        </div>

        <div className="grid grid-cols-2 gap-6 mb-8">
          <div>
            <SubHeader title="Disputes by Status" />
            {disputeStatusData.length === 0 ? (
              <Empty label="No disputes in this period." />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={disputeStatusData}
                  layout="vertical"
                  margin={{ top: 4, right: 16, bottom: 0, left: 80 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#f1f5f9"
                    horizontal={false}
                  />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="status" tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar
                    dataKey="count"
                    name="Disputes"
                    fill={CHART_COLORS.red}
                    radius={[0, 3, 3, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div>
            <SubHeader title="Trust Level Distribution (all active users)" />
            {trustLevelData.length === 0 ? (
              <Empty label="No active user data." />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={trustLevelData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) =>
                      `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {trustLevelData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={TRUST_COLORS[entry.name] ?? CHART_COLORS.slate}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="mb-8">
          <SubHeader title="Verification Completion Rates (active users)" />
          {verificationData.length === 0 ? (
            <Empty label="No verification data." />
          ) : (
            <div className="grid grid-cols-5 gap-3">
              {verificationData.map((v) => (
                <div
                  key={v.label}
                  className="bg-gray-50 rounded-lg border border-gray-200 p-4 text-center"
                >
                  <p className="text-2xl font-bold text-gray-900">{v.rate}%</p>
                  <p className="text-xs text-gray-500 mt-1">{v.label}</p>
                  <p className="text-xs text-gray-400">{v.count.toLocaleString()} users</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <SubHeader title="Security Flag Volume Over Time" />
            {flagVolumeData.length === 0 ? (
              <Empty label="No security events in this period." />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart
                  data={flagVolumeData}
                  margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="value"
                    name="Security Events"
                    stroke={CHART_COLORS.red}
                    fill={`${CHART_COLORS.red}22`}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          <div>
            <SubHeader title="Top Security Event Types" />
            {flagTypeData.length === 0 ? (
              <Empty label="No security events in this period." />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={flagTypeData}
                  layout="vertical"
                  margin={{ top: 4, right: 16, bottom: 0, left: 140 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#f1f5f9"
                    horizontal={false}
                  />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                  <YAxis
                    type="category"
                    dataKey="event_type"
                    tick={{ fontSize: 9 }}
                    width={136}
                  />
                  <Tooltip />
                  <Bar
                    dataKey="count"
                    name="Events"
                    fill={CHART_COLORS.orange}
                    radius={[0, 3, 3, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* 5. GEOGRAPHY                                                    */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <SectionHeader title="Geography" onExport={exportGeography} />

        {/* ── User registrations by state ─────────────────────────────── */}
        <div className="mb-8">
          <SubHeader title="User Registrations by State (top 10)" />

          <div className="grid grid-cols-3 gap-4 mb-4">
            <StatCard label="Unique Locations"  value={uniqueLocations}             />
            <StatCard label="Top State (Users)" value={geoData[0]?.location ?? '—'} />
            <StatCard label="Users in Top State" value={geoData[0]?.users ?? 0}     />
          </div>

          {geoData.length === 0 ? (
            <Empty label="No location data in this period." />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={geoData}
                layout="vertical"
                margin={{ top: 4, right: 16, bottom: 0, left: 110 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#f1f5f9"
                  horizontal={false}
                />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="location" tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar
                  dataKey="users"
                  name="Users"
                  fill={CHART_COLORS.violet}
                  radius={[0, 3, 3, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── Transaction volume by state ──────────────────────────────── */}
        {/* Sourced from transactions joined to recipient profile location. */}
        {/* Rows with no recipient location are excluded (null location =   */}
        {/* unlocatable recipient — e.g. platform fee captures).            */}
        <div>
          <SubHeader title="Transaction Volume by State — ₦ received (top 10)" />

          <div className="grid grid-cols-3 gap-4 mb-4">
            <StatCard
              label="States with Transactions"
              value={geoTxData.length}
              sub="states represented in this period"
            />
            <StatCard
              label="Top State (Volume)"
              value={topTxState?.location ?? '—'}
              sub={topTxState ? `${topTxState.count} transactions` : undefined}
            />
            <StatCard
              label="Top State Volume"
              value={topTxState ? fmt(topTxState.volume) : '—'}
              sub={
                topTxState && totalGeoTxVolume > 0
                  ? `${Math.round((topTxState.volume / totalGeoTxVolume) * 100)}% of mapped total`
                  : undefined
              }
            />
          </div>

          {geoTxData.length === 0 ? (
            <Empty label="No transaction data with locatable recipients in this period." />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={geoTxData}
                layout="vertical"
                margin={{ top: 4, right: 16, bottom: 0, left: 110 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#f1f5f9"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tickFormatter={(v: number) => fmt(v)}
                  tick={{ fontSize: 10 }}
                />
                <YAxis
                  type="category"
                  dataKey="location"
                  tick={{ fontSize: 11 }}
                />
                {/* ── FIX (TS2322): formatter param widened to ValueType | undefined ── */}
                <Tooltip
                  formatter={(
                    value: number | string | readonly (number | string)[] | undefined,
                  ) =>
                    typeof value === 'number'
                      ? [fmt(value), 'Volume']
                      : String(value ?? '')
                  }
                />
                <Bar
                  dataKey="volume"
                  name="Transaction Volume"
                  fill={CHART_COLORS.teal}
                  radius={[0, 3, 3, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function Empty({ label }: { label: string }) {
  return (
    <div className="h-[220px] flex items-center justify-center text-sm text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200">
      {label}
    </div>
  );
}