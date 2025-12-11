// src/app/api/marketplace/orders/route.ts
// Complete marketplace order management

import { NextRequest, NextResponse } from 'next/server';
import { applyMiddleware } from '@/lib/api/enhanced-middleware';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const createOrderSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().min(1).max(100),
  delivery_address: z.object({
    full_name: z.string().min(2),
    phone: z.string().min(10),
    address: z.string().min(10),
    city: z.string().min(2),
    state: z.string().min(2),
    landmark: z.string().optional(),
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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const role = searchParams.get('role'); // 'buyer' or 'seller'

    const supabase = createClient();
    let query = supabase
      .from('marketplace_orders')
      .select(`
        *,
        product:products(*),
        buyer:profiles!marketplace_orders_buyer_id_fkey(*),
        seller:profiles!marketplace_orders_seller_id_fkey(*)
      `);

    // Filter by role
    if (role === 'buyer') {
      query = query.eq('buyer_id', user.id);
    } else if (role === 'seller') {
      query = query.eq('seller_id', user.id);
    } else {
      query = query.or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`);
    }

    if (status) {
      query = query.eq('status', status);
    }

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

    const body = await request.json();
    const validated = createOrderSchema.parse(body);

    const supabase = createClient();

    // Get product details
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

    // Calculate total
    const subtotal = product.price * validated.quantity;
    const deliveryFee = calculateDeliveryFee(validated.delivery_address.state);
    const total = subtotal + deliveryFee;

    // Generate order number
    const orderNumber = `MKT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    // Create order
    const { data: order, error: orderError } = await supabase
      .from('marketplace_orders')
      .insert({
        order_number: orderNumber,
        buyer_id: user.id,
        seller_id: product.seller_id,
        product_id: validated.product_id,
        quantity: validated.quantity,
        unit_price: product.price,
        subtotal,
        delivery_fee: deliveryFee,
        total_amount: total,
        delivery_address: validated.delivery_address,
        payment_method: validated.payment_method,
        status: 'pending_payment',
      })
      .select()
      .single();

    if (orderError) throw orderError;

    // Notify seller
    await supabase.from('notifications').insert({
      user_id: product.seller_id,
      type: 'new_marketplace_order',
      title: 'New Order Received',
      message: `You have a new order for ${product.title}`,
      link: `/marketplace/orders/${order.id}`,
    });

    return NextResponse.json({
      success: true,
      data: order,
      message: 'Order created. Proceed to payment.',
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0].message },
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

// Helper: Calculate delivery fee based on state
function calculateDeliveryFee(state: string): number {
  const lagosStates = ['Lagos', 'Ogun'];
  const nearbyStates = ['Oyo', 'Osun', 'Ondo', 'Ekiti'];
  
  if (lagosStates.includes(state)) return 1500;
  if (nearbyStates.includes(state)) return 2500;
  return 3500; // Other states
}