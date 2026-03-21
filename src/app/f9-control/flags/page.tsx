import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { Tables } from '@/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FlagsActionBar } from './FlagsActionBar';

// ─── Types ────────────────────────────────────────────────────────────────────

type ContestTicketWithUser = Omit<Tables<'contest_tickets'>, 'user_id'> & {
  user_id: Pick<Tables<'profiles'>, 'full_name' | 'id'> | null;
};

type SecurityLogWithUser = Omit<Tables<'security_logs'>, 'user_id'> & {
  user_id: Pick<Tables<'profiles'>, 'full_name' | 'id'> | null;
};

// ─── Server Actions ───────────────────────────────────────────────────────────
//
// FIX #8 — Every button previously had no server action.
// dismissTicket, reverseTicket, dismissFlag, and suspendFlaggedUser
// are now real Server Actions bound to the buttons via FlagsActionBar.

/** Mark a contest ticket as dismissed — the automated action stands. */
async function dismissTicket(fd: FormData) {
  'use server';
  const ticketId = fd.get('ticket_id') as string;
  const supabase = await createClient();
  const { data: { user: admin } } = await supabase.auth.getUser();
  if (!admin) throw new Error('Unauthenticated');

  await supabase
    .from('contest_tickets')
    .update({ status: 'dismissed', reviewed_by: admin.id })
    .eq('id', ticketId);

  await supabase.from('admin_action_logs').insert({
    admin_id:    admin.id,
    action_type: 'dismiss_ticket',
    reason:      `Contest ticket ${ticketId} dismissed — action stands`,
  });

  revalidatePath('/f9-control/flags');
}

/**
 * Reverse the contested automated action.
 * Uses the existing `reverse_admin_action` RPC pattern — but for contest
 * tickets the reversal is simpler: we just mark the ticket resolved and
 * let the admin manually undo the specific automated action (e.g. lift
 * a wallet hold) from the user profile view.
 *
 * The ticket is marked 'reversed' so it disappears from the pending queue
 * and appears in the resolved history.
 */
async function reverseTicket(fd: FormData) {
  'use server';
  const ticketId    = fd.get('ticket_id')    as string;
  const targetUserId = fd.get('user_id')     as string;
  const supabase = await createClient();
  const { data: { user: admin } } = await supabase.auth.getUser();
  if (!admin) throw new Error('Unauthenticated');

  await supabase
    .from('contest_tickets')
    .update({ status: 'reversed', reviewed_by: admin.id })
    .eq('id', ticketId);

  // Notify the user that their contest was successful
  if (targetUserId) {
    await supabase.from('notifications').insert({
      user_id: targetUserId,
      type:    'contest_reversed',
      title:   'Your Contest Was Successful',
      message: 'The automated action you contested has been reviewed and reversed by the F9 team.',
    });
  }

  await supabase.from('admin_action_logs').insert({
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
  const flagId      = fd.get('flag_id') as string;
  const targetUserId = fd.get('user_id') as string;
  const supabase = await createClient();
  const { data: { user: admin } } = await supabase.auth.getUser();
  if (!admin) throw new Error('Unauthenticated');

  // security_logs has no status column — we write a note to admin_action_logs
  // to mark the flag as reviewed, which is sufficient for the audit trail.
  await supabase.from('admin_action_logs').insert({
    admin_id:       admin.id,
    target_user_id: targetUserId || null,
    action_type:    'dismiss_flag',
    reason:         `Security flag ${flagId} dismissed after admin review`,
  });

  revalidatePath('/f9-control/flags');
}

/** Suspend the user associated with a security flag. */
async function suspendFlaggedUser(fd: FormData) {
  'use server';
  const userId = fd.get('user_id') as string;
  if (!userId) throw new Error('user_id missing');

  const supabase = await createClient();
  const { data: { user: admin } } = await supabase.auth.getUser();
  if (!admin) throw new Error('Unauthenticated');

  await supabase
    .from('profiles')
    .update({
      account_status:    'suspended',
      suspension_reason: 'Suspended by admin following a critical security flag.',
    })
    .eq('id', userId);

  await supabase.from('notifications').insert({
    user_id: userId,
    type:    'account_suspended',
    title:   'Account Suspended',
    message: 'Your account has been suspended following a security review. Please contact support.',
  });

  await supabase.from('admin_action_logs').insert({
    admin_id:       admin.id,
    target_user_id: userId,
    action_type:    'suspend',
    reason:         'Suspended following critical security flag review',
  });

  revalidatePath('/f9-control/flags');
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminFlagsPage() {
  const supabase = await createClient();

  const { data: tickets } = await supabase
    .from('contest_tickets')
    .select('*, user_id(full_name, id)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false }) as { data: ContestTicketWithUser[] | null };

  const { data: flags } = await supabase
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

                  {/* FIX #8 — buttons now have real server actions */}
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

                  {/* FIX #8 — buttons now have real server actions */}
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