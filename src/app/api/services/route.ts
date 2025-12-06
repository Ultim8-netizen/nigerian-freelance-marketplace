// src/app/api/services/route.ts
// Services API with flexible category support

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// Validation schema
const serviceSchema = z.object({
  title: z.string().min(10).max(100),
  description: z.string().min(50).max(2000),
  category: z.string().min(2).max(100), // Allow any category string
  base_price: z.number().min(100),
  delivery_days: z.number().int().min(1).max(90),
  images: z.array(z.string().url()).min(1).max(5),
  service_location: z.string().nullable().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const search = searchParams.get('search'); // For searching titles/descriptions
    const minPrice = searchParams.get('min_price');
    const maxPrice = searchParams.get('max_price');
    const state = searchParams.get('state');
    const city = searchParams.get('city');
    const page = parseInt(searchParams.get('page') || '1');
    const perPage = parseInt(searchParams.get('per_page') || '20');

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
          total_jobs_completed
        )
      `, { count: 'exact' })
      .eq('is_active', true);

    // Text search across title and description
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,category.ilike.%${search}%`);
    }

    // Category filter (exact match or partial match for flexibility)
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

    // Location filtering (for proximity, not requirement)
    if (state) {
      query = query.ilike('service_location', `%${state}%`);
    }

    if (city && state) {
      query = query.ilike('service_location', `%${city}%`);
    }

    // Pagination
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
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
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = serviceSchema.parse(body);

    const supabase = createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify user has a profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, account_type')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { success: false, error: 'Profile not found' },
        { status: 404 }
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
        images: validatedData.images,
        service_location: validatedData.service_location,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
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
          details: error.errors 
        },
        { status: 400 }
      );
    }

    console.error('Service creation error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}