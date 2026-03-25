import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getPlatformConfigs, CONFIG_KEYS } from '@/lib/platform-config';

// FIXED: Replaced createClient() (anon key, blocked by RLS) with createServiceClient()
// (service role key, bypasses RLS). Previously ALL three rules returned zero rows
// silently because auth.uid() = NULL with no user session, causing every RLS
// policy to filter out every row.
// UPDATED: Hardcoded time thresholds replaced with platform_config reads.
//          Keys: dispute_auto_resolve_days, frequent_disputer_window_days,
//          unlinked_tx_window_hours. Defaults preserved as fallbacks.

export async function POST() {
  // Service client bypasses RLS — correct for a cron with no user session.
  const supabase = createServiceClient();
  const logs: string[] = [];

  // ── Fetch all configurable thresholds in one query ────────────────────────
  const config = await getPlatformConfigs(supabase, [
    CONFIG_KEYS.DISPUTE_AUTO_RESOLVE_DAYS,
    CONFIG_KEYS.FREQUENT_DISPUTER_WINDOW_DAYS,
    CONFIG_KEYS.UNLINKED_TX_WINDOW_HOURS,
  ]);

  // ─── RULE 1: Stale dispute auto-resolution ─────────────────────────────────
  const disputeWindowMs = config[CONFIG_KEYS.DISPUTE_AUTO_RESOLVE_DAYS] * 24 * 60 * 60 * 1000;
  const sevenDaysAgo    = new Date(Date.now() - disputeWindowMs).toISOString();

  const { data: staleDisputes, error: disputeError } = await supabase
    .from('disputes')
    .select('id, order_id')
    .eq('status', 'open')
    .lte('created_at', sevenDaysAgo)
    .not('reason', 'in', '("quality","delivery")');

  if (disputeError) {
    console.error('Error fetching stale disputes:', disputeError);
  }

  if (staleDisputes && staleDisputes.length > 0) {
    for (const dispute of staleDisputes) {
      if (dispute.order_id) {
        await supabase
          .from('disputes')
          .update({
            status:           'resolved_client',
            resolution_notes: `Auto-resolved due to ${config[CONFIG_KEYS.DISPUTE_AUTO_RESOLVE_DAYS]} days of inactivity.`,
          })
          .eq('id', dispute.id);

        await supabase
          .from('escrow')
          .update({ status: 'refunded_to_client' })
          .eq('order_id', dispute.order_id);

        await supabase
          .from('orders')
          .update({ status: 'cancelled' })
          .eq('id', dispute.order_id);

        logs.push(`Auto-resolved dispute ${dispute.id}`);
      } else {
        logs.push(`Skipped dispute ${dispute.id} — no associated order`);
      }
    }
  }

  // Quality/delivery disputes → admin queue
  const { data: qualityDisputes, error: qualityError } = await supabase
    .from('disputes')
    .select('id')
    .eq('status', 'open')
    .lte('created_at', sevenDaysAgo)
    .in('reason', ['quality', 'delivery']);

  if (qualityError) {
    console.error('Error fetching quality/delivery disputes:', qualityError);
  }

  if (qualityDisputes && qualityDisputes.length > 0) {
    for (const dispute of qualityDisputes) {
      await supabase
        .from('disputes')
        .update({
          status:           'under_review',
          resolution_notes: 'Escalated to admin: quality/delivery disputes require manual review.',
        })
        .eq('id', dispute.id);

      logs.push(`Escalated quality/delivery dispute ${dispute.id} to admin queue`);
    }
  }

  // ─── RULE 2: Frequent disputers — Level 1 advisory ────────────────────────
  const disputer_window_ms = config[CONFIG_KEYS.FREQUENT_DISPUTER_WINDOW_DAYS] * 24 * 60 * 60 * 1000;
  const thirtyDaysAgo      = new Date(Date.now() - disputer_window_ms).toISOString();

  const { data: frequentDisputers, error: dispusterError } = await supabase.rpc(
    'find_frequent_disputers',
    { since_date: thirtyDaysAgo }
  );

  if (dispusterError) {
    console.error('Error finding frequent disputers:', dispusterError);
  }

  if (frequentDisputers && Array.isArray(frequentDisputers) && frequentDisputers.length > 0) {
    for (const user of frequentDisputers) {
      await supabase.rpc('add_trust_score_event', {
        p_user_id:      user.id,
        p_event_type:   'excessive_disputes',
        p_score_change: -15,
      });

      await supabase.from('notifications').insert({
        user_id: user.id,
        type:    'level_1_advisory',
        title:   'Level 1 Advisory Notice',
        message: 'Your account has initiated an unusually high number of disputes recently. Please review our marketplace guidelines.',
      });

      logs.push(`Issued Level 1 advisory to user ${user.id}`);
    }
  }

  // ─── RULE 3: 5+ unique senders with no linked orders → suspend + flag ──────
  //
  // Queries transactions where BOTH order_id IS NULL AND marketplace_order_id IS NULL.
  // These are wallet credits with no linked order — the fraud signal the spec describes.
  //
  // recipient_user_id is populated by the migration:
  //   ALTER TABLE transactions
  //     ADD COLUMN IF NOT EXISTS recipient_user_id uuid
  //     REFERENCES profiles(id) ON DELETE SET NULL;
  //
  // Sender identity is derived from flutterwave_response->customer->{email|phone_number}.
  //
  // Graceful degradation: if the migration column is not yet present (all
  // recipient_user_id values are null), the rule logs a warning and skips
  // rather than producing false positives.

  const unlinked_window_ms  = config[CONFIG_KEYS.UNLINKED_TX_WINDOW_HOURS] * 60 * 60 * 1000;
  const twentyFourHoursAgo  = new Date(Date.now() - unlinked_window_ms).toISOString();

  type UnlinkedTxRow = {
    id:                   string;
    recipient_user_id:    string | null;
    flutterwave_response: Record<string, unknown> | null;
    amount:               number;
  };

  const { data: unlinkedTx, error: txError } = await supabase
    .from('transactions')
    .select('id, recipient_user_id, flutterwave_response, amount')
    .is('order_id', null)
    .is('marketplace_order_id', null)
    .eq('status', 'completed')
    .gte('created_at', twentyFourHoursAgo) as { data: UnlinkedTxRow[] | null; error: unknown };

  if (txError) {
    console.error('Error fetching unlinked transactions for fraud check:', txError);
  }

  if (unlinkedTx && unlinkedTx.length > 0) {
    const migrationApplied = unlinkedTx.some((tx) => tx.recipient_user_id !== null);

    if (!migrationApplied) {
      console.warn(
        '[Rule 3] Skipped: recipient_user_id column not yet populated. ' +
        'Run the migration and update the wallet top-up route to set this field.'
      );
      logs.push('Rule 3 skipped — recipient_user_id not yet populated');
    } else {
      const recipientMap = new Map<string, Set<string>>();

      for (const tx of unlinkedTx) {
        if (!tx.recipient_user_id) continue;

        const flw      = tx.flutterwave_response;
        const customer = (flw && typeof flw === 'object' && 'customer' in flw)
          ? (flw.customer as Record<string, unknown>)
          : null;

        const senderKey =
          (customer?.email        as string | undefined) ||
          (customer?.phone_number as string | undefined) ||
          null;

        if (!senderKey) continue;

        if (!recipientMap.has(tx.recipient_user_id)) {
          recipientMap.set(tx.recipient_user_id, new Set());
        }
        recipientMap.get(tx.recipient_user_id)!.add(senderKey);
      }

      for (const [recipientId, senders] of recipientMap.entries()) {
        if (senders.size < 5) continue;

        await supabase
          .from('profiles')
          .update({ account_status: 'suspended' })
          .eq('id', recipientId);

        await supabase.from('security_logs').insert({
          user_id:     recipientId,
          event_type:  'suspicious_unlinked_inflow',
          severity:    'critical',
          description: `Received funds from ${senders.size} unique external senders in ${config[CONFIG_KEYS.UNLINKED_TX_WINDOW_HOURS]}h with no corresponding orders. Account suspended pending admin review.`,
        });

        const { data: adminProfiles } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_type', 'admin')
          .eq('account_status', 'active');

        if (adminProfiles && adminProfiles.length > 0) {
          await supabase.from('notifications').insert(
            adminProfiles.map((a) => ({
              user_id: a.id,
              type:    'critical_fraud_alert',
              title:   'Critical: Suspicious Wallet Inflow',
              message: `User ${recipientId} received funds from ${senders.size} unique external senders in ${config[CONFIG_KEYS.UNLINKED_TX_WINDOW_HOURS]}h with no linked orders. Account auto-suspended. Immediate review required.`,
            }))
          );
        }

        await supabase.from('notifications').insert({
          user_id: recipientId,
          type:    'account_suspended',
          title:   'Account Suspended',
          message: 'Unusual payment activity has been detected on your account. It has been temporarily suspended pending review. Please contact support.',
        });

        logs.push(`Suspended account ${recipientId} — ${senders.size} unique external senders in ${config[CONFIG_KEYS.UNLINKED_TX_WINDOW_HOURS]}h with no linked orders`);
      }
    }
  }

  return NextResponse.json({ success: true, actions: logs });
}