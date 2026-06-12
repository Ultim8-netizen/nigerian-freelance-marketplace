// src/app/api/marketplace/orders/[id]/route.ts
// PRODUCTION-READY: Marketplace order operations with complete CRUD
//
// FIX: params is a Promise in Next.js 15 — now typed and awaited in
//      GET/PATCH/DELETE.
// FIX: notifications INSERT has no RLS policy permitting it for a
//      user-scoped client (notifications table has SELECT/UPDATE policies
//      only — no INSERT policy, so RLS denies by default). All
//      notification inserts here now use createAdminClient() (service role).

import { NextRequest, NextResponse } from 'next/server';
import { authenticatedApi } from '@/lib/api/enhanced-middleware';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sanitizeUuid } from '@/lib/security/sanitize';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const updateStatusSchema = z.object({
  status: z.enum(['confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']),
  tracking_number: z.string().optional(),
  notes: z.string().optional(),
});

// GET - Get order details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticatedApi(request);
    if (authResult.error) return authResult.error;
    const user = authResult.user!;

    const { id } = await params;
    const orderId = sanitizeUuid(id);
    if (!orderId) {
      return NextResponse.json({ success: false, error: 'Invalid order ID' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: order, error } = await supabase
      .from('marketplace_orders')
      .select(`
        *,
        product:products(*),
        buyer:profiles!marketplace_orders_buyer_id_fkey(*),
        seller:profiles!marketplace_orders_seller_id_fkey(*)
      `)
      .eq('id', orderId)
      .single();

    if (error || !order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    if (order.buyer_id !== user.id && order.seller_id !== user.id) {
      logger.warn('Unauthorized order access', { orderId, userId: user.id });
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    logger.error('Order fetch error', error as Error);
    return NextResponse.json({ success: false, error: 'Failed to fetch order' }, { status: 500 });
  }
}

// PATCH - Update order status (seller only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticatedApi(request);
    if (authResult.error) return authResult.error;
    const user = authResult.user!;

    const { id } = await params;
    const orderId = sanitizeUuid(id);
    if (!orderId) {
      return NextResponse.json({ success: false, error: 'Invalid order ID' }, { status: 400 });
    }

    const body = await request.json();
    const validated = updateStatusSchema.parse(body);

    const supabase = await createClient();
    const { data: order, error: orderError } = await supabase
      .from('marketplace_orders')
      .select('seller_id, buyer_id, product_id, status')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    if (order.seller_id !== user.id) {
      logger.warn('Unauthorized order update attempt', { orderId, userId: user.id });
      return NextResponse.json(
        { success: false, error: 'Only seller can update order status' },
        { status: 403 }
      );
    }

    const { data: updated, error: updateError } = await supabase
      .from('marketplace_orders')
      .update({
        status: validated.status,
        tracking_number: validated.tracking_number,
        status_notes: validated.notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Notify buyer
    const statusMessages: Record<string, string> = {
      confirmed: 'Your order has been confirmed',
      processing: 'Your order is being processed',
      shipped: 'Your order has been shipped',
      delivered: 'Your order has been delivered',
      cancelled: 'Your order has been cancelled',
      refunded: 'Your order has been refunded',
    };

    // FIX: notifications has no INSERT RLS policy for user-scoped clients.
    // Use the service-role client so the insert is not silently dropped.
    const adminClient = createAdminClient();
    await adminClient.from('notifications').insert({
      user_id: order.buyer_id,
      type: 'order_status_update',
      title: 'Order Update',
      message: statusMessages[validated.status],
      link: `/marketplace/orders/${orderId}`,
    });

    logger.info('Order status updated', { orderId, status: validated.status, userId: user.id });

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Order updated successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0]?.message || 'Validation failed' },
        { status: 400 }
      );
    }

    logger.error('Order update error', error as Error);
    return NextResponse.json({ success: false, error: 'Failed to update order' }, { status: 500 });
  }
}

// DELETE - Cancel order (buyer only, before processing)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticatedApi(request);
    if (authResult.error) return authResult.error;
    const user = authResult.user!;

    const { id } = await params;
    const orderId = sanitizeUuid(id);
    if (!orderId) {
      return NextResponse.json({ success: false, error: 'Invalid order ID' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: order, error: orderError } = await supabase
      .from('marketplace_orders')
      .select('buyer_id, seller_id, status')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    if (order.buyer_id !== user.id) {
      logger.warn('Unauthorized order cancellation attempt', { orderId, userId: user.id });
      return NextResponse.json(
        { success: false, error: 'Only buyer can cancel order' },
        { status: 403 }
      );
    }

    if (!['pending_payment', 'confirmed'].includes(order.status)) {
      return NextResponse.json(
        { success: false, error: 'Order cannot be cancelled at this stage' },
        { status: 400 }
      );
    }

    await supabase
      .from('marketplace_orders')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);

    // FIX: notifications has no INSERT RLS policy for user-scoped clients.
    const adminClient = createAdminClient();
    await adminClient.from('notifications').insert({
      user_id: order.seller_id,
      type: 'order_cancelled',
      title: 'Order Cancelled',
      message: 'A buyer cancelled their order',
      link: `/marketplace/orders/${orderId}`,
    });

    logger.info('Order cancelled', { orderId, userId: user.id });

    return NextResponse.json({
      success: true,
      message: 'Order cancelled successfully',
    });
  } catch (error) {
    logger.error('Order cancellation error', error as Error);
    return NextResponse.json({ success: false, error: 'Failed to cancel order' }, { status: 500 });
  }
}