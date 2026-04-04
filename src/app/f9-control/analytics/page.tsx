// src/app/f9-control/analytics/page.tsx
// Server component — fetches the last 365 days of raw analytics data in a
// single parallel Promise.all and passes typed rows to AnalyticsClient.
//
// WHY createServiceClient?
//   All tables involved (profiles, transactions, disputes, etc.) have RLS
//   enabled.  Admin queries must use the service role key so that row-level
//   policies targeting auth.uid() do not filter out cross-user data.
//
// WHY 365 days up-front?
//   The client component offers four date-range options (30 d / 90 d / 180 d /
//   365 d).  Pre-fetching the full year once avoids round-trips when the admin
//   switches ranges; aggregation + filtering happen entirely client-side.

import { createServiceClient } from '@/lib/supabase/service';
import {
  AnalyticsClient,
  type ProfileRow,
  type MarketplaceOrderRow,
  type TransactionRow,
  type WithdrawalRow,
  type DisputeRow,
  type ContestTicketRow,
} from '@/components/admin/AnalyticsClient';

const YEAR_AGO = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();

export default async function AnalyticsPage() {
  const supabase = createServiceClient();

  const [
    profilesRes,
    marketplaceOrdersRes,
    transactionsRes,
    withdrawalsRes,
    disputesRes,
    contestTicketsRes,
    // Trust level distribution is a current-state snapshot — no date filter.
    allProfilesRes,
  ] = await Promise.all([
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

    // All profiles — used for trust level pie (current platform state)
    supabase
      .from('profiles')
      .select('trust_level')
      .eq('account_status', 'active'),
  ]);

  return (
    <AnalyticsClient
      profiles={(profilesRes.data ?? []) as ProfileRow[]}
      marketplaceOrders={(marketplaceOrdersRes.data ?? []) as MarketplaceOrderRow[]}
      transactions={(transactionsRes.data ?? []) as TransactionRow[]}
      withdrawals={(withdrawalsRes.data ?? []) as WithdrawalRow[]}
      disputes={(disputesRes.data ?? []) as DisputeRow[]}
      contestTickets={(contestTicketsRes.data ?? []) as ContestTicketRow[]}
      allProfileTrustLevels={
        (allProfilesRes.data ?? []) as Array<{ trust_level: string | null }>
      }
    />
  );
}