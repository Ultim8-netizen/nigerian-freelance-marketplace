// src/app/api/cron/process-pending-clearances/route.ts
//
// FIX (orphaned RPC, found during final pass): process_pending_clearances()
// exists in your live database (confirmed via the schema export) and is
// explicitly named in this domain's own description as "the clearance cron
// function" — but no route anywhere in this codebase ever calls it. It's a
// database function with no caller. Without this route (and a cron schedule
// entry pointing at it — see the vercel.json note at the bottom of this
// file), every freelancer's wallets.pending_clearance balance accumulates
// forever and never promotes into wallets.balance, regardless of how long
// ago the underlying order was completed. complete_order_with_payment now
// correctly loads pending_clearance (see the migration SQL) — this route is
// the other half: the thing that's supposed to clear it after 7 days.
//
// Mirrors the existing auto-complete-orders cron exactly: CRON_SECRET auth
// guard, service-role client, single RPC call, structured JSON result.

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  // Verify this is a legitimate Vercel Cron invocation — same guard as
  // auto-complete-orders/route.ts.
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc('process_pending_clearances');

  if (error) {
    logger.error('process_pending_clearances cron: RPC error', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }

  // process_pending_clearances() returns TABLE(processed_count integer) —
  // a single-row result set.
  const result = Array.isArray(data) ? data[0] : data;
  const processedCount = result?.processed_count ?? 0;

  logger.info('process_pending_clearances cron: completed', { processedCount });

  return NextResponse.json({
    success:        true,
    processed_count: processedCount,
  });
}

// ── vercel.json ──────────────────────────────────────────────────────────
// Add an entry alongside your existing auto-complete-orders cron, e.g.:
//
//   {
//     "crons": [
//       { "path": "/api/cron/auto-complete-orders",        "schedule": "0 * * * *" },
//       { "path": "/api/cron/process-pending-clearances",   "schedule": "0 * * * *" }
//     ]
//   }
//
// Hourly is a reasonable starting cadence — the underlying business rule is
// a 7-day hold, so running more or less often than hourly has no correctness
// impact, only how promptly clearance happens after the 7-day mark passes.
// I don't have your actual vercel.json, so I can't edit it directly — send
// it if you'd like me to add this entry in place rather than by hand.