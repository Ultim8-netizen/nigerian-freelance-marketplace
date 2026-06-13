// src/app/(dashboard)/client/orders/page.tsx

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { OrderCard } from '@/components/orders/OrderCard';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Hoisted to module scope — fixes react-hooks/static-components
function EmptyState({ message }: { message: string }) {
  return (
    <Card className="p-12 text-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
      <p className="text-gray-500 dark:text-gray-400">{message}</p>
    </Card>
  );
}

export default async function ClientOrdersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const selectFragment = `
    *,
    freelancer:profiles!orders_freelancer_id_fkey(id, full_name, profile_image_url),
    service:services(title)
  `;

  const [
    { data: pendingOrders },
    { data: activeOrders },
    { data: completedOrders },
    { data: cancelledOrders },
  ] = await Promise.all([
    supabase
      .from('orders')
      .select(selectFragment)
      .eq('client_id', user.id)
      .eq('status', 'pending_payment')
      .order('created_at', { ascending: false }),

    supabase
      .from('orders')
      .select(selectFragment)
      .eq('client_id', user.id)
      .in('status', ['awaiting_delivery', 'delivered', 'revision_requested', 'disputed'])
      .order('created_at', { ascending: false }),

    supabase
      .from('orders')
      .select(selectFragment)
      .eq('client_id', user.id)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(20),

    supabase
      .from('orders')
      .select(selectFragment)
      .eq('client_id', user.id)
      .eq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          My Orders
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Track and manage your service orders
        </p>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="pending">
            Pending ({pendingOrders?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="active">
            Active ({activeOrders?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({completedOrders?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="cancelled">
            Cancelled ({cancelledOrders?.length ?? 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          {pendingOrders && pendingOrders.length > 0 ? (
            <div className="grid gap-4">
              {pendingOrders.map((order) => (
                <OrderCard key={order.id} order={order} userType="client" />
              ))}
            </div>
          ) : (
            <EmptyState message="No pending payments" />
          )}
        </TabsContent>

        <TabsContent value="active">
          {activeOrders && activeOrders.length > 0 ? (
            <div className="grid gap-4">
              {activeOrders.map((order) => (
                <OrderCard key={order.id} order={order} userType="client" />
              ))}
            </div>
          ) : (
            <EmptyState message="No active orders" />
          )}
        </TabsContent>

        <TabsContent value="completed">
          {completedOrders && completedOrders.length > 0 ? (
            <div className="grid gap-4">
              {completedOrders.map((order) => (
                <OrderCard key={order.id} order={order} userType="client" />
              ))}
            </div>
          ) : (
            <EmptyState message="No completed orders yet" />
          )}
        </TabsContent>

        <TabsContent value="cancelled">
          {cancelledOrders && cancelledOrders.length > 0 ? (
            <div className="grid gap-4">
              {cancelledOrders.map((order) => (
                <OrderCard key={order.id} order={order} userType="client" />
              ))}
            </div>
          ) : (
            <EmptyState message="No cancelled orders" />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}