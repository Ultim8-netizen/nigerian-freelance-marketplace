// src/app/(dashboard)/freelancer/orders/page.tsx
// Freelancer orders management

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatRelativeTime } from '@/lib/utils';
import Link from 'next/link';
import { Clock, CheckCircle, AlertCircle } from 'lucide-react';

export default async function FreelancerOrdersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: orders } = await supabase
    .from('orders')
    .select(`
      *,
      client:profiles!orders_client_id_fkey(id, full_name, profile_image_url),
      service:services(title)
    `)
    .eq('freelancer_id', user.id)
    .order('created_at', { ascending: false });

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending_payment: 'bg-yellow-100 text-yellow-800',
      awaiting_delivery: 'bg-blue-100 text-blue-800',
      delivered: 'bg-purple-100 text-purple-800',
      revision_requested: 'bg-orange-100 text-orange-800',
      completed: 'bg-green-100 text-green-800',
      disputed: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'awaiting_delivery':
        return <Clock className="w-4 h-4" />;
      case 'disputed':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">My Orders</h1>
        <p className="text-gray-600">Manage your active and completed work</p>
      </div>

      {orders && orders.length > 0 ? (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card key={order.id} className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className="text-lg font-semibold">{order.title}</h2>
                    <Badge className={getStatusColor(order.status)}>
                      <span className="flex items-center gap-1">
                        {getStatusIcon(order.status)}
                        {order.status.replace(/_/g, ' ')}
                      </span>
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    From: {order.client?.full_name}
                  </p>

                  <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-3">
                    <div className="flex items-center gap-1">
                      <span className="font-medium">{formatCurrency(order.amount)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>Due {new Date(order.delivery_date).toLocaleDateString('en-NG')}</span>
                    </div>
                    <div className="text-xs">
                      Created {formatRelativeTime(order.created_at)}
                    </div>
                  </div>
                </div>

                <Link href={`/freelancer/orders/${order.id}`}>
                  <Button variant="outline">View Details</Button>
                </Link>
              </div>

              {/* Status-specific info */}
              {order.status === 'awaiting_delivery' && (
                <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800">
                  Work is expected by {new Date(order.delivery_date).toLocaleDateString('en-NG')}
                </div>
              )}
              {order.status === 'delivered' && (
                <div className="bg-purple-50 border border-purple-200 rounded p-3 text-sm text-purple-800">
                  Waiting for client review (7 days auto-approval)
                </div>
              )}
              {order.status === 'revision_requested' && (
                <div className="bg-orange-50 border border-orange-200 rounded p-3 text-sm text-orange-800">
                  Client requested revisions. Revision {order.revision_count}/{order.max_revisions}
                </div>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <div className="max-w-md mx-auto">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No Orders Yet</h3>
            <p className="text-gray-600 mb-6">
              Create services and start receiving orders from clients
            </p>
            <Link href="/freelancer/services/new">
              <Button>Create Your First Service</Button>
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}