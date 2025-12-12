// src/app/api/orders/[id]/deliver/route.ts
// Freelancer marks order as delivered

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { applyMiddleware } from '@/lib/api/enhanced-middleware';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const deliverySchema = z.object({
  delivery_note: z.string().min(20).max(1000),
  delivery_files: z.array(z.string().url()).min(1).max(10),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await applyMiddleware(request, {
      auth: 'required',
      roles: ['freelancer', 'both'],
      rateLimit: 'api',
    });

    if (error) return error;

    const orderId = params.id;
    const body = await request.json();
    const validatedData = deliverySchema.parse(body);

    const supabase = createClient();

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

    // Verify freelancer owns this order
    if (order.freelancer_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Check order status
    if (order.status !== 'awaiting_delivery' && order.status !== 'revision_requested') {
      return NextResponse.json(
        { 
          success: false, 
          error: `Cannot deliver order with status: ${order.status}` 
        },
        { status: 400 }
      );
    }

    // Update order
    await supabase
      .from('orders')
      .update({
        status: 'delivered',
        delivered_at: new Date().toISOString(),
        delivery_files: validatedData.delivery_files,
        delivery_note: validatedData.delivery_note,
      })
      .eq('id', orderId);

    // Notify client
    await supabase.from('notifications').insert({
      user_id: order.client_id,
      type: 'order_delivered',
      title: 'Order Delivered! 📦',
      message: `Your order "${order.title}" has been delivered. Please review.`,
      link: `/client/orders/${orderId}`,
    });

    logger.info('Order delivered', { orderId, freelancerId: user.id });

    return NextResponse.json({
      success: true,
      message: 'Order delivered successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0]?.message },
        { status: 400 }
      );
    }

    logger.error('Delivery error', error as Error);
    return NextResponse.json(
      { success: false, error: 'Failed to deliver order' },
      { status: 500 }
    );
  }
}