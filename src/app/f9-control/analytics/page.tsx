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
// FIX (confirmed via live RPC export): both transaction queries below
// previously filtered .eq('status', 'success'). Every RPC that writes a
// successful payment status in this codebase
// (process_successful_payment, process_marketplace_payment) writes
// status = 'successful' — never 'success'. That single-character mismatch
// meant these two queries matched zero rows, always, regardless of how
// much money actually moved through the platform — the Financial Flow
// Volume chart and the Geography transaction-volume-by-state chart have
// been silently empty since they were written. Corrected to 'successful'
// to match the value your functions actually write.
//
// QUERIES:
//   • profiles          — user growth + geography (user count by state)
//   • marketplace_orders — order status breakdown
//   • transactions      — financial flow volume
//   • withdrawals       — withdrawal volume
//   • disputes          — trust & safety dispute status
//   • contest_tickets   — trust & safety ticket status
//   • profiles (full)   — verification completion rates + trust level pie
//   • orders            — AOV, repeat-user detection, category popularity
//   • escrow            — escrow turnover + payment-to-release timing
//   • security_logs     — flag volume over time
//   • geoTransactions   — transactions joined to recipient profile location
//                         for the Geography section transaction-volume-by-state
//                         chart. Uses recipient_user_id FK -> profiles(location).

// FIX (found during final pass — this page previously had NO auth check at
// all, not even confirming a session exists): createAdminClient() was used
// for every query, with no preceding auth.getUser() call anywhere in the
// file. Combined with createAdminClient() bypassing RLS entirely, this
// meant ANY request that could reach this route — authenticated or not —
// would receive a full year of platform financial and user data: revenue,
// withdrawal volume, dispute outcomes, verification rates, geography
// breakdowns. Added the same auth + requireStaffRole gate used in
// finance/page.tsx and flags/page.tsx for consistency across every
// /f9-control surface.

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireStaffRole } from '@/lib/auth/require-staff-role';
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
  type GeoTransactionRow,
} from '@/components/admin/AnalyticsClient';

// Read-only financial/operational dashboard — same conservative default as
// flags/page.tsx. Widen if you introduce an analyst-tier staff role.
const ANALYTICS_ROLES = ['admin'];

const YEAR_AGO = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();

export default async function AnalyticsPage() {
  // Used ONLY to confirm there's a logged-in session and resolve who they
  // are — every actual data read below uses the admin client, same pattern
  // as finance/page.tsx and flags/page.tsx.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Unauthenticated');
  }

  const adminClient = createAdminClient();
  await requireStaffRole(adminClient, user.id, ANALYTICS_ROLES);

  const [
    profilesRes,
    marketplaceOrdersRes,
    transactionsRes,
    withdrawalsRes,
    disputesRes,
    contestTicketsRes,
    allProfilesRes,
    ordersRes,
    escrowRes,
    securityLogsRes,
    geoTransactionsRes,
  ] = await Promise.all([
    adminClient
      .from('profiles')
      .select('created_at, user_type, location, account_status')
      .gte('created_at', YEAR_AGO),

    adminClient
      .from('marketplace_orders')
      .select('created_at, status')
      .gte('created_at', YEAR_AGO),

    adminClient
      .from('transactions')
      .select('created_at, amount, transaction_type, status')
      .gte('created_at', YEAR_AGO)
      .eq('status', 'successful'),

    adminClient
      .from('withdrawals')
      .select('created_at, amount, status')
      .gte('created_at', YEAR_AGO),

    adminClient
      .from('disputes')
      .select('created_at, status')
      .gte('created_at', YEAR_AGO),

    adminClient
      .from('contest_tickets')
      .select('created_at, status')
      .gte('created_at', YEAR_AGO),

    // All active profiles — trust level pie + verification completion rates.
    adminClient
      .from('profiles')
      .select(
        'trust_level, onboarding_completed, identity_verified, liveness_verified, phone_verified, student_verified, account_status'
      )
      .eq('account_status', 'active'),

    // Service orders with category join, client_id, amount, cleared_at.
    adminClient
      .from('orders')
      .select('created_at, status, amount, client_id, cleared_at, service_id(category)')
      .gte('created_at', YEAR_AGO),

    // Escrow entries for turnover + payment-to-release timing.
    adminClient
      .from('escrow')
      .select('created_at, released_at, status, amount')
      .gte('created_at', YEAR_AGO),

    // Security logs for flag volume over time.
    adminClient
      .from('security_logs')
      .select('created_at, event_type, severity')
      .gte('created_at', YEAR_AGO),

    // Geo transactions: transactions joined to recipient profile location.
    // recipient_user_id(location) uses the transactions_recipient_user_id_fkey
    // FK to profiles, returning { location: string | null } per row.
    // Only successful transactions. Client aggregates by location, top 10.
    adminClient
      .from('transactions')
      .select('created_at, amount, recipient_user_id(location)')
      .gte('created_at', YEAR_AGO)
      .eq('status', 'successful'),
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
          trust_level:          string | null;
          onboarding_completed: boolean | null;
          identity_verified:    boolean | null;
          liveness_verified:    boolean | null;
          phone_verified:       boolean | null;
          student_verified:     boolean | null;
          account_status:       string;
        }>
      }
      orders={(ordersRes.data ?? []) as OrderRow[]}
      escrowEntries={(escrowRes.data ?? []) as EscrowRow[]}
      securityLogs={(securityLogsRes.data ?? []) as SecurityLogRow[]}
      geoTransactions={(geoTransactionsRes.data ?? []) as GeoTransactionRow[]}
    />
  );
}