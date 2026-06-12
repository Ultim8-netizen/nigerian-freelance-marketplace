// src/app/api/services/[id]/route.ts
// MERGED:
// 1. Async params — Next.js 15 requires `await params` on all handlers.
// 2. PATCH/DELETE now use applyMiddleware for auth + rate limiting.
// 3. Fire-and-forget view-count increment uses `void` (project standard).
// 4. Ownership checks retained via requireOwnership (original pattern).

import { NextRequest, NextResponse } from 'next/server';
import { applyMiddleware, requireOwnership } from '@/lib/api/enhanced-middleware';
import { checkRateLimit } from '@/lib/rate-limit-upstash';
import { createClient } from '@/lib/supabase/server';
import { serviceSchema } from '@/lib/validations';
import { sanitizeHtml, sanitizeText, sanitizeUuid } from '@/lib/security/sanitize';
import { logger } from '@/lib/logger';
import { z } from 'zod';

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;

    const serviceId = sanitizeUuid(id);
    if (!serviceId) {
      return NextResponse.json(
        { success: false, error: 'Invalid service ID' },
        { status: 400 }
      );
    }

    // Rate limiting for reads (more permissive)
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
    const rateLimitResult = await checkRateLimit('api', ip);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { success: false, error: 'Too many requests', resetAt: rateLimitResult.reset },
        { status: 429 }
      );
    }

    const supabase = await createClient();

    const { data: service, error } = await supabase
      .from('services')
      .select(`
        *,
        freelancer:profiles!services_freelancer_id_fkey(
          id,
          full_name,
          profile_image_url,
          bio,
          freelancer_rating,
          total_jobs_completed,
          identity_verified,
          student_verified,
          university,
          location,
          created_at
        ),
        reviews:reviews!reviews_reviewee_id_fkey(
          id,
          rating,
          review_text,
          created_at,
          reviewer:profiles!reviews_reviewer_id_fkey(
            full_name,
            profile_image_url
          )
        )
      `)
      .eq('id', serviceId)
      .single();

    if (error || !service) {
      logger.warn('Service not found', { serviceId });
      return NextResponse.json(
        { success: false, error: 'Service not found' },
        { status: 404 }
      );
    }

    // Null-coalesce views_count once — it is nullable per schema
    const viewsCount = service.views_count ?? 0;

    // Increment view count (fire and forget)
    void supabase
      .from('services')
      .update({ views_count: viewsCount + 1 })
      .eq('id', serviceId);

    logger.info('Service viewed', { serviceId, viewCount: viewsCount + 1 });

    return NextResponse.json({
      success: true,
      data: service,
    });
  } catch (error) {
    logger.error('Service fetch error', error as Error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch service' },
      { status: 500 }
    );
  }
}

// ─── PATCH ────────────────────────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    // 0. Resolve async params and validate service ID
    const { id } = await params;

    const serviceId = sanitizeUuid(id);
    if (!serviceId) {
      return NextResponse.json(
        { success: false, error: 'Invalid service ID' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // 1. Authentication + rate limiting
    const { user, error: authError } = await applyMiddleware(request, {
      auth: 'required',
      rateLimit: 'api',
    });
    if (authError) return authError;
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // 2. Ownership verification
    const ownershipResult = await requireOwnership(
      request,
      'services',
      serviceId,
      'freelancer_id',
      supabase,
      user
    );
    if (ownershipResult.error) return ownershipResult.error;

    // 3. Parse and sanitize updates
    const body = await request.json();

    const sanitizedBody = {
      ...body,
      title: body.title ? sanitizeText(body.title) : undefined,
      description: body.description ? sanitizeHtml(body.description) : undefined,
      category: body.category ? sanitizeText(body.category) : undefined,
      requirements: body.requirements ? sanitizeHtml(body.requirements) : undefined,
      tags: body.tags?.map((tag: string) => sanitizeText(tag)) ?? undefined,
    };

    // 4. Validate with partial schema
    const validatedData = serviceSchema.partial().parse(sanitizedBody);

    // 5. Update service
    const { data: updatedService, error } = await supabase
      .from('services')
      .update({
        ...validatedData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', serviceId)
      .select()
      .single();

    if (error) {
      logger.error('Service update failed', error, { serviceId, userId: user.id });
      throw error;
    }

    logger.info('Service updated', { serviceId, userId: user.id });

    return NextResponse.json({
      success: true,
      data: updatedService,
      message: 'Service updated successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0]?.message ?? 'Validation failed' },
        { status: 400 }
      );
    }

    logger.error('Service update error', error as Error);
    return NextResponse.json(
      { success: false, error: 'Failed to update service' },
      { status: 500 }
    );
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const supabase = await createClient();

    // 1. Authentication + rate limiting
    const { user, error: authError } = await applyMiddleware(request, {
      auth: 'required',
      rateLimit: 'api',
    });
    if (authError) return authError;
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // 2. Resolve async params and validate service ID
    const { id } = await params;

    const serviceId = sanitizeUuid(id);
    if (!serviceId) {
      return NextResponse.json(
        { success: false, error: 'Invalid service ID' },
        { status: 400 }
      );
    }

    // 3. Ownership verification
    const ownershipResult = await requireOwnership(
      request,
      'services',
      serviceId,
      'freelancer_id',
      supabase,
      user
    );
    if (ownershipResult.error) return ownershipResult.error;

    // 4. Get orders_count to decide soft vs hard delete
    const { data: service } = await supabase
      .from('services')
      .select('orders_count')
      .eq('id', serviceId)
      .single();

    if (!service) {
      return NextResponse.json(
        { success: false, error: 'Service not found' },
        { status: 404 }
      );
    }

    // 5. Soft delete if has orders, hard delete otherwise
    // Null-coalesce orders_count — it is nullable per schema
    const ordersCount = service.orders_count ?? 0;

    if (ordersCount > 0) {
      await supabase
        .from('services')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', serviceId);

      logger.info('Service soft deleted', { serviceId, userId: user.id });
    } else {
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', serviceId);

      if (error) throw error;

      logger.info('Service hard deleted', { serviceId, userId: user.id });
    }

    return NextResponse.json({
      success: true,
      message: 'Service deleted successfully',
    });
  } catch (error) {
    logger.error('Service deletion error', error as Error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete service' },
      { status: 500 }
    );
  }
}