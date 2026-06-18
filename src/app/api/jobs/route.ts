// src/app/api/jobs/route.ts
// FIXED: GET handler now applies applyMiddleware with auth:optional + rateLimit:api.
// Previously the GET endpoint had zero rate limiting, leaving it as the only
// unprotected read endpoint in the entire domain.
//
// FIXED (Domain 4 audit, POST handler):
//   - sanitizedBody now reads `body.required_skills` (was `body.skills_required`,
//     which never matched what CreateJobForm sends — every job was created with
//     an empty skills array regardless of what the user entered).
//   - Added subcategory + estimated_duration sanitization/passthrough — both are
//     real columns on `jobs` and both are collected by CreateJobForm, previously
//     silently dropped.
//   - insert now writes `required_skills` (was `skills_required`, which is not a
//     column on `jobs` — that insert would have thrown "column does not exist").

import { NextRequest, NextResponse } from 'next/server';
import { applyMiddleware } from '@/lib/api/enhanced-middleware';
import { createClient } from '@/lib/supabase/server';
import { jobSchema } from '@/lib/validations';
import { sanitizeHtml, sanitizeText } from '@/lib/security/sanitize';
import { containsSqlInjection } from '@/lib/security/sql-injection-check';
import { logger } from '@/lib/logger';
import { evaluateTrustGate } from '@/lib/trust/feature-gates';
import { z } from 'zod';

// GET - Browse jobs with filtering
export async function GET(request: NextRequest) {
  try {
    // FIXED: rate limiting added — was completely absent
    const { error: rlError } = await applyMiddleware(request, {
      auth: 'optional',
      rateLimit: 'api',
    });
    if (rlError) return rlError;

    const searchParams = request.nextUrl.searchParams;

    const category        = sanitizeText(searchParams.get('category') || '');
    const budgetType      = searchParams.get('budget_type');
    const status          = searchParams.get('status') || 'open';
    const experienceLevel = searchParams.get('experience_level');
    const minBudget       = searchParams.get('min_budget');
    const maxBudget       = searchParams.get('max_budget');
    const search          = sanitizeText(searchParams.get('search') || '');
    const page            = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const perPage         = Math.min(50, Math.max(1, parseInt(searchParams.get('per_page') || '20')));

    if (search && containsSqlInjection(search)) {
      logger.warn('SQL injection attempt in jobs search', {
        search,
        ip: request.headers.get('x-forwarded-for'),
      });
      return NextResponse.json(
        { success: false, error: 'Invalid search query' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    let query = supabase
      .from('jobs')
      .select(
        `*,
        client:profiles!jobs_client_id_fkey(
          id, full_name, profile_image_url,
          client_rating, total_jobs_posted, identity_verified
        ),
        proposals(count)`,
        { count: 'exact' }
      )
      .eq('status', status);

    if (search) {
      const searchTerm = `%${search}%`;
      query = query.or(`title.ilike.${searchTerm},description.ilike.${searchTerm}`);
    }

    if (category)        query = query.eq('category', category);
    if (budgetType)      query = query.eq('budget_type', budgetType);
    if (experienceLevel) query = query.eq('experience_level', experienceLevel);
    if (minBudget)       query = query.gte('budget_min', parseFloat(minBudget));
    if (maxBudget)       query = query.lte('budget_max', parseFloat(maxBudget));

    const from = (page - 1) * perPage;
    const to   = from + perPage - 1;

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      logger.error('Jobs fetch error', error);
      throw error;
    }

    logger.info('Jobs query executed', {
      filters:     { category, search, status },
      resultCount: data?.length || 0,
    });

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        page,
        per_page:    perPage,
        total:       count || 0,
        total_pages: Math.ceil((count || 0) / perPage),
      },
    });
  } catch (error) {
    logger.error('Jobs GET error', error as Error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch jobs' },
      { status: 500 }
    );
  }
}

// POST - Create job (clients only, rate-limited)
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await applyMiddleware(request, {
      auth:      'required',
      roles:     ['client', 'both'],
      rateLimit: 'createJob',
    });

    if (error) return error;
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();

    const parsedMin   = Number(body.budget_min) || 0;
    const parsedMax   = Number(body.budget_max) || 0;
    const checkAmount = Math.max(parsedMin, parsedMax);

    const gate = await evaluateTrustGate(user.id, 'post_listing', checkAmount);

    if (!gate.allowed) {
      logger.warn('Trust Gate blocked job post', {
        userId:          user.id,
        restrictionType: gate.restrictionType,
        checkAmount,
      });
      return NextResponse.json(
        {
          success:         false,
          error:           gate.reason,
          restrictionType: gate.restrictionType,
          capAmount:       gate.capAmount,
        },
        { status: 403 }
      );
    }

    const sanitizedBody = {
      ...body,
      title:              sanitizeText(body.title || ''),
      description:        sanitizeHtml(body.description || ''),
      category:           sanitizeText(body.category || ''),
      subcategory:        body.subcategory ? sanitizeText(body.subcategory) : undefined,
      estimated_duration: body.estimated_duration ? sanitizeText(body.estimated_duration) : undefined,
      // FIXED: was `body.skills_required` — CreateJobForm sends `required_skills`,
      // matching the jobs.required_skills column.
      required_skills:    body.required_skills?.map((s: string) => sanitizeText(s)) || [],
    };

    const validatedData = jobSchema.parse(sanitizedBody);
    const supabase      = await createClient();

    const { data, error: jobError } = await supabase
      .from('jobs')
      .insert({
        client_id:          user.id,
        title:              validatedData.title,
        description:        validatedData.description,
        category:           validatedData.category,
        subcategory:        validatedData.subcategory ?? null,
        budget_type:        validatedData.budget_type,
        budget_min:         validatedData.budget_min ?? null,
        budget_max:         validatedData.budget_max ?? null,
        experience_level:   validatedData.experience_level,
        estimated_duration: validatedData.estimated_duration ?? null,
        deadline:           validatedData.deadline ?? null,
        // FIXED: was `skills_required` — not a column on `jobs`.
        required_skills:    validatedData.required_skills ?? [],
        status:             'open',
        views_count:        0,
        proposals_count:    0,
      })
      .select()
      .single();

    if (jobError) {
      logger.error('Job creation failed', jobError, { userId: user.id });
      throw jobError;
    }

    logger.info('Job created successfully', {
      jobId:    data.id,
      userId:   user.id,
      category: validatedData.category,
    });

    return NextResponse.json(
      { success: true, data, message: 'Job posted successfully' },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Job validation failed', { errors: error.issues });
      return NextResponse.json(
        {
          success: false,
          error:   error.issues[0]?.message || 'Validation failed',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    logger.error('Job creation error', error as Error);
    return NextResponse.json(
      { success: false, error: 'Failed to create job' },
      { status: 500 }
    );
  }
}