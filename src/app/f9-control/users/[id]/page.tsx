import { notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { UserProfileTabs } from './UserProfileTabs';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const MODERATOR_MAX_SUSPENSION_DAYS = 30;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns true if the acting user is a full admin.
 * Moderators (staff_roles entries) are NOT admins.
 */
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

/**
 * Returns true if the target user is an admin.
 * Admin accounts are "unblockable" — no suspension, ban, freeze, or
 * trust-score manipulation may be applied to them.
 */
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

/**
 * Computes the suspended_until timestamp.
 *
 * Rules:
 *  - Admin, durationDays === 0  → null (indefinite)
 *  - Admin, durationDays > 0   → now + durationDays (uncapped)
 *  - Moderator, any value       → now + min(durationDays || MAX, MAX)
 *
 * Returns { suspendedUntil, effectiveDays } so callers can log what was applied.
 */
function computeSuspension(
  durationDays: number,
  isAdmin: boolean,
): { suspendedUntil: string | null; effectiveDays: number | null } {
  if (isAdmin && durationDays === 0) {
    // Explicit indefinite — admin privilege only
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

  // ── Unblockable guard ────────────────────────────────────────────────────
  // Admin accounts should not receive warnings — they are F9 platform
  // identities, not subject to moderation actions.
  if (await isTargetAdmin(supabase, userId)) return;

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
  const userId      = fd.get('user_id') as string;
  const reason      = fd.get('reason') as string;
  // duration_days === 0 means "indefinite" — only admins may do this.
  // The <ActionPanel> should default to 7, making 0 an explicit admin choice.
  const durationDays = Number(fd.get('duration_days') ?? 7);

  const supabase = await createClient();
  const { data: { user: admin } } = await supabase.auth.getUser();
  if (!admin) return;

  // ── Unblockable guard ────────────────────────────────────────────────────
  // Admin profiles cannot be suspended. This is enforced here (early exit)
  // and at the DB level via the `guard_admin_account_status` trigger, which
  // raises an exception if the UPDATE is attempted through any other path.
  if (await isTargetAdmin(supabase, userId)) return;

  const isAdmin = await isActingUserAdmin(supabase, admin.id);
  const { suspendedUntil, effectiveDays } = computeSuspension(durationDays, isAdmin);

  // If a moderator tried to submit 0 (indefinite), effectiveDays will be MAX.
  // Build a clear audit note so we can see if a cap was applied.
  const wasCapApplied = !isAdmin && durationDays !== effectiveDays;
  const durationNote = effectiveDays === null
    ? 'indefinite'
    : `${effectiveDays} day${effectiveDays !== 1 ? 's' : ''}${wasCapApplied ? ` (capped from ${durationDays}d — moderator limit)` : ''}`;

  await supabase.from('profiles').update({
    account_status:    'suspended',
    suspension_reason: reason,
    suspended_until:   suspendedUntil,  // null = indefinite (admin only)
  }).eq('id', userId);

  await supabase.from('notifications').insert({
    user_id: userId,
    type: 'account_suspended',
    title: 'Account Suspended',
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
  const supabase = await createClient();
  const { data: { user: admin } } = await supabase.auth.getUser();
  if (!admin) return;

  // ── Unblockable guard ────────────────────────────────────────────────────
  // Admin profiles cannot be banned. Backed by DB trigger as second line
  // of defence (`guard_admin_account_status` on profiles BEFORE UPDATE).
  if (await isTargetAdmin(supabase, userId)) return;

  await supabase.from('profiles').update({
    account_status:    'banned',
    suspension_reason: reason,
    suspended_until:   null, // bans are always permanent — clear any prior timed suspension
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

  // ── Unblockable guard ────────────────────────────────────────────────────
  // Admin profiles cannot be wallet-frozen. The F9 platform account does not
  // have a user-facing wallet that requires freezing. Backed by DB trigger.
  if (await isTargetAdmin(supabase, userId)) return;

  await supabase.from('profiles').update({
    account_status:    'suspended',
    suspension_reason: `Wallet frozen: ${reason}`,
    suspended_until:   null, // wallet freezes held until manually reviewed
  }).eq('id', userId);

  await supabase.from('security_logs').insert({
    user_id:     userId,
    event_type:  'wallet_frozen_by_admin',
    severity:    'critical',
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

  // ── Unblockable guard ────────────────────────────────────────────────────
  // Admin trust scores are not user-facing and must not be manipulated
  // via this panel. This prevents accidental or malicious score events on
  // the platform identity account.
  if (await isTargetAdmin(supabase, userId)) return;

  // add_trust_score_event RPC — 6 params verified against Functions schema
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

  // ── Financials ─────────────────────────────────────────────────────────────
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