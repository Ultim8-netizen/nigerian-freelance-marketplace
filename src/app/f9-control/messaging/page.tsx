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

  // Empty string → send immediately (null); non-empty → ISO timestamp for scheduled delivery
  const rawSchedule = (fd.get('scheduled_at') as string).trim();
  const scheduledAt  = rawSchedule.length > 0
    ? new Date(rawSchedule).toISOString()
    : null;

  const supabase = await createClient();
  const { data: { user: admin }, error: authError } = await supabase.auth.getUser();
  if (authError || !admin) throw new Error('Unauthenticated');

  // Look up recipient by email — profiles.email is a real column
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
    // Double-cast to satisfy the typed client while migration columns are pending
    .insert(row as unknown as Database['public']['Tables']['notifications']['Insert']);

  if (insertError) {
    console.error('[sendDirect] notification insert error:', insertError);
    throw new Error('Failed to create notification');
  }

  // Audit trail
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
 * Broadcast (or schedule) a notification to all users or a filtered audience.
 * Inserts are batched in a single call. Capped at 500 recipients.
 * When scheduled_at is set, rows are inserted immediately but will not surface
 * in notification queries until scheduled_at <= NOW().
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

  const supabase = await createClient();
  const { data: { user: admin }, error: authError } = await supabase.auth.getUser();
  if (authError || !admin) throw new Error('Unauthenticated');

  let recipientQuery = supabase
    .from('profiles')
    .select('id')
    .eq('account_status', 'active')
    .limit(500);

  if (audience !== 'all') {
    recipientQuery = recipientQuery.eq('user_type', audience);
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

  // Admin inbox — only fetch notifications that are due (scheduled_at <= NOW() or no schedule).
  // Notifications with a future scheduled_at are queued and not yet visible.
  const { data: inbox } = await supabase
    .from('notifications')
    .select('id, type, title, message, is_read, created_at, scheduled_at, delivery_method')
    .eq('user_id', admin?.id ?? '')
    .or(`scheduled_at.is.null,scheduled_at.lte.${now}`)
    .order('created_at', { ascending: false })
    .limit(30);

  // Broadcast history — recent admin_action_logs for message actions
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