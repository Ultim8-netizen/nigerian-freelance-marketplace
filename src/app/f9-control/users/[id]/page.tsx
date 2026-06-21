// src/app/f9-control/users/[id]/page.tsx
//
// FIX (RLS — confirmed against live schema):
//   notifications table has NO INSERT policy for any role. Only SELECT and
//   UPDATE for own user (user_id = auth.uid()). Every server action that
//   inserts a notification for a target user via createClient() (session-
//   scoped, bound by RLS) was silently discarding the row — the insert
//   returned no error (Postgres returns success even when RLS blocks a write
//   on a permissive policy table with no matching policy) but wrote nothing.
//   This meant: warn notifications, suspension notifications, ban
//   notifications, and freeze notifications were all never delivered.
//
//   FIX: use createAdminClient() (service role, bypasses RLS) for every
//   cross-user notification insert and for security_logs inserts.
//   admin_action_logs retains createClient() because it has its own admin
//   ALL policy (user_type='admin') — the session client works there.
//   profiles.update retains createClient() for the same reason.
//
// FIX: await createAdminClient() in banUser was incorrect — createAdminClient
//   is synchronous. Removed the erroneous await.
//
// security_logs also has no INSERT policy (SELECT only for own user). The
//   freezeWallet action's security_log write (event_type='wallet_frozen_by_admin')
//   was silently failing — meaning the NotificationBell, which polls for that
//   specific event_type, would never light up after a manual wallet freeze.
//   Fixed: security_logs.insert in freezeWallet now uses adminClient.

import { notFound }           from 'next/navigation';
import { revalidatePath }     from 'next/cache';
import { createClient }       from '@/lib/supabase/server';
import { createAdminClient }  from '@/lib/supabase/admin';
import { UserProfileTabs }    from './UserProfileTabs';
import Link                   from 'next/link';
import { ChevronLeft }        from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const MODERATOR_MAX_SUSPENSION_DAYS = 30;

const ACTIVE_ORDER_STATUSES = ['pending', 'awaiting_delivery', 'delivered'] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function isActingUserAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  actorId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('profiles')
    .select('user_type')
    .eq('id', actorId)
    .single();
  return data?.user_type === 'admin';
}

async function isTargetAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  targetId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('profiles')
    .select('user_type')
    .eq('id', targetId)
    .single();
  return data?.user_type === 'admin';
}

function computeSuspension(
  durationDays: number,
  isAdmin: boolean,
): { suspendedUntil: string | null; effectiveDays: number | null } {
  if (isAdmin && durationDays === 0) {
    return { suspendedUntil: null, effectiveDays: null };
  }
  const raw = durationDays > 0 ? durationDays : MODERATOR_MAX_SUSPENSION_DAYS;
  const effectiveDays = isAdmin ? raw : Math.min(raw, MODERATOR_MAX_SUSPENSION_DAYS);
  const until = new Date();
  until.setDate(until.getDate() + effectiveDays);
  return { suspendedUntil: until.toISOString(), effectiveDays };
}

// ─── Server Actions ───────────────────────────────────────────────────────────

async function warnUser(fd: FormData) {
  'use server';
  const userId = fd.get('user_id') as string;
  const reason = fd.get('reason') as string;

  const supabase = await createClient();
  const { data: { user: admin } } = await supabase.auth.getUser();
  if (!admin) return;
  if (await isTargetAdmin(supabase, userId)) return;

  // FIX: adminClient required — notifications has no INSERT policy for session client
  const adminClient = createAdminClient();

  await adminClient.from('notifications').insert({
    user_id: userId,
    type:    'admin_warning',
    title:   'Official Warning',
    message: reason,
  });

  await supabase.from('admin_action_logs').insert({
    admin_id:       admin.id,
    target_user_id: userId,
    action_type:    'warn',
    reason,
  });

  revalidatePath(`/f9-control/users/${userId}`);
}

async function suspendUser(fd: FormData) {
  'use server';
  const userId      = fd.get('user_id')       as string;
  const reason      = fd.get('reason')        as string;
  const durationDays = Number(fd.get('duration_days') ?? 7);

  const supabase = await createClient();
  const { data: { user: admin } } = await supabase.auth.getUser();
  if (!admin) return;
  if (await isTargetAdmin(supabase, userId)) return;

  const isAdmin = await isActingUserAdmin(supabase, admin.id);
  const { suspendedUntil, effectiveDays } = computeSuspension(durationDays, isAdmin);

  const wasCapApplied = !isAdmin && durationDays !== effectiveDays;
  const durationNote = effectiveDays === null
    ? 'indefinite'
    : `${effectiveDays} day${effectiveDays !== 1 ? 's' : ''}${
        wasCapApplied ? ` (capped from ${durationDays}d — moderator limit)` : ''
      }`;

  // profiles has admin UPDATE policy — session client is fine
  await supabase.from('profiles').update({
    account_status:    'suspended',
    suspension_reason: reason,
    suspended_until:   suspendedUntil,
  }).eq('id', userId);

  // FIX: adminClient required — notifications has no INSERT policy for session client
  const adminClient = createAdminClient();

  await adminClient.from('notifications').insert({
    user_id: userId,
    type:    'account_suspended',
    title:   'Account Suspended',
    message: effectiveDays === null
      ? `Your account has been suspended indefinitely. Reason: ${reason}`
      : `Your account has been suspended for ${effectiveDays} day${effectiveDays !== 1 ? 's' : ''}. Reason: ${reason}`,
  });

  await supabase.from('admin_action_logs').insert({
    admin_id:       admin.id,
    target_user_id: userId,
    action_type:    'suspend',
    reason:         `${reason} [Duration: ${durationNote}]`,
  });

  revalidatePath(`/f9-control/users/${userId}`);
}

async function banUser(fd: FormData) {
  'use server';
  const userId = fd.get('user_id') as string;
  const reason = fd.get('reason') as string;

  const supabase    = await createClient();
  // FIX: createAdminClient is synchronous — removed incorrect await
  const adminClient = createAdminClient();

  const { data: { user: admin } } = await supabase.auth.getUser();
  if (!admin) return;
  if (await isTargetAdmin(supabase, userId)) return;

  // Step 1: Disable account (profiles has admin UPDATE policy — session client ok)
  await supabase.from('profiles').update({
    account_status:    'banned',
    suspension_reason: reason,
    suspended_until:   null,
  }).eq('id', userId);

  // Step 2: Freeze wallet (wallets has no UPDATE policy — adminClient required)
  const { error: walletFreezeError } = await adminClient
    .from('wallets')
    .update({
      is_frozen: true,
      frozen_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (walletFreezeError) {
    console.error('[banUser] wallet freeze error:', walletFreezeError);
  }

  // Step 3: Cancel active orders (orders has no admin UPDATE policy — adminClient required)
  const { data: activeOrders } = await adminClient
    .from('orders')
    .select('id, client_id, freelancer_id')
    .or(`client_id.eq.${userId},freelancer_id.eq.${userId}`)
    .in('status', ACTIVE_ORDER_STATUSES);

  if (activeOrders && activeOrders.length > 0) {
    const orderIds = activeOrders.map((o) => o.id);

    await adminClient
      .from('orders')
      .update({ status: 'cancelled' })
      .in('id', orderIds);

    // Step 4 (partial): Notify counterparties
    // FIX: adminClient required — notifications has no INSERT policy for session client
    const counterpartyNotifications = activeOrders.map((order) => {
      const counterpartyId =
        order.client_id === userId ? order.freelancer_id : order.client_id;
      return {
        user_id: counterpartyId,
        type:    'order_cancelled',
        title:   'Order Cancelled',
        message: `An order you were part of has been cancelled because the other party's account was banned by the F9 team.`,
      };
    });

    await adminClient.from('notifications').insert(counterpartyNotifications);
  }

  // Step 4 (primary): Notify the banned user
  // FIX: adminClient required — notifications has no INSERT policy for session client
  await adminClient.from('notifications').insert({
    user_id: userId,
    type:    'account_banned',
    title:   'Account Banned',
    message: reason,
  });

  // Audit log — admin_action_logs has admin ALL policy, session client is fine
  const cancelledCount = activeOrders?.length ?? 0;
  const walletNote     = walletFreezeError
    ? ' [wallet freeze FAILED — check server logs]'
    : ' [wallet frozen]';

  await supabase.from('admin_action_logs').insert({
    admin_id:       admin.id,
    target_user_id: userId,
    action_type:    'ban',
    reason:         `${reason}${walletNote}${
      cancelledCount > 0
        ? ` [${cancelledCount} active order${cancelledCount !== 1 ? 's' : ''} cancelled]`
        : ''
    }`,
  });

  revalidatePath(`/f9-control/users/${userId}`);
}

async function freezeWallet(fd: FormData) {
  'use server';
  const userId = fd.get('user_id') as string;
  const reason = fd.get('reason') as string;

  const supabase = await createClient();
  const { data: { user: admin } } = await supabase.auth.getUser();
  if (!admin) return;
  if (await isTargetAdmin(supabase, userId)) return;

  // FIX: createAdminClient required for security_logs (no INSERT policy) and
  //      notifications (no INSERT policy for cross-user rows)
  const adminClient = createAdminClient();

  // profiles has admin UPDATE policy — session client is fine
  await supabase.from('profiles').update({
    account_status:    'suspended',
    suspension_reason: `Wallet frozen: ${reason}`,
    suspended_until:   null,
  }).eq('id', userId);

  // FIX: security_logs has no INSERT policy — was silently dropping this row,
  //      meaning NotificationBell never saw wallet_frozen_by_admin events
  await adminClient.from('security_logs').insert({
    user_id:     userId,
    event_type:  'wallet_frozen_by_admin',
    severity:    'critical',
    description: reason,
  });

  // FIX: notifications has no INSERT policy for session client
  await adminClient.from('notifications').insert({
    user_id: userId,
    type:    'account_frozen',
    title:   'Wallet Frozen',
    message: `Your wallet has been frozen by the F9 team. Reason: ${reason}`,
  });

  // admin_action_logs has admin ALL policy — session client is fine
  await supabase.from('admin_action_logs').insert({
    admin_id:       admin.id,
    target_user_id: userId,
    action_type:    'freeze_wallet',
    reason,
  });

  revalidatePath(`/f9-control/users/${userId}`);
}

async function overrideTrustScore(fd: FormData) {
  'use server';
  const userId      = fd.get('user_id')      as string;
  const scoreChange = Number(fd.get('score_change'));
  const reason      = fd.get('reason')       as string;
  if (isNaN(scoreChange)) return;

  const supabase = await createClient();
  const { data: { user: admin } } = await supabase.auth.getUser();
  if (!admin) return;
  if (await isTargetAdmin(supabase, userId)) return;

  // add_trust_score_event is SECURITY DEFINER — bypasses RLS, session client fine
  await supabase.rpc('add_trust_score_event', {
    p_user_id:      userId,
    p_event_type:   'admin_override',
    p_score_change: scoreChange,
    p_notes:        reason,
  });

  await supabase.from('admin_action_logs').insert({
    admin_id:       admin.id,
    target_user_id: userId,
    action_type:    'override_trust_score',
    reason:         `${scoreChange >= 0 ? '+' : ''}${scoreChange} — ${reason}`,
  });

  revalidatePath(`/f9-control/users/${userId}`);
}

async function addPrivateNote(fd: FormData) {
  'use server';
  const userId = fd.get('user_id') as string;
  const note   = (fd.get('note') as string)?.trim();
  if (!note) return;

  const supabase = await createClient();
  const { data: { user: admin } } = await supabase.auth.getUser();
  if (!admin) return;

  // admin_action_logs has admin ALL policy — session client fine
  await supabase.from('admin_action_logs').insert({
    admin_id:         admin.id,
    target_user_id:   userId,
    action_type:      'private_note',
    reason:           note,
    reversible_until: null,
  });

  revalidatePath(`/f9-control/users/${userId}`);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminUserProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single();

  if (!profile) notFound();

  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .or(`client_id.eq.${id},freelancer_id.eq.${id}`)
    .order('created_at', { ascending: false })
    .limit(20);

  const { data: disputes } = await supabase
    .from('disputes')
    .select('*')
    .or(`raised_by.eq.${id},against.eq.${id}`)
    .order('created_at', { ascending: false })
    .limit(20);

  const { data: wallet } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', id)
    .single();

  const { data: withdrawals } = await supabase
    .from('withdrawals')
    .select('*')
    .eq('user_id', id)
    .order('created_at', { ascending: false })
    .limit(20);

  const orderIds = (orders ?? []).map((o) => o.id);

  const [{ data: txByRecipient }, { data: txByOrder }] = await Promise.all([
    supabase
      .from('transactions')
      .select('*')
      .eq('recipient_user_id', id)
      .order('created_at', { ascending: false })
      .limit(30),

    orderIds.length > 0
      ? supabase
          .from('transactions')
          .select('*')
          .in('order_id', orderIds)
          .order('created_at', { ascending: false })
          .limit(30)
      : Promise.resolve({ data: [] as import('@/types').Tables<'transactions'>[] }),
  ]);

  const txMap = new Map<string, import('@/types').Tables<'transactions'>>();
  for (const tx of [...(txByOrder ?? []), ...(txByRecipient ?? [])]) {
    txMap.set(tx.id, tx);
  }
  const transactions = Array.from(txMap.values()).sort(
    (a, b) =>
      new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime(),
  );

  const { data: securityLogs } = await supabase
    .from('security_logs')
    .select('*')
    .eq('user_id', id)
    .order('created_at', { ascending: false })
    .limit(30);

  const { data: trustEvents } = await supabase
    .from('trust_score_events')
    .select('*')
    .eq('user_id', id)
    .order('created_at', { ascending: false })
    .limit(30);

  const { data: devices } = await supabase
    .from('user_devices')
    .select('*')
    .eq('user_id', id)
    .order('last_seen_at', { ascending: false })
    .limit(5);

  const { data: auditLogs } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('user_id', id)
    .order('created_at', { ascending: false })
    .limit(30);

  const { data: adminNotes } = await supabase
    .from('admin_action_logs')
    .select('*')
    .eq('target_user_id', id)
    .order('created_at', { ascending: false })
    .limit(30);

  return (
    <div className="space-y-6">
      <Link
        href="/f9-control/users"
        className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
      >
        <ChevronLeft size={14} />
        Back to User Directory
      </Link>

      <UserProfileTabs
        profile={profile}
        orders={orders ?? []}
        disputes={disputes ?? []}
        wallet={wallet ?? null}
        withdrawals={withdrawals ?? []}
        transactions={transactions}
        securityLogs={securityLogs ?? []}
        trustEvents={trustEvents ?? []}
        devices={devices ?? []}
        auditLogs={auditLogs ?? []}
        adminNotes={adminNotes ?? []}
        onWarn={warnUser}
        onSuspend={suspendUser}
        onBan={banUser}
        onFreeze={freezeWallet}
        onOverrideTrust={overrideTrustScore}
        onAddNote={addPrivateNote}
      />
    </div>
  );
}