// src/app/api/services/[id]/route.ts
// FIXED:
//   1. Async params — all three handlers now await params (Next.js 15)
//   2. requireAuth() + checkRateLimit() replaced with applyMiddleware()
//      for consistent auth + rate-limit handling across the codebase
//   3. requireOwnership() removed — ownership checked manually in-query
//      (same pattern as jobs/[id]/route.ts), eliminating a redundant DB call
//   4. Fire-and-forget view increment uses void (project protocol)

import { NextRequest, NextResponse } from 'next/server';
import { applyMiddleware } from '@/lib/api/enhanced-middleware';
import { createClient } from '@/lib/supabase/server';
import { serviceSchema } from '@/lib/validations';
import { sanitizeHtml, sanitizeText, sanitizeUuid } from '@/lib/security/sanitize';
import { logger } from '@/lib/logger';
import { z } from 'zod';

// GET — service details (public, optional auth, rate-limited)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;

    const { error: rlError } = await applyMiddleware(request, {
      auth: 'optional',
      rateLimit: 'api',
    });
    if (rlError) return rlError;

    const serviceId = sanitizeUuid(id);
    if (!serviceId) {
      return NextResponse.json(
        { success: false, error: 'Invalid service ID' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data: service, error } = await supabase
      .from('services')
      .select(`
        *,
        freelancer:profiles!services_freelancer_id_fkey(
          id, full_name, profile_image_url, bio,
          freelancer_rating, total_jobs_completed,
          identity_verified, student_verified,
          university, location, created_at
        ),
        reviews:reviews!reviews_reviewee_id_fkey(
          id, rating, review_text, created_at,
          reviewer:profiles!reviews_reviewer_id_fkey(
            full_name, profile_image_url
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

    const viewsCount = service.views_count ?? 0;

    // Fire-and-forget (project protocol: void)
    void supabase
      .from('services')
      .update({ views_count: viewsCount + 1 })
      .eq('id', serviceId);

    logger.info('Service viewed', { serviceId, viewCount: viewsCount + 1 });

    return NextResponse.json({ success: true, data: service });
  } catch (err) {
    logger.error('Service fetch error', err as Error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch service' },
      { status: 500 }
    );
  }
}

// PATCH — update service (owner only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;

    const { user, error } = await applyMiddleware(request, {
      auth: 'required',
      rateLimit: 'api',
    });
    if (error) return error;
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const serviceId = sanitizeUuid(id);
    if (!serviceId) {
      return NextResponse.json(
        { success: false, error: 'Invalid service ID' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Fetch service and verify ownership in one round-trip
    const { data: existing } = await supabase
      .from('services')
      .select('freelancer_id')
      .eq('id', serviceId)
      .single();

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Service not found' },
        { status: 404 }
      );
    }

    if (existing.freelancer_id !== user.id) {
      logger.warn('Unauthorized service update attempt', { serviceId, userId: user.id });
      return NextResponse.json(
        { success: false, error: 'You can only update your own services' },
        { status: 403 }
      );
    }

    const body = await request.json();

    const sanitizedBody = {
      ...body,
      title:        body.title        ? sanitizeText(body.title)        : undefined,
      description:  body.description  ? sanitizeHtml(body.description)  : undefined,
      category:     body.category     ? sanitizeText(body.category)     : undefined,
      requirements: body.requirements ? sanitizeHtml(body.requirements) : undefined,
      tags:         body.tags?.map((tag: string) => sanitizeText(tag))  || undefined,
    };

    const validatedData = serviceSchema.partial().parse(sanitizedBody);

    const { data: updatedService, error: updateError } = await supabase
      .from('services')
      .update({ ...validatedData, updated_at: new Date().toISOString() })
      .eq('id', serviceId)
      .select()
      .single();

    if (updateError) {
      logger.error('Service update failed', updateError, { serviceId, userId: user.id });
      throw updateError;
    }

    logger.info('Service updated', { serviceId, userId: user.id });

    return NextResponse.json({
      success: true,
      data: updatedService,
      message: 'Service updated successfully',
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: err.issues[0]?.message || 'Validation failed' },
        { status: 400 }
      );
    }
    logger.error('Service update error', err as Error);
    return NextResponse.json(
      { success: false, error: 'Failed to update service' },
      { status: 500 }
    );
  }
}

// DELETE — delete service (owner only)
// Soft-deletes if service has active orders (is_active → false).
// Hard-deletes if no orders exist.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;

    const { user, error } = await applyMiddleware(request, {
      auth: 'required',
      rateLimit: 'api',
    });
    if (error) return error;
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const serviceId = sanitizeUuid(id);
    if (!serviceId) {
      return NextResponse.json(
        { success: false, error: 'Invalid service ID' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data: service } = await supabase
      .from('services')
      .select('freelancer_id, orders_count')
      .eq('id', serviceId)
      .single();

    if (!service) {
      return NextResponse.json(
        { success: false, error: 'Service not found' },
        { status: 404 }
      );
    }

    if (service.freelancer_id !== user.id) {
      logger.warn('Unauthorized service delete attempt', { serviceId, userId: user.id });
      return NextResponse.json(
        { success: false, error: 'You can only delete your own services' },
        { status: 403 }
      );
    }

    const ordersCount = service.orders_count ?? 0;

    if (ordersCount > 0) {
      await supabase
        .from('services')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', serviceId);

      logger.info('Service soft-deleted (has orders)', { serviceId, userId: user.id });
    } else {
      const { error: deleteError } = await supabase
        .from('services')
        .delete()
        .eq('id', serviceId);

      if (deleteError) throw deleteError;

      logger.info('Service hard-deleted', { serviceId, userId: user.id });
    }

    return NextResponse.json({ success: true, message: 'Service deleted successfully' });
  } catch (err) {
    logger.error('Service deletion error', err as Error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete service' },
      { status: 500 }
    );
  }
}