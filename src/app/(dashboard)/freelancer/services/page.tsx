// src/app/(dashboard)/freelancer/services/page.tsx
// Freelancer services management

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';
import { Plus, Eye, ShoppingCart, Star, Edit2, Trash2 } from 'lucide-react';

export default async function FreelancerServicesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: services } = await supabase
    .from('services')
    .select('*')
    .eq('freelancer_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">My Services</h1>
          <p className="text-gray-600">Create and manage your service offerings</p>
        </div>
        <Link href="/freelancer/services/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Create Service
          </Button>
        </Link>
      </div>

      {services && services.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* CLICKABLE ADD CARD */}
          <Link href="/freelancer/services/new" className="block h-full min-h-[300px]">
            <Card className="h-full flex flex-col items-center justify-center border-2 border-dashed border-gray-300 hover:border-blue-500 hover:bg-blue-50 transition-all cursor-pointer group p-6">
              <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Plus className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="font-semibold text-lg text-gray-900">Add New Service</h3>
              <p className="text-sm text-gray-500 mt-2 text-center">Offer a new skill to clients</p>
            </Card>
          </Link>

          {services.map((service) => (
            <Card key={service.id} className="p-6 hover:shadow-lg transition-shadow flex flex-col h-full">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2 gap-2">
                  <h2 className="text-lg font-semibold line-clamp-1">{service.title}</h2>
                  <Badge variant={service.is_active ? "success" : "outline"}>
                    {service.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>

                <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                  {service.description}
                </p>

                <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-4">
                  <span className="font-medium text-gray-900">
                    {formatCurrency(service.base_price)}
                  </span>
                  <div className="flex items-center gap-1">
                    <ShoppingCart className="w-4 h-4" />
                    <span>{service.orders_count || 0}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Eye className="w-4 h-4" />
                    <span>{service.views_count || 0}</span>
                  </div>
                  {service.rating && (
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span>{service.rating.toFixed(1)} ({service.reviews_count || 0})</span>
                    </div>
                  )}
                </div>

                {service.category && (
                  <Badge variant="outline" className="text-xs">
                    {service.category}
                  </Badge>
                )}
              </div>

              <div className="flex gap-2 mt-auto pt-4 border-t">
                <Link href={`/services/${service.id}`} className="flex-1">
                  <Button variant="outline" size="sm" className="w-full">
                    View
                  </Button>
                </Link>
                <Link href={`/freelancer/services/${service.id}/edit`}>
                  <Button variant="outline" size="sm" className="px-2">
                    <Edit2 className="w-4 h-4" />
                  </Button>
                </Link>
                <Button variant="outline" size="sm" className="px-2 text-red-600 hover:text-red-700">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <div className="max-w-md mx-auto">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Plus className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No Services Yet</h3>
            <p className="text-gray-600 mb-6">
              Start earning by creating your first service. Describe what you offer and set your price.
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