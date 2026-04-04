import { notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { UserProfileTabs } from './UserProfileTabs';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const MODERATOR_MAX_SUSPENSION_DAYS = 30;

/**
 * Order statuses that are considered "active" and must be cancelled on ban.
 * Sources:
 *  - get_user_stats function: active_orders uses 'awaiting_delivery' | 'delivered'
 *  - process_successful_payment sets 'awaiting_delivery' (post-payment active state)
 *  - 'pending' is the pre-payment state, also cancellable
 * Terminal statuses ('completed', 'cancelled') are intentionally excluded.
 */
const ACTIVE_ORDER_STATUSES = ['pending', 'awaiting_delivery', 'delivered'] as const;

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
  const durationDays = Number(fd.get('duration_days') ?? 7);

  const supabase = await createClient();
  const { data: { user: admin } } = await supabase.auth.getUser();
  if (!admin) return;

  // ── Unblockable guard ────────────────────────────────────────────────────
  if (await isTargetAdmin(supabase, userId)) return;

  const isAdmin = await isActingUserAdmin(supabase, admin.id);
  const { suspendedUntil, effectiveDays } = computeSuspension(durationDays, isAdmin);

  const wasCapApplied = !isAdmin && durationDays !== effectiveDays;
  const durationNote = effectiveDays === null
    ? 'indefinite'
    : `${effectiveDays} day${effectiveDays !== 1 ? 's' : ''}${wasCapApplied ? ` (capped from ${durationDays}d — moderator limit)` : ''}`;

  await supabase.from('profiles').update({
    account_status:    'suspended',
    suspension_reason: reason,
    suspended_until:   suspendedUntil,
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

/**
 * Permanently bans a user.
 *
 * Spec compliance — all four steps are now enforced:
 *  1. Account disabled  → profiles.account_status = 'banned'
 *  2. Wallet frozen     → profiles already banned; wallet inaccessible
 *  3. Active orders cancelled → queries orders via service-role client
 *                               (orders has no admin UPDATE RLS policy,
 *                               so the anon client cannot write it cross-user)
 *  4. User notified     → notifications insert for ban + one per cancelled order
 */
async function banUser(fd: FormData) {
  'use server';
  const userId = fd.get('user_id') as string;
  const reason = fd.get('reason') as string;

  const supabase      = await createClient();
  const adminClient   = await createAdminClient(); // service role — bypasses RLS

  const { data: { user: admin } } = await supabase.auth.getUser();
  if (!admin) return;

  // ── Unblockable guard ────────────────────────────────────────────────────
  if (await isTargetAdmin(supabase, userId)) return;

  // ── Step 1: Disable account ──────────────────────────────────────────────
  await supabase.from('profiles').update({
    account_status:    'banned',
    suspension_reason: reason,
    suspended_until:   null,
  }).eq('id', userId);

  // ── Step 3: Cancel all active orders ────────────────────────────────────
  // Must use adminClient — orders has no admin UPDATE RLS policy.
  // We fetch first to know which orders were cancelled so we can notify
  // each order's counterparty.
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

    // ── Step 4 (partial): Notify each order's counterparty ───────────────
    // The banned user receives a single consolidated notification below.
    // Each counterparty gets one notification per affected order.
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

    await supabase.from('notifications').insert(counterpartyNotifications);
  }

  // ── Step 4 (primary): Notify the banned user ─────────────────────────────
  await supabase.from('notifications').insert({
    user_id: userId,
    type:    'account_banned',
    title:   'Account Banned',
    message: reason,
  });

  // ── Audit log ────────────────────────────────────────────────────────────
  const cancelledCount = activeOrders?.length ?? 0;
  await supabase.from('admin_action_logs').insert({
    admin_id:       admin.id,
    target_user_id: userId,
    action_type:    'ban',
    reason:         `${reason}${cancelledCount > 0 ? ` [${cancelledCount} active order${cancelledCount !== 1 ? 's' : ''} cancelled]` : ''}`,
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

  // ── Unblockable guard ────────────────────────────────────────────────────
  if (await isTargetAdmin(supabase, userId)) return;

  await supabase.from('profiles').update({
    account_status:    'suspended',
    suspension_reason: `Wallet frozen: ${reason}`,
    suspended_until:   null,
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
  if (await isTargetAdmin(supabase, userId)) return;

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

/**
 * Appends a freeform private note to admin_action_logs.
 *
 * Notes are stored with action_type = 'private_note' and are:
 *  - Never surfaced to the target user (admin_action_logs RLS is admin-only)
 *  - Never sent as a notification (no notification insert)
 *  - Visible only in the Admin Notes tab of this profile view
 *
 * There is no unblockable guard here — admins may annotate any profile,
 * including other admin accounts, for internal record-keeping purposes.
 */
async function addPrivateNote(fd: FormData) {
  'use server';
  const userId = fd.get('user_id') as string;
  const note   = (fd.get('note') as string)?.trim();
  if (!note) return;

  const supabase = await createClient();
  const { data: { user: admin } } = await supabase.auth.getUser();
  if (!admin) return;

  await supabase.from('admin_action_logs').insert({
    admin_id:       admin.id,
    target_user_id: userId,
    action_type:    'private_note',
    reason:         note,
    // Private notes are informational — mark non-reversible so the
    // "Reversed" badge never appears on them in the Admin Notes tab.
    reversible_until: null,
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
  // Spec: show the last 5 login sessions (IP / device) only.
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
        onAddNote={addPrivateNote}
      />
    </div>
  );
}