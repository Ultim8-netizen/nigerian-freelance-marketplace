// src/app/f9-control/analytics/page.tsx
// Server component — fetches the last 365 days of raw analytics data in a
// single parallel Promise.all and passes typed rows to AnalyticsClient.
//
// WHY createAdminClient?
//   All tables involved (profiles, transactions, disputes, escrow, etc.) have
//   RLS enabled. Admin queries must use the service role key so that row-level
//   policies targeting auth.uid() do not filter out cross-user data.
//   createAdminClient() (from @/lib/supabase/admin) is the project-standard
//   way to obtain a service-role client — createServiceClient was removed.
//
// WHY 365 days up-front?
//   The client component offers four date-range options (30 d / 90 d / 180 d /
//   365 d). Pre-fetching the full year once avoids round-trips when the admin
//   switches ranges; aggregation + filtering happen entirely client-side.
//
// NEW QUERIES vs original:
//   • orders          — AOV, repeat-user detection, payment-to-release time,
//                       service category popularity (via service_id join)
//   • escrow          — escrow turnover (released entries) + released_at for
//                       avg payment-to-release calculation
//   • profiles (full) — onboarding_completed, identity_verified,
//                       liveness_verified, phone_verified, student_verified
//                       columns were missing from the original partial select
//   • security_logs   — flag volume over time (event_type + severity buckets)

import { createAdminClient } from '@/lib/supabase/admin';
import {
  AnalyticsClient,
  type ProfileRow,
  type MarketplaceOrderRow,
  type TransactionRow,
  type WithdrawalRow,
  type DisputeRow,
  type ContestTicketRow,
  type OrderRow,
  type EscrowRow,
  type SecurityLogRow,
} from '@/components/admin/AnalyticsClient';

const YEAR_AGO = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();

export default async function AnalyticsPage() {
  const supabase = createAdminClient();

  const [
    profilesRes,
    marketplaceOrdersRes,
    transactionsRes,
    withdrawalsRes,
    disputesRes,
    contestTicketsRes,
    // Trust level + verification columns — current-state snapshot, no date filter.
    allProfilesRes,
    // NEW: service orders with category (via service join), client_id for
    // repeat-user detection, amount for AOV, cleared_at for payment-to-release.
    ordersRes,
    // NEW: escrow entries — turnover (released in period) + timing data.
    escrowRes,
    // NEW: security_logs — flag/event volume over time.
    securityLogsRes,
  ] = await Promise.all([
    // ── Existing queries (columns extended) ─────────────────────────────────
    supabase
      .from('profiles')
      .select('created_at, user_type, location, account_status')
      .gte('created_at', YEAR_AGO),

    supabase
      .from('marketplace_orders')
      .select('created_at, status')
      .gte('created_at', YEAR_AGO),

    supabase
      .from('transactions')
      .select('created_at, amount, transaction_type, status')
      .gte('created_at', YEAR_AGO)
      .eq('status', 'success'),

    supabase
      .from('withdrawals')
      .select('created_at, amount, status')
      .gte('created_at', YEAR_AGO),

    supabase
      .from('disputes')
      .select('created_at, status')
      .gte('created_at', YEAR_AGO),

    supabase
      .from('contest_tickets')
      .select('created_at, status')
      .gte('created_at', YEAR_AGO),

    // All active profiles — trust level pie + verification completion rates.
    // NOW includes all verification boolean columns missing from the original.
    supabase
      .from('profiles')
      .select(
        'trust_level, onboarding_completed, identity_verified, liveness_verified, phone_verified, student_verified, account_status'
      )
      .eq('account_status', 'active'),

    // ── NEW: orders ──────────────────────────────────────────────────────────
    // service_id(category) performs a join to the services table so we get
    // category names without a second round-trip.
    // client_id identifies repeat buyers (same client_id appearing > 1 time).
    // amount is the gross order value for AOV.
    // cleared_at is the timestamp when escrow released to freelancer — used as
    // the "payment released" timestamp for avg payment-to-release calculation.
    supabase
      .from('orders')
      .select('created_at, status, amount, client_id, cleared_at, service_id(category)')
      .gte('created_at', YEAR_AGO),

    // ── NEW: escrow ──────────────────────────────────────────────────────────
    // status='released' rows within the period = escrow turnover.
    // released_at - created_at = time money sat in escrow before release.
    supabase
      .from('escrow')
      .select('created_at, released_at, status, amount')
      .gte('created_at', YEAR_AGO),

    // ── NEW: security_logs ───────────────────────────────────────────────────
    // All events in the period for flag-volume-over-time chart.
    supabase
      .from('security_logs')
      .select('created_at, event_type, severity')
      .gte('created_at', YEAR_AGO),
  ]);

  return (
    <AnalyticsClient
      profiles={(profilesRes.data ?? []) as ProfileRow[]}
      marketplaceOrders={(marketplaceOrdersRes.data ?? []) as MarketplaceOrderRow[]}
      transactions={(transactionsRes.data ?? []) as TransactionRow[]}
      withdrawals={(withdrawalsRes.data ?? []) as WithdrawalRow[]}
      disputes={(disputesRes.data ?? []) as DisputeRow[]}
      contestTickets={(contestTicketsRes.data ?? []) as ContestTicketRow[]}
      allProfiles={
        (allProfilesRes.data ?? []) as Array<{
          trust_level:         string | null;
          onboarding_completed: boolean | null;
          identity_verified:   boolean | null;
          liveness_verified:   boolean | null;
          phone_verified:      boolean | null;
          student_verified:    boolean | null;
          account_status:      string;
        }>
      }
      orders={(ordersRes.data ?? []) as OrderRow[]}
      escrowEntries={(escrowRes.data ?? []) as EscrowRow[]}
      securityLogs={(securityLogsRes.data ?? []) as SecurityLogRow[]}
    />
  );
}