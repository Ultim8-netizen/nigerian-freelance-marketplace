// src/app/api/payments/initiate/route.ts
// Fixed: Uses server-only service

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { FlutterwaveServerService } from '@/lib/flutterwave/server-service';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

// Rate limiting check (simple in-memory for demo)
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT = 5; // 5 requests per minute
const RATE_WINDOW = 60000; // 1 minute

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userRequests = rateLimitMap.get(userId) || [];
  
  // Filter requests within window
  const recentRequests = userRequests.filter(time => now - time < RATE_WINDOW);
  
  if (recentRequests.length >= RATE_LIMIT) {
    return false;
  }
  
  recentRequests.push(now);
  rateLimitMap.set(userId, recentRequests);
  return true;
}

const initiateSchema = z.object({
  order_id: z.string().uuid(),
  redirect_url: z.string().url().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Rate limiting
    if (!checkRateLimit(user.id)) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please wait.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const validatedData = initiateSchema.parse(body);

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, client:profiles!orders_client_id_fkey(*)')
      .eq('id', validatedData.order_id)
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

    // Check order status
    if (order.status !== 'pending_payment') {
      return NextResponse.json(
        { success: false, error: 'Order already paid or cancelled' },
        { status: 400 }
      );
    }

    // Generate secure transaction reference
    const txRef = `TX-${Date.now()}-${uuidv4().slice(0, 8)}`;

    // Initialize Flutterwave payment (server-side)
    const paymentData = {
      tx_ref: txRef,
      amount: order.amount,
      currency: 'NGN',
      redirect_url:
        validatedData.redirect_url ||
        `${process.env.NEXT_PUBLIC_APP_URL}/payment/callback`,
      customer: {
        email: order.client.email,
        phone_number: order.client.phone_number || '',
        name: order.client.full_name,
      },
      customizations: {
        title: process.env.NEXT_PUBLIC_APP_NAME || 'F9',
        description: order.title,
        logo: `${process.env.NEXT_PUBLIC_APP_URL}/logo.png`,
      },
    };

    const flutterwaveResponse = await FlutterwaveServerService.initializePayment(
      paymentData
    );

    // Create transaction record
    await supabase.from('transactions').insert({
      order_id: order.id,
      transaction_ref: txRef,
      amount: order.amount,
      transaction_type: 'payment',
      status: 'pending',
    });

    return NextResponse.json({
      success: true,
      data: {
        payment_link: flutterwaveResponse.data.link,
        tx_ref: txRef,
      },
    });
  } catch (error: any) {
    console.error('Payment initiation error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Payment initiation failed' },
      { status: 500 }
    );
  }
}