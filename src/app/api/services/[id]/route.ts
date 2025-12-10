// src/app/api/services/[id]/route.ts
// PRODUCTION-READY: Individual service operations with full security

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOwnership } from '@/lib/api/middleware';
import { checkRateLimit } from '@/lib/rate-limit-upstash';
import { createClient } from '@/lib/supabase/server';
import { serviceSchema } from '@/lib/validations';
import { sanitizeHtml, sanitizeText, sanitizeUuid } from '@/lib/security/sanitize';
import { logger } from '@/lib/logger';
import { z } from 'zod';

// GET - Get service details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const serviceId = sanitizeUuid(params.id);
    if (!serviceId) {
      return NextResponse.json(
        { success: false, error: 'Invalid service ID' },
        { status: 400 }
      );
    }

    // Rate limiting for reads (more permissive)
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitResult = await checkRateLimit('api', ip);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { success: false, error: 'Too many requests', resetAt: rateLimitResult.reset },
        { status: 429 }
      );
    }

    const supabase = createClient();

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

    // Increment view count (fire and forget)
    supabase
      .from('services')
      .update({ views_count: service.views_count + 1 })
      .eq('id', serviceId)
      .then();

    logger.info('Service viewed', { serviceId, viewCount: service.views_count + 1 });

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

// PATCH - Update service (owner only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    // 2. Validate service ID
    const serviceId = sanitizeUuid(params.id);
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
      'freelancer_id'
    );
    if (ownershipResult instanceof NextResponse) return ownershipResult;

    // 4. Rate limiting
    const rateLimitResult = await checkRateLimit('api', user.id);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { success: false, error: 'Too many requests', resetAt: rateLimitResult.reset },
        { status: 429 }
      );
    }

    // 5. Parse and sanitize updates
    const body = await request.json();
    
    const sanitizedBody = {
      ...body,
      title: body.title ? sanitizeText(body.title) : undefined,
      description: body.description ? sanitizeHtml(body.description) : undefined,
      category: body.category ? sanitizeText(body.category) : undefined,
      requirements: body.requirements ? sanitizeHtml(body.requirements) : undefined,
      tags: body.tags?.map((tag: string) => sanitizeText(tag)) || undefined,
    };

    // 6. Validate with partial schema
    const validatedData = serviceSchema.partial().parse(sanitizedBody);

    const supabase = createClient();

    // 7. Update service
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
        { success: false, error: error.errors[0]?.message || 'Validation failed' },
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

// DELETE - Delete service (owner only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    // 2. Validate service ID
    const serviceId = sanitizeUuid(params.id);
    if (!serviceId) {
      return NextResponse.json(
        { success: false, error: 'Invalid service ID' },
        { status: 400 }
      );
    }

    // 3. Rate limiting
    const rateLimitResult = await checkRateLimit('api', user.id);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { success: false, error: 'Too many requests', resetAt: rateLimitResult.reset },
        { status: 429 }
      );
    }

    const supabase = createClient();

    // 4. Verify ownership and get service details
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
      logger.warn('Unauthorized delete attempt', { serviceId, userId: user.id });
      return NextResponse.json(
        { success: false, error: 'You can only delete your own services' },
        { status: 403 }
      );
    }

    // 5. Soft delete if has orders, hard delete otherwise
    if (service.orders_count > 0) {
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