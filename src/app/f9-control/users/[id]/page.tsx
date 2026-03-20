import { notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { UserProfileTabs } from './UserProfileTabs';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

// ─── Server Actions ───────────────────────────────────────────────────────────
//
// Each action is defined at module scope with 'use server' so it can be passed
// as a prop to the Client Component. The target userId is closed over from
// the page's `params` — we re-read it from a hidden FormData field so the
// closure stays serialisable to the client boundary.

async function warnUser(fd: FormData) {
  'use server';
  const userId = fd.get('user_id') as string;
  const reason = fd.get('reason') as string;
  const supabase = await createClient();
  const { data: { user: admin } } = await supabase.auth.getUser();
  if (!admin) return;

  await supabase.from('notifications').insert({
    user_id: userId,
    type: 'admin_warning',
    title: 'Official Warning',
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
  const userId = fd.get('user_id') as string;
  const reason = fd.get('reason') as string;
  const supabase = await createClient();
  const { data: { user: admin } } = await supabase.auth.getUser();
  if (!admin) return;

  // profiles.account_status + profiles.suspension_reason — both columns verified
  await supabase.from('profiles').update({
    account_status:   'suspended',
    suspension_reason: reason,
  }).eq('id', userId);

  await supabase.from('notifications').insert({
    user_id: userId,
    type: 'account_suspended',
    title: 'Account Suspended',
    message: reason,
  });

  await supabase.from('admin_action_logs').insert({
    admin_id:       admin.id,
    target_user_id: userId,
    action_type:    'suspend',
    reason,
  });

  revalidatePath(`/f9-control/users/${userId}`);
}

async function banUser(fd: FormData) {
  'use server';
  const userId = fd.get('user_id') as string;
  const reason = fd.get('reason') as string;
  const supabase = await createClient();
  const { data: { user: admin } } = await supabase.auth.getUser();
  if (!admin) return;

  await supabase.from('profiles').update({
    account_status:   'banned',
    suspension_reason: reason,
  }).eq('id', userId);

  await supabase.from('notifications').insert({
    user_id: userId,
    type: 'account_banned',
    title: 'Account Banned',
    message: reason,
  });

  await supabase.from('admin_action_logs').insert({
    admin_id:       admin.id,
    target_user_id: userId,
    action_type:    'ban',
    reason,
  });

  revalidatePath(`/f9-control/users/${userId}`);
}

async function freezeWallet(fd: FormData) {
  'use server';
  // wallets has no `status` column — wallet freeze is enacted via
  // profiles.account_status = 'suspended' + a critical security_log entry.
  const userId = fd.get('user_id') as string;
  const reason = fd.get('reason') as string;
  const supabase = await createClient();
  const { data: { user: admin } } = await supabase.auth.getUser();
  if (!admin) return;

  await supabase.from('profiles').update({
    account_status:   'suspended',
    suspension_reason: `Wallet frozen: ${reason}`,
  }).eq('id', userId);

  await supabase.from('security_logs').insert({
    user_id:    userId,
    event_type: 'wallet_frozen_by_admin',
    severity:   'critical',
    description: reason,
  });

  await supabase.from('notifications').insert({
    user_id: userId,
    type: 'account_frozen',
    title: 'Wallet Frozen',
    message: `Your wallet has been frozen by the F9 team. Reason: ${reason}`,
  });

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
  const userId      = fd.get('user_id') as string;
  const scoreChange = Number(fd.get('score_change'));
  const reason      = fd.get('reason') as string;
  if (isNaN(scoreChange)) return;

  const supabase = await createClient();
  const { data: { user: admin } } = await supabase.auth.getUser();
  if (!admin) return;

  // add_trust_score_event RPC — 6 params verified against Functions schema
  await supabase.rpc('add_trust_score_event', {
    p_user_id:     userId,
    p_event_type:  'admin_override',
    p_score_change: scoreChange,
    p_notes:       reason,
  });

  await supabase.from('admin_action_logs').insert({
    admin_id:       admin.id,
    target_user_id: userId,
    action_type:    'override_trust_score',
    reason:         `${scoreChange >= 0 ? '+' : ''}${scoreChange} — ${reason}`,
  });

  revalidatePath(`/f9-control/users/${userId}`);
}

// ─── Bound action wrappers ────────────────────────────────────────────────────
//
// Server actions passed as props must be plain async functions. We bind the
// userId into FormData at the client level via a hidden <input name="user_id">.
// The actions above all read `fd.get('user_id')` so no wrapper factory is needed.

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminUserProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const supabase = await createClient();

  // ── Profile ────────────────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single();

  if (!profile) notFound();

  // ── Activity ───────────────────────────────────────────────────────────────
  // Orders where the user appears on either side (client or freelancer).
  // `orders` columns: client_id, freelancer_id — verified.
  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .or(`client_id.eq.${id},freelancer_id.eq.${id}`)
    .order('created_at', { ascending: false })
    .limit(20);

  // Disputes where the user raised or is subject of.
  // `disputes` columns: raised_by, against — verified.
  const { data: disputes } = await supabase
    .from('disputes')
    .select('*')
    .or(`raised_by.eq.${id},against.eq.${id}`)
    .order('created_at', { ascending: false })
    .limit(20);

  // ── Financials ─────────────────────────────────────────────────────────────
  const { data: wallet } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', id)
    .single();

  // `withdrawals` columns: user_id — verified.
  const { data: withdrawals } = await supabase
    .from('withdrawals')
    .select('*')
    .eq('user_id', id)
    .order('created_at', { ascending: false })
    .limit(20);

  // ── Flags & History ────────────────────────────────────────────────────────
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

  // ── Security ───────────────────────────────────────────────────────────────
  const { data: devices } = await supabase
    .from('user_devices')
    .select('*')
    .eq('user_id', id)
    .order('last_seen_at', { ascending: false });

  const { data: auditLogs } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('user_id', id)
    .order('created_at', { ascending: false })
    .limit(30);

  // ── Admin Notes ────────────────────────────────────────────────────────────
  // `admin_action_logs` column: target_user_id — verified.
  const { data: adminNotes } = await supabase
    .from('admin_action_logs')
    .select('*')
    .eq('target_user_id', id)
    .order('created_at', { ascending: false })
    .limit(30);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
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
      />
    </div>
  );
}