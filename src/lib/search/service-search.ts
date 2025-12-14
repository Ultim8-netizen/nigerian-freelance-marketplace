// src/lib/search/service-search.ts
import { createClient } from '@/lib/supabase/server';

interface SearchFilters {
  category?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  state?: string;
  verifiedOnly?: boolean;
  page?: number;
  perPage?: number;
}

export async function searchServices(filters: SearchFilters) {
  const supabase = await createClient();
  const page = filters.page || 1;
  const perPage = filters.perPage || 20;
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
        total_jobs_completed,
        trust_level,
        trust_score,
        liveness_verified,
        identity_verified
      )
    `, { count: 'exact' })
    .eq('is_active', true);

  // Apply filters
  if (filters.category) {
    query = query.ilike('category', `%${filters.category}%`);
  }

  if (filters.search) {
    query = query.or(
      `title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
    );
  }

  if (filters.minPrice) {
    query = query.gte('base_price', filters.minPrice);
  }

  if (filters.maxPrice) {
    query = query.lte('base_price', filters.maxPrice);
  }

  if (filters.state) {
    query = query.ilike('service_location', `%${filters.state}%`);
  }

  if (filters.verifiedOnly) {
    query = query.eq('freelancer.liveness_verified', true);
  }

  // Fetch results
  const { data: services, count, error } = await query.range(from, to);

  if (error) throw error;

  // Apply trust-based ranking boost
  const rankedServices = (services || []).sort((a, b) => {
    // Trust score multiplier
    const trustMultiplierA = getTrustMultiplier(a.freelancer.trust_level);
    const trustMultiplierB = getTrustMultiplier(b.freelancer.trust_level);

    // Verified badge multiplier
    const verifiedMultiplierA = a.freelancer.liveness_verified ? 1.3 : 1.0;
    const verifiedMultiplierB = b.freelancer.liveness_verified ? 1.3 : 1.0;

    // Combined score
    const scoreA = (a.orders_count + 1) * trustMultiplierA * verifiedMultiplierA;
    const scoreB = (b.orders_count + 1) * trustMultiplierB * verifiedMultiplierB;

    return scoreB - scoreA;
  });

  return {
    services: rankedServices,
    count,
    page,
    perPage,
    totalPages: Math.ceil((count || 0) / perPage),
  };
}

function getTrustMultiplier(trustLevel: string): number {
  const multipliers: Record<string, number> = {
    elite: 2.0,
    top_rated: 1.7,
    trusted: 1.4,
    verified: 1.2,
    new: 1.0,
  };
  return multipliers[trustLevel] || 1.0;
}