// src/app/api/marketplace/orders/route.ts
// Complete marketplace order management with dynamic platform fee
//
// FIX: notifications INSERT uses adminClient (no INSERT RLS policy for
//      user-scoped clients).
// FIX: Data integrity — platform_revenue and marketplace_orders inserts
//      were sequential with no transaction. If revenue succeeded but order
//      failed, the client received 500 with an orphan order row. If revenue
//      failed after the order was created, the client received 500 with an
//      orphan order that had no revenue record.
//
//      Resolution (no DB transaction available from app layer):
//        1. Pre-generate orderNumber before any DB writes.
//        2. Insert platform_revenue FIRST using orderNumber as transaction_ref.
//           platform_revenue.transaction_ref is text | null with no FK —
//           a string reference is valid.
//        3. If revenue insert fails → return 500. No order was created. Clean.
//        4. Insert marketplace_order.
//        5. If order insert fails → compensating DELETE on platform_revenue
//           by transaction_ref, then throw. Clean state restored.
//        6. After both succeed → fire-and-forget UPDATE of transaction_ref
//           from orderNumber to order.id for precise UUID lookup by admins.

import { NextRequest, NextResponse } from 'next/server';
import { applyMiddleware } from '@/lib/api/enhanced-middleware';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPlatformConfigs, CONFIG_KEYS } from '@/lib/platform-config';
import { calculateMarketplaceFee, calculateSellerEarnings } from '@/lib/utils';
import { z } from 'zod';

const createOrderSchema = z.object({
  product_id: z.string().uuid(),
  quantity:   z.number().int().min(1).max(100),
  delivery_address: z.object({
    full_name: z.string().min(2),
    phone:     z.string().min(10),
    address:   z.string().min(10),
    city:      z.string().min(2),
    state:     z.string().min(2),
    landmark:  z.string().optional(),
  }),
  payment_method: z.enum(['card', 'bank_transfer', 'wallet']),
});

// GET - List user's orders
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await applyMiddleware(request, {
      auth:      'required',
      rateLimit: 'api',
    });

    if (error) return error;
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const role   = searchParams.get('role'); // 'buyer' | 'seller'

    const supabase = await createClient();
    let query = supabase
      .from('marketplace_orders')
      .select(`
        *,
        product:products(*),
        buyer:profiles!marketplace_orders_buyer_id_fkey(*),
        seller:profiles!marketplace_orders_seller_id_fkey(*)
      `);

    if (role === 'buyer') {
      query = query.eq('buyer_id', user.id);
    } else if (role === 'seller') {
      query = query.eq('seller_id', user.id);
    } else {
      query = query.or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`);
    }

    if (status) query = query.eq('status', status);

    const { data, error: queryError } = await query.order('created_at', { ascending: false });

    if (queryError) throw queryError;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Orders fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}

// POST - Create new order
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await applyMiddleware(request, {
      auth:      'required',
      rateLimit: 'api',
    });

    if (error) return error;
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body      = await request.json();
    const validated = createOrderSchema.parse(body);

    const adminClient = createAdminClient();
    const supabase    = await createClient();

    // ── 1. Fetch fee percent from platform_config ─────────────────────────
    const configs    = await getPlatformConfigs(adminClient, [
      CONFIG_KEYS.MARKETPLACE_FEE_PERCENT,
    ]);
    const feePercent = configs[CONFIG_KEYS.MARKETPLACE_FEE_PERCENT];

    // ── 2. Fetch product ──────────────────────────────────────────────────
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*, seller:profiles!products_seller_id_fkey(*)')
      .eq('id', validated.product_id)
      .eq('is_active', true)
      .single();

    if (productError || !product) {
      return NextResponse.json(
        { success: false, error: 'Product not found or inactive' },
        { status: 404 }
      );
    }

    if (!product.seller_id) {
      return NextResponse.json(
        { success: false, error: 'Product has no associated seller' },
        { status: 400 }
      );
    }

    // ── 3. Calculate amounts ──────────────────────────────────────────────
    const subtotal       = product.price * validated.quantity;
    const deliveryFee    = calculateDeliveryFee(validated.delivery_address.state);
    const totalAmount    = subtotal + deliveryFee;
    const platformFee    = calculateMarketplaceFee(totalAmount, feePercent);
    const sellerEarnings = calculateSellerEarnings(totalAmount, feePercent);

    // ── 4. Pre-generate orderNumber — used as a stable reference key that
    //       links the revenue record to the order before the order row exists.
    const orderNumber = `MKT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    // ── 5. Insert platform_revenue FIRST ─────────────────────────────────
    // transaction_ref is text | null with no FK constraint — orderNumber is a
    // valid string reference. If this fails we return 500 with no order created.
    const { error: revenueError } = await adminClient
      .from('platform_revenue')
      .insert({
        revenue_type:    'marketplace_commission',
        amount:          platformFee,
        source_user_id:  user.id,
        transaction_ref: orderNumber,
      });

    if (revenueError) {
      console.error('platform_revenue insert failed — aborting order creation', {
        orderNumber,
        revenueError,
      });
      // No order was created — fail clean.
      throw revenueError;
    }

    // ── 6. Insert marketplace_order ───────────────────────────────────────
    const { data: order, error: orderError } = await supabase
      .from('marketplace_orders')
      .insert({
        order_number:     orderNumber,
        buyer_id:         user.id,
        seller_id:        product.seller_id,
        product_id:       validated.product_id,
        quantity:         validated.quantity,
        unit_price:       product.price,
        subtotal,
        delivery_fee:     deliveryFee,
        total_amount:     totalAmount,
        platform_fee:     platformFee,
        seller_earnings:  sellerEarnings,
        delivery_address: validated.delivery_address,
        payment_method:   validated.payment_method,
        status:           'pending_payment',
      })
      .select()
      .single();

    if (orderError) {
      // Compensate: remove the revenue record so no orphan exists.
      await adminClient
        .from('platform_revenue')
        .delete()
        .eq('transaction_ref', orderNumber);

      console.error('marketplace_orders insert failed — revenue record compensated', {
        orderNumber,
        orderError,
      });
      throw orderError;
    }

    // ── 7. Update transaction_ref to actual order UUID (fire-and-forget) ──
    // Enables precise UUID-based admin lookups. orderNumber remains as fallback
    // if this update fails (it is still a valid reconciliation reference).
    void adminClient
      .from('platform_revenue')
      .update({ transaction_ref: order.id })
      .eq('transaction_ref', orderNumber);

    // ── 8. Notify seller (fire-and-forget) ────────────────────────────────
    void adminClient.from('notifications').insert({
      user_id: product.seller_id,
      type:    'new_marketplace_order',
      title:   'New Order Received',
      message: `You have a new order for ${product.title}`,
      link:    `/marketplace/orders/${order.id}`,
    });

    return NextResponse.json({
      success: true,
      data:    order,
      message: 'Order created. Proceed to payment.',
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error('Order creation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create order' },
      { status: 500 }
    );
  }
}

// ── Helper ────────────────────────────────────────────────────────────────────

function calculateDeliveryFee(state: string): number {
  const lagosZone  = ['Lagos', 'Ogun'];
  const nearbyZone = ['Oyo', 'Osun', 'Ondo', 'Ekiti'];

  if (lagosZone.includes(state))  return 1500;
  if (nearbyZone.includes(state)) return 2500;
  return 3500;
}