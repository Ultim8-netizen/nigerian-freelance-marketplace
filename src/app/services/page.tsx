// src/app/services/page.tsx
import { createClient } from '@/lib/supabase/server';
import { ServiceCard } from '@/components/services/ServiceCard';
import { ServicesFilters } from '@/components/services/ServicesFilters';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { DashboardNav } from '@/components/layout/DashboardNav';

export default async function ServicesPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  // Await searchParams for Next.js 15 compatibility
  const searchParams = await props.searchParams;
  
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch profile for navigation
  let profile = null;
  if (user) {
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    profile = data;
  }

  // Safe parameter parsing
  const category = typeof searchParams.category === 'string' ? searchParams.category : undefined;
  const search = typeof searchParams.search === 'string' ? searchParams.search : undefined;
  const minPrice = typeof searchParams.min_price === 'string' ? searchParams.min_price : undefined;
  const maxPrice = typeof searchParams.max_price === 'string' ? searchParams.max_price : undefined;
  const state = typeof searchParams.state === 'string' ? searchParams.state : undefined;
  const city = typeof searchParams.city === 'string' ? searchParams.city : undefined;
  const page = typeof searchParams.page === 'string' ? parseInt(searchParams.page) : 1;

  const perPage = 20;
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  // Build query
  let query = supabase
    .from('services')
    .select(`
      *,
      freelancer:profiles!services_freelancer_id_fkey(
        id, full_name, profile_image_url, freelancer_rating, total_jobs_completed
      )
    `, { count: 'exact' })
    .eq('is_active', true);

  // Apply filters
  if (search) {
    query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,category.ilike.%${search}%`);
  }
  if (category) {
    query = query.ilike('category', `%${category}%`);
  }
  if (minPrice) {
    query = query.gte('base_price', parseFloat(minPrice));
  }
  if (maxPrice) {
    query = query.lte('base_price', parseFloat(maxPrice));
  }
  if (state) {
    query = query.ilike('service_location', `%${state}%`);
  }
  if (city && state) {
    query = query.ilike('service_location', `%${city}%`);
  }

  const { data: services, count, error } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('Error fetching services:', error);
  }

  const totalPages = Math.ceil((count || 0) / perPage);
  const popularCategories = ['Academic Services', 'Tech & Digital', 'Creative Services', 'Personal Services'];

  // Build query string for pagination
  const buildQueryString = (newPage?: number) => {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (search) params.set('search', search);
    if (minPrice) params.set('min_price', minPrice);
    if (maxPrice) params.set('max_price', maxPrice);
    if (state) params.set('state', state);
    if (city) params.set('city', city);
    if (newPage) params.set('page', newPage.toString());
    return params.toString();
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Navigation */}
      {user && profile ? (
        <DashboardNav user={user} profile={profile} />
      ) : (
        <header className="bg-white border-b p-4 flex justify-between items-center">
          <Link href="/" className="font-bold text-2xl text-blue-600">F9</Link>
          <div className="flex gap-4">
            <Link href="/login"><Button variant="ghost">Login</Button></Link>
            <Link href="/register"><Button>Sign Up</Button></Link>
          </div>
        </header>
      )}

      <div className="container mx-auto px-4 py-8">
        {/* Header with branding */}
        <div className="mb-8 bg-linear-to-r from-red-600 via-blue-600 to-purple-600 p-8 rounded-2xl text-white shadow-lg">
          <h1 className="text-3xl font-bold mb-2">Browse Services</h1>
          <p className="text-blue-100">Find talented students offering services across Nigeria</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Filters Sidebar */}
          <aside className="lg:w-64 shrink-0">
            <ServicesFilters 
              currentFilters={{ 
                category, 
                search, 
                min_price: minPrice, 
                max_price: maxPrice, 
                state, 
                city 
              }} 
            />
          </aside>

          {/* Main Content */}
          <main className="flex-1">
            {/* Quick Category Pills */}
            <div className="mb-6 flex gap-2 flex-wrap">
              <Link href="/services">
                <Button variant={!category ? 'default' : 'outline'} size="sm" className={!category ? "bg-blue-600 text-white" : "hover:bg-blue-50"}>
                  All Services
                </Button>
              </Link>
              {popularCategories.map((cat) => (
                <Link key={cat} href={`/services?category=${encodeURIComponent(cat)}`}>
                  <Button 
                    variant={category === cat ? 'default' : 'outline'} 
                    size="sm"
                    className={category === cat ? "bg-blue-600 text-white" : "hover:bg-blue-50"}
                  >
                    {cat}
                  </Button>
                </Link>
              ))}
            </div>

            {/* Active Filters Display */}
            {(search || state || minPrice || maxPrice) && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-blue-800">
                    <span className="font-medium">Active filters:</span>
                    {search && <span className="ml-2">Search: &quot;{search}&quot;</span>}
                    {state && <span className="ml-2">Location: {state}</span>}
                    {minPrice && <span className="ml-2">Min: ₦{minPrice}</span>}
                    {maxPrice && <span className="ml-2">Max: ₦{maxPrice}</span>}
                  </div>
                  <Link href="/services">
                    <Button variant="ghost" size="sm">Clear all</Button>
                  </Link>
                </div>
              </div>
            )}

            {/* Results Count */}
            <div className="mb-4 text-sm text-gray-600">
              {count ? (
                <span>Showing {from + 1}-{Math.min(to + 1, count)} of {count} services</span>
              ) : (
                <span>No services found</span>
              )}
            </div>

            {/* Services Grid */}
            {services && services.length > 0 ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {services.map((service) => (
                  <ServiceCard key={service.id} service={service} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="text-gray-400 mb-4">
                  <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No services found</h3>
                <p className="text-gray-500 mb-4">Try adjusting your filters or search terms</p>
                <Link href="/services"><Button variant="outline">Clear filters</Button></Link>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8 flex justify-center items-center gap-2">
                {page > 1 && (
                  <Link href={`/services?${buildQueryString(page - 1)}`}>
                    <Button variant="outline">Previous</Button>
                  </Link>
                )}
                
                <div className="flex items-center gap-2">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }

                    return (
                      <Link key={pageNum} href={`/services?${buildQueryString(pageNum)}`}>
                        <Button variant={page === pageNum ? 'default' : 'outline'} size="sm">
                          {pageNum}
                        </Button>
                      </Link>
                    );
                  })}
                </div>

                {page < totalPages && (
                  <Link href={`/services?${buildQueryString(page + 1)}`}>
                    <Button variant="outline">Next</Button>
                  </Link>
                )}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}