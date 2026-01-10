import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { getInitials } from '@/lib/utils';
import Link from 'next/link';
import { Profile } from '@/types/database.types';

interface OrderWithFreelancer {
  freelancer: Profile | null;
}

export default async function HiredFreelancersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Get distinct freelancers from orders
  const { data: orders, error } = await supabase
    .from('orders')
    .select(`
      freelancer:profiles!orders_freelancer_id_fkey(*)
    `)
    .eq('client_id', user.id) as { 
      data: OrderWithFreelancer[] | null; 
      error: unknown;
    };

  if (error) {
    console.error('Error fetching orders:', error);
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Hired Freelancers</h1>
        <div className="text-center py-12 text-red-500">
          Failed to load freelancers. Please try again later.
        </div>
      </div>
    );
  }

  // Deduplicate freelancers
  const freelancersMap = new Map<string, Profile>();
  orders?.forEach((order) => {
    if (order.freelancer) {
      freelancersMap.set(order.freelancer.id, order.freelancer);
    }
  });

  const freelancers = Array.from(freelancersMap.values());

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Hired Freelancers</h1>
      
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {freelancers.map((freelancer) => (
          <Card key={freelancer.id} className="p-6 flex flex-col items-center text-center">
            <Avatar className="w-20 h-20 mb-4">
              <AvatarImage src={freelancer.profile_image_url || undefined} />
              <AvatarFallback>{getInitials(freelancer.full_name)}</AvatarFallback>
            </Avatar>
            <h3 className="font-semibold text-lg">{freelancer.full_name}</h3>
            <p className="text-sm text-gray-500 mb-4">{freelancer.user_type}</p>
            
            <div className="w-full grid grid-cols-2 gap-2 mt-auto">
              <Link href={`/marketplace/sellers/${freelancer.id}`} className="w-full">
                <Button variant="outline" className="w-full">Profile</Button>
              </Link>
              <Button className="w-full">Message</Button>
            </div>
          </Card>
        ))}

        {freelancers.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-500">
                You have not hired any freelancers yet.
            </div>
        )}
      </div>
    </div>
  );
}