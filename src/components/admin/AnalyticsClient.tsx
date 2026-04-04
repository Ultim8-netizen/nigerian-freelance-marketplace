'use client';
// src/components/admin/AnalyticsClient.tsx
// Client component — owns all chart rendering, date-range filtering, and
// CSV export for the F9 Analytics dashboard.
//
// Sections:
//   1. User Growth      — line chart, new users per period
//   2. Marketplace      — bar chart, orders by status + volume over time
//   3. Financial Flow   — area chart, transaction + withdrawal volume
//   4. Trust & Safety   — bar chart (disputes) + pie (trust level distribution)
//   5. Geography        — horizontal bar, top 10 user locations
//
// Dependency: recharts — npm install recharts

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

// ─── Exported types (consumed by page.tsx) ───────────────────────────────────

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

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  profiles:              ProfileRow[];
  marketplaceOrders:     MarketplaceOrderRow[];
  transactions:          TransactionRow[];
  withdrawals:           WithdrawalRow[];
  disputes:              DisputeRow[];
  contestTickets:        ContestTicketRow[];
  allProfileTrustLevels: Array<{ trust_level: string | null }>;
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
  // ISO week: shift to Monday
  const d = new Date(date);
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
  const map = new Map<string, number>();

  for (const row of filtered) {
    const key = getBucketKey(new Date(row.created_at), range);
    map.set(key, (map.get(key) ?? 0) + value(row));
  }

  // Preserve insertion order (rows arrive sorted by created_at asc from Supabase)
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

const CHART_COLORS = {
  blue:    '#3b82f6',
  emerald: '#10b981',
  amber:   '#f59e0b',
  red:     '#ef4444',
  violet:  '#8b5cf6',
  pink:    '#ec4899',
  slate:   '#64748b',
};

const TRUST_COLORS: Record<string, string> = {
  elite:      CHART_COLORS.violet,
  top_rated:  CHART_COLORS.blue,
  trusted:    CHART_COLORS.emerald,
  verified:   CHART_COLORS.amber,
  new:        CHART_COLORS.slate,
};

function fmt(n: number): string {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `₦${(n / 1_000).toFixed(1)}K`;
  return `₦${n.toLocaleString()}`;
}

// FIX TS2322 — recharts' ValueType includes `readonly (string | number)[]`.
// Using ReadonlyArray instead of Array makes the parameter a supertype of both
// mutable and readonly tuple variants, satisfying Formatter<ValueType, NameType>.
function fmtTooltip(value: number | string | ReadonlyArray<number | string> | undefined): string {
  return typeof value === 'number' ? fmt(value) : String(value ?? '');
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AnalyticsClient({
  profiles,
  marketplaceOrders,
  transactions,
  withdrawals,
  disputes,
  contestTickets,
  allProfileTrustLevels,
}: Props) {
  const [range, setRange] = useState<DateRange>('90d');

  // ── 1. User Growth ──────────────────────────────────────────────────────────

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

  // ── 2. Marketplace Health ───────────────────────────────────────────────────

  const ordersInRange = useMemo(
    () => filterByRange(marketplaceOrders, range),
    [marketplaceOrders, range],
  );

  const orderVolumeData = useMemo(
    () => groupByBucket(marketplaceOrders, range),
    [marketplaceOrders, range],
  );

  const orderStatusData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const o of ordersInRange) {
      map[o.status] = (map[o.status] ?? 0) + 1;
    }
    return Object.entries(map).map(([status, count]) => ({ status, count }));
  }, [ordersInRange]);

  const completedOrders = ordersInRange.filter((o) => o.status === 'delivered').length;
  const cancelledOrders = ordersInRange.filter((o) => o.status === 'cancelled').length;
  const cancelRate      = ordersInRange.length
    ? Math.round((cancelledOrders / ordersInRange.length) * 100)
    : 0;

  // ── 3. Financial Flow ───────────────────────────────────────────────────────

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

  // Merge tx + withdrawal into a single time-series for the area chart
  const financialData = useMemo(() => {
    const map = new Map<string, { period: string; transactions: number; withdrawals: number }>();
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

  // ── 4. Trust & Safety ───────────────────────────────────────────────────────

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
    for (const p of allProfileTrustLevels) {
      const lvl = p.trust_level ?? 'new';
      map[lvl] = (map[lvl] ?? 0) + 1;
    }
    return order
      .filter((lvl) => map[lvl])
      .map((name) => ({ name, value: map[name] }));
  }, [allProfileTrustLevels]);

  const openDisputes    = disputesInRange.filter((d) => d.status === 'open').length;
  const pendingTickets  = ticketsInRange.filter((t)  => t.status === 'pending').length;
  const reversedTickets = ticketsInRange.filter((t)  => t.status === 'reversed').length;

  // ── 5. Geography ────────────────────────────────────────────────────────────

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

  // ── CSV export payloads ─────────────────────────────────────────────────────

  function exportUserGrowth() {
    downloadCSV(
      userGrowthData.map((d) => ({ period: d.period, new_users: d.value })),
      `f9_user_growth_${range}.csv`,
    );
  }

  function exportMarketplace() {
    downloadCSV(
      orderStatusData.map((d) => ({ status: d.status, count: d.count })),
      `f9_marketplace_${range}.csv`,
    );
  }

  function exportFinancial() {
    downloadCSV(
      financialData.map((d) => ({
        period:       d.period,
        transactions: d.transactions,
        withdrawals:  d.withdrawals,
      })),
      `f9_financial_flow_${range}.csv`,
    );
  }

  function exportTrustSafety() {
    downloadCSV(
      [
        ...disputeStatusData.map((d) => ({ type: 'dispute',     status: d.status, count: d.count })),
        ...trustLevelData.map((d)    => ({ type: 'trust_level', status: d.name,   count: d.value })),
      ],
      `f9_trust_safety_${range}.csv`,
    );
  }

  function exportGeography() {
    downloadCSV(
      geoData.map((d) => ({ location: d.location, users: d.users })),
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

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* 1. USER GROWTH                                                    */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <SectionHeader title="User Growth" onExport={exportUserGrowth} />

        <div className="grid grid-cols-3 gap-4 mb-6">
          <StatCard label="New Users"        value={profilesInRange.length} />
          <StatCard label="Freelancers"      value={freelancerCount}        />
          <StatCard label="Clients / Buyers" value={clientCount}            />
        </div>

        {userGrowthData.length === 0 ? (
          <Empty label="No registration data in this period." />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={userGrowthData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
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

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* 2. MARKETPLACE HEALTH                                             */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <SectionHeader title="Marketplace Health" onExport={exportMarketplace} />

        <div className="grid grid-cols-3 gap-4 mb-6">
          <StatCard label="Total Orders"      value={ordersInRange.length} />
          <StatCard label="Delivered"         value={completedOrders}      />
          <StatCard label="Cancellation Rate" value={`${cancelRate}%`}     />
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Volume over time */}
          <div>
            <p className="text-xs text-gray-500 mb-2 font-medium">Order Volume Over Time</p>
            {orderVolumeData.length === 0 ? (
              <Empty label="No order data." />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={orderVolumeData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
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

          {/* Status breakdown */}
          <div>
            <p className="text-xs text-gray-500 mb-2 font-medium">Orders by Status</p>
            {orderStatusData.length === 0 ? (
              <Empty label="No order data." />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={orderStatusData}
                  layout="vertical"
                  margin={{ top: 4, right: 16, bottom: 0, left: 60 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="status" tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Orders" fill={CHART_COLORS.emerald} radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* 3. FINANCIAL FLOW                                                 */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <SectionHeader title="Financial Flow" onExport={exportFinancial} />

        <div className="grid grid-cols-3 gap-4 mb-6">
          <StatCard label="Transaction Volume" value={fmt(totalTxVolume)} sub="successful only" />
          <StatCard label="Withdrawal Volume"  value={fmt(totalWdVolume)}                       />
          <StatCard label="Net Retained"       value={fmt(Math.max(0, totalTxVolume - totalWdVolume))} />
        </div>

        {financialData.length === 0 ? (
          <Empty label="No financial data in this period." />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={financialData} margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
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
      </section>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* 4. TRUST & SAFETY                                                 */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <SectionHeader title="Trust & Safety" onExport={exportTrustSafety} />

        <div className="grid grid-cols-3 gap-4 mb-6">
          <StatCard label="Open Disputes"    value={openDisputes}    />
          <StatCard label="Pending Tickets"  value={pendingTickets}  />
          <StatCard label="Reversed Tickets" value={reversedTickets} />
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Disputes by status */}
          <div>
            <p className="text-xs text-gray-500 mb-2 font-medium">Disputes by Status</p>
            {disputeStatusData.length === 0 ? (
              <Empty label="No disputes in this period." />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={disputeStatusData}
                  layout="vertical"
                  margin={{ top: 4, right: 16, bottom: 0, left: 80 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="status" tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Disputes" fill={CHART_COLORS.red} radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Trust level distribution (all active users — current state) */}
          <div>
            <p className="text-xs text-gray-500 mb-2 font-medium">
              Trust Level Distribution{' '}
              <span className="text-gray-400">(all active users)</span>
            </p>
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
                      // FIX TS18048 — recharts types `percent` as number | undefined.
                      // Nullish coalesce to 0 before multiplication.
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
      </section>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* 5. GEOGRAPHY                                                      */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <SectionHeader title="Geography" onExport={exportGeography} />

        <div className="grid grid-cols-3 gap-4 mb-6">
          <StatCard label="Unique Locations"  value={uniqueLocations}               />
          <StatCard label="Top Location"      value={geoData[0]?.location ?? '—'}   />
          <StatCard label="Users in Top City" value={geoData[0]?.users    ?? 0}     />
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
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="location" tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="users" name="Users" fill={CHART_COLORS.violet} radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
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