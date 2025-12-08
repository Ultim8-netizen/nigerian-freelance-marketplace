// src/app/api/orders/[id]/approve/route.ts
// Client approves delivered work and releases payment atomically

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const approvalSchema = z.object({
  rating: z.number().int().min(1).max(5),
  review: z.string().min(10).max(500).optional(),
  communication_rating: z.number().int().min(1).max(5).optional(),
  quality_rating: z.number().int().min(1).max(5).optional(),
  professionalism_rating: z.number().int().min(1).max(5).optional(),
});

const revisionSchema = z.object({
  revision_note: z
    .string()
    .min(20, 'Revision note must be at least 20 characters')
    .max(500, 'Revision note cannot exceed 500 characters'),
});

/**
 * POST - Approve delivered work and release payment
 * This endpoint atomically:
 * 1. Updates order status to completed
 * 2. Releases escrow payment to freelancer
 * 3. Creates review
 * 4. Updates freelancer ratings and stats
 * 5. Sends notification
 */
export async function POST(
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

    const orderId = params.id;
    const body = await request.json();
    const validatedData = approvalSchema.parse(body);

    // Verify order exists and user is authorized
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('client_id, status')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    if (order.client_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    if (order.status !== 'delivered') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Order must be delivered before approval' 
        },
        { status: 400 }
      );
    }

    // ATOMIC: Complete order and release payment using database function
    // This ensures all operations succeed or fail together
    const { data: result, error: rpcError } = await supabase
      .rpc('complete_order_with_payment', {
        p_order_id: orderId,
        p_client_rating: validatedData.rating,
        p_client_review: validatedData.review,
        p_communication_rating: validatedData.communication_rating,
        p_quality_rating: validatedData.quality_rating,
        p_professionalism_rating: validatedData.professionalism_rating,
      });

    if (rpcError) {
      console.error('Order completion error:', rpcError);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to complete order',
          details: process.env.NODE_ENV === 'development' ? rpcError.message : undefined
        },
        { status: 500 }
      );
    }

    if (!result?.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: result?.error || 'Order completion failed' 
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Order completed and payment released',
      data: result
    });

  } catch (error) {
    console.error('Approval error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid input',
          details: error.issues[0]?.message || 'Validation failed'
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' && error instanceof Error 
          ? error.message 
          : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Request revision on delivered work
 * Client can request revisions up to the maximum allowed
 */
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

    const orderId = params.id;
    const body = await request.json();
    
    // Validate revision request data
    const validatedData = revisionSchema.parse(body);
    const revisionNote = validatedData.revision_note;

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('client_id, freelancer_id, status, revision_count, max_revisions, title')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    if (order.client_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    if (order.status !== 'delivered') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Can only request revisions on delivered orders' 
        },
        { status: 400 }
      );
    }

    if (order.revision_count >= order.max_revisions) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Maximum revisions reached (${order.max_revisions})` 
        },
        { status: 400 }
      );
    }

    // Update order status and increment revision count
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'revision_requested',
        revision_count: order.revision_count + 1,
        revision_note: revisionNote,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (updateError) {
      console.error('Order update error:', updateError);
      throw updateError;
    }

    // Create notification for freelancer with revision details
    await supabase.from('notifications').insert({
      user_id: order.freelancer_id,
      type: 'revision_requested',
      title: 'Revision Requested',
      message: `Client requested revision for: ${order.title}`,
      link: `/freelancer/orders/${orderId}`,
      metadata: {
        revision_count: order.revision_count + 1,
        max_revisions: order.max_revisions,
        revision_note: revisionNote,
      },
    });

    // Create activity log entry for revision request
    await supabase.from('order_activities').insert({
      order_id: orderId,
      user_id: user.id,
      action: 'revision_requested',
      description: `Revision ${order.revision_count + 1} of ${order.max_revisions} requested`,
      metadata: {
        revision_note: revisionNote,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Revision requested',
      data: {
        revision_count: order.revision_count + 1,
        max_revisions: order.max_revisions,
        revision_note: revisionNote,
      }
    });

  } catch (error) {
    console.error('Revision request error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid input',
          details: error.issues[0]?.message || 'Validation failed'
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to request revision',
        details: process.env.NODE_ENV === 'development' && error instanceof Error 
          ? error.message 
          : undefined
      },
      { status: 500 }
    );
  }
}