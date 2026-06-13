// src/app/api/orders/[id]/deliver/route.ts
// CHANGED: Replaced applyMiddleware with direct createClient() auth, consistent
// with all other action routes in this domain. Logic unchanged.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
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
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const orderId = params.id;
    const body = await request.json();
    const validatedData = deliverySchema.parse(body);

    // Fetch order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, client_id, freelancer_id, status, title')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    if (order.freelancer_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    if (
      order.status !== 'awaiting_delivery' &&
      order.status !== 'revision_requested'
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot deliver order with status: ${order.status}`,
        },
        { status: 400 }
      );
    }

    // Mark delivered
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'delivered',
        delivered_at: new Date().toISOString(),
        delivery_files: validatedData.delivery_files,
        delivery_note: validatedData.delivery_note,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (updateError) {
      logger.error('Order deliver update error', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to submit delivery' },
        { status: 500 }
      );
    }

    // Notify client
    await supabase.from('notifications').insert({
      user_id: order.client_id,
      type: 'order_delivered',
      title: 'Order Delivered! 📦',
      message: `Your order "${order.title}" has been delivered. Please review and approve.`,
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
        {
          success: false,
          error: error.issues[0]?.message ?? 'Validation error',
        },
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