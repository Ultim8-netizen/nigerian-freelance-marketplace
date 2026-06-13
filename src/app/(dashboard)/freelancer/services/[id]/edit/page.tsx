// src/app/(dashboard)/freelancer/services/[id]/edit/page.tsx
// Service edit page. Ownership enforced at query level.

import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import EditServiceForm from '@/components/services/EditServiceForm';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default async function EditServicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: serviceId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: service, error } = await supabase
    .from('services')
    .select(
      'id, title, description, category, base_price, requirements, tags, is_active, service_location, remote_ok, location_required'
    )
    .eq('id', serviceId)
    .eq('freelancer_id', user.id) // ownership enforced at query level
    .single();

  if (error || !service) notFound();

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="mb-6">
        <Link href="/freelancer/services">
          <Button variant="ghost" size="sm" className="gap-2 pl-0 hover:pl-2 transition-all">
            <ArrowLeft className="w-4 h-4" />
            Back to Services
          </Button>
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mt-2">Edit Service</h1>
        <p className="text-gray-600 dark:text-gray-400">Update your service details and pricing.</p>
      </div>

      <EditServiceForm service={service} />
    </div>
  );
}