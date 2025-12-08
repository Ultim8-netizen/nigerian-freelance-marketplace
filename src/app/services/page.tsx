// src/app/services/page.tsx
// Services browsing page with search, filters, and location proximity

import { createClient } from '@/lib/supabase/server';
import { ServiceCard } from '@/components/services/ServiceCard';
import { ServicesFilters } from '@/components/services/ServicesFilters';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface SearchParams {
  category?: string;
  search?: string;
  min_price?: string;
  max_price?: string;
  state?: string;
  city?: string;
  page?: string;
}

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = createClient();
  const page = parseInt(searchParams.page || '1');
  const perPage = 20;
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  let query = supabase
    .from('services')
    .select(`
      *,
      freelancer:profiles!services_freelancer_id_fkey(
        id,
        full_name,
        profile_image_url,
        freelancer_rating,
        total_jobs_completed
      )
    `, { count: 'exact' })
    .eq('is_active', true);

  // Text search across title, description, and category
  if (searchParams.search) {
    query = query.or(
      `title.ilike.%${searchParams.search}%,description.ilike.%${searchParams.search}%,category.ilike.%${searchParams.search}%`
    );
  }

  // Category filter (partial match for flexibility)
  if (searchParams.category) {
    query = query.ilike('category', `%${searchParams.category}%`);
  }

  // Price range filters
  if (searchParams.min_price) {
    query = query.gte('base_price', parseFloat(searchParams.min_price));
  }
  if (searchParams.max_price) {
    query = query.lte('base_price', parseFloat(searchParams.max_price));
  }

  // Location filter (for proximity, not requirement)
  if (searchParams.state) {
    query = query.ilike('service_location', `%${searchParams.state}%`);
  }
  if (searchParams.city && searchParams.state) {
    query = query.ilike('service_location', `%${searchParams.city}%`);
  }

  const { data: services, count, error } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('Error fetching services:', error);
  }

  const totalPages = Math.ceil((count || 0) / perPage);

  // Get popular categories for quick filters
  const popularCategories = [
    'Academic Services',
    'Tech & Digital',
    'Creative Services',
    'Personal Services',
  ];

  // Build query string helper for pagination
  const buildQueryString = (newPage?: number) => {
    const params = new URLSearchParams();
    if (searchParams.category) params.set('category', searchParams.category);
    if (searchParams.search) params.set('search', searchParams.search);
    if (searchParams.min_price) params.set('min_price', searchParams.min_price);
    if (searchParams.max_price) params.set('max_price', searchParams.max_price);
    if (searchParams.state) params.set('state', searchParams.state);
    if (searchParams.city) params.set('city', searchParams.city);
    if (newPage) params.set('page', newPage.toString());
    return params.toString();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Browse Services</h1>
          <p className="text-gray-600">
            Find talented students offering services across Nigeria
          </p>
        </div>

        {/* Filters Sidebar & Content */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Filters Sidebar */}
          <aside className="lg:w-64 shrink-0">
            <ServicesFilters currentFilters={searchParams} />
          </aside>

          {/* Main Content */}
          <main className="flex-1">
            {/* Quick Category Pills */}
            <div className="mb-6 flex gap-2 flex-wrap">
              <Link href="/services">
                <Button
                  variant={!searchParams.category ? 'default' : 'outline'}
                  size="sm"
                >
                  All Services
                </Button>
              </Link>
              {popularCategories.map((category) => (
                <Link
                  key={category}
                  href={`/services?category=${encodeURIComponent(category)}`}
                >
                  <Button
                    variant={
                      searchParams.category === category ? 'default' : 'outline'
                    }
                    size="sm"
                  >
                    {category}
                  </Button>
                </Link>
              ))}
            </div>

            {/* Active Filters Display */}
            {(searchParams.search ||
              searchParams.state ||
              searchParams.min_price ||
              searchParams.max_price) && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-blue-800">
                    <span className="font-medium">Active filters:</span>
                    {searchParams.search && (
                      <span className="ml-2">
                        Search: &quot;{searchParams.search}&quot;
                      </span>
                    )}
                    {searchParams.state && (
                      <span className="ml-2">Location: {searchParams.state}</span>
                    )}
                    {searchParams.min_price && (
                      <span className="ml-2">
                        Min: ₦{searchParams.min_price}
                      </span>
                    )}
                    {searchParams.max_price && (
                      <span className="ml-2">
                        Max: ₦{searchParams.max_price}
                      </span>
                    )}
                  </div>
                  <Link href="/services">
                    <Button variant="ghost" size="sm">
                      Clear all
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            {/* Results Count */}
            <div className="mb-4 text-sm text-gray-600">
              {count ? (
                <span>
                  Showing {from + 1}-{Math.min(to + 1, count)} of {count} services
                </span>
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
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4">
                  <svg
                    className="mx-auto h-12 w-12"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No services found
                </h3>
                <p className="text-gray-500 mb-4">
                  Try adjusting your filters or search terms
                </p>
                <Link href="/services">
                  <Button variant="outline">Clear filters</Button>
                </Link>
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
                  {/* Show page numbers */}
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
                      <Link
                        key={pageNum}
                        href={`/services?${buildQueryString(pageNum)}`}
                      >
                        <Button
                          variant={page === pageNum ? 'default' : 'outline'}
                          size="sm"
                        >
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