// ============================================================================
// src/app/api/images/delete/route.ts
// API endpoint to delete images

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { deleteImage, deleteMultipleImages } from '@/lib/cloudinary/admin';

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { publicIds, resourceType = 'service' } = body;

    if (!publicIds || !Array.isArray(publicIds)) {
      return NextResponse.json(
        { success: false, error: 'Invalid request' },
        { status: 400 }
      );
    }

    // Verify ownership based on resource type
    if (resourceType === 'service') {
      // Check if user owns the service
      const { data: service } = await supabase
        .from('services')
        .select('freelancer_id')
        .contains('images', publicIds)
        .single();

      if (!service || service.freelancer_id !== user.id) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 403 }
        );
      }
    }

    // Delete from Cloudinary
    const deletedCount = await deleteMultipleImages(publicIds);

    return NextResponse.json({
      success: true,
      data: { deleted: deletedCount },
    });
  } catch (error: any) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Delete failed' },
      { status: 500 }
    );
  }
}