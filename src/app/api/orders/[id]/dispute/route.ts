// src/app/api/orders/[id]/dispute/route.ts
// Raise dispute for an order

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const disputeSchema = z.object({
  reason: z.string().min(5).max(100),
  description: z.string().min(50).max(2000),
  evidence: z.array(z.string().url()).max(10).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const orderId = params.id;
    const body = await request.json();
    const validatedData = disputeSchema.parse(body);

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

    // Verify user is either client or freelancer
    const isClient = order.client_id === user.id;
    const isFreelancer = order.freelancer_id === user.id;

    if (!isClient && !isFreelancer) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Can't dispute completed or refunded orders
    if (['completed', 'refunded', 'disputed'].includes(order.status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot dispute order with status: ${order.status}`,
        },
        { status: 400 }
      );
    }

    // Check if dispute already exists
    const { data: existingDispute } = await supabase
      .from('disputes')
      .select('id')
      .eq('order_id', orderId)
      .eq('status', 'open')
      .single();

    if (existingDispute) {
      return NextResponse.json(
        { success: false, error: 'Dispute already exists for this order' },
        { status: 400 }
      );
    }

    const againstId = isClient ? order.freelancer_id : order.client_id;

    // Create dispute
    const { data: dispute, error: disputeError } = await supabase
      .from('disputes')
      .insert({
        order_id: orderId,
        raised_by: user.id,
        against: againstId,
        reason: validatedData.reason,
        description: validatedData.description,
        evidence: validatedData.evidence,
        status: 'open',
      })
      .select()
      .single();

    if (disputeError) {
      throw disputeError;
    }

    // Update order status
    await supabase
      .from('orders')
      .update({ status: 'disputed' })
      .eq('id', orderId);

    // Update escrow status
    await supabase
      .from('escrow')
      .update({ status: 'disputed' })
      .eq('order_id', orderId);

    // Notify other party
    await supabase.from('notifications').insert({
      user_id: againstId,
      type: 'dispute_raised',
      title: 'Dispute Raised',
      message: `A dispute has been raised for: ${order.title}`,
      link: `/orders/${orderId}/dispute`,
    });

    // Notify admins (if you have admin users)
    // await notifyAdmins(dispute);

    return NextResponse.json({
      success: true,
      data: dispute,
      message:
        'Dispute raised successfully. Our team will review within 48 hours.',
    });
  } catch (error) {
    console.error('Dispute error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0].message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to raise dispute' },
      { status: 500 }
    );
  }
}

// GET - View dispute details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const orderId = params.id;

    // Get dispute
    const { data: dispute, error: disputeError } = await supabase
      .from('disputes')
      .select(
        `
        *,
        order:orders(*),
        raised_by_user:profiles!disputes_raised_by_fkey(*),
        against_user:profiles!disputes_against_fkey(*)
      `
      )
      .eq('order_id', orderId)
      .single();

    if (disputeError || !dispute) {
      return NextResponse.json(
        { success: false, error: 'Dispute not found' },
        { status: 404 }
      );
    }

    // Verify access
    if (dispute.raised_by !== user.id && dispute.against !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: dispute,
    });
  } catch (error) {
    console.error('Dispute fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dispute' },
      { status: 500 }
    );
  }
}