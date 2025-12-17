'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  DollarSign,
} from 'lucide-react';

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  pendingVerifications: number;
  completedTransactions: number;
  totalRevenue: number;
  averageOrderValue: number;
  recentReports: Array<{
    id: string;
    type: string;
    status: 'open' | 'resolved' | 'pending';
    createdAt: string;
  }>;
}

export function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/admin/stats');
        const data = await response.json();
        setStats(data);
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return <div className="text-center py-12">Loading dashboard...</div>;
  }

  if (!stats) {
    return <div className="text-center py-12 text-red-600">Failed to load stats</div>;
  }

  const statCards = [
    {
      title: 'Total Users',
      value: stats.totalUsers,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Active Users',
      value: stats.activeUsers,
      icon: TrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Pending Verifications',
      value: stats.pendingVerifications,
      icon: Clock,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
    },
    {
      title: 'Completed Transactions',
      value: stats.completedTransactions,
      icon: CheckCircle,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      title: 'Total Revenue',
      value: `₦${stats.totalRevenue.toLocaleString()}`,
      icon: DollarSign,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
    },
    {
      title: 'Avg Order Value',
      value: `₦${stats.averageOrderValue.toLocaleString()}`,
      icon: DollarSign,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome back to the admin panel</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card
              key={stat.title}
              className={`p-6 ${stat.bgColor} border-0 shadow-sm hover:shadow-md transition-shadow`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-medium">
                    {stat.title}
                  </p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {stat.value}
                  </p>
                </div>
                <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Recent Reports */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Recent Reports</h2>
        {stats.recentReports.length === 0 ? (
          <p className="text-gray-500 text-sm">No recent reports</p>
        ) : (
          <div className="space-y-3">
            {stats.recentReports.map((report) => (
              <div
                key={report.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                  <div>
                    <p className="font-medium text-sm text-gray-900">
                      {report.type}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(report.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <Badge
                  variant={
                    report.status === 'resolved'
                      ? 'success'
                      : report.status === 'pending'
                      ? 'warning'
                      : 'destructive'
                  }
                >
                  {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Quick Actions */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <a
            href="/admin/users"
            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-center"
          >
            <Users className="w-6 h-6 mx-auto mb-2 text-blue-600" />
            <p className="font-medium text-sm">Manage Users</p>
          </a>
          <a
            href="/admin/reports"
            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-center"
          >
            <AlertCircle className="w-6 h-6 mx-auto mb-2 text-amber-600" />
            <p className="font-medium text-sm">View Reports</p>
          </a>
          <a
            href="/admin/analytics"
            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-center"
          >
            <TrendingUp className="w-6 h-6 mx-auto mb-2 text-green-600" />
            <p className="font-medium text-sm">Analytics</p>
          </a>
        </div>
      </Card>
    </div>
  );
}