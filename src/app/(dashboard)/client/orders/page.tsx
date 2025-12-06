// src/app/(dashboard)/client/orders/page.tsx
// Client's orders management

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { OrderCard } from '@/components/orders/OrderCard';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default async function ClientOrdersPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/login');
  }

  // Get orders grouped by status
  const { data: pendingOrders } = await supabase
    .from('orders')
    .select(`
      *,
      freelancer:profiles!orders_freelancer_id_fkey(*),
      service:services(*)
    `)
    .eq('client_id', user.id)
    .eq('status', 'pending_payment')
    .order('created_at', { ascending: false });

  const { data: activeOrders } = await supabase
    .from('orders')
    .select(`
      *,
      freelancer:profiles!orders_freelancer_id_fkey(*),
      service:services(*)
    `)
    .eq('client_id', user.id)
    .in('status', ['awaiting_delivery', 'delivered', 'revision_requested'])
    .order('created_at', { ascending: false });

  const { data: completedOrders } = await supabase
    .from('orders')
    .select(`
      *,
      freelancer:profiles!orders_freelancer_id_fkey(*),
      service:services(*)
    `)
    .eq('client_id', user.id)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(20);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">My Orders</h1>
        <p className="text-gray-600">Track and manage your service orders</p>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="pending">
            Pending Payment ({pendingOrders?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="active">
            Active ({activeOrders?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({completedOrders?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          {pendingOrders && pendingOrders.length > 0 ? (
            <div className="grid gap-6">
              {pendingOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  userType="client"
                />
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <p className="text-gray-600">No pending payments</p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="active">
          {activeOrders && activeOrders.length > 0 ? (
            <div className="grid gap-6">
              {activeOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  userType="client"
                />
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <p className="text-gray-600">No active orders</p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="completed">
          {completedOrders && completedOrders.length > 0 ? (
            <div className="grid gap-6">
              {completedOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  userType="client"
                />
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <p className="text-gray-600">No completed orders yet</p>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}