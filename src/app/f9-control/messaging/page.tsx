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
 *   inactive   — active users whose last_seen_at is older than `inactive_days` days
 *   low_trust  — active users with trust_score < `trust_threshold`
 *   unverified — active users who have not completed identity verification
 *   state      — active users whose profile state matches `state`
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

  // Base query — always select only active accounts unless the segment overrides
  // (inactive targets active accounts that have gone dormant, not suspended/banned ones)
  let recipientQuery = supabase
    .from('profiles')
    .select('id')
    .eq('account_status', 'active')
    .limit(500);

  switch (audience) {
    case 'freelancer':
    case 'client':
    case 'both':
      // Filter by role; active status already applied above
      recipientQuery = recipientQuery.eq('user_type', audience);
      break;

    case 'inactive': {
      // Users who have not been seen for at least `inactiveDays` days.
      // Relies on profiles.last_seen_at — verify column name against database.types.ts.
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - inactiveDays);
      recipientQuery = recipientQuery.lt('last_seen_at', cutoff.toISOString());
      break;
    }

    case 'low_trust':
      // trust_score is nullable; .lt() will naturally exclude NULL rows,
      // which is the correct behaviour (NULL score = unscored, not low).
      recipientQuery = recipientQuery.lt('trust_score', trustThreshold);
      break;

    case 'unverified':
      // Target users who have not completed identity verification.
      // Adjust the column(s) to match the intended definition of "unverified"
      // in your spec (e.g. swap for email_verified if preferred).
      recipientQuery = recipientQuery.eq('identity_verified', false);
      break;

    case 'state':
      // Relies on profiles.state — verify column name against database.types.ts.
      if (targetState) {
        recipientQuery = recipientQuery.eq('state', targetState);
      }
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