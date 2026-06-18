// src/app/api/marketplace/search/route.ts
// Enhanced search with filters, sorting, and recommendations
//
// FIX: applyMiddleware(auth:'optional', rateLimit:'api') added previously.
// FIX: `q` checked with containsSqlInjection — now AFTER applyMiddleware.
//      Previously the injection check returned before the rate limiter ran,
//      making probing requests free. Rate limiter now runs unconditionally first.
// FIX: seller join uses !inner so .ilike('seller.location', ...) filters rows.
// FIX: .or() filter values are now wrapped in double-quotes per PostgREST
//      syntax. Without quoting, a user query containing a comma (e.g. "phones,
//      bags") split the PostgREST or-expression into extra unintended conditions
//      and returned 0 results or a 400. Double-quoting instructs PostgREST to
//      treat the comma as part of the value, not a condition separator.
//      Any literal double-quotes in the query are stripped before quoting to
//      prevent value-boundary escape.

import { NextRequest, NextResponse } from 'next/server';
import { applyMiddleware } from '@/lib/api/enhanced-middleware';
import { createClient } from '@/lib/supabase/server';
import { containsSqlInjection } from '@/lib/security/sql-injection-check';
import { logger } from '@/lib/logger';
import type { ProductWithSeller } from '@/types/marketplace.types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const query     = searchParams.get('q') || '';
    const category  = searchParams.get('category');
    const minPrice  = searchParams.get('min_price');
    const maxPrice  = searchParams.get('max_price');
    const condition = searchParams.get('condition');
    const state     = searchParams.get('state');
    const sortBy    = searchParams.get('sort_by') || 'relevance';
    const page      = parseInt(searchParams.get('page') || '1');
    const perPage   = 24;

    // FIX: Rate limiter runs FIRST — all requests (including probes) consume a token.
    const { error: middlewareError } = await applyMiddleware(request, {
      auth:      'optional',
      rateLimit: 'api',
    });
    if (middlewareError) return middlewareError;

    // SQL injection check — now runs after the rate limiter.
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

    const supabase = await createClient();

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

    // FIX: Wrap each ilike value in PostgREST double-quotes so commas (and
    // other characters) inside the user's query are treated as part of the
    // value, not as or-condition separators. Strip any literal double-quote
    // characters from the query first to prevent escape injection.
    if (query) {
      const safeQ = query.replace(/"/g, '');
      dbQuery = dbQuery.or(
        `title.ilike."%${safeQ}%",description.ilike."%${safeQ}%",category.ilike."%${safeQ}%"`
      );
    }

    if (category)  dbQuery = dbQuery.eq('category', category);
    if (condition) dbQuery = dbQuery.eq('condition', condition);
    if (minPrice)  dbQuery = dbQuery.gte('price', parseFloat(minPrice));
    if (maxPrice)  dbQuery = dbQuery.lte('price', parseFloat(maxPrice));
    // !inner join means ilike on seller.location actually filters rows.
    if (state)     dbQuery = dbQuery.ilike('seller.location', `%${state}%`);

    switch (sortBy) {
      case 'price_low':  dbQuery = dbQuery.order('price',       { ascending: true  }); break;
      case 'price_high': dbQuery = dbQuery.order('price',       { ascending: false }); break;
      case 'rating':     dbQuery = dbQuery.order('rating',      { ascending: false }); break;
      case 'recent':     dbQuery = dbQuery.order('created_at',  { ascending: false }); break;
      case 'popular':    dbQuery = dbQuery.order('sales_count', { ascending: false }); break;
      default:           dbQuery = dbQuery.order('views_count', { ascending: false }); break;
    }

    const from = (page - 1) * perPage;
    const to   = from + perPage - 1;

    const { data, error, count } = await dbQuery.range(from, to);

    if (error) throw error;

    let recommendations: ProductWithSeller[] = [];
    if (!data || data.length < 5) {
      const { data: popular } = await supabase
        .from('products')
        .select('*, seller:profiles!products_seller_id_fkey(*)')
        .eq('is_active', true)
        .order('sales_count', { ascending: false })
        .limit(12);

      recommendations = (popular as ProductWithSeller[]) || [];
    }

    return NextResponse.json({
      success: true,
      data,
      recommendations,
      pagination: {
        page,
        per_page:    perPage,
        total:       count || 0,
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
    logger.error('Search error', error as Error);
    return NextResponse.json(
      { success: false, error: 'Search failed' },
      { status: 500 }
    );
  }
}