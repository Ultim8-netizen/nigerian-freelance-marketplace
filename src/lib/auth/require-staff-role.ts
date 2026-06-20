// src/lib/auth/require-staff-role.ts
//
// Centralizes the staff-role authorization check. Previously only
// src/app/api/admin/withdrawals/execute/route.ts verified the caller held
// an admin/financial_analyst role before acting — every other privileged
// surface in this domain (finance/page.tsx, flags/page.tsx,
// analytics/page.tsx) checked only that *someone* was logged in
// (auth.getUser() succeeding), never that they were staff. That's an
// inconsistency within the same domain, not just a gap in one file.
//
// FIX (confirmed via live RLS export): your schema actually has TWO
// separate admin-authorization mechanisms in active use, not one:
//   1. profiles.user_type = 'admin' — used by 4 existing RLS policies
//      (admin_action_logs ALL, contest_tickets admin ALL, staff_roles ALL,
//      profiles admin-UPDATE). This is the dominant, pre-existing
//      convention.
//   2. staff_roles.role_type — used only by execute/route.ts, for granting
//      narrower roles (e.g. financial_analyst) that don't imply blanket
//      profiles.user_type='admin'.
// The original version of this helper checked ONLY staff_roles, which
// would have rejected anyone with profiles.user_type='admin' but no
// staff_roles row — and your staff_roles table was confirmed completely
// empty, meaning literally everyone (including you) would have been locked
// out. Now checks BOTH: profiles.user_type='admin' satisfies any
// allowedRoles list containing 'admin'; staff_roles satisfies whatever
// role_type it actually holds (covering financial_analyst and anything
// else profiles has no equivalent for).
//
// IMPORTANT — this is only safe because profiles.user_type can no longer be
// self-escalated through the application API. "Users can update own
// profile" (auth.uid() = id, with_check: null) and "Users can insert their
// own profile" (same shape) place NO restriction on what value a user can
// write to their own user_type column — RLS alone does not block
// `UPDATE profiles SET user_type='admin' WHERE id=auth.uid()`. This was
// fixed via a migration extending protect_f9_identity() (which already
// fires on both INSERT and UPDATE) to reject user_type='admin' whenever
// auth.role() IS NOT NULL — i.e. whenever the write comes through the
// Supabase API (anon, authenticated, or service_role) rather than a direct
// SQL editor / migration connection. If that migration has not been
// applied, do not trust path A below — see the SQL provided alongside this
// fix.
//
// This does NOT replace route-level/middleware-level gating if you have it
// (e.g. restricting /f9-control/* to staff at the middleware layer) — it's
// defense in depth at the data layer, which is the right place for it
// regardless of what middleware does, since a server action can in
// principle be invoked directly.
//
// Must be called with an ADMIN client (service role) — both profiles and
// staff_roles reads here need to see the target row regardless of the
// caller's own RLS context, and a session-scoped client checking its own
// caller's role is circular reasoning anyway.

import type { SupabaseClient } from '@supabase/supabase-js';

export class UnauthorizedError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Throws UnauthorizedError unless EITHER:
 *   A. allowedRoles includes 'admin' AND profiles.user_type === 'admin'
 *      for this user, OR
 *   B. the user has an active staff_roles row whose role_type is in
 *      allowedRoles.
 */
export async function requireStaffRole(
  adminClient: SupabaseClient,
  userId: string,
  allowedRoles: string[],
): Promise<void> {
  // Path A: profiles.user_type === 'admin'.
  if (allowedRoles.includes('admin')) {
    const { data: profile } = await adminClient
      .from('profiles')
      .select('user_type')
      .eq('id', userId)
      .single();

    if (profile?.user_type === 'admin') return;
  }

  // Path B: staff_roles grant — covers role types with no profiles-level
  // equivalent (e.g. financial_analyst), and also covers 'admin' itself if
  // someone is granted that way instead of via profiles.user_type.
  const { data: staffRole, error } = await adminClient
    .from('staff_roles')
    .select('role_type, is_active')
    .eq('user_id', userId)
    .single();

  if (
    !error &&
    staffRole &&
    staffRole.is_active &&
    allowedRoles.includes(staffRole.role_type ?? '')
  ) {
    return;
  }

  throw new UnauthorizedError(
    `Forbidden: requires one of [${allowedRoles.join(', ')}] via profiles.user_type or staff_roles`,
  );
}