import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Note: Secure this endpoint in middleware.ts or via Vercel Cron Secret in production
export async function POST() {
  const supabase = await createClient();
  const logs: string[] = [];

  // ─── RULE 1: Stale dispute auto-resolution ─────────────────────────────────
  // Both parties silent on an open dispute for 7 days → auto-resolve in buyer's favor.
  // EXCEPTION: quality/delivery disputes are NEVER auto-resolved — route to admin queue.
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: staleDisputes, error: disputeError } = await supabase
    .from('disputes')
    .select('id, order_id')
    .eq('status', 'open')
    .lte('created_at', sevenDaysAgo)
    // Exclude quality & delivery claims — these require human admin review
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
            status: 'resolved_client',
            resolution_notes: 'Auto-resolved due to 7 days of inactivity.',
          })
          .eq('id', dispute.id);

        await supabase
          .from('escrow')
          .update({ status: 'refunded_to_client' })
          .eq('order_id', dispute.order_id);

        await supabase
          .from('orders')
          .update({ status: 'refunded' })
          .eq('id', dispute.order_id);

        logs.push(`Auto-resolved dispute ${dispute.id}`);
      } else {
        logs.push(`Skipped dispute ${dispute.id} — no associated order`);
      }
    }
  }

  // ─── Route quality/delivery disputes to admin review queue ────────────────
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
          status: 'pending_admin',
          resolution_notes:
            'Escalated to admin: quality/delivery disputes require manual review.',
        })
        .eq('id', dispute.id);

      logs.push(`Escalated quality/delivery dispute ${dispute.id} to admin queue`);
    }
  }

  // ─── RULE 2: Frequent disputers — Level 1 advisory ────────────────────────
  // 3 disputes initiated in 30 days → dock trust score and send advisory.
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

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
        p_user_id: user.id,
        p_event_type: 'excessive_disputes',
        p_score_change: -15,
      });

      await supabase.from('notifications').insert({
        user_id: user.id,
        type: 'level_1_advisory',
        title: 'Level 1 Advisory Notice',
        message:
          'Your account has initiated an unusually high number of disputes recently. Please review our marketplace guidelines.',
      });

      logs.push(`Issued Level 1 advisory to user ${user.id}`);
    }
  }

  // ─── RULE 3: 5+ unique clients paying one freelancer in 24 h → suspend ────
  //
  // Schema constraints addressed:
  //
  // (a) `transactions` has no sender_id / recipient_id columns — the only table
  //     that records payer → payee relationships is `orders` (client_id / freelancer_id).
  //     We group orders created in the last 24 h by freelancer_id and count
  //     distinct client_ids as the available fraud signal.
  //
  // (b) `wallets` has no `status` column — account lock-down is applied via
  //     `profiles.account_status = 'suspended'`.
  //
  // (c) `security_logs` uses `description` (not `details`).
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: recentOrders, error: ordersError } = await supabase
    .from('orders')
    .select('client_id, freelancer_id')
    .gte('created_at', twentyFourHoursAgo);

  if (ordersError) {
    console.error('Error fetching recent orders for fraud check:', ordersError);
  }

  if (recentOrders && recentOrders.length > 0) {
    // Group distinct client_ids per freelancer_id
    const freelancerMap: Record<string, Set<string>> = {};

    for (const order of recentOrders) {
      if (!order.freelancer_id || !order.client_id) continue;
      if (!freelancerMap[order.freelancer_id]) {
        freelancerMap[order.freelancer_id] = new Set();
      }
      freelancerMap[order.freelancer_id].add(order.client_id);
    }

    for (const [freelancerId, clients] of Object.entries(freelancerMap)) {
      if (clients.size >= 5) {
        // Suspend account — wallets has no status column, suspend via profiles
        await supabase
          .from('profiles')
          .update({ account_status: 'suspended' })
          .eq('id', freelancerId);

        // Critical security event — column is `description`, not `details`
        await supabase.from('security_logs').insert({
          user_id: freelancerId,
          event_type: 'suspicious_inflow',
          severity: 'critical',
          description: `Received payments from ${clients.size} unique clients in 24 h. Account suspended pending review.`,
        });

        await supabase.from('notifications').insert({
          user_id: freelancerId,
          type: 'account_suspended',
          title: 'Account Suspended',
          message:
            'Unusual payment activity has been detected on your account. It has been temporarily suspended. Please contact support.',
        });

        logs.push(
          `Suspended account for user ${freelancerId} — ${clients.size} unique clients in 24 h`
        );
      }
    }
  }

  return NextResponse.json({ success: true, actions: logs });
}