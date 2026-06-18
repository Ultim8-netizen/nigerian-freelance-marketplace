// src/app/marketplace/page.tsx
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ProductCard } from '@/components/marketplace/ProductCard';
import { MarketplaceFilters } from '@/components/marketplace/Filters';
import { MarketplaceSearch } from '@/components/marketplace/SearchBar';
import { DashboardNav } from '@/components/layout/DashboardNav';
import type { ProductWithSeller } from '@/types/marketplace.types';

export default async function MarketplacePage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login?redirect=/marketplace');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  // Next.js 15: searchParams is a Promise.
  const searchParams = await props.searchParams;

  // ── Extract all filter params sent by Filters.tsx ────────────────────────
  // FIX: previously only category and search were read; condition, min_price,
  // max_price, and state were silently ignored, making 4 of 6 filters inert.
  const category  = typeof searchParams.category  === 'string' ? searchParams.category  : undefined;
  const search    = typeof searchParams.search    === 'string' ? searchParams.search    : undefined;
  const condition = typeof searchParams.condition === 'string' ? searchParams.condition : undefined;
  const minPrice  = typeof searchParams.min_price === 'string' ? searchParams.min_price : undefined;
  const maxPrice  = typeof searchParams.max_price === 'string' ? searchParams.max_price : undefined;
  const state     = typeof searchParams.state     === 'string' ? searchParams.state     : undefined;

  // ── Build query with all active filters ──────────────────────────────────
  let query = supabase
    .from('products')
    .select('*, seller:profiles!products_seller_id_fkey(*)')
    .eq('is_active', true);

  if (category)  query = query.eq('category', category);
  if (condition) query = query.eq('condition', condition);
  if (search)    query = query.ilike('title', `%${search}%`);
  if (minPrice)  query = query.gte('price', parseFloat(minPrice));
  if (maxPrice)  query = query.lte('price', parseFloat(maxPrice));
  // products.location stores the seller-provided pickup location; filtering
  // it with the state name (ilike) gives approximate geographic filtering
  // consistent with how CreateProductForm populates the field.
  if (state)     query = query.ilike('location', `%${state}%`);

  const { data: products, error } = await query
    .order('created_at', { ascending: false }) as {
      data: ProductWithSeller[] | null;
      error: unknown;
    };

  if (error) {
    console.error('Error fetching products:', error);
  }

  const currentFilters = { category, search, condition, min_price: minPrice, max_price: maxPrice, state };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <DashboardNav user={user} profile={profile ?? {}} />

      <div className="container mx-auto px-4 py-8">
        <div className="flex gap-6">
          {/* Sidebar Filters */}
          <aside className="w-64 shrink-0 hidden lg:block">
            <div className="sticky top-24">
              <MarketplaceFilters currentFilters={currentFilters} />
            </div>
          </aside>

          <main className="flex-1">
            {/* Branded Header — MarketplaceSearch rendered here so the
                search input is wired up to the page. The component routes to
                /marketplace?search=... which this page now correctly reads. */}
            <div className="mb-6 bg-linear-to-r from-purple-600 to-pink-600 p-6 rounded-xl text-white shadow-md">
              <h1 className="text-3xl font-bold mb-1">Student Marketplace</h1>
              <p className="opacity-90 mb-4">Buy and sell within your university community</p>
              <MarketplaceSearch />
            </div>

            {/* Mobile Filters */}
            <div className="lg:hidden mb-4">
              <MarketplaceFilters currentFilters={currentFilters} />
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
                  {/* FIX: restored missing opening <a tags on both anchors */}
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
          </main>{/* FIX: restored missing </main> closing tag */}
        </div>
      </div>
    </div>
  );
}