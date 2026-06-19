// src/app/f9-control/messaging/page.tsx
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { MessagingClient } from './MessagingClient';
import type { NotificationInsert } from '@/types';

// NotificationInsertExtended was removed. Both `scheduled_at` and
// `delivery_method` already exist in notifications.Insert per database.types.ts.
// The extension type and the `as unknown as Database[...]` cast it required
// were masking type errors and providing no value.

// ─── Server Actions ───────────────────────────────────────────────────────────

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

  const { error: insertError } = await supabase
    .from('notifications')
    .insert(row);

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

  revalidatePath('/f9-control/messaging');
}

/**
 * Broadcast (or schedule) a notification to a filtered audience.
 *
 * Supported audience segments:
 *   all        — all active users
 *   freelancer — active users with user_type = 'freelancer'
 *   client     — active users with user_type = 'client'
 *   both       — active users with user_type = 'both'
 *   inactive   — active users whose most-recent user_devices.last_seen_at is
 *                older than `inactive_days` days
 *   low_trust  — active users with trust_score < `trust_threshold`
 *   unverified — active users who have not completed identity verification
 *                (identity_verified IS NULL OR identity_verified = false)
 *   state      — active users whose user_locations.state matches `state`,
 *                optionally narrowed to a specific `city`
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

  // ── Pre-filter: segments that need a join query ─────────────────────────────

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

    if (preFilteredIds.length === 0) {
      throw new Error('No inactive users found for the given window');
    }
  }

  if (audience === 'state' && targetState) {
    let locationQuery = supabase
      .from('user_locations')
      .select('user_id')
      .eq('state', targetState);

    if (targetCity) {
      locationQuery = locationQuery.eq('city', targetCity);
    }

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
    if (preFilteredIds.length === 0) {
      throw new Error(`No users found in ${locationLabel}`);
    }
  }

  // ── Main profiles query ─────────────────────────────────────────────────────

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
      // trust_score is nullable; .lt() excludes NULL which is correct —
      // NULL means unscored, not low-trust.
      recipientQuery = recipientQuery.lt('trust_score', trustThreshold);
      break;

    case 'unverified':
      // FIX (Error 6): identity_verified is boolean | null. New registrations
      // have NULL (no default on this column); they are the primary target of
      // a verification reminder. .eq('identity_verified', false) silently
      // excluded them. .or() captures both explicit false and NULL rows.
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

  const { error: insertError } = await supabase
    .from('notifications')
    .insert(rows);

  if (insertError) {
    console.error('[sendBroadcast] bulk insert error:', insertError);
    throw new Error('Failed to insert broadcast notifications');
  }

  const locationLabel = audience === 'state'
    ? targetCity
      ? `${targetCity}, ${targetState}`
      : targetState ?? 'unknown state'
    : null;

  const scheduleNote  = scheduledAt ? ` | scheduled: ${scheduledAt}` : '';
  const audienceLabel = locationLabel ? `state: ${locationLabel}` : audience;

  const { error: logError } = await supabase.from('admin_action_logs').insert({
    admin_id:       admin.id,
    target_user_id: null,
    action_type:    'broadcast',
    reason:         `[${type}] ${title} → audience: ${audienceLabel} (${recipients.length} users) | delivery: ${deliveryMethod}${scheduleNote}`,
  });

  if (logError) console.error('[sendBroadcast] audit log error:', logError);

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