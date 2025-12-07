// ============================================================================
// src/app/api/services/route.ts
// Enhanced services API with advanced filtering
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { serviceSchema } from '@/lib/validations';
import { rateLimit } from '@/lib/rate-limit';
import { z } from 'zod';

// GET - Browse services with advanced filtering
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const minPrice = searchParams.get('min_price');
    const maxPrice = searchParams.get('max_price');
    const state = searchParams.get('state');
    const city = searchParams.get('city');
    const verified = searchParams.get('verified_only') === 'true';
    const sortBy = searchParams.get('sort_by') || 'created_at';
    const page = parseInt(searchParams.get('page') || '1');
    const perPage = Math.min(parseInt(searchParams.get('per_page') || '20'), 50);

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

    // Text search
    if (search) {
  query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`)
  // Split into separate safe queries
  const searchTerm = `%${search}%`;
  query = query.or(
    `title.ilike.${searchTerm},description.ilike.${searchTerm},category.ilike.${searchTerm}`
  );
}

    // Category filter
    if (category) {
      query = query.ilike('category', `%${category}%`);
    }

    // Price filters
    if (minPrice) {
      query = query.gte('base_price', parseFloat(minPrice));
    }
    if (maxPrice) {
      query = query.lte('base_price', parseFloat(maxPrice));
    }

    // Location filters
    if (state) {
      query = query.ilike('service_location', `%${state}%`);
    }
    if (city) {
      query = query.ilike('service_location', `%${city}%`);
    }

    // Verified freelancers only
    if (verified) {
      query = query.eq('freelancer.identity_verified', true);
    }

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
      throw error;
    }

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
  } catch (error: any) {
    console.error('Services fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch services' },
      { status: 500 }
    );
  }
}

// POST - Create service (authenticated)
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Rate limiting (10 services per hour)
    if (!rateLimit(`create_service:${user.id}`, 10, 3600000)) {
      return NextResponse.json(
        { success: false, error: 'Too many service creations. Please try again later.' },
        { status: 429 }
      );
    }

    // Verify user is allowed to create services
    const { data: profile } = await supabase
      .from('profiles')
      .select('user_type, account_status')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json(
        { success: false, error: 'Profile not found' },
        { status: 404 }
      );
    }

    if (profile.account_status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Account is suspended or banned' },
        { status: 403 }
      );
    }

    if (profile.user_type === 'client') {
      return NextResponse.json(
        { success: false, error: 'Only freelancers can create services' },
        { status: 403 }
      );
    }

    // Validate request body
    const body = await request.json();
    const validatedData = serviceSchema.parse(body);

    // Check service limit (max 20 active services per user)
    const { count: serviceCount } = await supabase
      .from('services')
      .select('*', { count: 'exact', head: true })
      .eq('freelancer_id', user.id)
      .eq('is_active', true);

    if (serviceCount && serviceCount >= 20) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Maximum active services limit reached (20). Please deactivate some services first.' 
        },
        { status: 400 }
      );
    }

    // Create service
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
      throw error;
    }

    return NextResponse.json({
      success: true,
      data,
      message: 'Service created successfully',
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: error.errors[0].message,
          details: error.errors,
        },
        { status: 400 }
      );
    }

    console.error('Service creation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create service' },
      { status: 500 }
    );
  }
}