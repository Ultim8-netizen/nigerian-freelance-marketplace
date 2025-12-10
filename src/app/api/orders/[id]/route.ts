// src/app/api/orders/[id]/route.ts
// PRODUCTION-READY: Individual order operations with security

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/middleware';
import { checkRateLimit } from '@/lib/rate-limit-upstash';
import { createClient } from '@/lib/supabase/server';
import { sanitizeUuid } from '@/lib/security/sanitize';
import { logger } from '@/lib/logger';

// GET - Get order details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    // 2. Validate order ID
    const orderId = sanitizeUuid(params.id);
    if (!orderId) {
      return NextResponse.json(
        { success: false, error: 'Invalid order ID' },
        { status: 400 }
      );
    }

    // 3. Rate limiting
    const rateLimitResult = await checkRateLimit('api', user.id);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { success: false, error: 'Too many requests', resetAt: rateLimitResult.reset },
        { status: 429 }
      );
    }

    const supabase = createClient();

    // 4. Fetch order with related data
    const { data: order, error } = await supabase
      .from('orders')
      .select(`
        *,
        client:profiles!orders_client_id_fkey(*),
        freelancer:profiles!orders_freelancer_id_fkey(*),
        service:services(*),
        job:jobs(*),
        transactions(
          id,
          amount,
          status,
          transaction_type,
          created_at
        ),
        escrow(
          id,
          amount,
          status,
          created_at
        )
      `)
      .eq('id', orderId)
      .single();

    if (error || !order) {
      logger.warn('Order not found', { orderId });
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    // 5. Authorization check - must be client or freelancer
    if (order.client_id !== user.id && order.freelancer_id !== user.id) {
      logger.warn('Unauthorized order access attempt', { orderId, userId: user.id });
      return NextResponse.json(
        { success: false, error: 'You do not have access to this order' },
        { status: 403 }
      );
    }

    logger.info('Order viewed', { orderId, userId: user.id });

    return NextResponse.json({
      success: true,
      data: order,
    });
  } catch (error) {
    logger.error('Order fetch error', error as Error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch order' },
      { status: 500 }
    );
  }
}

// PATCH - Update order status (limited operations)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    // 2. Validate order ID
    const orderId = sanitizeUuid(params.id);
    if (!orderId) {
      return NextResponse.json(
        { success: false, error: 'Invalid order ID' },
        { status: 400 }
      );
    }

    // 3. Rate limiting
    const rateLimitResult = await checkRateLimit('api', user.id);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { success: false, error: 'Too many requests', resetAt: rateLimitResult.reset },
        { status: 429 }
      );
    }

    const supabase = createClient();

    // 4. Get order details
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

    // 5. Authorization check
    if (order.client_id !== user.id && order.freelancer_id !== user.id) {
      logger.warn('Unauthorized order update attempt', { orderId, userId: user.id });
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action } = body;

    // 6. Handle different actions based on user role
    if (action === 'cancel' && order.client_id === user.id) {
      // Client can cancel before freelancer starts work
      if (order.status !== 'pending_payment' && order.status !== 'awaiting_delivery') {
        return NextResponse.json(
          { success: false, error: 'Order cannot be cancelled at this stage' },
          { status: 400 }
        );
      }

      await supabase
        .from('orders')
        .update({ 
          status: 'cancelled',
          updated_at: new Date().toISOString() 
        })
        .eq('id', orderId);

      // Notify freelancer
      await supabase.from('notifications').insert({
        user_id: order.freelancer_id,
        type: 'order_cancelled',
        title: 'Order Cancelled',
        message: 'Client cancelled the order',
        link: `/freelancer/orders/${orderId}`,
      });

      logger.info('Order cancelled by client', { orderId, userId: user.id });

      return NextResponse.json({
        success: true,
        message: 'Order cancelled successfully',
      });
    }

    // Add more action handlers as needed

    return NextResponse.json(
      { success: false, error: 'Invalid action or insufficient permissions' },
      { status: 400 }
    );
  } catch (error) {
    logger.error('Order update error', error as Error);
    return NextResponse.json(
      { success: false, error: 'Failed to update order' },
      { status: 500 }
    );
  }
}