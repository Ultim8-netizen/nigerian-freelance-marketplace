'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Search,
  Ban,
  CheckCircle,
  Loader2,
  Shield,
} from 'lucide-react';

interface User {
  id: string;
  full_name: string;
  email: string;
  user_type: 'freelancer' | 'client' | 'both';
  status: 'active' | 'suspended' | 'pending';
  verified: boolean;
  created_at: string;
  trust_score: number;
}

export function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers();
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/admin/users?search=${encodeURIComponent(search)}`
      );
      const data = await response.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSuspend = async (userId: string) => {
    if (!confirm('Suspend this user?')) return;

    setActionLoading(userId);
    try {
      await fetch(`/api/admin/users/${userId}/suspend`, {
        method: 'POST',
      });
      fetchUsers();
    } catch (error) {
      console.error('Failed to suspend user:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleVerify = async (userId: string) => {
    setActionLoading(userId);
    try {
      await fetch(`/api/admin/users/${userId}/verify`, {
        method: 'POST',
      });
      fetchUsers();
    } catch (error) {
      console.error('Failed to verify user:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'suspended':
        return 'destructive';
      default:
        return 'warning';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
        <p className="text-gray-600 mt-1">Manage platform users and verify accounts</p>
      </div>

      {/* Search */}
      <Card className="p-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </Card>

      {/* Users Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">
                  Trust Score
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{user.full_name}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-600">{user.email}</p>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="outline" className="capitalize">
                        {user.user_type}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={getStatusColor(user.status)}>
                        {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-600"
                            style={{ width: `${user.trust_score}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                          {user.trust_score}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {!user.verified && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleVerify(user.id)}
                            disabled={actionLoading === user.id}
                          >
                            {actionLoading === user.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckCircle className="w-4 h-4 mr-1" />
                            )}
                            Verify
                          </Button>
                        )}
                        {user.status !== 'suspended' && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleSuspend(user.id)}
                            disabled={actionLoading === user.id}
                          >
                            {actionLoading === user.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Ban className="w-4 h-4" />
                            )}
                          </Button>
                        )}
                      </div>
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