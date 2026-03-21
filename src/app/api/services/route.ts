// src/app/api/services/route.ts
// PRODUCTION-READY: Enhanced services API with full security stack
// UPDATED: Trust Gate check added to POST handler before service insertion.
// UPDATED: serviceSchema covers service_location, location_required, remote_ok,
//          portfolio_links, and packages.
// FIX: evaluateContentTriggers now invoked after trust gate.
//      - allowed=false → 400, listing rejected, user notified.
//      - autoHold=true → inserted with is_active:false, flagged for admin review.
// FIX: requirePostingActive guard added — blocks new listing creation when
//      profiles.posting_suspended_until is set and in the future.

import { NextRequest, NextResponse } from 'next/server';
import { applyMiddleware, requirePostingActive } from '@/lib/api/enhanced-middleware';
import { createClient } from '@/lib/supabase/server';
import { serviceSchema } from '@/lib/validations';
import { sanitizeHtml, sanitizeText } from '@/lib/security/sanitize';
import { containsSqlInjection } from '@/lib/security/sql-injection-check';
import { logger } from '@/lib/logger';
import { evaluateTrustGate } from '@/lib/trust/feature-gates';
import { evaluateContentTriggers } from '@/lib/trust/automation';
import { z } from 'zod';

// ─── GET — Browse services ────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const category = sanitizeText(searchParams.get('category') || '');
    const search   = sanitizeText(searchParams.get('search')   || '');
    const minPrice = searchParams.get('min_price');
    const maxPrice = searchParams.get('max_price');
    const state    = sanitizeText(searchParams.get('state')    || '');
    const city     = sanitizeText(searchParams.get('city')     || '');
    const verified = searchParams.get('verified_only') === 'true';
    const sortBy   = searchParams.get('sort_by') || 'created_at';
    const page     = Math.max(1, parseInt(searchParams.get('page')     || '1'));
    const perPage  = Math.min(50, Math.max(1, parseInt(searchParams.get('per_page') || '20')));

    if (search && containsSqlInjection(search)) {
      logger.warn('SQL injection attempt in search', {
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
      .from('services')
      .select(`
        *,
        freelancer:profiles!services_freelancer_id_fkey(
          id, full_name, profile_image_url,
          freelancer_rating, total_jobs_completed,
          identity_verified, student_verified
        )
      `, { count: 'exact' })
      .eq('is_active', true);

    if (search) {
      const searchTerm = `%${search}%`;
      query = query.or(
        `title.ilike.${searchTerm},description.ilike.${searchTerm},category.ilike.${searchTerm}`
      );
    }

    if (category) query = query.ilike('category', `%${category}%`);
    if (minPrice) query = query.gte('base_price', parseFloat(minPrice));
    if (maxPrice) query = query.lte('base_price', parseFloat(maxPrice));
    if (state)    query = query.ilike('service_location', `%${state}%`);
    if (city)     query = query.ilike('service_location', `%${city}%`);
    if (verified) query = query.eq('freelancer.identity_verified', true);

    const sortMap: Record<string, string> = {
      price_low:  'base_price',
      price_high: 'base_price',
      rating:     'freelancer.freelancer_rating',
      popular:    'orders_count',
      recent:     'created_at',
    };

    const sortColumn = sortMap[sortBy] || 'created_at';
    const ascending  = sortBy !== 'price_high' && sortBy !== 'rating' && sortBy !== 'popular';

    query = query.order(sortColumn, { ascending });

    const from = (page - 1) * perPage;
    const to   = from + perPage - 1;

    const { data, error, count } = await query.range(from, to);

    if (error) {
      logger.error('Services fetch error', error);
      throw error;
    }

    logger.info('Services query executed', {
      filters:     { category, search, verified },
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
      filters: {
        category,
        search,
        price_range:  { min: minPrice, max: maxPrice },
        location:     { state, city },
        verified_only: verified,
        sort_by:       sortBy,
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

// ─── POST — Create service ────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await applyMiddleware(request, {
      auth:      'required',
      roles:     ['freelancer', 'both'],
      rateLimit: 'createService',
    });

    if (error) return error;

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Single client instance reused for all DB operations in this handler
    const supabase = await createClient();

    // ── Gate 0: Posting suspension ────────────────────────────────────────
    // Checks profiles.posting_suspended_until. Returns 403 with resumesAt
    // if the freelancer is within an active 72-hour suspension window from
    // consecutive 1-star reviews. Does not affect account_status.
    const postingBlocked = await requirePostingActive(user.id, supabase);
    if (postingBlocked) return postingBlocked;

    const body = await request.json();

    const sanitizedBody = {
      ...body,
      title:        sanitizeText(body.title       || ''),
      description:  sanitizeHtml(body.description || ''),
      category:     sanitizeText(body.category    || ''),
      requirements: body.requirements ? sanitizeHtml(body.requirements) : undefined,
      tags:         body.tags?.map((tag: string) => sanitizeText(tag)) || [],
    };

    const validatedData = serviceSchema.parse(sanitizedBody);

    // ── Gate 1: Trust score / listing price cap ───────────────────────────
    const gate = await evaluateTrustGate(
      user.id,
      'post_listing',
      Number(validatedData.base_price)
    );

    if (!gate.allowed) {
      logger.warn('Trust Gate blocked service creation', {
        userId:          user.id,
        restrictionType: gate.restrictionType,
        basePrice:       validatedData.base_price,
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

    // ── Gate 2: Content triggers — prohibited keywords & high-value new accounts
    //
    // FIX: evaluateContentTriggers was dead code; it is now called here.
    // Three outcomes:
    //   allowed=false  → reject immediately, notify user, return 400.
    //   autoHold=true  → insert with is_active:false so the service is invisible
    //                    to clients; security_log written inside automation.ts
    //                    surfaces it in the admin Flags page for review.
    //   otherwise      → insert normally with is_active:true.
    const contentCheck = await evaluateContentTriggers(user.id, {
      title:       validatedData.title,
      description: validatedData.description,
      amount:      Number(validatedData.base_price),
    });

    if (!contentCheck.allowed) {
      logger.warn('Content trigger rejected service creation', {
        userId: user.id,
        reason: contentCheck.reason,
      });

      await supabase.from('notifications').insert({
        user_id: user.id,
        type:    'listing_rejected',
        title:   'Service Listing Rejected',
        message: contentCheck.reason ??
          'Your service listing was rejected because it violates platform policies.',
      });

      return NextResponse.json(
        { success: false, error: contentCheck.reason },
        { status: 400 }
      );
    }

    // autoHold — service is created but held for admin review
    const isActive = !contentCheck.autoHold;

    // Active service limit (max 20)
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
          error:   'Maximum active services limit reached (20). Please deactivate some services first.',
        },
        { status: 400 }
      );
    }

    const { packages, ...serviceData } = validatedData;

    const { data, error: serviceError } = await supabase
      .from('services')
      .insert({
        freelancer_id: user.id,
        ...serviceData,
        images:       body.images || [],
        // autoHold: is_active=false makes the service invisible to clients
        // until admin approves it from the Flags & Tickets page.
        is_active:    isActive,
        views_count:  0,
        orders_count: 0,
      })
      .select()
      .single();

    if (serviceError) {
      logger.error('Service creation failed', serviceError, { userId: user.id });
      throw serviceError;
    }

    // Relational package inserts (non-fatal if they fail)
    if (packages) {
      const packagesToInsert = (['basic', 'standard', 'premium'] as const)
        .filter((tier) => packages[tier]?.name)
        .map((tier) => ({
          ...packages[tier]!,
          package_type: tier,
          service_id:   data.id,
        }));

      if (packagesToInsert.length > 0) {
        const { error: packagesError } = await supabase
          .from('service_packages')
          .insert(packagesToInsert);

        if (packagesError) {
          logger.error('Service packages insert failed', packagesError, {
            userId:    user.id,
            serviceId: data.id,
          });
        }
      }
    }

    // Notify the freelancer when their service is held for review
    if (contentCheck.autoHold) {
      await supabase.from('notifications').insert({
        user_id: user.id,
        type:    'listing_held',
        title:   'Service Listing Pending Review',
        message:
          'Your service listing has been submitted but is pending admin review because it exceeds ₦100,000 and your account is less than 7 days old. It will be published once approved.',
        link:    `/services/${data.id}`,
      });

      logger.info('Service held for admin review (high-value new account)', {
        serviceId: data.id,
        userId:    user.id,
        basePrice: validatedData.base_price,
      });
    } else {
      logger.info('Service created successfully', {
        serviceId:    data.id,
        userId:       user.id,
        category:     validatedData.category,
        packageCount: packages
          ? Object.values(packages).filter(Boolean).length
          : 0,
      });
    }

    return NextResponse.json(
      {
        success:  true,
        data,
        message:  contentCheck.autoHold
          ? 'Service submitted and pending admin review.'
          : 'Service created successfully',
        autoHold: contentCheck.autoHold ?? false,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Service validation failed', { errors: error.issues });
      return NextResponse.json(
        {
          success: false,
          error:   error.issues[0]?.message || 'Validation failed',
          details: error.issues,
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