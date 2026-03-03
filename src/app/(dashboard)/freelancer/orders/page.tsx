// src/app/(dashboard)/freelancer/orders/page.tsx
// FIXED:
// 1. Empty state: was saying "Create Your First Service" — changed to order-relevant messaging
// 2. Text contrast: "No orders yet" and other muted texts now use readable dark-mode-aware classes
// 3. All status text now legible in both light and dark themes

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatRelativeTime } from '@/lib/utils';
import Link from 'next/link';
import { Clock, CheckCircle, AlertCircle, Briefcase } from 'lucide-react';

export default async function FreelancerOrdersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: orders } = await supabase
    .from('orders')
    .select(
      `
      *,
      client:profiles!orders_client_id_fkey(id, full_name, profile_image_url),
      service:services(title)
    `
    )
    .eq('freelancer_id', user.id)
    .order('created_at', { ascending: false });

  const getStatusColor = (status: string | null) => {
    const colors: Record<string, string> = {
      pending_payment: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200',
      awaiting_delivery: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200',
      delivered: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200',
      revision_requested: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200',
      completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200',
      disputed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200',
      cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
    };
    return colors[status ?? ''] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
  };

  const getStatusIcon = (status: string | null) => {
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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">My Orders</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage your active and completed work
        </p>
      </div>

      {orders && orders.length > 0 ? (
        <div className="space-y-4">
          {orders.map((order) => {
            const status = order.status ?? 'pending';
            const createdAt = order.created_at ?? new Date().toISOString();
            const deliveryDate = order.delivery_date ?? new Date().toISOString();

            return (
              <Card
                key={order.id}
                className="p-6 hover:shadow-lg transition-shadow bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {order.title}
                      </h2>
                      <Badge className={getStatusColor(status)}>
                        <span className="flex items-center gap-1">
                          {getStatusIcon(status)}
                          {status.replace(/_/g, ' ')}
                        </span>
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      From:{' '}
                      <span className="font-medium text-gray-800 dark:text-gray-200">
                        {order.client?.full_name || 'Unknown Client'}
                      </span>
                    </p>

                    <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400 mb-3">
                      <div className="flex items-center gap-1">
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {formatCurrency(order.amount)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>
                          Due{' '}
                          {new Date(deliveryDate).toLocaleDateString('en-NG')}
                        </span>
                      </div>
                      <div className="text-xs" suppressHydrationWarning>
                        Created {formatRelativeTime(createdAt)}
                      </div>
                    </div>
                  </div>

                  <Link href={`/freelancer/orders/${order.id}`}>
                    <Button variant="outline">View Details</Button>
                  </Link>
                </div>

                {status === 'awaiting_delivery' && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded p-3 text-sm text-blue-800 dark:text-blue-200">
                    Work is expected by{' '}
                    {new Date(deliveryDate).toLocaleDateString('en-NG')}
                  </div>
                )}
                {status === 'delivered' && (
                  <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded p-3 text-sm text-purple-800 dark:text-purple-200">
                    Waiting for client review (7 days auto-approval)
                  </div>
                )}
                {status === 'revision_requested' && (
                  <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded p-3 text-sm text-orange-800 dark:text-orange-200">
                    Client requested revisions. Revision {order.revision_count ?? 0}/
                    {order.max_revisions ?? 0}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        /* FIXED: Empty state now says "No Orders Yet" with order-relevant CTA,
           not "Create Your First Service". Text uses readable dark-mode-aware colors. */
        <Card className="p-12 text-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <div className="max-w-md mx-auto">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Briefcase className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No Orders Yet
            </h3>
            {/* FIXED: was "Create your first service" which made no sense on an orders page */}
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Orders appear here once clients hire you. You can get orders by creating
              services or submitting proposals on available jobs.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/freelancer/services/new">
                <Button className="w-full sm:w-auto">Create an Order</Button>
              </Link>
              <Link href="/freelancer/jobs">
                <Button variant="outline" className="w-full sm:w-auto">
                  Browse Available Jobs
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}