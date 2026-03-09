import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrustBadge, type TrustLevel } from '@/components/ui/TrustBadge';
import Link from 'next/link';

export default async function AdminUsersPage({ searchParams }: { searchParams: { q?: string } }) {
  const supabase = await createClient();
  const query = searchParams.q || '';

  let dbQuery = supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(50);
  if (query) {
    dbQuery = dbQuery.ilike('full_name', `%${query}%`);
  }

  const { data: users } = await dbQuery;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">User Directory</h1>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 font-medium text-gray-500">Name</th>
                <th className="px-6 py-3 font-medium text-gray-500">Role</th>
                <th className="px-6 py-3 font-medium text-gray-500">Trust Score</th>
                <th className="px-6 py-3 font-medium text-gray-500">Status</th>
                <th className="px-6 py-3 font-medium text-gray-500">Joined</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users?.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{user.full_name}</td>
                  <td className="px-6 py-4 capitalize">{user.user_type}</td>
                  <td className="px-6 py-4">
                    {/* FIXED: Use valid TrustLevel value 'new' as default (not 'basic') */}
                    <TrustBadge level={(user.trust_level || 'new') as TrustLevel} score={user.trust_score || 0} size="sm" />
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={user.account_status === 'active' ? 'success' : 'destructive'}>
                      {user.account_status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {/* FIXED: Add null check before creating Date - created_at is string | null */}
                    {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link href={`/f9-control/users/${user.id}`} className="text-blue-600 hover:underline">
                      View Profile
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}