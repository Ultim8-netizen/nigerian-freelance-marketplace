// ============================================================================
// src/app/api/services/[id]/route.ts
// Individual service operations
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { serviceSchema } from '@/lib/validations';
import { z } from 'zod';

// GET - Get service details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const serviceId = params.id;

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

    return NextResponse.json({
      success: true,
      data: service,
    });
  } catch (error: unknown) {
    console.error('Service fetch error:', error);
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
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const serviceId = params.id;

    // Verify ownership
    const { data: service } = await supabase
      .from('services')
      .select('freelancer_id')
      .eq('id', serviceId)
      .single();

    if (!service) {
      return NextResponse.json(
        { success: false, error: 'Service not found' },
        { status: 404 }
      );
    }

    if (service.freelancer_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'You can only edit your own services' },
        { status: 403 }
      );
    }

    // Validate updates
    const body = await request.json();
    const validatedData = serviceSchema.partial().parse(body);

    // Update service
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
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: updatedService,
      message: 'Service updated successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error instanceof Error ? error.message : 'An error occurred' },
        { status: 400 }
      );
    }

    console.error('Service update error:', error);
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
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const serviceId = params.id;

    // Verify ownership
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
      return NextResponse.json(
        { success: false, error: 'You can only delete your own services' },
        { status: 403 }
      );
    }

    // Don't allow deletion if service has orders
    if (service.orders_count > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Cannot delete service with existing orders. You can deactivate it instead.' 
        },
        { status: 400 }
      );
    }

    // Soft delete (deactivate)
    const { error } = await supabase
      .from('services')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', serviceId);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: 'Service deleted successfully',
    });
  } catch (error: unknown) {
    console.error('Service deletion error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete service' },
      { status: 500 }
    );
  }
}