// src/app/marketplace/page.tsx
// FIXED: Authentication requirement, filter visibility, source map issues

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ProductCard } from '@/components/marketplace/ProductCard';
import { MarketplaceFilters } from '@/components/marketplace/Filters';
import { Product } from '@/types/marketplace.types';

interface SearchParams {
  category?: string;
  search?: string;
}

export default async function MarketplacePage({ 
  searchParams 
}: { 
  searchParams: SearchParams 
}) {
  const supabase = await createClient();
  
  // AUTHENTICATION CHECK - Redirect if not logged in
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/login?redirect=/marketplace');
  }
  
  // Build query with filters
  let query = supabase
    .from('products')
    .select('*, seller:profiles!products_seller_id_fkey(*)')
    .eq('is_active', true);
  
  // Apply filters safely
  const categoryParam = searchParams?.category;
  const searchParam = searchParams?.search;
  
  if (categoryParam) {
    query = query.eq('category', categoryParam);
  }
  
  if (searchParam) {
    query = query.ilike('title', `%${searchParam}%`);
  }
  
  // Execute query
  const { data: products } = await query.order('created_at', { ascending: false }) as { data: Product[] | null };
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex gap-6">
          {/* Sidebar Filters - FIXED VISIBILITY */}
          <aside className="w-64 shrink-0">
            <div className="sticky top-4">
              <MarketplaceFilters currentFilters={searchParams || {}} />
            </div>
          </aside>
          
          {/* Main Content */}
          <main className="flex-1">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Student Marketplace</h1>
              <p className="text-gray-600">
                Buy and sell within your university community
              </p>
            </div>
            
            {/* Products Grid */}
            {products && products.length > 0 ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300">
                <p className="text-gray-600 text-lg mb-4">No products found</p>
                <p className="text-gray-500 text-sm">
                  Try adjusting your filters or{' '}
                  <a href="/marketplace/seller/products/new" className="text-blue-600 hover:underline">
                    list a product
                  </a>
                </p>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}