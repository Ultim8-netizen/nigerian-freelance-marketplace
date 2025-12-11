// src/app/api/images/delete/route.ts
// Delete images from Cloudinary

import { NextRequest, NextResponse } from 'next/server';
import { applyMiddleware } from '@/lib/api/enhanced-middleware';
import { createClient } from '@/lib/supabase/server';
import { deleteMultipleImages } from '@/lib/cloudinary/admin';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await applyMiddleware(request, {
      auth: 'required',
      rateLimit: 'api',
    });

    if (error) return error;

    const body = await request.json();
    const { publicIds, resourceType = 'service' } = body;

    if (!publicIds || !Array.isArray(publicIds) || publicIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid request - publicIds array required' },
        { status: 400 }
      );
    }

    // Verify ownership based on resource type
    const supabase = createClient();
    if (resourceType === 'service') {
      const { data: service } = await supabase
        .from('services')
        .select('freelancer_id')
        .contains('images', publicIds)
        .single();

      if (!service || service.freelancer_id !== user.id) {
        logger.warn('Unauthorized image delete attempt', { userId: user.id, publicIds });
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
      }
    }

    // Delete from Cloudinary
    const deletedCount = await deleteMultipleImages(publicIds);

    logger.info('Images deleted', { userId: user.id, count: deletedCount });

    return NextResponse.json({
      success: true,
      data: { deleted: deletedCount },
    });
  } catch (error) {
    logger.error('Image deletion error', error as Error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete images' },
      { status: 500 }
    );
  }
}