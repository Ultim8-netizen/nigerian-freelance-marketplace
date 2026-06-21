// src/app/f9-control/users/page.tsx
//
// User Directory — paginated, filterable listing of all platform profiles.
//
// FIX (critical): This file was previously a broken copy of users/[id]/page.tsx.
// It imported params: Promise<{ id: string }> which does not exist at the
// /f9-control/users route, causing id to always be undefined, which caused
// the .eq('id', undefined) query to match no rows, which caused notFound()
// to fire on every single request to this page — permanent 404.
//
// Additionally, UsersFilterBar.tsx was fully implemented but imported nowhere
// because the listing page it was built for didn't exist. Fixed here.
//
// QUERY NOTES:
//   - adminClient is used even though profiles has a public SELECT policy
//     (true qual). This is intentional: the admin panel should never depend
//     on user-facing RLS to determine what data is visible. Service role
//     also ensures future policy changes cannot accidentally restrict the
//     admin view.
//   - The 'verified=none' filter uses .or() chains because PostgREST's
//     .or() on a single field appends an AND to the outer query, not an OR
//     across fields. Two separate .or() calls on two separate columns
//     produces: WHERE (col_a IS NULL OR col_a = false) AND (col_b IS NULL OR col_b = false)
//     which is "not verified on either check" — correct for the intent.
//   - Pagination uses .range(from, to) which is 0-indexed inclusive on both ends.
//   - TYPE FIX (root cause): the .select() column list MUST be a single
//     unbroken string literal. @supabase/postgrest-js parses the .select()
//     argument at the TYPE level via template-literal matching to build the
//     typed Row shape. The `+` string concatenation previously used here
//     produces a value of type `string` (not a literal type — TS does not
//     preserve literal-ness across the `+` operator), which causes that
//     type-level parser to fail and fall back to `GenericStringError`,
//     poisoning every downstream property access on the query result.
//     Writing the column list as one literal restores correct typing.
//     No runtime/SQL change — purely a TS fix.

import { createClient }      from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireStaffRole }  from '@/lib/auth/require-staff-role';
import Link                  from 'next/link';
import { Card }              from '@/components/ui/card';
import { Badge }             from '@/components/ui/badge';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { UsersFilterBar }    from './UsersFilterBar';

const PAGE_SIZE   = 25;
const ADMIN_ROLES = ['admin'];

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  // ── Auth guard ────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthenticated');

  const adminClient = createAdminClient();
  await requireStaffRole(adminClient, user.id, ADMIN_ROLES);

  // ── Parse search params ───────────────────────────────────────────────────
  const sp = await searchParams;

  function sp_str(key: string): string {
    const v = sp[key];
    return typeof v === 'string' ? v.trim() : '';
  }

  const filter = {
    q:          sp_str('q'),
    role:       sp_str('role'),
    status:     sp_str('status'),
    verified:   sp_str('verified'),
    location:   sp_str('location'),
    university: sp_str('university'),
    trust_min:  sp_str('trust_min'),
    trust_max:  sp_str('trust_max'),
  };

  const page = Math.max(1, Number(sp_str('page') || '1'));
  const from = (page - 1) * PAGE_SIZE;
  const to   = from + PAGE_SIZE - 1;

  // ── Build query ───────────────────────────────────────────────────────────
  // NOTE: single string literal — do not split/concatenate this with `+`.
  // See TYPE FIX note at top of file for why that breaks the inferred Row type.
  let query = adminClient
    .from('profiles')
    .select(
      'id, full_name, email, user_type, account_status, trust_score, trust_level, created_at, identity_verified, liveness_verified, student_verified, location, university',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(from, to);

  if (filter.q)          query = query.ilike('full_name', `%${filter.q}%`);
  if (filter.role)       query = query.eq('user_type', filter.role);
  if (filter.status)     query = query.eq('account_status', filter.status);
  if (filter.location)   query = query.ilike('location', `%${filter.location}%`);
  if (filter.university) query = query.ilike('university', `%${filter.university}%`);

  if (filter.trust_min && !isNaN(Number(filter.trust_min))) {
    query = query.gte('trust_score', Number(filter.trust_min));
  }
  if (filter.trust_max && !isNaN(Number(filter.trust_max))) {
    query = query.lte('trust_score', Number(filter.trust_max));
  }

  // Verification filter — each branch targets the specific column.
  // 'none' requires that BOTH liveness AND identity are unverified (two
  // chained .or() calls produce two independent AND conditions).
  switch (filter.verified) {
    case 'liveness':
      query = query.eq('liveness_verified', true);
      break;
    case 'identity':
      query = query.eq('identity_verified', true);
      break;
    case 'student':
      query = query.eq('student_verified', true);
      break;
    case 'none':
      query = query
        .or('identity_verified.is.null,identity_verified.eq.false')
        .or('liveness_verified.is.null,liveness_verified.eq.false');
      break;
  }

  const { data: users, count, error } = await query;

  if (error) console.error('[users/page] query error:', error);

  const total      = count ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // ── Pagination URL helper ─────────────────────────────────────────────────
  function pageUrl(p: number): string {
    const params = new URLSearchParams();
    if (filter.q)          params.set('q',          filter.q);
    if (filter.role)       params.set('role',       filter.role);
    if (filter.status)     params.set('status',     filter.status);
    if (filter.verified)   params.set('verified',   filter.verified);
    if (filter.location)   params.set('location',   filter.location);
    if (filter.university) params.set('university', filter.university);
    if (filter.trust_min)  params.set('trust_min',  filter.trust_min);
    if (filter.trust_max)  params.set('trust_max',  filter.trust_max);
    if (p > 1)             params.set('page',       String(p));
    const qs = params.toString();
    return `/f9-control/users${qs ? `?${qs}` : ''}`;
  }

  // ── Trust score badge colour ──────────────────────────────────────────────
  function trustColour(score: number | null): string {
    const s = score ?? 0;
    if (s >= 70) return 'bg-green-100 text-green-800';
    if (s >= 40) return 'bg-amber-100 text-amber-800';
    return 'bg-red-100 text-red-800';
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <p className="text-sm text-gray-500">
          {total.toLocaleString()} user{total !== 1 ? 's' : ''} total
        </p>
      </div>

      {/* Filter bar — Client Component; reads/writes URL search params */}
      <UsersFilterBar />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['User', 'Role', 'Status', 'Trust', 'Verified', 'Location', 'Joined'].map((h) => (
                  <th key={h} className="px-5 py-3 text-xs font-medium text-gray-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {!users || users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-gray-400 italic">
                    {error
                      ? 'Failed to load users — check server logs.'
                      : 'No users match the current filters.'}
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    {/* Name + email */}
                    <td className="px-5 py-4">
                      <Link
                        href={`/f9-control/users/${u.id}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {u.full_name}
                      </Link>
                      <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[200px]">
                        {u.email}
                      </p>
                    </td>

                    {/* Role */}
                    <td className="px-5 py-4">
                      <span className="capitalize text-xs font-medium text-gray-700">
                        {u.user_type}
                      </span>
                    </td>

                    {/* Account status */}
                    <td className="px-5 py-4">
                      <Badge
                        variant={
                          u.account_status === 'active'
                            ? 'success'
                            : u.account_status === 'suspended'
                              ? 'outline'
                              : 'destructive'
                        }
                        className="capitalize text-xs"
                      >
                        {u.account_status}
                      </Badge>
                    </td>

                    {/* Trust score */}
                    <td className="px-5 py-4">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${trustColour(u.trust_score)}`}>
                        {u.trust_score ?? 0}
                      </span>
                    </td>

                    {/* Verification badges */}
                    <td className="px-5 py-4">
                      <div className="flex gap-1 flex-wrap">
                        {u.liveness_verified && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                            Liveness
                          </span>
                        )}
                        {u.identity_verified && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                            ID
                          </span>
                        )}
                        {u.student_verified && (
                          <span className="text-xs bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded">
                            Student
                          </span>
                        )}
                        {!u.liveness_verified && !u.identity_verified && !u.student_verified && (
                          <span className="text-xs text-gray-400 italic">None</span>
                        )}
                      </div>
                    </td>

                    {/* Location */}
                    <td className="px-5 py-4 text-xs text-gray-500">
                      {u.location ?? '—'}
                    </td>

                    {/* Joined date */}
                    <td className="px-5 py-4 text-xs text-gray-500 whitespace-nowrap">
                      {u.created_at
                        ? new Date(u.created_at).toLocaleDateString('en-NG', {
                            day:   '2-digit',
                            month: 'short',
                            year:  'numeric',
                          })
                        : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between text-sm">
            <p className="text-gray-500">
              Showing {(from + 1).toLocaleString()}–{Math.min(to + 1, total).toLocaleString()} of{' '}
              {total.toLocaleString()}
            </p>
            <div className="flex items-center gap-2">
              {page > 1 ? (
                <Link
                  href={pageUrl(page - 1)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors text-xs font-medium"
                >
                  <ChevronLeft size={13} />
                  Prev
                </Link>
              ) : (
                <span className="flex items-center gap-1 px-3 py-1.5 rounded border border-gray-200 text-gray-300 text-xs font-medium cursor-not-allowed">
                  <ChevronLeft size={13} />
                  Prev
                </span>
              )}

              <span className="px-3 py-1.5 text-gray-700 font-medium text-xs">
                {page} / {totalPages}
              </span>

              {page < totalPages ? (
                <Link
                  href={pageUrl(page + 1)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors text-xs font-medium"
                >
                  Next
                  <ChevronRight size={13} />
                </Link>
              ) : (
                <span className="flex items-center gap-1 px-3 py-1.5 rounded border border-gray-200 text-gray-300 text-xs font-medium cursor-not-allowed">
                  Next
                  <ChevronRight size={13} />
                </span>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}