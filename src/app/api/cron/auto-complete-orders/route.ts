// src/app/api/cron/auto-complete-orders/route.ts
// Vercel Cron job: auto-completes delivered orders that have not been reviewed
// within 7 days. Called by Vercel Cron via vercel.json (e.g. every hour).
//
// Uses complete_order_with_payment RPC with rating=5 and an explicit
// "Auto-approved" review string — industry-standard behaviour (mirrors Fiverr).
// This is transparent: the client_review text makes auto-completion auditable.
//
// Uses createServiceClient() (service role) because RLS would block
// cross-user reads in a cron context.

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

interface CompletionResult {
  success: boolean;
  error?: string;
  amount_clearing?: number;
}

export async function POST(request: NextRequest) {
  // Verify this is a legitimate Vercel Cron invocation
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Find all delivered orders where the 7-day review window has expired
  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: staleOrders, error: queryError } = await supabase
    .from('orders')
    .select('id, title, freelancer_id, freelancer_earnings')
    .eq('status', 'delivered')
    .lt('delivered_at', sevenDaysAgo);

  if (queryError) {
    logger.error('Auto-complete cron: query error', queryError);
    return NextResponse.json(
      { success: false, error: 'Query failed' },
      { status: 500 }
    );
  }

  if (!staleOrders || staleOrders.length === 0) {
    logger.info('Auto-complete cron: no stale orders found');
    return NextResponse.json({ success: true, processed: 0 });
  }

  logger.info(`Auto-complete cron: processing ${staleOrders.length} orders`);

  const results = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    errors: [] as Array<{ orderId: string; error: string }>,
  };

  for (const order of staleOrders) {
    results.processed++;

    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      'complete_order_with_payment',
      {
        p_order_id: order.id,
        // Rating 5 = auto-approved; review text makes this auditable
        p_client_rating: 5,
        p_client_review: 'Auto-approved: review period expired after 7 days',
        p_communication_rating: null,
        p_quality_rating: null,
        p_professionalism_rating: null,
      }
    );

    if (rpcError) {
      logger.error('Auto-complete RPC error', rpcError, { orderId: order.id });
      results.failed++;
      results.errors.push({ orderId: order.id, error: rpcError.message });
      continue;
    }

    const result = rpcResult as CompletionResult;

    if (!result?.success) {
      const errMsg = result?.error ?? 'RPC returned success=false';
      logger.warn('Auto-complete RPC returned failure', {
        orderId: order.id,
        error: errMsg,
      });
      results.failed++;
      results.errors.push({ orderId: order.id, error: errMsg });
      continue;
    }

    results.succeeded++;
    logger.info('Order auto-completed', {
      orderId: order.id,
      freelancerId: order.freelancer_id,
      amountClearing: result.amount_clearing,
    });
  }

  return NextResponse.json({
    success: true,
    ...results,
  });
}