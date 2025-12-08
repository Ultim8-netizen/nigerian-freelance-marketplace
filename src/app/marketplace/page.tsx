// src/app/marketplace/page.tsx
import { createClient } from '@/lib/supabase/server';
import { ProductCard } from '@/components/marketplace/ProductCard';
import { MarketplaceFilters } from '@/components/marketplace/Filters';

export default async function MarketplacePage({ searchParams }) {
  const supabase = createClient();
  
  let query = supabase
    .from('products')
    .select('*, seller:profiles!products_seller_id_fkey(*)')
    .eq('is_active', true);
  
  if (searchParams.category) query = query.eq('category', searchParams.category);
  if (searchParams.search) query = query.ilike('title', `%${searchParams.search}%`);
  
  const { data: products } = await query.order('created_at', { ascending: false });
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex gap-6">
        <aside className="w-64">
          <MarketplaceFilters currentFilters={searchParams} />
        </aside>
        
        <main className="flex-1">
          <h1 className="text-3xl font-bold mb-6">Student Marketplace</h1>
          
          {products?.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <p className="text-gray-600">No products found</p>
          )}
        </main>
      </div>
    </div>
  );
}