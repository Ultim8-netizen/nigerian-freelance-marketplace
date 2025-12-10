// src/components/admin/VerificationRevenueDashboard.tsx
'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  Shield,
  Calendar,
  Download
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';

interface RevenueStats {
  total_revenue: number;
  today_revenue: number;
  this_week_revenue: number;
  this_month_revenue: number;
  total_verifications: number;
  recent_verifications: Array<{
    id: string;
    user_name: string;
    amount: number;
    created_at: string;
  }>;
}

export function VerificationRevenueDashboard() {
  const [stats, setStats] = useState<RevenueStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/admin/verification-revenue');
      const result = await response.json();
      
      if (result.success) {
        setStats(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !stats) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">NIN Verification Revenue</h2>
        <Badge className="bg-blue-600">
          <Shield className="w-3 h-3 mr-1" />
          Live Data
        </Badge>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Total Revenue</span>
            <DollarSign className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-green-600">
            {formatCurrency(stats.total_revenue, 'NGN', { showDecimals: false })}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            From {stats.total_verifications} verifications
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Today</span>
            <Calendar className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-2xl font-bold">
            {formatCurrency(stats.today_revenue, 'NGN', { showDecimals: false })}
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">This Week</span>
            <TrendingUp className="w-5 h-5 text-purple-600" />
          </div>
          <p className="text-2xl font-bold">
            {formatCurrency(stats.this_week_revenue, 'NGN', { showDecimals: false })}
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">This Month</span>
            <Users className="w-5 h-5 text-orange-600" />
          </div>
          <p className="text-2xl font-bold">
            {formatCurrency(stats.this_month_revenue, 'NGN', { showDecimals: false })}
          </p>
        </Card>
      </div>

      {/* Recent Verifications */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Recent Verifications</h3>
          <button className="text-sm text-blue-600 hover:underline flex items-center gap-1">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>

        <div className="space-y-3">
          {stats.recent_verifications.map((verification) => (
            <div 
              key={verification.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <Shield className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium">{verification.user_name}</p>
                  <p className="text-xs text-gray-500">
                    {formatDate(verification.created_at)}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-green-600">
                  {formatCurrency(verification.amount, 'NGN', { showDecimals: false })}
                </p>
                <Badge variant="secondary" className="text-xs">
                  Verified
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}