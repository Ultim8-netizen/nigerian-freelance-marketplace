// src/app/api/images/delete/route.ts
// Delete images from Cloudinary
// ============================================================================

import { NextRequest as Request, NextResponse as Response } from 'next/server';
import { requireAuth as authenticate } from '@/lib/api/middleware';
import { checkRateLimit as checkLimit } from '@/lib/rate-limit-upstash';
import { createClient as supabase } from '@/lib/supabase/server';
import { deleteMultipleImages } from '@/lib/cloudinary/admin';
import { logger as log } from '@/lib/logger';

export async function POST(request: Request) {
  try {
    const authResult = await authenticate(request);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;

    const rateLimitResult = await checkLimit('api', user.id);
    if (!rateLimitResult.success) {
      return Response.json(
        { success: false, error: 'Too many requests', resetAt: rateLimitResult.reset },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { publicIds, resourceType = 'service' } = body;

    if (!publicIds || !Array.isArray(publicIds) || publicIds.length === 0) {
      return Response.json(
        { success: false, error: 'Invalid request - publicIds array required' },
        { status: 400 }
      );
    }

    // Verify ownership based on resource type
    const db = supabase();
    if (resourceType === 'service') {
      const { data: service } = await db
        .from('services')
        .select('freelancer_id')
        .contains('images', publicIds)
        .single();

      if (!service || service.freelancer_id !== user.id) {
        log.warn('Unauthorized image delete attempt', { userId: user.id, publicIds });
        return Response.json({ success: false, error: 'Unauthorized' }, { status: 403 });
      }
    }

    // Delete from Cloudinary
    const deletedCount = await deleteMultipleImages(publicIds);

    log.info('Images deleted', { userId: user.id, count: deletedCount });

    return Response.json({
      success: true,
      data: { deleted: deletedCount },
    });
  } catch (error) {
    log.error('Image deletion error', error as Error);
    return Response.json(
      { success: false, error: 'Failed to delete images' },
      { status: 500 }
    );
  }
}