// src/app/(dashboard)/freelancer/dashboard/page.tsx
// Freelancer dashboard

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { DollarSign, Package, Clock, Star } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

type Order = {
  id: string;
  title: string;
  status: string;
};

export default async function FreelancerDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/login');
  }

  // Get profile and wallet
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const { data: wallet } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', user.id)
    .single();

  // Get active orders
  const { data: activeOrders, count: activeCount } = await supabase
    .from('orders')
    .select('*', { count: 'exact' })
    .eq('freelancer_id', user.id)
    .in('status', ['awaiting_delivery', 'delivered']);

  // Get total services
  const { count: servicesCount } = await supabase
    .from('services')
    .select('*', { count: 'exact', head: true })
    .eq('freelancer_id', user.id)
    .eq('is_active', true);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Welcome back, {profile?.full_name}!</h1>

      {/* Stats Grid */}
      <div className="grid md:grid-cols-4 gap-6 mb-8">
        <StatCard
          icon={<DollarSign className="w-6 h-6" />}
          title="Available Balance"
          value={formatCurrency(wallet?.balance || 0)}
          color="bg-green-500"
        />
        <StatCard
          icon={<Clock className="w-6 h-6" />}
          title="Pending Clearance"
          value={formatCurrency(wallet?.pending_clearance || 0)}
          color="bg-yellow-500"
        />
        <StatCard
          icon={<Package className="w-6 h-6" />}
          title="Active Orders"
          value={activeCount?.toString() || '0'}
          color="bg-blue-500"
        />
        <StatCard
          icon={<Star className="w-6 h-6" />}
          title="Rating"
          value={profile?.freelancer_rating?.toFixed(1) || '0.0'}
          color="bg-purple-500"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <Link href="/freelancer/services/new">
              <Button className="w-full">Create New Service</Button>
            </Link>
            <Link href="/freelancer/orders">
              <Button variant="outline" className="w-full">View All Orders</Button>
            </Link>
            <Link href="/freelancer/earnings">
              <Button variant="outline" className="w-full">Manage Earnings</Button>
            </Link>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
          <div className="mb-4 text-sm text-gray-600">
            {servicesCount || 0} active service{servicesCount !== 1 ? 's' : ''}
          </div>
          {activeOrders && activeOrders.length > 0 ? (
            <div className="space-y-3">
              {activeOrders.slice(0, 3).map((order: Order) => (
                <div key={order.id} className="border-l-4 border-blue-500 pl-3 py-2">
                  <p className="font-medium">{order.title}</p>
                  <p className="text-sm text-gray-600">
                    Status: {order.status.replace('_', ' ')}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No active orders</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function StatCard({ icon, title, value, color }: {
  icon: React.ReactNode;
  title: string;
  value: string;
  color: string;
}) {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-4">
        <div className={`${color} text-white p-3 rounded-lg`}>
          {icon}
        </div>
        <div>
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </div>
    </Card>
  );
}