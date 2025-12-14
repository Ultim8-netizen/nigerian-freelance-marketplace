// src/app/marketplace/seller/products/new/page.tsx
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { CreateProductForm } from '@/components/marketplace/CreateProductForm';

export default async function CreateProductPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirect=/marketplace/seller/products/new');
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">List a Product</h1>
            <p className="text-gray-600">
              Sell your items to students across Nigeria
            </p>
          </div>

          <CreateProductForm />
        </div>
      </div>
    </div>
  );
}