// ============================================================================
// src/app/api/jobs/route.ts
// Enhanced jobs API with validation and security
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { jobSchema } from '@/lib/validations';
import { rateLimit } from '@/lib/rate-limit';
import { z } from 'zod';

// GET - Browse jobs with filtering
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const budgetType = searchParams.get('budget_type');
    const status = searchParams.get('status') || 'open';
    const experienceLevel = searchParams.get('experience_level');
    const minBudget = searchParams.get('min_budget');
    const maxBudget = searchParams.get('max_budget');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const perPage = Math.min(parseInt(searchParams.get('per_page') || '20'), 50);

    const supabase = createClient();

    let query = supabase
      .from('jobs')
      .select(`
        *,
        client:profiles!jobs_client_id_fkey(
          id,
          full_name,
          profile_image_url,
          client_rating,
          total_jobs_posted,
          identity_verified
        ),
        proposals(count)
      `, { count: 'exact' })
      .eq('status', status);

    // Search
    if (search) {
      query = query.or(
        `title.ilike.%${search}%,description.ilike.%${search}%`
      );
    }

    // Filters
    if (category) query = query.eq('category', category);
    if (budgetType) query = query.eq('budget_type', budgetType);
    if (experienceLevel) query = query.eq('experience_level', experienceLevel);
    if (minBudget) query = query.gte('budget_min', parseFloat(minBudget));
    if (maxBudget) query = query.lte('budget_max', parseFloat(maxBudget));

    // Pagination
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

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
  } catch (error: any) {
    console.error('Jobs fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch jobs' },
      { status: 500 }
    );
  }
}

// POST - Create job (clients only)
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

    // Rate limiting (5 jobs per day)
    if (!rateLimit(`create_job:${user.id}`, 5, 86400000)) {
      return NextResponse.json(
        { success: false, error: 'Maximum daily job postings reached (5). Please try tomorrow.' },
        { status: 429 }
      );
    }

    // Verify user can post jobs
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

    if (profile.user_type === 'freelancer') {
      return NextResponse.json(
        { success: false, error: 'Only clients can post jobs' },
        { status: 403 }
      );
    }

    // Validate request
    const body = await request.json();
    const validatedData = jobSchema.parse(body);

    // Create job
    const { data, error } = await supabase
      .from('jobs')
      .insert({
        client_id: user.id,
        ...validatedData,
        status: 'open',
        views_count: 0,
        proposals_count: 0,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data,
      message: 'Job posted successfully',
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0].message },
        { status: 400 }
      );
    }

    console.error('Job creation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create job' },
      { status: 500 }
    );
  }
}