import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrustBadge, type TrustLevel } from '@/components/ui/TrustBadge';
import Link from 'next/link';
import { UsersFilterBar } from './UsersFilterBar'; // FIX #3 — was never imported

interface SearchParams {
  q?:          string;
  role?:       string;
  status?:     string;
  verified?:   string;
  location?:   string;
  university?: string;
  trust_min?:  string;
  trust_max?:  string;
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createClient();

  // Build query — applies every searchParam that is present
  let query = supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (searchParams.q) {
    query = query.ilike('full_name', `%${searchParams.q}%`);
  }
  if (searchParams.role) {
    query = query.eq('user_type', searchParams.role);
  }
  if (searchParams.status) {
    query = query.eq('account_status', searchParams.status);
  }
  if (searchParams.location) {
    query = query.ilike('location', `%${searchParams.location}%`);
  }
  if (searchParams.university) {
    query = query.ilike('university', `%${searchParams.university}%`);
  }
  if (searchParams.trust_min) {
    query = query.gte('trust_score', Number(searchParams.trust_min));
  }
  if (searchParams.trust_max) {
    query = query.lte('trust_score', Number(searchParams.trust_max));
  }

  // Verification filters — three separate boolean columns on profiles
  if (searchParams.verified === 'liveness') {
    query = query.eq('liveness_verified', true);
  } else if (searchParams.verified === 'identity') {
    query = query.eq('identity_verified', true);
  } else if (searchParams.verified === 'student') {
    query = query.eq('student_verified', true);
  } else if (searchParams.verified === 'none') {
    query = query
      .eq('liveness_verified', false)
      .eq('identity_verified', false)
      .eq('student_verified', false);
  }

  const { data: users } = await query;

  const activeFilters = Object.values(searchParams).filter(Boolean).length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Directory</h1>
          {activeFilters > 0 && (
            <p className="text-sm text-gray-500 mt-0.5">
              {users?.length ?? 0} result{users?.length === 1 ? '' : 's'} ·{' '}
              {activeFilters} filter{activeFilters === 1 ? '' : 's'} applied
            </p>
          )}
        </div>
      </div>

      {/* FIX #3 — render the filter bar (previously omitted from this file) */}
      <UsersFilterBar />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 font-medium text-gray-500">Name</th>
                <th className="px-6 py-3 font-medium text-gray-500">Email</th>
                <th className="px-6 py-3 font-medium text-gray-500">Role</th>
                <th className="px-6 py-3 font-medium text-gray-500">Trust Score</th>
                <th className="px-6 py-3 font-medium text-gray-500">Verified</th>
                <th className="px-6 py-3 font-medium text-gray-500">Status</th>
                <th className="px-6 py-3 font-medium text-gray-500">Joined</th>
                <th className="px-6 py-3 text-right font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {!users || users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-sm text-gray-400 italic">
                    No users found matching the current filters.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {user.full_name}
                      {user.university && (
                        <p className="text-xs text-gray-400 font-normal">{user.university}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-600 text-xs">{user.email}</td>
                    <td className="px-6 py-4 capitalize">{user.user_type}</td>
                    <td className="px-6 py-4">
                      <TrustBadge
                        level={(user.trust_level || 'new') as TrustLevel}
                        score={user.trust_score || 0}
                        size="sm"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-0.5">
                        {user.liveness_verified && (
                          <span className="text-xs text-green-700 font-medium">✓ Liveness</span>
                        )}
                        {user.identity_verified && (
                          <span className="text-xs text-green-700 font-medium">✓ Identity</span>
                        )}
                        {user.student_verified && (
                          <span className="text-xs text-green-700 font-medium">✓ Student</span>
                        )}
                        {!user.liveness_verified && !user.identity_verified && !user.student_verified && (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        variant={user.account_status === 'active' ? 'success' : 'destructive'}
                      >
                        {user.account_status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-xs">
                      {user.created_at
                        ? new Date(user.created_at).toLocaleDateString()
                        : 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/f9-control/users/${user.id}`}
                        className="text-blue-600 hover:underline font-medium text-xs"
                      >
                        View Profile
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}