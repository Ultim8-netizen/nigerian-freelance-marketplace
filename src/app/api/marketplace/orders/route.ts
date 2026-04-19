// src/app/api/marketplace/orders/route.ts
// Complete marketplace order management with dynamic platform fee

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
      auth: 'required',
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
      auth: 'required',
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

    // Admin client required for platform_config (RLS blocks public SELECT)
    // and for the platform_revenue insert.
    const adminClient = createAdminClient();
    const supabase    = await createClient();

    // ── 1. Fetch fee percent from platform_config ─────────────────────────
    const configs    = await getPlatformConfigs(adminClient, [
      CONFIG_KEYS.MARKETPLACE_FEE_PERCENT,
    ]);
    const feePercent = configs[CONFIG_KEYS.MARKETPLACE_FEE_PERCENT]; // e.g. 8

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

    // ── 3. Calculate amounts — never trust client payload ─────────────────
    const subtotal     = product.price * validated.quantity;
    const deliveryFee  = calculateDeliveryFee(validated.delivery_address.state);
    const totalAmount  = subtotal + deliveryFee;

    // Fee is applied to the full total (subtotal + delivery)
    const platformFee    = calculateMarketplaceFee(totalAmount, feePercent);
    const sellerEarnings = calculateSellerEarnings(totalAmount, feePercent);

    const orderNumber = `MKT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    // ── 4. Insert marketplace order ───────────────────────────────────────
    const { data: order, error: orderError } = await supabase
      .from('marketplace_orders')
      .insert({
        order_number:    orderNumber,
        buyer_id:        user.id,
        seller_id:       product.seller_id,
        product_id:      validated.product_id,
        quantity:        validated.quantity,
        unit_price:      product.price,
        subtotal,
        delivery_fee:    deliveryFee,
        total_amount:    totalAmount,
        platform_fee:    platformFee,
        seller_earnings: sellerEarnings,
        delivery_address: validated.delivery_address,
        payment_method:  validated.payment_method,
        status:          'pending_payment',
      })
      .select()
      .single();

    if (orderError) throw orderError;

    // ── 5. Record platform revenue — synchronous, same request ────────────
    const { error: revenueError } = await adminClient
      .from('platform_revenue')
      .insert({
        revenue_type:    'marketplace_commission',
        amount:          platformFee,
        source_user_id:  user.id,       // buyer is the payer
        transaction_ref: order.id,
      });

    if (revenueError) {
      console.error('platform_revenue insert failed for marketplace order', {
        orderId: order.id,
        revenueError,
      });
      // Revenue record is mandatory — surface error rather than silently drop it.
      throw revenueError;
    }

    // ── 6. Notify seller (fire-and-forget) ────────────────────────────────
    void supabase.from('notifications').insert({
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