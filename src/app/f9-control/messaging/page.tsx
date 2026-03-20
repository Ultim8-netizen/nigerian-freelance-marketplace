import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { MessagingClient } from './MessagingClient';

// ─── Server Actions ───────────────────────────────────────────────────────────

/** Send a direct notification to a single user, looked up by email. */
async function sendDirect(fd: FormData) {
  'use server';
  const recipientEmail = (fd.get('recipient_email') as string).trim();
  const type    = fd.get('type')    as string;
  const title   = fd.get('title')   as string;
  const message = fd.get('message') as string;
  const link    = (fd.get('link') as string) || null;

  const supabase = await createClient();
  const { data: { user: admin } } = await supabase.auth.getUser();
  if (!admin) throw new Error('Unauthenticated');

  // Look up recipient by email — profiles.email is a real column
  const { data: recipient, error: lookupError } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', recipientEmail)
    .single();

  if (lookupError || !recipient) throw new Error('Recipient not found');

  await supabase.from('notifications').insert({
    user_id: recipient.id,
    type,
    title,
    message,
    link,
  });

  // Audit trail
  await supabase.from('admin_action_logs').insert({
    admin_id:       admin.id,
    target_user_id: recipient.id,
    action_type:    'direct_message',
    reason:         `[${type}] ${title}`,
  });

  revalidatePath('/f9-control/messaging');
}

/**
 * Broadcast a notification to all users, or filtered by user_type.
 * Inserts are batched in a single call.  Capped at 500 recipients.
 */
async function sendBroadcast(fd: FormData) {
  'use server';
  const audience = (fd.get('audience') as string) || 'all';
  const type     = fd.get('type')    as string;
  const title    = fd.get('title')   as string;
  const message  = fd.get('message') as string;
  const link     = (fd.get('link') as string) || null;

  const supabase = await createClient();
  const { data: { user: admin } } = await supabase.auth.getUser();
  if (!admin) throw new Error('Unauthenticated');

  let recipientQuery = supabase
    .from('profiles')
    .select('id')
    .eq('account_status', 'active')
    .limit(500);

  if (audience !== 'all') {
    recipientQuery = recipientQuery.eq('user_type', audience);
  }

  const { data: recipients } = await recipientQuery;
  if (!recipients || recipients.length === 0) throw new Error('No recipients found');

  const rows = recipients.map((r) => ({
    user_id: r.id,
    type,
    title,
    message,
    link,
  }));

  await supabase.from('notifications').insert(rows);

  await supabase.from('admin_action_logs').insert({
    admin_id:       admin.id,
    target_user_id: null,
    action_type:    'broadcast',
    reason:         `[${type}] ${title} → audience: ${audience} (${recipients.length} users)`,
  });

  revalidatePath('/f9-control/messaging');
}

// ─── Data fetches ─────────────────────────────────────────────────────────────

export default async function AdminMessagingPage() {
  const supabase = await createClient();
  const { data: { user: admin } } = await supabase.auth.getUser();

  // Inbox — notifications received by the admin account
  const { data: inbox } = await supabase
    .from('notifications')
    .select('id, type, title, message, is_read, created_at')
    .eq('user_id', admin?.id ?? '')
    .order('created_at', { ascending: false })
    .limit(30);

  // Broadcast history — recent admin_action_logs of type 'broadcast' or 'direct_message'
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
          Send direct or broadcast notifications. All messages are logged in Admin Action Logs.
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