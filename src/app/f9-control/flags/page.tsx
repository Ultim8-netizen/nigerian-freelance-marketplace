// src/app/f9-control/flags/page.tsx
//
// FIX (preventative — same pattern proven broken in finance/page.tsx): every
// write in this file previously used createClient() (the session-scoped,
// RLS-bound client) for privileged writes to contest_tickets, security_logs
// (via admin_action_logs), profiles, and notifications. I don't have a live
// RLS export for those four tables the way I had one for
// withdrawals/escrow/transactions/platform_config, so I can't say with the
// same certainty that this was silently no-op'ing — but:
//   1. The exact same author/pattern produced a confirmed, severe version of
//      this bug one file over (f9-control/finance/page.tsx), where
//      createAdminClient() was already imported and used in exactly one
//      isolated path but not applied consistently.
//   2. Switching to createAdminClient() for these writes is strictly safe
//      regardless of what those policies turn out to be — service role
//      bypasses RLS entirely, so it can only succeed where the session
//      client would have succeeded, never the reverse.
// createClient() (session-scoped) is kept ONLY for auth.getUser().
//
// RESOLVED: every server action and the page load now call
// requireStaffRole(adminClient, <id>, FLAGS_ROLES) before acting — see
// src/lib/auth/require-staff-role.ts. This closes the gap regardless of
// what src/middleware.ts does or doesn't gate at the route level; the
// check now lives at the data-access layer, which is correct defense in
// depth even if middleware already covers this route group.

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireStaffRole } from '@/lib/auth/require-staff-role';
import { revalidatePath } from 'next/cache';
import type { Tables } from '@/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FlagsActionBar } from './FlagsActionBar';

// Conservative default: only 'admin' is a confirmed staff_roles role_type
// in this codebase for trust & safety actions (suspending users, reversing
// contested actions). Unlike FINANCE_ROLES in finance/page.tsx, I have no
// evidence a 'trust_safety_analyst' or similar role_type exists yet — if
// you add one, extend this list rather than widening it to something
// invented.
const FLAGS_ROLES = ['admin'];

// ─── Types ────────────────────────────────────────────────────────────────────

type ContestTicketWithUser = Omit<Tables<'contest_tickets'>, 'user_id'> & {
  user_id: Pick<Tables<'profiles'>, 'full_name' | 'id'> | null;
};

type SecurityLogWithUser = Omit<Tables<'security_logs'>, 'user_id'> & {
  user_id: Pick<Tables<'profiles'>, 'full_name' | 'id'> | null;
};

// ─── Server Actions ───────────────────────────────────────────────────────────

/** Mark a contest ticket as dismissed — the automated action stands. */
async function dismissTicket(fd: FormData) {
  'use server';
  const ticketId = fd.get('ticket_id') as string;

  const supabase = await createClient();
  const { data: { user: admin } } = await supabase.auth.getUser();
  if (!admin) throw new Error('Unauthenticated');

  const adminClient = createAdminClient();
  await requireStaffRole(adminClient, admin.id, FLAGS_ROLES);

  const { error } = await adminClient
    .from('contest_tickets')
    .update({ status: 'dismissed', reviewed_by: admin.id })
    .eq('id', ticketId);

  if (error) throw new Error(`Failed to dismiss ticket: ${error.message}`);

  await adminClient.from('admin_action_logs').insert({
    admin_id:    admin.id,
    action_type: 'dismiss_ticket',
    reason:      `Contest ticket ${ticketId} dismissed — action stands`,
  });

  revalidatePath('/f9-control/flags');
}

/**
 * Reverse the contested automated action.
 * Marks the ticket 'reversed' so it disappears from the pending queue.
 * The admin manually undoes the specific action (e.g. lift a wallet hold)
 * from the user profile view if needed.
 */
async function reverseTicket(fd: FormData) {
  'use server';
  const ticketId     = fd.get('ticket_id') as string;
  const targetUserId = fd.get('user_id')   as string;

  const supabase = await createClient();
  const { data: { user: admin } } = await supabase.auth.getUser();
  if (!admin) throw new Error('Unauthenticated');

  const adminClient = createAdminClient();
  await requireStaffRole(adminClient, admin.id, FLAGS_ROLES);

  const { error } = await adminClient
    .from('contest_tickets')
    .update({ status: 'reversed', reviewed_by: admin.id })
    .eq('id', ticketId);

  if (error) throw new Error(`Failed to reverse ticket: ${error.message}`);

  if (targetUserId) {
    await adminClient.from('notifications').insert({
      user_id: targetUserId,
      type:    'contest_reversed',
      title:   'Your Contest Was Successful',
      message: 'The automated action you contested has been reviewed and reversed by the F9 team.',
    });
  }

  await adminClient.from('admin_action_logs').insert({
    admin_id:       admin.id,
    target_user_id: targetUserId || null,
    action_type:    'reverse_ticket',
    reason:         `Contest ticket ${ticketId} — action reversed after review`,
  });

  revalidatePath('/f9-control/flags');
}

/** Dismiss a security flag — no action taken against the user. */
async function dismissFlag(fd: FormData) {
  'use server';
  const flagId       = fd.get('flag_id') as string;
  const targetUserId = fd.get('user_id') as string;

  const supabase = await createClient();
  const { data: { user: admin } } = await supabase.auth.getUser();
  if (!admin) throw new Error('Unauthenticated');

  const adminClient = createAdminClient();
  await requireStaffRole(adminClient, admin.id, FLAGS_ROLES);

  // security_logs has no status column — audit log is sufficient for reviewed state.
  await adminClient.from('admin_action_logs').insert({
    admin_id:       admin.id,
    target_user_id: targetUserId || null,
    action_type:    'dismiss_flag',
    reason:         `Security flag ${flagId} dismissed after admin review`,
  });

  revalidatePath('/f9-control/flags');
}

/**
 * Suspend the user associated with a critical security flag.
 *
 * These suspensions are ALWAYS indefinite (suspended_until = null) because:
 *   1. They are triggered by critical security events (fraud, suspicious inflow,
 *      account compromise) where a time limit would be inappropriate.
 *   2. Only full admins can issue indefinite suspensions — and this action
 *      is only reachable from the admin-only Flags & Tickets page.
 *   3. Explicitly setting suspended_until = null prevents a prior timed
 *      suspension timestamp from surviving on the row and causing the cron's
 *      lift_expired_suspensions() to incorrectly reactivate this account.
 */
async function suspendFlaggedUser(fd: FormData) {
  'use server';
  const userId = fd.get('user_id') as string;
  if (!userId) throw new Error('user_id missing');

  const supabase = await createClient();
  const { data: { user: admin } } = await supabase.auth.getUser();
  if (!admin) throw new Error('Unauthenticated');

  const adminClient = createAdminClient();
  await requireStaffRole(adminClient, admin.id, FLAGS_ROLES);

  const { error } = await adminClient
    .from('profiles')
    .update({
      account_status:    'suspended',
      suspension_reason: 'Suspended by admin following a critical security flag.',
      // Explicitly null — this suspension is indefinite and must NOT be auto-lifted
      // by the lift_expired_suspensions() cron. If a prior timed suspension left a
      // suspended_until timestamp on this row, this write clears it.
      suspended_until:   null,
    })
    .eq('id', userId);

  if (error) throw new Error(`Failed to suspend user: ${error.message}`);

  await adminClient.from('notifications').insert({
    user_id: userId,
    type:    'account_suspended',
    title:   'Account Suspended',
    message: 'Your account has been suspended following a security review. Please contact support.',
  });

  await adminClient.from('admin_action_logs').insert({
    admin_id:       admin.id,
    target_user_id: userId,
    action_type:    'suspend',
    reason:         'Suspended following critical security flag review [indefinite]',
  });

  revalidatePath('/f9-control/flags');
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminFlagsPage() {
  // Used ONLY to confirm there's a logged-in session — see file header on
  // why every actual table read below uses the admin client.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Unauthenticated');
  }

  const adminClient = createAdminClient();
  await requireStaffRole(adminClient, user.id, FLAGS_ROLES);

  const { data: tickets } = await adminClient
    .from('contest_tickets')
    .select('*, user_id(full_name, id)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false }) as { data: ContestTicketWithUser[] | null };

  const { data: flags } = await adminClient
    .from('security_logs')
    .select('*, user_id(full_name, id)')
    .in('severity', ['high', 'critical'])
    .order('created_at', { ascending: false })
    .limit(20) as { data: SecurityLogWithUser[] | null };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Flags &amp; Tickets</h1>

      <Tabs defaultValue="tickets" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="tickets">
            Contest Tickets ({tickets?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="flags">
            Critical Flags ({flags?.length ?? 0})
          </TabsTrigger>
        </TabsList>

        {/* ── Contest Tickets ── */}
        <TabsContent value="tickets" className="space-y-4">
          {!tickets || tickets.length === 0 ? (
            <p className="text-sm text-gray-400 italic py-8 text-center">
              No pending contest tickets.
            </p>
          ) : (
            tickets.map((ticket) => (
              <Card key={ticket.id} className="p-4 border-l-4 border-l-orange-500">
                <div className="flex justify-between items-start gap-4">
                  <div className="min-w-0">
                    <h3 className="font-bold text-gray-900">
                      {ticket.user_id?.full_name ?? 'Unknown User'}
                    </h3>
                    <p className="text-sm text-gray-500 mt-0.5">
                      Contesting: <span className="font-medium">{ticket.action_contested}</span>
                    </p>
                    <p className="mt-2 text-gray-800 bg-gray-50 p-3 rounded text-sm">
                      {ticket.explanation}
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                      {ticket.created_at
                        ? new Date(ticket.created_at).toLocaleString([], {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })
                        : ''}
                    </p>
                  </div>

                  <FlagsActionBar
                    type="ticket"
                    ticketId={ticket.id}
                    userId={ticket.user_id?.id ?? ''}
                    onDismissTicket={dismissTicket}
                    onReverseTicket={reverseTicket}
                  />
                </div>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ── Security Flags ── */}
        <TabsContent value="flags" className="space-y-4">
          {!flags || flags.length === 0 ? (
            <p className="text-sm text-gray-400 italic py-8 text-center">
              No high or critical flags.
            </p>
          ) : (
            flags.map((flag) => (
              <Card
                key={flag.id}
                className={`p-4 border-l-4 ${
                  (flag.severity ?? 'high') === 'critical'
                    ? 'border-l-red-600'
                    : 'border-l-orange-400'
                }`}
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-bold text-gray-900">
                        {flag.user_id?.full_name ?? 'Unknown User'}
                      </h3>
                      <Badge variant="destructive">
                        {(flag.severity ?? 'high').toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium text-gray-700">
                      {flag.event_type.replace(/_/g, ' ').toUpperCase()}
                    </p>
                    {flag.description && (
                      <p className="text-sm text-gray-500 mt-1">{flag.description}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-2">
                      {flag.created_at
                        ? new Date(flag.created_at).toLocaleString([], {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })
                        : ''}
                    </p>
                  </div>

                  <FlagsActionBar
                    type="flag"
                    flagId={flag.id}
                    userId={flag.user_id?.id ?? ''}
                    onDismissFlag={dismissFlag}
                    onSuspendUser={suspendFlaggedUser}
                  />
                </div>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}