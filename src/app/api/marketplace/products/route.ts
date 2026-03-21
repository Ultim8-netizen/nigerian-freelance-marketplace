// src/app/api/marketplace/products/route.ts
// PRODUCTION-READY: Marketplace products with full security
// UPDATED: Trust Gate check added to POST handler before product insertion.
// FIX: evaluateContentTriggers now invoked after trust gate.
//      - allowed=false → 400, listing rejected, user notified.
//      - autoHold=true → inserted with is_active:false, flagged for admin review.
// FIX: requirePostingActive guard added — blocks new listing creation when
//      profiles.posting_suspended_until is set and in the future.

import { NextRequest, NextResponse } from 'next/server';
import { applyMiddleware, requirePostingActive } from '@/lib/api/enhanced-middleware';
import { createClient } from '@/lib/supabase/server';
import { sanitizeText, sanitizeHtml, sanitizeUrl } from '@/lib/security/sanitize';
import { containsSqlInjection } from '@/lib/security/sql-injection-check';
import { logger } from '@/lib/logger';
import { evaluateTrustGate } from '@/lib/trust/feature-gates';
import { evaluateContentTriggers } from '@/lib/trust/automation';
import { z } from 'zod';

const productSchema = z.object({
  title:            z.string().min(10).max(200),
  description:      z.string().min(20).max(2000),
  price:            z.number().min(100).max(10000000),
  category:         z.string(),
  images:           z.array(z.string()).min(1).max(8),
  condition:        z.enum(['new', 'like_new', 'used']),
  delivery_options: z.array(z.string()).min(1),
});

// ─── GET — Browse products ────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const category  = sanitizeText(searchParams.get('category') || '');
    const search    = sanitizeText(searchParams.get('search')   || '');
    const minPrice  = searchParams.get('min_price');
    const maxPrice  = searchParams.get('max_price');
    const condition = searchParams.get('condition');
    const page      = Math.max(1, parseInt(searchParams.get('page')     || '1'));
    const perPage   = Math.min(50, Math.max(1, parseInt(searchParams.get('per_page') || '20')));

    if (search && containsSqlInjection(search)) {
      logger.warn('SQL injection attempt in product search', {
        search,
        ip: request.headers.get('x-forwarded-for'),
      });
      return NextResponse.json(
        { success: false, error: 'Invalid search query' },
        { status: 400 }
      );
    }

    const { error } = await applyMiddleware(request, {
      auth:      'optional',
      rateLimit: 'api',
    });
    if (error) return error;

    const supabase = await createClient();

    let query = supabase
      .from('products')
      .select(`
        *,
        seller:profiles!products_seller_id_fkey(
          id, full_name, profile_image_url,
          freelancer_rating, identity_verified
        )
      `, { count: 'exact' })
      .eq('is_active', true);

    if (category) query = query.eq('category', category);
    if (search)   query = query.ilike('title', `%${search}%`);
    if (minPrice) query = query.gte('price', parseFloat(minPrice));
    if (maxPrice) query = query.lte('price', parseFloat(maxPrice));
    if (condition) query = query.eq('condition', condition);

    const from = (page - 1) * perPage;
    const to   = from + perPage - 1;

    const { data, error: queryError, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (queryError) {
      logger.error('Products fetch error', queryError);
      throw queryError;
    }

    logger.info('Products query executed', {
      filters:     { category, search },
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
    logger.error('Products GET error', error as Error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

// ─── POST — Create product ────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await applyMiddleware(request, {
      auth:      'required',
      rateLimit: 'createService',
    });

    if (error) return error;

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Single client instance reused for all DB operations in this handler
    const supabase = await createClient();

    // ── Gate 0: Posting suspension ────────────────────────────────────────
    // Checks profiles.posting_suspended_until. Returns 403 with resumesAt
    // if the seller is within an active 72-hour suspension window from
    // consecutive 1-star reviews. Does not affect account_status.
    const postingBlocked = await requirePostingActive(user.id, supabase);
    if (postingBlocked) return postingBlocked;

    const body = await request.json();

    const sanitizedBody = {
      ...body,
      title:            sanitizeText(body.title       || ''),
      description:      sanitizeHtml(body.description || ''),
      category:         sanitizeText(body.category    || ''),
      images:           body.images?.map((url: string) => sanitizeUrl(url)).filter(Boolean) || [],
      delivery_options: body.delivery_options?.map((opt: string) => sanitizeText(opt)) || [],
    };

    const validated = productSchema.parse(sanitizedBody);

    // ── Gate 1: Trust score / listing price cap ───────────────────────────
    const gate = await evaluateTrustGate(user.id, 'post_listing', validated.price);

    if (!gate.allowed) {
      logger.warn('Trust Gate blocked product listing', {
        userId:          user.id,
        restrictionType: gate.restrictionType,
        price:           validated.price,
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
    //   autoHold=true  → insert with is_active:false so it is invisible to
    //                    buyers; the security_log written inside automation.ts
    //                    surfaces it in the admin Flags page for review.
    //   otherwise      → insert normally with is_active:true.
    const contentCheck = await evaluateContentTriggers(user.id, {
      title:       validated.title,
      description: validated.description,
      amount:      validated.price,
    });

    if (!contentCheck.allowed) {
      logger.warn('Content trigger rejected product listing', {
        userId: user.id,
        reason: contentCheck.reason,
      });

      await supabase.from('notifications').insert({
        user_id: user.id,
        type:    'listing_rejected',
        title:   'Listing Rejected',
        message: contentCheck.reason ??
          'Your listing was rejected because it violates platform policies.',
      });

      return NextResponse.json(
        { success: false, error: contentCheck.reason },
        { status: 400 }
      );
    }

    // autoHold — listing is created but held for admin review
    const isActive = !contentCheck.autoHold;

    const { data, error: createError } = await supabase
      .from('products')
      .insert({
        seller_id:        user.id,
        ...validated,
        // autoHold: is_active=false makes the listing invisible to buyers until
        // admin approves it from the Flags & Tickets page.
        is_active:        isActive,
        views_count:      0,
        sales_count:      0,
      })
      .select()
      .single();

    if (createError) {
      logger.error('Product creation failed', createError, { userId: user.id });
      throw createError;
    }

    // Notify the seller when their listing is held for review
    if (contentCheck.autoHold) {
      await supabase.from('notifications').insert({
        user_id: user.id,
        type:    'listing_held',
        title:   'Listing Pending Review',
        message:
          'Your listing has been submitted but is pending admin review because it exceeds ₦100,000 and your account is less than 7 days old. It will be published once approved.',
        link:    `/marketplace/products/${data.id}`,
      });

      logger.info('Product held for admin review (high-value new account)', {
        productId: data.id,
        userId:    user.id,
        price:     validated.price,
      });
    } else {
      logger.info('Product created', { productId: data.id, userId: user.id });
    }

    return NextResponse.json(
      {
        success:   true,
        data,
        message:   contentCheck.autoHold
          ? 'Product submitted and pending admin review.'
          : 'Product created successfully',
        autoHold:  contentCheck.autoHold ?? false,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0]?.message || 'Validation failed' },
        { status: 400 }
      );
    }

    logger.error('Product creation error', error as Error);
    return NextResponse.json(
      { success: false, error: 'Failed to create product' },
      { status: 500 }
    );
  }
}