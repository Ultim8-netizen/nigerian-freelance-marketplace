// src/app/api/marketplace/orders/[id]/route.ts
// Individual order operations

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const updateStatusSchema = z.object({
  status: z.enum([
    'confirmed',
    'processing',
    'shipped',
    'delivered',
    'cancelled',
    'refunded'
  ]),
  tracking_number: z.string().optional(),
  notes: z.string().optional(),
});

// GET - Get order details
export async function GET(
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

    const { data: order, error } = await supabase
      .from('marketplace_orders')
      .select(`
        *,
        product:products(*),
        buyer:profiles!marketplace_orders_buyer_id_fkey(*),
        seller:profiles!marketplace_orders_seller_id_fkey(*)
      `)
      .eq('id', params.id)
      .single();

    if (error || !order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    // Verify user is buyer or seller
    if (order.buyer_id !== user.id && order.seller_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    console.error('Order fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch order' },
      { status: 500 }
    );
  }
}

// PATCH - Update order status (seller only)
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

    const body = await request.json();
    const validated = updateStatusSchema.parse(body);

    // Get order
    const { data: order, error: orderError } = await supabase
      .from('marketplace_orders')
      .select('*')
      .eq('id', params.id)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    // Verify user is seller
    if (order.seller_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Only seller can update order status' },
        { status: 403 }
      );
    }

    // Update order
    const { data: updated, error: updateError } = await supabase
      .from('marketplace_orders')
      .update({
        status: validated.status,
        tracking_number: validated.tracking_number,
        status_notes: validated.notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Notify buyer
    const statusMessages = {
      confirmed: 'Your order has been confirmed',
      processing: 'Your order is being processed',
      shipped: 'Your order has been shipped',
      delivered: 'Your order has been delivered',
      cancelled: 'Your order has been cancelled',
      refunded: 'Your order has been refunded',
    };

    await supabase.from('notifications').insert({
      user_id: order.buyer_id,
      type: 'order_status_update',
      title: 'Order Update',
      message: statusMessages[validated.status],
      link: `/marketplace/orders/${order.id}`,
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Order updated successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0].message },
        { status: 400 }
      );
    }

    console.error('Order update error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update order' },
      { status: 500 }
    );
  }
}

// DELETE - Cancel order (buyer only, before processing)
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

    const { data: order, error: orderError } = await supabase
      .from('marketplace_orders')
      .select('*')
      .eq('id', params.id)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    // Verify user is buyer
    if (order.buyer_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Only buyer can cancel order' },
        { status: 403 }
      );
    }

    // Can only cancel if not yet processing
    if (!['pending_payment', 'confirmed'].includes(order.status)) {
      return NextResponse.json(
        { success: false, error: 'Order cannot be cancelled at this stage' },
        { status: 400 }
      );
    }

    // Update to cancelled
    await supabase
      .from('marketplace_orders')
      .update({ status: 'cancelled' })
      .eq('id', params.id);

    // Notify seller
    await supabase.from('notifications').insert({
      user_id: order.seller_id,
      type: 'order_cancelled',
      title: 'Order Cancelled',
      message: 'A buyer cancelled their order',
      link: `/marketplace/orders/${order.id}`,
    });

    return NextResponse.json({
      success: true,
      message: 'Order cancelled successfully',
    });
  } catch (error) {
    console.error('Order cancellation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to cancel order' },
      { status: 500 }
    );
  }
}