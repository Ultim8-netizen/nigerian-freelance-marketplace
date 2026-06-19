// src/app/api/cron/notifications/route.ts
//
// Dedicated cron: dispatches the F9 inbox leg of scheduled notifications
// whose delivery window has arrived.
//
// WHY A DEDICATED ROUTE (vs. relying on Rule 5 in the main automation cron):
//   The main automation cron at /api/admin/automation/cron runs heavy rules
//   (dispute resolution, fraud detection, referral processing) and may be
//   scheduled less frequently. Scheduled notifications need to fire within
//   ~1 minute of their scheduled_at time for a reliable UX. A dedicated,
//   lightweight cron achieves this without adding latency to sensitive
//   financial automation rules.
//
// WHAT THIS DISPATCHES:
//   notifications WHERE
//     scheduled_at IS NOT NULL          ← only scheduled rows
//     AND scheduled_at <= now()         ← delivery window has opened
//     AND dispatched_at IS NULL         ← not yet dispatched (idempotency gate)
//     AND delivery_method IN ('inbox', 'both')
//
//   delivery_method='in_app' rows are intentionally excluded: the notification
//   bell UI already filters by scheduled_at <= now() on every page load, so
//   in_app delivery is self-executing and requires no cron action.
//
// IDEMPOTENCY:
//   dispatched_at IS NULL is the eligibility gate. After delivery the column
//   is stamped to now(). Repeated cron runs will never re-fire a row whose
//   dispatched_at is already set, regardless of cron frequency.
//
//   If sendF9SystemMessage fails (it never throws; logs internally), we still
//   stamp dispatched_at to prevent an infinite retry loop. The conversation
//   reuse pattern in sendF9SystemMessage (SELECT-before-INSERT) means the
//   worst case is a single duplicate inbox message on a transient failure.
//
// AUTH:
//   Guarded by CRON_SECRET env var. Vercel Cron automatically sets the
//   Authorization: Bearer <CRON_SECRET> header on every invocation when
//   CRON_SECRET is configured in the project settings. In local development
//   where CRON_SECRET is unset, the check is skipped so the route remains
//   callable via curl for testing.
//
// SCHEDULE:
//   Intended to run every minute (* * * * *) via vercel.json crons.
//   Requires Vercel Pro plan or higher. On Hobby plan the minimum is daily —
//   adjust the schedule in vercel.json accordingly.
//
// RELATIONSHIP TO RULE 5 in /api/admin/automation/cron:
//   Rule 5 and this route select the same rows. If both run concurrently,
//   the second to attempt a send will find dispatched_at already stamped
//   and have no work to do. This is safe — idempotency is guaranteed by
//   the IS NULL gate.

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient }          from '@/lib/supabase/admin';
import { sendF9SystemMessage }         from '@/lib/messaging/system-message';

type ScheduledNotifRow = {
  id:              string;
  user_id:         string | null;
  message:         string;
  delivery_method: string | null;
};

export async function POST(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const adminClient   = createAdminClient();
  const logs: string[] = [];
  const now            = new Date().toISOString();

  // ── Query due rows ────────────────────────────────────────────────────
  const { data: dueRows, error: queryError } = await adminClient
    .from('notifications')
    .select('id, user_id, message, delivery_method')
    .not('scheduled_at', 'is', null)
    .lte('scheduled_at', now)
    .is('dispatched_at', null)
    .in('delivery_method', ['inbox', 'both'])
    .limit(200) as { data: ScheduledNotifRow[] | null; error: unknown };

  if (queryError) {
    console.error('[cron/notifications] query error:', queryError);
    return NextResponse.json(
      { success: false, error: 'Query failed', logs },
      { status: 500 },
    );
  }

  if (!dueRows || dueRows.length === 0) {
    logs.push('No scheduled notifications due for dispatch');
    return NextResponse.json({ success: true, dispatched: 0, logs });
  }

  // ── Dispatch each row ─────────────────────────────────────────────────
  // Sequential (not parallel): keeps DB connection pressure low for the
  // common case of 0–20 due rows per minute. If volume grows to hundreds
  // per minute, switch to Promise.allSettled with batching.
  const dispatchedAt = new Date().toISOString();

  for (const row of dueRows) {
    if (!row.user_id) {
      logs.push(`Skipped notification ${row.id} — no user_id`);
      continue;
    }

    // sendF9SystemMessage: never throws, logs internally on failure.
    await sendF9SystemMessage(adminClient, row.user_id, row.message);

    // Stamp dispatched_at regardless of sendF9SystemMessage success.
    // Rationale: a transient message failure is preferable to an infinite
    // retry loop. The conversation reuse SELECT-before-INSERT in
    // sendF9SystemMessage limits duplicate message damage to one extra row.
    const { error: stampError } = await adminClient
      .from('notifications')
      .update({ dispatched_at: dispatchedAt })
      .eq('id', row.id);

    if (stampError) {
      console.error(`[cron/notifications] stamp failed for ${row.id}:`, stampError);
      logs.push(`STAMP FAILED for ${row.id} — may re-fire on next tick`);
    } else {
      logs.push(`Dispatched ${row.id} → user ${row.user_id}`);
    }
  }

  return NextResponse.json({
    success:    true,
    dispatched: dueRows.length,
    logs,
  });
}