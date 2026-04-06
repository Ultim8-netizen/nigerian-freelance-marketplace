// src/app/f9-control/messaging/page.tsx
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { MessagingClient } from './MessagingClient';
import type { Database } from '@/types';

// ─── Extended insert type ─────────────────────────────────────────────────────
// Covers the two columns added by migration:
//   ALTER TABLE public.notifications
//     ADD COLUMN scheduled_at   TIMESTAMPTZ,
//     ADD COLUMN delivery_method TEXT NOT NULL DEFAULT 'both';
// Remove this extension and regenerate database.types.ts once the migration is applied.

type NotificationInsertExtended = Database['public']['Tables']['notifications']['Insert'] & {
  scheduled_at?:    string | null;
  delivery_method?: string;
};

// ─── Server Actions ───────────────────────────────────────────────────────────

/** Send (or schedule) a direct notification to a single user, looked up by email. */
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

  const row: NotificationInsertExtended = {
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
    .insert(row as unknown as Database['public']['Tables']['notifications']['Insert']);

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
 *                (profiles has no last_seen_at; the authoritative column is
 *                 user_devices.last_seen_at — schema-verified)
 *   low_trust  — active users with trust_score < `trust_threshold`
 *   unverified — active users who have not completed identity verification
 *   state      — active users whose user_locations.state matches `state`
 *                (profiles has no state column; geography lives in the
 *                 user_locations table — schema-verified)
 *
 * Audience-specific FormData fields (appended by MessagingClient):
 *   trust_threshold  (number, default 40)  — used by low_trust
 *   state            (string)              — used by state
 *   inactive_days    (number, default 30)  — used by inactive
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

  // Audience-specific filter values
  const trustThreshold = parseInt((fd.get('trust_threshold') as string) || '40', 10);
  const targetState    = (fd.get('state') as string) || null;
  const inactiveDays   = parseInt((fd.get('inactive_days') as string) || '30', 10);

  const supabase = await createClient();
  const { data: { user: admin }, error: authError } = await supabase.auth.getUser();
  if (authError || !admin) throw new Error('Unauthenticated');

  // ── Resolve recipient IDs for segments that require a pre-query ─────────────
  //
  // Two segments cannot be resolved with a simple profiles column filter because
  // the relevant columns do not exist on the profiles table:
  //
  //   inactive → user_devices.last_seen_at  (profiles has no last_seen_at)
  //   state    → user_locations.state       (profiles has location: string | null,
  //                                          which is free-text, not a state enum)
  //
  // Strategy: pre-query the owning table, collect profile UUIDs, then apply
  // .in('id', ids) on the main profiles query. Both tables have a user_id FK
  // to profiles and are schema-verified in database.types.ts.

  let preFilteredIds: string[] | null = null; // null = no pre-filter needed

  if (audience === 'inactive') {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - inactiveDays);

    // user_devices.last_seen_at: string | null (schema-verified)
    // A user may have multiple device rows; we want the ones whose MOST RECENT
    // device activity is still before the cutoff. Selecting distinct user_ids
    // whose every device row is old is non-trivial in a single Supabase query,
    // so we take the pragmatic approach: select all user_ids that appear in
    // user_devices with last_seen_at < cutoff, then exclude any whose user_id
    // also appears with last_seen_at >= cutoff (active on at least one device).
    // Implemented as two queries + set subtraction.

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
    // user_locations.state: string (NOT NULL, schema-verified)
    // user_locations has a 1:1 FK to profiles (user_locations_user_id_fkey).

    const { data: locationRows, error: locErr } = await supabase
      .from('user_locations')
      .select('user_id')
      .eq('state', targetState);

    if (locErr) {
      console.error('[sendBroadcast] state location query error:', locErr);
      throw new Error('Failed to resolve state segment');
    }

    preFilteredIds = [
      ...new Set(
        (locationRows ?? []).map((l) => l.user_id).filter(Boolean) as string[]
      ),
    ];

    if (preFilteredIds.length === 0) {
      throw new Error(`No users found in state: ${targetState}`);
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
      // Pre-filter IDs resolved above; apply them here.
      // preFilteredIds is guaranteed non-null and non-empty at this point.
      recipientQuery = recipientQuery.in('id', preFilteredIds!);
      break;

    case 'low_trust':
      // trust_score is nullable; .lt() naturally excludes NULL rows,
      // which is correct (NULL = unscored, not low-trust).
      recipientQuery = recipientQuery.lt('trust_score', trustThreshold);
      break;

    case 'unverified':
      // Target users who have not completed identity verification.
      recipientQuery = recipientQuery.eq('identity_verified', false);
      break;

    case 'all':
    default:
      // No additional filter; active status already applied above.
      break;
  }

  const { data: recipients, error: recipientsError } = await recipientQuery;

  if (recipientsError) {
    console.error('[sendBroadcast] recipient query error:', recipientsError);
    throw new Error('Failed to fetch recipients');
  }
  if (!recipients || recipients.length === 0) throw new Error('No recipients found');

  const rows: NotificationInsertExtended[] = recipients.map((r) => ({
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
    .insert(rows as unknown as Database['public']['Tables']['notifications']['Insert'][]);

  if (insertError) {
    console.error('[sendBroadcast] bulk insert error:', insertError);
    throw new Error('Failed to insert broadcast notifications');
  }

  const scheduleNote = scheduledAt ? ` | scheduled: ${scheduledAt}` : '';
  const { error: logError } = await supabase.from('admin_action_logs').insert({
    admin_id:       admin.id,
    target_user_id: null,
    action_type:    'broadcast',
    reason:         `[${type}] ${title} → audience: ${audience} (${recipients.length} users) | delivery: ${deliveryMethod}${scheduleNote}`,
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