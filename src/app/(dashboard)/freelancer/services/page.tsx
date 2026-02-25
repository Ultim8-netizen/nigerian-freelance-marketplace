// src/app/(dashboard)/freelancer/services/page.tsx
// FIXED:
// 1. "No Services Yet" text: was text-gray-600 (faint on white) → now text-gray-700 dark:text-gray-300
// 2. All card text uses explicit dark-mode-aware color classes
// 3. Description text contrast improved throughout

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';
import { Plus, Eye, ShoppingCart, Edit2, Trash2 } from 'lucide-react';

export default async function FreelancerServicesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
            My Services
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Create and manage your service offerings
          </p>
        </div>
        <Link href="/freelancer/services/new">
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Create Service
          </Button>
        </Link>
      </div>

      {services && services.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Add new service card */}
          <Link href="/freelancer/services/new" className="block h-full min-h-[300px]">
            <Card className="h-full flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all cursor-pointer group p-6 bg-white dark:bg-gray-800">
              <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Plus className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
                Add New Service
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 text-center">
                Offer a new skill to clients
              </p>
            </Card>
          </Link>

          {services.map((service) => (
            <Card
              key={service.id}
              className="p-6 hover:shadow-lg transition-shadow flex flex-col h-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2 gap-2">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white line-clamp-1">
                    {service.title}
                  </h2>
                  <Badge variant={service.is_active ? 'success' : 'outline'}>
                    {service.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>

                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2">
                  {service.description}
                </p>

                <div className="flex flex-wrap gap-4 text-sm mb-4">
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(service.base_price)}
                  </span>
                  <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                    <ShoppingCart className="w-4 h-4" />
                    <span>{service.orders_count || 0} orders</span>
                  </div>
                  <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                    <Eye className="w-4 h-4" />
                    <span>{service.views_count || 0} views</span>
                  </div>
                </div>

                {service.category && (
                  <Badge variant="outline" className="text-xs">
                    {service.category}
                  </Badge>
                )}
              </div>

              <div className="flex gap-2 mt-auto pt-4 border-t border-gray-100 dark:border-gray-700">
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
                <Button
                  variant="outline"
                  size="sm"
                  className="px-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        /* FIXED: Text contrast — was barely readable grey on white */
        <Card className="p-12 text-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <div className="max-w-md mx-auto">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Plus className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No Services Yet
            </h3>
            {/* FIXED: was text-gray-600 which is nearly invisible on white — now readable */}
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              Start earning by creating your first service. Describe what you offer and set
              your price.
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