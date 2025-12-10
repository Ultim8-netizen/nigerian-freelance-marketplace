// src/app/api/services/route.ts
// PRODUCTION-READY: Enhanced services API with full security stack

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/api/middleware';
import { checkRateLimit } from '@/lib/rate-limit-upstash';
import { createClient } from '@/lib/supabase/server';
import { serviceSchema } from '@/lib/validations';
import { sanitizeHtml, sanitizeText } from '@/lib/security/sanitize';
import { containsSqlInjection } from '@/lib/security/sql-injection-check';
import { logger } from '@/lib/logger';
import { z } from 'zod';

// GET - Browse services with advanced filtering
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Input validation and sanitization
    const category = sanitizeText(searchParams.get('category') || '');
    const search = sanitizeText(searchParams.get('search') || '');
    const minPrice = searchParams.get('min_price');
    const maxPrice = searchParams.get('max_price');
    const state = sanitizeText(searchParams.get('state') || '');
    const city = sanitizeText(searchParams.get('city') || '');
    const verified = searchParams.get('verified_only') === 'true';
    const sortBy = searchParams.get('sort_by') || 'created_at';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get('per_page') || '20')));

    // SQL injection check on text inputs
    if (search && containsSqlInjection(search)) {
      logger.warn('SQL injection attempt in search', { search, ip: request.headers.get('x-forwarded-for') });
      return NextResponse.json(
        { success: false, error: 'Invalid search query' },
        { status: 400 }
      );
    }

    const supabase = createClient();

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
          identity_verified,
          student_verified
        )
      `, { count: 'exact' })
      .eq('is_active', true);

    // Text search with sanitized input
    if (search) {
      const searchTerm = `%${search}%`;
      query = query.or(
        `title.ilike.${searchTerm},description.ilike.${searchTerm},category.ilike.${searchTerm}`
      );
    }

    // Filters
    if (category) query = query.ilike('category', `%${category}%`);
    if (minPrice) query = query.gte('base_price', parseFloat(minPrice));
    if (maxPrice) query = query.lte('base_price', parseFloat(maxPrice));
    if (state) query = query.ilike('service_location', `%${state}%`);
    if (city) query = query.ilike('service_location', `%${city}%`);
    if (verified) query = query.eq('freelancer.identity_verified', true);

    // Sorting
    const sortMap: Record<string, string> = {
      'price_low': 'base_price',
      'price_high': 'base_price',
      'rating': 'freelancer.freelancer_rating',
      'popular': 'orders_count',
      'recent': 'created_at',
    };
    
    const sortColumn = sortMap[sortBy] || 'created_at';
    const ascending = sortBy !== 'price_high' && sortBy !== 'rating' && sortBy !== 'popular';
    
    query = query.order(sortColumn, { ascending });

    // Pagination
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    const { data, error, count } = await query.range(from, to);

    if (error) {
      logger.error('Services fetch error', error);
      throw error;
    }

    // Log successful query for analytics
    logger.info('Services query executed', {
      filters: { category, search, verified },
      resultCount: data?.length || 0
    });

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        page,
        per_page: perPage,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / perPage),
      },
      filters: {
        category,
        search,
        price_range: { min: minPrice, max: maxPrice },
        location: { state, city },
        verified_only: verified,
        sort_by: sortBy,
      },
    });
  } catch (error) {
    logger.error('Services GET error', error as Error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch services' },
      { status: 500 }
    );
  }
}

// POST - Create service (authenticated, rate-limited)
export async function POST(request: NextRequest) {
  try {
    // 1. Authentication check
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    // 2. Role verification - only freelancers can create services
    const roleResult = await requireRole(request, ['freelancer', 'both']);
    if (roleResult instanceof NextResponse) return roleResult;

    // 3. Rate limiting (10 services per hour)
    const rateLimitResult = await checkRateLimit('createService', user.id);
    if (!rateLimitResult.success) {
      logger.warn('Rate limit exceeded for service creation', { userId: user.id });
      return NextResponse.json(
        { 
          success: false, 
          error: 'Too many service creations. Please try again later.',
          resetAt: rateLimitResult.reset 
        },
        { status: 429 }
      );
    }

    // 4. Parse and validate request body
    const body = await request.json();
    
    // Sanitize text inputs
    const sanitizedBody = {
      ...body,
      title: sanitizeText(body.title || ''),
      description: sanitizeHtml(body.description || ''),
      category: sanitizeText(body.category || ''),
      requirements: body.requirements ? sanitizeHtml(body.requirements) : undefined,
      tags: body.tags?.map((tag: string) => sanitizeText(tag)) || [],
    };

    // Validate with Zod schema
    const validatedData = serviceSchema.parse(sanitizedBody);

    const supabase = createClient();

    // 5. Check service limit (max 20 active services per user)
    const { count: serviceCount } = await supabase
      .from('services')
      .select('*', { count: 'exact', head: true })
      .eq('freelancer_id', user.id)
      .eq('is_active', true);

    if (serviceCount && serviceCount >= 20) {
      logger.warn('Service limit reached', { userId: user.id, count: serviceCount });
      return NextResponse.json(
        { 
          success: false, 
          error: 'Maximum active services limit reached (20). Please deactivate some services first.' 
        },
        { status: 400 }
      );
    }

    // 6. Create service
    const { data, error } = await supabase
      .from('services')
      .insert({
        freelancer_id: user.id,
        title: validatedData.title,
        description: validatedData.description,
        category: validatedData.category,
        base_price: validatedData.base_price,
        delivery_days: validatedData.delivery_days,
        images: validatedData.images || [],
        service_location: validatedData.service_location,
        is_active: true,
        views_count: 0,
        orders_count: 0,
      })
      .select()
      .single();

    if (error) {
      logger.error('Service creation failed', error, { userId: user.id });
      throw error;
    }

    // 7. Log successful creation
    logger.info('Service created successfully', {
      serviceId: data.id,
      userId: user.id,
      category: validatedData.category
    });

    return NextResponse.json({
      success: true,
      data,
      message: 'Service created successfully',
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Service validation failed', undefined, { errors: error.errors });
      return NextResponse.json(
        { 
          success: false, 
          error: error.errors[0]?.message || 'Validation failed',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    logger.error('Service creation error', error as Error);
    return NextResponse.json(
      { success: false, error: 'Failed to create service' },
      { status: 500 }
    );
  }
}