// src/app/api/admin/notifications/route.ts
// Returns unread critical signal counts for the admin notification bell.
//
// Two data sources with different access requirements:
//   contest_tickets (pending) — admin RLS covers this, but going through
//     the API route keeps the component's data-fetching uniform and avoids
//     a second Supabase client init in the browser for this purpose.
//   security_logs (critical/high severity) — no admin RLS policy exists;
//     service role is the only read path for cross-user rows.
//
// "Critical" window: last 24 hours. Older events are considered acknowledged
// at the infrastructure level. This prevents the bell from permanently
// lighting due to historical data.

import { NextResponse }      from 'next/server';
import { createClient }      from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger }            from '@/lib/logger';

export async function GET() {
  try {
    // ── 1. Verify admin session ─────────────────────────────────────────────
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('user_type')
      .eq('id', user.id)
      .single();

    if (!profile || profile.user_type !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    // ── 2. Query both signal sources via admin client ───────────────────────
    const adminClient = createAdminClient();
    const since       = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [securityResult, contestResult] = await Promise.all([
      // Critical and high-severity security events in the last 24 hours.
      // Both severities are included because platform automation writes
      // actionable flags (e.g. shared_device_fingerprint) as 'high'.
      adminClient
        .from('security_logs')
        .select('id', { count: 'exact', head: true })
        .in('severity', ['critical', 'high'])
        .gte('created_at', since),

      // All pending contest tickets (no time bound — every unreviewed
      // ticket is a pending admin action regardless of age).
      adminClient
        .from('contest_tickets')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
    ]);

    if (securityResult.error) {
      logger.error('Admin notifications: security_logs query failed', securityResult.error);
    }
    if (contestResult.error) {
      logger.error('Admin notifications: contest_tickets query failed', contestResult.error);
    }

    return NextResponse.json({
      success:           true,
      criticalSecurity:  securityResult.count  ?? 0,
      pendingContests:   contestResult.count    ?? 0,
    });

  } catch (error) {
    logger.error('Admin notifications route error', error as Error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch notification counts' },
      { status: 500 }
    );
  }
}