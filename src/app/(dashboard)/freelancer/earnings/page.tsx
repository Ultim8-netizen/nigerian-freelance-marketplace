// src/app/(dashboard)/freelancer/earnings/page.tsx
// Freelancer earnings and wallet management

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { DollarSign, TrendingUp, AlertCircle, Download } from 'lucide-react';
import Link from 'next/link';

export default async function EarningsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get wallet
  const { data: wallet } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', user.id)
    .single();

  // Get completed orders
  const { data: completedOrders } = await supabase
    .from('orders')
    .select('amount, completed_at')
    .eq('freelancer_id', user.id)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false });

  // Calculate earnings stats
  const totalEarnings = completedOrders?.reduce((sum, o) => sum + o.amount, 0) || 0;
  const thisMonth = completedOrders?.filter(o => {
    const date = new Date(o.completed_at);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }).reduce((sum, o) => sum + o.amount, 0) || 0;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Earnings</h1>
        <p className="text-gray-600">Track your income and manage withdrawals</p>
      </div>

      {/* Wallet Summary */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-600 text-sm">Available Balance</span>
            <DollarSign className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-3xl font-bold text-green-600">
            {formatCurrency(wallet?.balance || 0)}
          </p>
          <p className="text-xs text-gray-500 mt-2">Ready to withdraw</p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-600 text-sm">Pending Clearance</span>
            <AlertCircle className="w-5 h-5 text-orange-600" />
          </div>
          <p className="text-3xl font-bold text-orange-600">
            {formatCurrency(wallet?.pending_clearance || 0)}
          </p>
          <p className="text-xs text-gray-500 mt-2">14-day holding period</p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-600 text-sm">Total Earned</span>
            <TrendingUp className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-blue-600">
            {formatCurrency(totalEarnings)}
          </p>
          <p className="text-xs text-gray-500 mt-2">All time earnings</p>
        </Card>
      </div>

      {/* This Month */}
      <Card className="p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">This Month</h2>
          <span className="text-2xl font-bold text-blue-600">
            {formatCurrency(thisMonth)}
          </span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full">
          <div 
            className="h-2 bg-blue-600 rounded-full"
            style={{ width: '65%' }}
          />
        </div>
        <p className="text-sm text-gray-600 mt-2">
          {completedOrders?.filter(o => {
            const date = new Date(o.completed_at);
            const now = new Date();
            return date.getMonth() === now.getMonth();
          }).length || 0} orders completed
        </p>
      </Card>

      {/* Withdrawal Section */}
      <Card className="p-6 mb-8 border-green-200 bg-green-50">
        <h2 className="text-lg font-semibold mb-4">Withdraw Funds</h2>
        {wallet && wallet.balance > 5000 ? (
          <div>
            <p className="text-sm text-gray-700 mb-4">
              You have {formatCurrency(wallet.balance)} available to withdraw.
            </p>
            <Button className="bg-green-600 hover:bg-green-700">
              <Download className="w-4 h-4 mr-2" />
              Withdraw Now
            </Button>
          </div>
        ) : (
          <div className="text-sm text-gray-700">
            <p>Minimum withdrawal amount is ₦5,000</p>
            <p className="mt-2">You need {formatCurrency(5000 - (wallet?.balance || 0))} more to withdraw</p>
          </div>
        )}
      </Card>

      {/* Recent Orders */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Recent Completed Orders</h2>
        {completedOrders && completedOrders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr>
                  <th className="text-left py-2">Date</th>
                  <th className="text-left py-2">Amount</th>
                  <th className="text-left py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {completedOrders.slice(0, 10).map((order, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 text-gray-600">
                      {new Date(order.completed_at).toLocaleDateString('en-NG')}
                    </td>
                    <td className="py-2 font-medium">{formatCurrency(order.amount)}</td>
                    <td className="py-2">
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                        Completed
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-600">No completed orders yet</p>
        )}
      </Card>
    </div>
  );
}