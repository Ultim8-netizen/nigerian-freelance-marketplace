// src/app/api/marketplace/search/route.ts
// Enhanced search with filters, sorting, and recommendations
//
// FIX: applyMiddleware(auth:'optional', rateLimit:'api') added — this route
//      previously had zero auth/rate-limiting, unlike products/route.ts GET.
// FIX: `q` is now checked with containsSqlInjection before being interpolated
//      into the .or() filter string (products/route.ts already did this for
//      its `search` param; this route built an equivalent .or() expression
//      with no check at all).
// FIX: seller join now uses `!inner` so `.ilike('seller.location', ...)`
//      actually filters rows — PostgREST only applies filters on embedded
//      resources when the embed is an inner join. Every product has a
//      seller (products.seller_id is NOT NULL with an FK to profiles), so
//      this does not exclude any rows when `state` is not provided.

import { NextRequest, NextResponse } from 'next/server';
import { applyMiddleware } from '@/lib/api/enhanced-middleware';
import { createClient } from '@/lib/supabase/server';
import { containsSqlInjection } from '@/lib/security/sql-injection-check';
import { logger } from '@/lib/logger';
import type { Product } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const query = searchParams.get('q') || '';
    const category = searchParams.get('category');
    const minPrice = searchParams.get('min_price');
    const maxPrice = searchParams.get('max_price');
    const condition = searchParams.get('condition');
    const state = searchParams.get('state');
    const sortBy = searchParams.get('sort_by') || 'relevance';
    const page = parseInt(searchParams.get('page') || '1');
    const perPage = 24;

    if (query && containsSqlInjection(query)) {
      logger.warn('SQL injection attempt in marketplace search', {
        query,
        ip: request.headers.get('x-forwarded-for'),
      });
      return NextResponse.json(
        { success: false, error: 'Invalid search query' },
        { status: 400 }
      );
    }

    const { error: middlewareError } = await applyMiddleware(request, {
      auth:      'optional',
      rateLimit: 'api',
    });
    if (middlewareError) return middlewareError;

    const supabase = await createClient();

    // Build query
    let dbQuery = supabase
      .from('products')
      .select(`
        *,
        seller:profiles!products_seller_id_fkey!inner(
          id,
          full_name,
          profile_image_url,
          freelancer_rating,
          identity_verified,
          location
        )
      `, { count: 'exact' })
      .eq('is_active', true);

    // Text search (title, description, category)
    if (query) {
      dbQuery = dbQuery.or(
        `title.ilike.%${query}%,description.ilike.%${query}%,category.ilike.%${query}%`
      );
    }

    // Filters
    if (category) dbQuery = dbQuery.eq('category', category);
    if (condition) dbQuery = dbQuery.eq('condition', condition);
    if (minPrice) dbQuery = dbQuery.gte('price', parseFloat(minPrice));
    if (maxPrice) dbQuery = dbQuery.lte('price', parseFloat(maxPrice));
    if (state) dbQuery = dbQuery.ilike('seller.location', `%${state}%`);

    // Sorting
    switch (sortBy) {
      case 'price_low':
        dbQuery = dbQuery.order('price', { ascending: true });
        break;
      case 'price_high':
        dbQuery = dbQuery.order('price', { ascending: false });
        break;
      case 'rating':
        dbQuery = dbQuery.order('rating', { ascending: false });
        break;
      case 'recent':
        dbQuery = dbQuery.order('created_at', { ascending: false });
        break;
      case 'popular':
        dbQuery = dbQuery.order('sales_count', { ascending: false });
        break;
      default: // relevance
        dbQuery = dbQuery.order('views_count', { ascending: false });
    }

    // Pagination
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    const { data, error, count } = await dbQuery.range(from, to);

    if (error) throw error;

    // Get related/popular products if few results
    let recommendations: Product[] = [];
    if (!data || data.length < 5) {
      const { data: popular } = await supabase
        .from('products')
        .select('*, seller:profiles!products_seller_id_fkey(*)')
        .eq('is_active', true)
        .order('sales_count', { ascending: false })
        .limit(12);

      recommendations = popular || [];
    }

    return NextResponse.json({
      success: true,
      data,
      recommendations,
      pagination: {
        page,
        per_page: perPage,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / perPage),
      },
      filters: {
        query,
        category,
        price_range: { min: minPrice, max: maxPrice },
        condition,
        state,
        sort_by: sortBy,
      },
    });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { success: false, error: 'Search failed' },
      { status: 500 }
    );
  }
}