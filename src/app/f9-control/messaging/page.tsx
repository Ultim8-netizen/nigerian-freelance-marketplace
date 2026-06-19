// src/app/f9-control/messaging/page.tsx
import { createClient }              from '@/lib/supabase/server';
import { createAdminClient }         from '@/lib/supabase/admin';
import { revalidatePath }            from 'next/cache';
import { MessagingClient }           from './MessagingClient';
import { dispatchNotificationInbox } from '@/lib/notifications/dispatch';
import type { NotificationInsert }   from '@/types';

// ─── Server Actions ───────────────────────────────────────────────────────────

/** Send (or schedule) a direct notification to a single user by email. */
async function sendDirect(fd: FormData) {
  'use server';
  const recipientEmail = (fd.get('recipient_email') as string).trim();
  const type           = fd.get('type')            as string;
  const title          = fd.get('title')           as string;
  const message        = fd.get('message')         as string;
  const link           = (fd.get('link') as string) || null;
  const deliveryMethod = (fd.get('delivery_method') as string) || 'both';

  const rawSchedule = (fd.get('scheduled_at') as string).trim();
  const scheduledAt  = rawSchedule.length > 0
    ? new Date(rawSchedule).toISOString()
    : null;

  const supabase = await createClient();
  const { data: { user: admin }, error: authError } = await supabase.auth.getUser();
  if (authError || !admin) throw new Error('Unauthenticated');

  const { data: recipient, error: lookupError } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', recipientEmail)
    .single();

  if (lookupError || !recipient) throw new Error('Recipient not found');

  const row: NotificationInsert = {
    user_id:         recipient.id,
    type,
    title,
    message,
    link,
    delivery_method: deliveryMethod,
    scheduled_at:    scheduledAt,
  };

  // Gap 1 FIX: select the notification ID back so we can pass it to
  // dispatchNotificationInbox for dispatched_at stamping. Previously the
  // insert discarded the return value and delivery_method was never acted on.
  const { data: insertedNotif, error: insertError } = await supabase
    .from('notifications')
    .insert(row)
    .select('id')
    .single();

  if (insertError) {
    console.error('[sendDirect] notification insert error:', insertError);
    throw new Error('Failed to create notification');
  }

  const scheduleNote = scheduledAt ? ` | scheduled: ${scheduledAt}` : '';
  const { error: logError } = await supabase.from('admin_action_logs').insert({
    admin_id:       admin.id,
    target_user_id: recipient.id,
    action_type:    'direct_message',
    reason:         `[${type}] ${title} | delivery: ${deliveryMethod}${scheduleNote}`,
  });

  if (logError) console.error('[sendDirect] audit log error:', logError);

  // Gap 1 FIX: dispatch the inbox leg for immediate sends.
  // Fire-and-forget (void) — does not block the server action response.
  // dispatchNotificationInbox is a no-op for delivery_method='in_app'
  // and for future-dated scheduled sends (cron at /api/cron/notifications
  // handles those). adminClient is required because the inbox message
  // INSERT must bypass RLS (sender = platform system user, not admin).
  if (insertedNotif) {
    void dispatchNotificationInbox({
      adminClient:    createAdminClient(),
      userId:         recipient.id,
      message,
      deliveryMethod,
      scheduledAt,
      notificationId: insertedNotif.id,
    });
  }

  revalidatePath('/f9-control/messaging');
}

/**
 * Broadcast (or schedule) a notification to a filtered audience segment.
 *
 * Supported audience values and their filter logic:
 *   all        — all active users (no extra filter)
 *   freelancer — active users with user_type = 'freelancer'
 *   client     — active users with user_type = 'client'
 *   both       — active users with user_type = 'both'
 *   inactive   — active users with no device activity for > inactive_days
 *                (pre-queried from user_devices.last_seen_at)
 *   low_trust  — active users with trust_score < trust_threshold
 *   unverified — active users with identity_verified IS NULL OR = false
 *   state      — active users in user_locations.state, optionally by city
 */
async function sendBroadcast(fd: FormData) {
  'use server';
  const audience       = (fd.get('audience')        as string) || 'all';
  const type           = fd.get('type')             as string;
  const title          = fd.get('title')            as string;
  const message        = fd.get('message')          as string;
  const link           = (fd.get('link') as string) || null;
  const deliveryMethod = (fd.get('delivery_method') as string) || 'both';

  const rawSchedule = (fd.get('scheduled_at') as string).trim();
  const scheduledAt  = rawSchedule.length > 0
    ? new Date(rawSchedule).toISOString()
    : null;

  const trustThreshold = parseInt((fd.get('trust_threshold') as string) || '40', 10);
  const targetState    = (fd.get('state') as string) || null;
  const rawCity        = (fd.get('city') as string | null) ?? '';
  const targetCity     = rawCity.trim().length > 0 ? rawCity.trim() : null;
  const inactiveDays   = parseInt((fd.get('inactive_days') as string) || '30', 10);

  const supabase = await createClient();
  const { data: { user: admin }, error: authError } = await supabase.auth.getUser();
  if (authError || !admin) throw new Error('Unauthenticated');

  // ── Pre-filter: segments that require a join query ──────────────────────

  let preFilteredIds: string[] | null = null;

  if (audience === 'inactive') {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - inactiveDays);

    const { data: staleDevices, error: staleErr } = await supabase
      .from('user_devices')
      .select('user_id')
      .lt('last_seen_at', cutoff.toISOString())
      .not('user_id', 'is', null);

    if (staleErr) {
      console.error('[sendBroadcast] inactive stale-device query error:', staleErr);
      throw new Error('Failed to resolve inactive segment');
    }

    const { data: activeDevices, error: activeErr } = await supabase
      .from('user_devices')
      .select('user_id')
      .gte('last_seen_at', cutoff.toISOString())
      .not('user_id', 'is', null);

    if (activeErr) {
      console.error('[sendBroadcast] inactive active-device query error:', activeErr);
      throw new Error('Failed to resolve inactive segment');
    }

    const activeSet = new Set(
      (activeDevices ?? []).map((d) => d.user_id).filter(Boolean) as string[]
    );

    preFilteredIds = [
      ...new Set(
        (staleDevices ?? [])
          .map((d) => d.user_id)
          .filter((id): id is string => !!id && !activeSet.has(id))
      ),
    ];

    if (preFilteredIds.length === 0) throw new Error('No inactive users found for the given window');
  }

  if (audience === 'state' && targetState) {
    let locationQuery = supabase
      .from('user_locations')
      .select('user_id')
      .eq('state', targetState);

    if (targetCity) locationQuery = locationQuery.eq('city', targetCity);

    const { data: locationRows, error: locErr } = await locationQuery;

    if (locErr) {
      console.error('[sendBroadcast] state location query error:', locErr);
      throw new Error('Failed to resolve state segment');
    }

    preFilteredIds = [
      ...new Set(
        (locationRows ?? []).map((l) => l.user_id).filter(Boolean) as string[]
      ),
    ];

    const locationLabel = targetCity ? `${targetCity}, ${targetState}` : targetState;
    if (preFilteredIds.length === 0) throw new Error(`No users found in ${locationLabel}`);
  }

  // ── Main profiles query ─────────────────────────────────────────────────

  let recipientQuery = supabase
    .from('profiles')
    .select('id')
    .eq('account_status', 'active')
    .limit(500);

  switch (audience) {
    case 'freelancer':
    case 'client':
    case 'both':
      recipientQuery = recipientQuery.eq('user_type', audience);
      break;

    case 'inactive':
    case 'state':
      recipientQuery = recipientQuery.in('id', preFilteredIds!);
      break;

    case 'low_trust':
      recipientQuery = recipientQuery.lt('trust_score', trustThreshold);
      break;

    case 'unverified':
      // identity_verified is boolean | null. New registrations have NULL.
      // .eq(false) silently excludes them — .or() captures both correctly.
      recipientQuery = recipientQuery.or(
        'identity_verified.is.null,identity_verified.eq.false'
      );
      break;

    case 'all':
    default:
      break;
  }

  const { data: recipients, error: recipientsError } = await recipientQuery;

  if (recipientsError) {
    console.error('[sendBroadcast] recipient query error:', recipientsError);
    throw new Error('Failed to fetch recipients');
  }
  if (!recipients || recipients.length === 0) throw new Error('No recipients found');

  const rows: NotificationInsert[] = recipients.map((r) => ({
    user_id:         r.id,
    type,
    title,
    message,
    link,
    delivery_method: deliveryMethod,
    scheduled_at:    scheduledAt,
  }));

  // Gap 1 FIX: select 'id, user_id' back from the bulk insert so we can
  // pass each notification's ID to dispatchNotificationInbox for
  // dispatched_at stamping. Previously the insert discarded the return
  // value and delivery_method was never acted on for broadcasts.
  const { data: insertedRows, error: insertError } = await supabase
    .from('notifications')
    .insert(rows)
    .select('id, user_id');

  if (insertError) {
    console.error('[sendBroadcast] bulk insert error:', insertError);
    throw new Error('Failed to insert broadcast notifications');
  }

  const locationLabel = audience === 'state'
    ? targetCity ? `${targetCity}, ${targetState}` : targetState ?? 'unknown state'
    : null;

  const scheduleNote  = scheduledAt ? ` | scheduled: ${scheduledAt}` : '';
  const audienceLabel = locationLabel ? `state: ${locationLabel}` : audience;

  const { error: logError } = await supabase.from('admin_action_logs').insert({
    admin_id:       admin.id,
    target_user_id: null,
    action_type:    'broadcast',
    reason:
      `[${type}] ${title} → audience: ${audienceLabel} ` +
      `(${recipients.length} users) | delivery: ${deliveryMethod}${scheduleNote}`,
  });

  if (logError) console.error('[sendBroadcast] audit log error:', logError);

  // Gap 1 FIX: dispatch inbox leg for all recipients on immediate sends.
  // Promise.allSettled: a single failure does not block other recipients.
  // dispatchNotificationInbox is a no-op for delivery_method='in_app' and
  // for future-dated sends, so scheduled broadcasts cost zero extra work here.
  //
  // NOTE: For audiences consistently > 100 users with delivery_method='inbox'
  // or 'both' and no scheduledAt, consider offloading to a queue/worker
  // to avoid serverless timeout limits. The 500-recipient cap provides an
  // upper bound per action at current scale.
  if (insertedRows && insertedRows.length > 0) {
    const adminClient = createAdminClient();
    await Promise.allSettled(
      insertedRows.map((row) => {
        if (!row.user_id) return Promise.resolve();
        return dispatchNotificationInbox({
          adminClient,
          userId:         row.user_id,
          message,
          deliveryMethod,
          scheduledAt,
          notificationId: row.id,
        });
      })
    );
  }

  revalidatePath('/f9-control/messaging');
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminMessagingPage() {
  const supabase = await createClient();
  const { data: { user: admin } } = await supabase.auth.getUser();

  const now = new Date().toISOString();

  const { data: inbox } = await supabase
    .from('notifications')
    .select('id, type, title, message, is_read, created_at, scheduled_at, delivery_method')
    .eq('user_id', admin?.id ?? '')
    .or(`scheduled_at.is.null,scheduled_at.lte.${now}`)
    .order('created_at', { ascending: false })
    .limit(30);

  const { data: sentLog } = await supabase
    .from('admin_action_logs')
    .select('id, action_type, reason, created_at, target_user_id')
    .in('action_type', ['broadcast', 'direct_message'])
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Messaging</h1>
        <p className="text-sm text-gray-500 mt-1">
          Send direct or broadcast notifications. Optionally schedule delivery for a future time.
          All messages are logged in Admin Action Logs.
        </p>
      </div>

      <MessagingClient
        inbox={inbox ?? []}
        sentLog={sentLog ?? []}
        onSendDirect={sendDirect}
        onSendBroadcast={sendBroadcast}
      />
    </div>
  );
}