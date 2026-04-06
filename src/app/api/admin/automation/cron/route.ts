// src/app/api/admin/automation/cron/route.ts
// FIX: Rule 1 dispute inactivity check now uses disputes.last_activity_at
//      instead of created_at — see original file header for full rationale.
// NEW: Rule 4 — Auto-release timed withdrawal holds.
//      Queries withdrawals WHERE status='held' AND hold_release_at IS NOT NULL
//      AND hold_release_at <= now(). For each row found:
//        1. Updates status → 'pending' and clears failure_reason.
//        2. Fires dual-channel notification: notifications row + F9 inbox
//           message via sendF9SystemMessage() (same pattern as earnings page).
//      Rows where hold_release_at IS NULL (Check 0 / admin-gate holds) are
//      never touched — they require explicit admin approval.
//      The sync_wallet_on_withdrawal AFTER UPDATE trigger only fires when
//      NEW.status = 'completed', so promoting 'held' → 'pending' is
//      wallet-safe and causes no premature balance deduction.
// NEW: Rule 5 — Scheduled broadcast dispatch.
//      Finds notifications WHERE scheduled_at IS NOT NULL
//        AND scheduled_at <= now()
//        AND dispatched_at IS NULL
//        AND delivery_method IN ('inbox', 'both')
//      For each row: fires sendF9SystemMessage() then stamps dispatched_at.
//      delivery_method='in_app' rows are excluded — the in-app bell already
//      filters by scheduled_at <= now(), making cron dispatch unnecessary for
//      that channel. dispatched_at IS NOT NULL rows are excluded to guarantee
//      idempotency across repeated cron runs.
//      Requires migration: migrations/20260406_add_notification_dispatched_at.sql

import { NextResponse }        from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getPlatformConfigs, CONFIG_KEYS } from '@/lib/platform-config';
import { sendF9SystemMessage } from '@/lib/messaging/system-message';

export async function POST() {
  const supabase = createServiceClient();
  const logs: string[] = [];

  const config = await getPlatformConfigs(supabase, [
    CONFIG_KEYS.DISPUTE_AUTO_RESOLVE_DAYS,
    CONFIG_KEYS.FREQUENT_DISPUTER_WINDOW_DAYS,
    CONFIG_KEYS.UNLINKED_TX_WINDOW_HOURS,
  ]);

  // ─── RULE 0: Lift expired timed suspensions ────────────────────────────────

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

  const disputeWindowMs  = config[CONFIG_KEYS.DISPUTE_AUTO_RESOLVE_DAYS] * 24 * 60 * 60 * 1000;
  const inactivityCutoff = new Date(Date.now() - disputeWindowMs).toISOString();

  const { data: staleDisputes, error: disputeError } = await supabase
    .from('disputes')
    .select('id, order_id')
    .eq('status', 'open')
    .lte('last_activity_at', inactivityCutoff)
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

  const { data: qualityDisputes, error: qualityError } = await supabase
    .from('disputes')
    .select('id')
    .eq('status', 'open')
    .lte('last_activity_at', inactivityCutoff)
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

  // ─── RULE 2: Frequent disputers ───────────────────────────────────────────

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

  // ─── RULE 4: Auto-release timed withdrawal holds ───────────────────────────
  //
  // Condition: status='held' AND hold_release_at IS NOT NULL AND
  //            hold_release_at <= now()
  //
  // hold_release_at is written at withdrawal creation time in
  // earnings/page.tsx initiateWithdrawal():
  //   Check 0 (gate threshold) → NULL   ← never matched here; admin-only
  //   Check 1 (wallet funded)  → +24h   ← matched and released
  //   Check 2 (bank details)   → +24h   ← matched and released
  //   Check 3 (trust 40–59)    → +48h   ← matched and released
  //
  // Action per row:
  //   1. Update status → 'pending', clear failure_reason.
  //      The sync_wallet_on_withdrawal trigger only fires on status='completed',
  //      so this update is wallet-safe — no premature balance deduction.
  //   2. Dual-channel notification: notifications row + F9 inbox message.

  type HeldWithdrawalRow = {
    id:      string;
    user_id: string;
    amount:  number;
  };

  const { data: expiredHolds, error: holdsError } = await supabase
    .from('withdrawals')
    .select('id, user_id, amount')
    .eq('status', 'held')
    .not('hold_release_at', 'is', null)
    .lte('hold_release_at', new Date().toISOString()) as {
      data: HeldWithdrawalRow[] | null;
      error: unknown;
    };

  if (holdsError) {
    console.error('[Rule 4] Error fetching expired holds:', holdsError);
  }

  if (expiredHolds && expiredHolds.length > 0) {
    for (const hold of expiredHolds) {
      // ── 1. Promote to pending ─────────────────────────────────────────────
      const { error: updateError } = await supabase
        .from('withdrawals')
        .update({
          status:         'pending',
          failure_reason: null,
        })
        .eq('id', hold.id);

      if (updateError) {
        console.error(`[Rule 4] Failed to release hold ${hold.id}:`, updateError);
        logs.push(`Rule 4: FAILED to release hold ${hold.id} for user ${hold.user_id}`);
        continue;
      }

      // ── 2. Dual-channel notification ──────────────────────────────────────
      const releaseMessage =
        `Your withdrawal of ₦${hold.amount.toLocaleString('en-NG')} has been automatically ` +
        `released from its fraud-prevention hold and is now queued for processing. ` +
        `You will receive the funds within 1–3 business days.`;

      await Promise.all([
        supabase.from('notifications').insert({
          user_id: hold.user_id,
          type:    'withdrawal_released',
          title:   'Withdrawal Hold Released',
          message: releaseMessage,
        }),
        sendF9SystemMessage(supabase, hold.user_id, releaseMessage),
      ]);

      logs.push(
        `Rule 4: Released hold on withdrawal ${hold.id} ` +
        `(₦${hold.amount.toLocaleString('en-NG')}) for user ${hold.user_id} → pending`
      );
    }
  }

  // ─── RULE 5: Scheduled broadcast dispatch ─────────────────────────────────
  //
  // Fires the F9 inbox leg of scheduled notifications whose delivery time has
  // arrived but whose inbox message has not yet been sent.
  //
  // WHY ONLY 'inbox' AND 'both':
  //   delivery_method='in_app' — the notification bell UI already filters by
  //     scheduled_at <= now(), so in-app delivery is self-executing. No cron
  //     action is needed or safe (inserting a second row would duplicate the bell
  //     notification).
  //   delivery_method='inbox' or 'both' — the F9 inbox message is a row in the
  //     messages table delivered via sendF9SystemMessage(). That insertion cannot
  //     happen at authoring time (scheduled_at is in the future) and must happen
  //     here, exactly once, when the window arrives.
  //
  // IDEMPOTENCY:
  //   dispatched_at IS NULL is the eligibility gate. After successful delivery
  //   the column is stamped to now(). Repeated cron runs will never re-fire a
  //   row whose dispatched_at is set, regardless of how many times the cron
  //   executes within the same minute.
  //
  //   If sendF9SystemMessage fails (logged internally, never throws), we still
  //   stamp dispatched_at. The inbox message is best-effort; the notification
  //   bell row is the durable record. A failed inbox message is preferable to
  //   an infinite retry loop that spam-delivers to the user.
  //
  // REQUIRES MIGRATION: migrations/20260406_add_notification_dispatched_at.sql
  //   Until applied, the .is('dispatched_at', null) filter will cause a
  //   PostgREST column-not-found error, which is caught below. The rule will
  //   log the error and no-op — it will NOT crash the cron or affect other rules.

  type ScheduledNotifRow = {
    id:              string;
    user_id:         string | null;
    message:         string;
    delivery_method: string | null;
  };

  const { data: scheduledRows, error: scheduleQueryError } = await supabase
    .from('notifications')
    .select('id, user_id, message, delivery_method')
    .not('scheduled_at', 'is', null)
    .lte('scheduled_at', new Date().toISOString())
    .is('dispatched_at', null)
    .in('delivery_method', ['inbox', 'both'])
    .limit(200) as { data: ScheduledNotifRow[] | null; error: unknown };

  if (scheduleQueryError) {
    // Most likely cause pre-migration: column "dispatched_at" does not exist.
    // Log and skip — other rules are unaffected.
    console.error('[Rule 5] Failed to query scheduled notifications:', scheduleQueryError);
    logs.push('Rule 5: SKIPPED — query error (migration may not be applied yet)');
  } else if (scheduledRows && scheduledRows.length > 0) {
    const dispatchedAt = new Date().toISOString();

    for (const notif of scheduledRows) {
      if (!notif.user_id) {
        // Broadcast rows with user_id IS NULL should not exist in practice
        // (sendBroadcast always sets user_id per-recipient), but guard anyway.
        logs.push(`Rule 5: Skipped notification ${notif.id} — no user_id`);
        continue;
      }

      // Fire the F9 inbox message. sendF9SystemMessage catches its own errors
      // and never throws — a failure here is logged inside the helper and does
      // not prevent the dispatched_at stamp below.
      await sendF9SystemMessage(supabase, notif.user_id, notif.message);

      // Stamp dispatched_at regardless of inbox delivery success (see IDEMPOTENCY
      // note above). If the UPDATE itself fails, log but do not retry — the next
      // cron tick would re-fire which is the lesser evil compared to silent loss.
      const { error: stampError } = await supabase
        .from('notifications')
        .update({ dispatched_at: dispatchedAt } as Record<string, unknown>)
        .eq('id', notif.id);

      if (stampError) {
        console.error(`[Rule 5] Failed to stamp dispatched_at for notification ${notif.id}:`, stampError);
        logs.push(`Rule 5: FAILED to stamp ${notif.id} — may re-fire on next tick`);
      } else {
        logs.push(`Rule 5: Dispatched scheduled inbox message for notification ${notif.id} → user ${notif.user_id}`);
      }
    }
  } else if (!scheduleQueryError) {
    logs.push('Rule 5: No scheduled notifications due for dispatch');
  }

  return NextResponse.json({ success: true, actions: logs });
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function liftedIds_from(rows: { lifted_user_id: string }[]): string[] {
  return rows.map((r) => r.lifted_user_id);
}