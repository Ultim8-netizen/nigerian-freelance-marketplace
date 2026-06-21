// src/app/api/admin/automation/cron/route.ts
//
// FIX: sendFraudAlertEmail (src/lib/email/admin-alert.ts) was documented as
//   "Called from: this file (Rule 3)" but was never imported or called here.
//   The file existed as dead code. Wired into Rule 3 so admins receive an
//   out-of-band email alert when a wallet is auto-frozen for suspicious
//   unlinked inflow — the in-app notification alone is insufficient since
//   the admin may not be looking at the panel.
//
// All other rules are unchanged from the previous version.

import { NextResponse }          from 'next/server';
import { createServiceClient }   from '@/lib/supabase/service';
import { getPlatformConfigs, CONFIG_KEYS } from '@/lib/platform-config';
import { sendF9SystemMessage }   from '@/lib/messaging/system-message';
import { sendFraudAlertEmail }   from '@/lib/email/admin-alert';

export async function POST() {
  const supabase = createServiceClient();
  const logs: string[] = [];

  const config = await getPlatformConfigs(supabase, [
    CONFIG_KEYS.DISPUTE_AUTO_RESOLVE_DAYS,
    CONFIG_KEYS.FREQUENT_DISPUTER_WINDOW_DAYS,
    CONFIG_KEYS.UNLINKED_TX_WINDOW_HOURS,
    CONFIG_KEYS.REFERRAL_PROGRAM_ENABLED,
    CONFIG_KEYS.REFERRAL_REWARD_AMOUNT,
    CONFIG_KEYS.REFERRAL_THRESHOLD_AMOUNT,
    CONFIG_KEYS.REFERRAL_MAX_REWARDS,
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
      logs.push(`[Rule 0] Lifted suspension for user ${userId}`);
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
    console.error('[Rule 1] Error fetching stale disputes:', disputeError);
  }

  if (staleDisputes && staleDisputes.length > 0) {
    for (const dispute of staleDisputes) {
      if (!dispute.order_id) {
        logs.push(`[Rule 1] Skipped dispute ${dispute.id} — no associated order`);
        continue;
      }

      const { data: escrowRow, error: escrowFetchError } = await supabase
        .from('escrow')
        .select('amount')
        .eq('order_id', dispute.order_id)
        .eq('status', 'held')
        .maybeSingle();

      if (escrowFetchError) {
        console.error(`[Rule 1] Escrow fetch error for order ${dispute.order_id}:`, escrowFetchError);
        logs.push(`[Rule 1] Skipped dispute ${dispute.id} — escrow fetch error`);
        continue;
      }

      if (!escrowRow) {
        await supabase
          .from('disputes')
          .update({
            status:           'resolved_client',
            resolution_notes: `Auto-resolved: no activity for ${config[CONFIG_KEYS.DISPUTE_AUTO_RESOLVE_DAYS]} days. Escrow was not in held state at resolution time — no refund issued.`,
          })
          .eq('id', dispute.id);

        logs.push(`[Rule 1] Closed dispute ${dispute.id} — escrow already terminal, no wallet credit`);
        continue;
      }

      const { data: orderRow, error: orderFetchError } = await supabase
        .from('orders')
        .select('client_id')
        .eq('id', dispute.order_id)
        .single();

      if (orderFetchError || !orderRow) {
        console.error(`[Rule 1] Order fetch error for ${dispute.order_id}:`, orderFetchError);
        logs.push(`[Rule 1] Skipped dispute ${dispute.id} — order fetch error`);
        continue;
      }

      const refundAmount = Number(escrowRow.amount);
      const buyerId      = orderRow.client_id;

      const { error: disputeUpdateError } = await supabase
        .from('disputes')
        .update({
          status:           'resolved_client',
          resolution_notes: `Auto-resolved: no activity from either party for ${config[CONFIG_KEYS.DISPUTE_AUTO_RESOLVE_DAYS]} days.`,
        })
        .eq('id', dispute.id);

      if (disputeUpdateError) {
        console.error(`[Rule 1] Dispute update failed for ${dispute.id}:`, disputeUpdateError);
        logs.push(`[Rule 1] FAILED to update dispute ${dispute.id} — skipping`);
        continue;
      }

      const { data: updatedEscrow, error: escrowUpdateError } = await supabase
        .from('escrow')
        .update({ status: 'refunded_to_client' })
        .eq('order_id', dispute.order_id)
        .eq('status', 'held')
        .select('id');

      if (escrowUpdateError || !updatedEscrow || updatedEscrow.length === 0) {
        if (escrowUpdateError) {
          console.error(
            `[Rule 1] Escrow update DB error for order ${dispute.order_id}:`,
            escrowUpdateError,
          );
          logs.push(
            `[Rule 1] Escrow update DB error for dispute ${dispute.id} — ` +
            `no wallet credit issued`,
          );
        } else {
          console.warn(
            `[Rule 1] TOCTOU race detected for order ${dispute.order_id} — ` +
            `escrow was 'held' at read time but 0 rows matched on write. ` +
            `Concurrent complete_order_with_payment likely fired. No wallet credit issued.`,
          );

          await supabase.from('security_logs').insert({
            user_id:     buyerId,
            event_type:  'cron_escrow_race_detected',
            severity:    'info',
            description:
              `Cron Rule 1 detected a TOCTOU race on order ${dispute.order_id} ` +
              `(dispute ${dispute.id}). Escrow was in 'held' state at read time ` +
              `but had already transitioned when the UPDATE was attempted. ` +
              `No duplicate wallet credit was issued. Order likely completed legitimately.`,
          });

          logs.push(
            `[Rule 1] TOCTOU race on dispute ${dispute.id} / order ${dispute.order_id} — ` +
            `escrow no longer 'held', no wallet credit issued (see security_logs)`,
          );
        }

        continue;
      }

      await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', dispute.order_id);

      const { error: walletCreditError } = await supabase.rpc(
        'increment_wallet_balance',
        { p_user_id: buyerId, p_amount: refundAmount }
      );

      if (walletCreditError) {
        console.error(`[Rule 1] Wallet credit failed for buyer ${buyerId}:`, walletCreditError);

        await supabase.from('security_logs').insert({
          user_id:     buyerId,
          event_type:  'manual_credit_required',
          severity:    'high',
          description:
            `Dispute ${dispute.id} auto-resolved: escrow marked 'refunded_to_client' ` +
            `but wallet credit of ₦${refundAmount.toLocaleString('en-NG')} failed. ` +
            `Manual wallet adjustment required. Order: ${dispute.order_id}.`,
        });

        logs.push(
          `[Rule 1] FAILED wallet credit for buyer ${buyerId} — ` +
          `MANUAL CREDIT REQUIRED ₦${refundAmount.toLocaleString('en-NG')} ` +
          `(dispute ${dispute.id})`
        );
        continue;
      }

      await supabase.from('transactions').insert({
        recipient_user_id: buyerId,
        transaction_type:  'refund',
        transaction_ref:   `REFUND-${dispute.id}-${Date.now()}`,
        amount:            refundAmount,
        status:            'completed',
        order_id:          dispute.order_id,
      });

      await supabase.from('notifications').insert({
        user_id: buyerId,
        type:    'dispute_auto_resolved',
        title:   'Dispute Auto-Resolved — Refund Issued',
        message:
          `Your dispute has been automatically resolved in your favour after ` +
          `${config[CONFIG_KEYS.DISPUTE_AUTO_RESOLVE_DAYS]} days of inactivity from both parties. ` +
          `₦${refundAmount.toLocaleString('en-NG')} has been refunded to your F9 wallet.`,
      });

      logs.push(
        `[Rule 1] Auto-resolved dispute ${dispute.id} — ` +
        `refunded ₦${refundAmount.toLocaleString('en-NG')} to buyer ${buyerId}`
      );
    }
  }

  // ─── RULE 1 (cont.): Quality/delivery disputes → escalate ──────────────────

  const { data: qualityDisputes, error: qualityError } = await supabase
    .from('disputes')
    .select('id')
    .eq('status', 'open')
    .lte('last_activity_at', inactivityCutoff)
    .in('reason', ['quality', 'delivery']);

  if (qualityError) {
    console.error('[Rule 1] Error fetching quality/delivery disputes:', qualityError);
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

      logs.push(`[Rule 1] Escalated quality/delivery dispute ${dispute.id} to admin queue`);
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
    console.error('[Rule 2] Error finding frequent disputers:', dispusterError);
  }

  if (frequentDisputers && Array.isArray(frequentDisputers) && frequentDisputers.length > 0) {
    for (const user of frequentDisputers) {
      await supabase.rpc('add_trust_score_event', {
        p_user_id:      user.id,
        p_event_type:   'excessive_disputes',
        p_score_change: -15,
      });

      const advisoryMessage =
        'Your account has initiated an unusually high number of disputes recently. ' +
        'Please review our marketplace guidelines.';

      await Promise.all([
        supabase.from('notifications').insert({
          user_id: user.id,
          type:    'level_1_advisory',
          title:   'Level 1 Advisory Notice',
          message: advisoryMessage,
        }),
        sendF9SystemMessage(supabase, user.id, advisoryMessage),
      ]);

      logs.push(`[Rule 2] Issued Level 1 advisory to user ${user.id}`);
    }
  }

  // ─── RULE 3: 5+ unique senders with no linked orders → freeze wallet + flag ─
  //
  // FIX: sendFraudAlertEmail is now called after the in-app admin notification
  //   so admins receive an out-of-band email alert. Previously this function
  //   existed in src/lib/email/admin-alert.ts but was never imported or called
  //   despite the file's own comment saying it was called from here.

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
    console.error('[Rule 3] Error fetching unlinked transactions:', txError);
  }

  if (unlinkedTx && unlinkedTx.length > 0) {
    const migrationApplied = unlinkedTx.some((tx) => tx.recipient_user_id !== null);

    if (!migrationApplied) {
      console.warn('[Rule 3] Skipped: recipient_user_id not yet populated.');
      logs.push('[Rule 3] Skipped — recipient_user_id not yet populated');
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

        // Freeze wallet only — full account suspension is a separate admin action
        await supabase
          .from('wallets')
          .update({
            is_frozen: true,
            frozen_at: new Date().toISOString(),
          })
          .eq('user_id', recipientId);

        await supabase.from('security_logs').insert({
          user_id:     recipientId,
          event_type:  'suspicious_unlinked_inflow',
          severity:    'critical',
          description: `Received funds from ${senders.size} unique external senders in ${config[CONFIG_KEYS.UNLINKED_TX_WINDOW_HOURS]}h with no corresponding orders. Wallet frozen pending admin review.`,
        });

        // In-app notifications for all active admins
        const { data: adminProfiles } = await supabase
          .from('profiles')
          .select('id, email')
          .eq('user_type', 'admin')
          .eq('account_status', 'active');

        if (adminProfiles && adminProfiles.length > 0) {
          await supabase.from('notifications').insert(
            adminProfiles.map((a) => ({
              user_id: a.id,
              type:    'critical_fraud_alert',
              title:   'Critical: Suspicious Wallet Inflow',
              message: `User ${recipientId} received funds from ${senders.size} unique external senders in ${config[CONFIG_KEYS.UNLINKED_TX_WINDOW_HOURS]}h with no linked orders. Wallet auto-frozen. Immediate review required.`,
            }))
          );

          // FIX: wire sendFraudAlertEmail — out-of-band email alert to all
          //   active admin email addresses. Fire-and-forget (void): a nodemailer
          //   failure must never crash this cron or affect other rules.
          //   The in-app notification above is the durable fallback.
          const adminEmails = adminProfiles
            .map((a) => a.email)
            .filter((e): e is string => Boolean(e));

          void sendFraudAlertEmail(adminEmails, {
            recipientUserId:   recipientId,
            uniqueSenderCount: senders.size,
            windowHours:       config[CONFIG_KEYS.UNLINKED_TX_WINDOW_HOURS],
          });
        }

        await supabase.from('notifications').insert({
          user_id: recipientId,
          type:    'wallet_frozen',
          title:   'Wallet Frozen',
          message: 'Unusual payment activity has been detected on your account. Your wallet has been temporarily frozen pending review. Please contact support.',
        });

        logs.push(`[Rule 3] Frozen wallet for ${recipientId} — ${senders.size} unique external senders in ${config[CONFIG_KEYS.UNLINKED_TX_WINDOW_HOURS]}h with no linked orders`);
      }
    }
  }

  // ─── RULE 4: Auto-release timed withdrawal holds ───────────────────────────

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
      const { error: updateError } = await supabase
        .from('withdrawals')
        .update({ status: 'pending', failure_reason: null })
        .eq('id', hold.id);

      if (updateError) {
        console.error(`[Rule 4] Failed to release hold ${hold.id}:`, updateError);
        logs.push(`[Rule 4] FAILED to release hold ${hold.id} for user ${hold.user_id}`);
        continue;
      }

      const releaseMessage =
        `Your withdrawal of ₦${hold.amount.toLocaleString('en-NG')} has been automatically ` +
        `released from its fraud-prevention hold and is now queued for processing. ` +
        `You will receive the funds within 1-3 business days.`;

      await Promise.all([
        supabase.from('notifications').insert({
          user_id: hold.user_id,
          type:    'withdrawal_released',
          title:   'Withdrawal Hold Released',
          message: releaseMessage,
        }),
        sendF9SystemMessage(supabase, hold.user_id, releaseMessage),
      ]);

      logs.push(`[Rule 4] Released hold ${hold.id} (₦${hold.amount.toLocaleString('en-NG')}) for user ${hold.user_id} → pending`);
    }
  }

  // ─── RULE 5: Scheduled broadcast dispatch ─────────────────────────────────

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
    console.error('[Rule 5] Failed to query scheduled notifications:', scheduleQueryError);
    logs.push('[Rule 5] SKIPPED — query error (migration may not be applied yet)');
  } else if (scheduledRows && scheduledRows.length > 0) {
    const dispatchedAt = new Date().toISOString();

    for (const notif of scheduledRows) {
      if (!notif.user_id) {
        logs.push(`[Rule 5] Skipped notification ${notif.id} — no user_id`);
        continue;
      }

      await sendF9SystemMessage(supabase, notif.user_id, notif.message);

      const { error: stampError } = await supabase
        .from('notifications')
        .update({ dispatched_at: dispatchedAt } as Record<string, unknown>)
        .eq('id', notif.id);

      if (stampError) {
        console.error(`[Rule 5] Failed to stamp dispatched_at for notification ${notif.id}:`, stampError);
        logs.push(`[Rule 5] FAILED to stamp ${notif.id} — may re-fire on next tick`);
      } else {
        logs.push(`[Rule 5] Dispatched scheduled inbox message for notification ${notif.id} → user ${notif.user_id}`);
      }
    }
  } else if (!scheduleQueryError) {
    logs.push('[Rule 5] No scheduled notifications due for dispatch');
  }

  // ─── RULE 6: Process Referral Rewards ─────────────────────────────────────

  const referralEnabled = config[CONFIG_KEYS.REFERRAL_PROGRAM_ENABLED] !== 0;

  if (referralEnabled) {
    const rewardAmount    = config[CONFIG_KEYS.REFERRAL_REWARD_AMOUNT];
    const thresholdAmount = config[CONFIG_KEYS.REFERRAL_THRESHOLD_AMOUNT];
    const maxRewards      = config[CONFIG_KEYS.REFERRAL_MAX_REWARDS];

    type PendingReferralRow = {
      id:          string;
      referrer_id: string;
      referee_id:  string;
    };

    const { data: pendingReferrals, error: refError } = await supabase
      .from('referrals')
      .select('id, referrer_id, referee_id')
      .eq('status', 'pending')
      .limit(50) as { data: PendingReferralRow[] | null; error: unknown };

    if (refError) {
      console.error('[Rule 6] Error fetching pending referrals:', refError);
    } else if (pendingReferrals && pendingReferrals.length > 0) {

      for (const ref of pendingReferrals) {
        const { data: fOrders } = await supabase
          .from('orders')
          .select('amount')
          .or(`client_id.eq.${ref.referee_id},freelancer_id.eq.${ref.referee_id}`)
          .eq('status', 'completed');

        const { data: mOrders } = await supabase
          .from('marketplace_orders')
          .select('subtotal')
          .or(`buyer_id.eq.${ref.referee_id},seller_id.eq.${ref.referee_id}`)
          .eq('status', 'delivered');

        const freelanceTotal  = (fOrders || []).reduce((sum, o) => sum + (o.amount   || 0), 0);
        const marketTotal     = (mOrders || []).reduce((sum, o) => sum + (o.subtotal || 0), 0);
        const aggregateVolume = freelanceTotal + marketTotal;

        if (aggregateVolume < thresholdAmount) {
          continue;
        }

        const { count: rewardCount } = await supabase
          .from('referrals')
          .select('id', { count: 'exact', head: true })
          .eq('referrer_id', ref.referrer_id)
          .eq('status', 'rewarded');

        if ((rewardCount || 0) >= maxRewards) {
          await supabase
            .from('referrals')
            .update({ status: 'capped' })
            .eq('id', ref.id);

          logs.push(`[Rule 6] Referral ${ref.id} capped for referrer ${ref.referrer_id} (max ${maxRewards} rewards reached)`);
          continue;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: success, error: rpcError } = await (supabase as any).rpc(
          'process_referral_reward',
          {
            p_referral_id:   ref.id,
            p_referrer_id:   ref.referrer_id,
            p_reward_amount: rewardAmount,
          }
        ) as { data: boolean | null; error: unknown };

        if (rpcError || !success) {
          console.error(`[Rule 6] RPC failed for referral ${ref.id}:`, rpcError);
          logs.push(`[Rule 6] FAILED RPC for referral ${ref.id} (referrer ${ref.referrer_id}) — will retry next tick`);
          continue;
        }

        await supabase.from('notifications').insert({
          user_id: ref.referrer_id,
          type:    'milestone',
          title:   'Referral Bonus Unlocked! 🎉',
          message: `A user you referred just hit their transaction milestone. ₦${rewardAmount.toLocaleString('en-NG')} has been credited to your wallet!`,
        });

        logs.push(`[Rule 6] Rewarded referrer ${ref.referrer_id} ₦${rewardAmount.toLocaleString('en-NG')} for referee ${ref.referee_id} (referral ${ref.id})`);
      }
    } else if (!refError) {
      logs.push('[Rule 6] No pending referrals to process');
    }
  } else {
    logs.push('[Rule 6] Referral program is currently disabled via platform_config.');
  }

  return NextResponse.json({ success: true, actions: logs });
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function liftedIds_from(rows: { lifted_user_id: string }[]): string[] {
  return rows.map((r) => r.lifted_user_id);
}