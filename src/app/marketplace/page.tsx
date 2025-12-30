// src/app/marketplace/page.tsx
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ProductCard } from '@/components/marketplace/ProductCard';
import { MarketplaceFilters } from '@/components/marketplace/Filters';
import { DashboardNav } from '@/components/layout/DashboardNav';
import { Product } from '@/types/marketplace.types';

export default async function MarketplacePage(props: { 
  searchParams: Promise<{ [key: string]: string | string[] | undefined }> 
}) {
  const supabase = await createClient();
  
  // Authentication check - redirect if not logged in
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login?redirect=/marketplace');
  }

  // Fetch profile for navigation
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  
  // Await search params for Next.js 15 compatibility
  const searchParams = await props.searchParams;
  
  // Safe parameter parsing
  const category = typeof searchParams.category === 'string' ? searchParams.category : undefined;
  const search = typeof searchParams.search === 'string' ? searchParams.search : undefined;
  
  // Build query with filters
  let query = supabase
    .from('products')
    .select('*, seller:profiles!products_seller_id_fkey(*)')
    .eq('is_active', true);
  
  // Apply filters
  if (category) {
    query = query.eq('category', category);
  }
  
  if (search) {
    query = query.ilike('title', `%${search}%`);
  }
  
  // Execute query with type safety
  const { data: products, error } = await query.order('created_at', { ascending: false }) as { 
    data: Product[] | null;
    error: unknown;
  };

  if (error) {
    console.error('Error fetching products:', error);
  }
  
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Navigation */}
      <DashboardNav user={user} profile={profile} />
      
      <div className="container mx-auto px-4 py-8">
        <div className="flex gap-6">
          {/* Sidebar Filters */}
          <aside className="w-64 shrink-0 hidden lg:block">
            <div className="sticky top-24">
              <MarketplaceFilters currentFilters={{ category, search }} />
            </div>
          </aside>
          
          {/* Main Content */}
          <main className="flex-1">
            {/* Branded Header */}
            <div className="mb-6 bg-linear-to-r from-purple-600 to-pink-600 p-6 rounded-xl text-white shadow-md">
              <h1 className="text-3xl font-bold mb-2">Student Marketplace</h1>
              <p className="opacity-90">Buy and sell within your university community</p>
            </div>

            {/* Mobile Filters Toggle - Show on small screens */}
            <div className="lg:hidden mb-4">
              <MarketplaceFilters currentFilters={{ category, search }} />
            </div>
            
            {/* Products Grid */}
            {products && products.length > 0 ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300 shadow-sm">
                <div className="text-gray-400 mb-4">
                  <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </div>
                <p className="text-gray-600 text-lg font-medium mb-2">No products found</p>
                <p className="text-gray-500 text-sm mb-4">
                  Try adjusting your filters or browse all categories
                </p>
                <div className="flex gap-3 justify-center">
                  <a 
                    href="/marketplace" 
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Clear Filters
                  </a>
                  <a 
                    href="/marketplace/seller/products/new" 
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-purple-600 hover:bg-purple-700"
                  >
                    List a Product
                  </a>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}