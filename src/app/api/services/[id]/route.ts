// src/app/api/services/[id]/route.ts
// FIXED:
//   1. Async params — all three handlers now await params (Next.js 15)
//   2. requireAuth() + checkRateLimit() replaced with applyMiddleware()
//      for consistent auth + rate-limit handling across the codebase
//   3. requireOwnership() removed — ownership checked manually in-query
//      (same pattern as jobs/[id]/route.ts), eliminating a redundant DB call
//   4. Fire-and-forget view increment uses void (project protocol)
//
// FIXED (Domain 4 audit, GET handler):
//   reviews:reviews!reviews_reviewee_id_fkey(...) removed from the services
//   select. That FK links reviews.reviewee_id → profiles.id, not services.id.
//   PostgREST cannot resolve this embed from the services table and was throwing
//   a 500 on every service-detail request.
//   Reviews are now fetched in a separate round-trip: completed order IDs for
//   this service are retrieved first (orders.service_id), then reviews for those
//   orders are queried and merged into the response under the same `reviews` key,
//   preserving the response shape for any consumer reading data.reviews.
//
// FIXED (Domain 4 audit, PATCH handler):
//   Removed dead `tags:` sanitization line from sanitizedBody. `tags` is not a
//   column on `services` (database.types.ts) and was stripped by Zod anyway;
//   leaving it in was misleading.

import { NextRequest, NextResponse } from 'next/server';
import { applyMiddleware } from '@/lib/api/enhanced-middleware';
import { createClient } from '@/lib/supabase/server';
import { serviceSchema } from '@/lib/validations';
import { sanitizeHtml, sanitizeText, sanitizeUuid } from '@/lib/security/sanitize';
import { logger } from '@/lib/logger';
import { z } from 'zod';

// ── Local types ───────────────────────────────────────────────────────────────

type ReviewRow = {
  id: string;
  rating: number;
  review_text: string | null;
  created_at: string | null;
  communication_rating: number | null;
  quality_rating: number | null;
  professionalism_rating: number | null;
  reviewer: {
    full_name: string;
    profile_image_url: string | null;
  } | null;
};

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

    // Step 1: Fetch the service with freelancer profile.
    // The reviews embed is intentionally absent — see file header for why.
    const { data: service, error } = await supabase
      .from('services')
      .select(`
        *,
        freelancer:profiles!services_freelancer_id_fkey(
          id, full_name, profile_image_url, bio,
          freelancer_rating, total_jobs_completed,
          identity_verified, student_verified,
          university, location, created_at
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

    // Step 2: Fetch reviews via the orders bridge.
    // There is no FK from reviews to services. The traversal is:
    //   services ← orders.service_id   (orders has service_id FK)
    //   orders   ← reviews.order_id   (reviews has order_id FK)
    // So we go: service → orders → reviews.
    let reviews: ReviewRow[] = [];

    const { data: serviceOrders } = await supabase
      .from('orders')
      .select('id')
      .eq('service_id', serviceId)
      .eq('status', 'completed');

    if (serviceOrders && serviceOrders.length > 0) {
      const orderIds = serviceOrders.map((o: { id: string }) => o.id);

      const { data: reviewData, error: reviewError } = await supabase
        .from('reviews')
        .select(`
          id, rating, review_text, created_at,
          communication_rating, quality_rating, professionalism_rating,
          reviewer:profiles!reviews_reviewer_id_fkey(
            full_name, profile_image_url
          )
        `)
        .in('order_id', orderIds)
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(20);

      if (reviewError) {
        // Non-fatal: log and continue with empty reviews rather than failing the page
        logger.warn('Reviews fetch failed for service', {
          serviceId,
          error: reviewError.message,
        });
      } else {
        reviews = (reviewData ?? []) as ReviewRow[];
      }
    }

    const viewsCount = service.views_count ?? 0;

    // Fire-and-forget (project protocol: void)
    void supabase
      .from('services')
      .update({ views_count: viewsCount + 1 })
      .eq('id', serviceId);

    logger.info('Service viewed', { serviceId, viewCount: viewsCount + 1 });

    return NextResponse.json({
      success: true,
      // Merge reviews into the data object — same key the old embed used,
      // so any existing consumer reading data.reviews still works.
      data: {
        ...service,
        reviews,
      },
    });
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

    // FIXED: removed `tags` from sanitizedBody — `tags` is not a column on
    // `services` (database.types.ts). Zod was already stripping it before the
    // update, so this was dead code; removing it prevents confusion.
    const sanitizedBody = {
      ...body,
      title:        body.title        ? sanitizeText(body.title)        : undefined,
      description:  body.description  ? sanitizeHtml(body.description)  : undefined,
      category:     body.category     ? sanitizeText(body.category)     : undefined,
      requirements: body.requirements ? sanitizeHtml(body.requirements) : undefined,
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