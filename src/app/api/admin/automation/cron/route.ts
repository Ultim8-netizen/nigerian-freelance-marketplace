// src/app/api/admin/automation/cron/route.ts
// FIX: Rule 1 dispute inactivity check previously evaluated .lte('created_at',
//      sevenDaysAgo), which measured elapsed time since the dispute was OPENED,
//      not since either party last communicated. Active disputes with ongoing
//      message exchanges were being force-closed after 7 days regardless of
//      activity — a direct spec violation.
//
//      Fix: filter now uses disputes.last_activity_at, a new TIMESTAMPTZ column
//      maintained by two database triggers:
//
//        trg_dispute_last_activity (BEFORE UPDATE ON disputes)
//          — resets last_activity_at = NOW() on any row update (status change,
//            evidence upload, resolution note, admin action).
//
//        trg_dispute_activity_on_message (AFTER INSERT ON messages)
//          — resets last_activity_at on any open dispute whose order_id matches
//            the order linked to the conversation the message was sent in.
//
//      The migration backfills last_activity_at = created_at for all existing
//      disputes so the column is never NULL and the filter behaves correctly
//      for historical rows from day one.

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getPlatformConfigs, CONFIG_KEYS } from '@/lib/platform-config';

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

  // ─── RULE 0: Lift expired timed suspensions ────────────────────────────────
  //
  // Runs first so a user whose suspension expires today is active again before
  // any fraud rules evaluate their account status.
  //
  // lift_expired_suspensions() is a SECURITY DEFINER function that:
  //   - Matches: account_status='suspended' AND suspended_until <= now()
  //   - Clears:  account_status→'active', suspended_until→NULL,
  //              suspension_reason→NULL
  //   - Returns: the UUIDs of every profile it updated

  const { data: liftedRows, error: liftError } = await supabase
    .rpc('lift_expired_suspensions') as {
      data: { lifted_user_id: string }[] | null;
      error: unknown;
    };

  if (liftError) {
    console.error('[Rule 0] Error lifting expired suspensions:', liftError);
  }

  if (liftedRows && liftedRows.length > 0) {
    const liftedIds = liftedIds_from(liftedRows);

    await supabase.from('notifications').insert(
      liftedIds.map((userId) => ({
        user_id: userId,
        type:    'account_reactivated',
        title:   'Account Suspension Lifted',
        message: 'Your suspension period has ended and your account is now active again. Please review our community guidelines to avoid future restrictions.',
      }))
    );

    await supabase.from('security_logs').insert(
      liftedIds.map((userId) => ({
        user_id:     userId,
        event_type:  'suspension_auto_lifted',
        severity:    'info',
        description: 'Timed suspension expired. Account automatically restored to active by cron.',
      }))
    );

    for (const userId of liftedIds) {
      logs.push(`Lifted suspension for user ${userId} — timed suspension expired`);
    }
  }

  // ─── RULE 1: Stale dispute auto-resolution ─────────────────────────────────
  //
  // "Both parties silent for N days → auto-resolve in buyer's favour."
  //
  // The inactivity clock is disputes.last_activity_at, which is reset by:
  //   • Any UPDATE to the dispute row (trigger: trg_dispute_last_activity)
  //   • Any new message in the conversation linked to the dispute's order
  //     (trigger: trg_dispute_activity_on_message)
  //
  // Using created_at here would close active disputes after N days regardless
  // of whether the parties are still communicating — that is the bug this fix
  // resolves. last_activity_at is backfilled to created_at by the migration
  // so existing rows are never NULL.

  const disputeWindowMs = config[CONFIG_KEYS.DISPUTE_AUTO_RESOLVE_DAYS] * 24 * 60 * 60 * 1000;
  const inactivityCutoff = new Date(Date.now() - disputeWindowMs).toISOString();

  const { data: staleDisputes, error: disputeError } = await supabase
    .from('disputes')
    .select('id, order_id')
    .eq('status', 'open')
    .lte('last_activity_at', inactivityCutoff)          // ← was: created_at
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
            resolution_notes: `Auto-resolved: no activity from either party for ${config[CONFIG_KEYS.DISPUTE_AUTO_RESOLVE_DAYS]} days.`,
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

  // Quality/delivery disputes → admin queue (same inactivity threshold)
  const { data: qualityDisputes, error: qualityError } = await supabase
    .from('disputes')
    .select('id')
    .eq('status', 'open')
    .lte('last_activity_at', inactivityCutoff)          // ← was: created_at
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
  const unlinked_window_ms = config[CONFIG_KEYS.UNLINKED_TX_WINDOW_HOURS] * 60 * 60 * 1000;
  const twentyFourHoursAgo = new Date(Date.now() - unlinked_window_ms).toISOString();

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

// ─── Internal helpers ─────────────────────────────────────────────────────────

function liftedIds_from(rows: { lifted_user_id: string }[]): string[] {
  return rows.map((r) => r.lifted_user_id);
}