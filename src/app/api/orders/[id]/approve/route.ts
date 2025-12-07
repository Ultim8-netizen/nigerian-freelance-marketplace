// src/app/api/orders/[id]/approve/route.ts
// Client approves delivered work and releases payment

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

    // Get order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, freelancer:profiles!orders_freelancer_id_fkey(*)')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    // Verify user is the client
    if (order.client_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Verify order status
    if (order.status !== 'delivered') {
      return NextResponse.json(
        {
          success: false,
          error: 'Order must be delivered before approval',
        },
        { status: 400 }
      );
    }

    // Start transaction
    // 1. Update order to completed
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'completed',
        client_rating: validatedData.rating,
        client_review: validatedData.review,
      })
      .eq('id', orderId);

    if (updateError) {
      throw updateError;
    }

    // 2. Release escrow
    const { data: escrow, error: escrowError } = await supabase
      .from('escrow')
      .update({
        status: 'released_to_freelancer',
        released_at: new Date().toISOString(),
      })
      .eq('order_id', orderId)
      .select()
      .single();

    if (escrowError) {
      throw escrowError;
    }

    // 3. Update freelancer wallet - move to available balance
    const { error: walletError } = await supabase.rpc(
      'release_escrow_to_wallet',
      {
        p_freelancer_id: order.freelancer_id,
        p_amount: order.freelancer_earnings,
      }
    );

    if (walletError) {
      console.error('Wallet update error:', walletError);
      // Don't fail the request, just log
    }

    // 4. Create review
    await supabase.from('reviews').insert({
      order_id: orderId,
      reviewer_id: user.id,
      reviewee_id: order.freelancer_id,
      rating: validatedData.rating,
      review_text: validatedData.review,
      communication_rating: validatedData.communication_rating,
      quality_rating: validatedData.quality_rating,
      professionalism_rating: validatedData.professionalism_rating,
    });

    // 5. Update freelancer rating
    await supabase.rpc('update_freelancer_rating', {
      p_freelancer_id: order.freelancer_id,
    });

    // 6. Increment completed jobs count
    await supabase.rpc('increment_jobs_completed', {
      p_user_id: order.freelancer_id,
    });

    // 7. Update service orders count if from service
    if (order.service_id) {
      await supabase.rpc('increment_service_orders', {
        p_service_id: order.service_id,
      });
    }

    // 8. Update job status if from job
    if (order.job_id) {
      await supabase
        .from('jobs')
        .update({ status: 'completed' })
        .eq('id', order.job_id);
    }

    // 9. Create notification for freelancer
    await supabase.from('notifications').insert({
      user_id: order.freelancer_id,
      type: 'order_completed',
      title: 'Order Completed & Payment Released',
      message: `${order.title} was completed. ₦${order.freelancer_earnings.toLocaleString()} added to your wallet.`,
      link: `/freelancer/orders/${orderId}`,
    });

    return NextResponse.json({
      success: true,
      message: 'Order completed and payment released',
    });
  } catch (error: any) {
    console.error('Approval error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0].message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to approve order' },
      { status: 500 }
    );
  }
}

// Request revision
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
    const revisionNote = z.string().min(20).max(500).parse(body.revision_note);

    // Get order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    // Verify user is the client
    if (order.client_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Check revision count
    if (order.revision_count >= order.max_revisions) {
      return NextResponse.json(
        { success: false, error: 'Maximum revisions reached' },
        { status: 400 }
      );
    }

    // Update order
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'revision_requested',
        revision_count: order.revision_count + 1,
      })
      .eq('id', orderId);

    if (updateError) {
      throw updateError;
    }

    // Create notification
    await supabase.from('notifications').insert({
      user_id: order.freelancer_id,
      type: 'revision_requested',
      title: 'Revision Requested',
      message: `Client requested revision for: ${order.title}`,
      link: `/freelancer/orders/${orderId}`,
    });

    return NextResponse.json({
      success: true,
      message: 'Revision requested',
    });
  } catch (error: any) {
    console.error('Revision request error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to request revision' },
      { status: 500 }
    );
  }
}