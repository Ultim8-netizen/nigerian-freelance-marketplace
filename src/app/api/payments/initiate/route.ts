// src/app/api/payments/initiate/route.ts
// PRODUCTION-READY: Secure payment initiation with comprehensive validation

import { NextRequest as NextReq, NextResponse as NextRes } from 'next/server';
import { requireAuth as reqAuth } from '@/lib/api/middleware';
import { checkRateLimit as checkLimit } from '@/lib/rate-limit-upstash';
import { createClient as createSupaClient } from '@/lib/supabase/server';
import { FlutterwaveServerService } from '@/lib/flutterwave/server-service';
import { sanitizeUuid as sanUuid } from '@/lib/security/sanitize';
import { logger as log } from '@/lib/logger';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

const initiateSchema = z.object({
  order_id: z.string().uuid(),
  redirect_url: z.string().url().optional(),
});

export async function POST(request: NextReq) {
  try {
    // 1. Authentication
    const authResult = await reqAuth(request);
    if (authResult instanceof NextRes) return authResult;
    const { user } = authResult;

    // 2. Rate limiting (5 payment initiations per hour)
    const rateLimitResult = await checkLimit('initiatePayment', user.id);
    if (!rateLimitResult.success) {
      log.warn('Payment rate limit exceeded', { userId: user.id });
      return NextRes.json(
        { 
          success: false, 
          error: 'Too many payment attempts. Please wait.',
          resetAt: rateLimitResult.reset 
        },
        { status: 429 }
      );
    }

    // 3. Validate and sanitize request
    const body = await request.json();
    const sanitizedBody = {
      order_id: sanUuid(body.order_id) || '',
      redirect_url: body.redirect_url,
    };

    const validatedData = initiateSchema.parse(sanitizedBody);

    const supabase = createSupaClient();

    // 4. Get order details with security checks
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, client:profiles!orders_client_id_fkey(*)')
      .eq('id', validatedData.order_id)
      .single();

    if (orderError || !order) {
      log.warn('Invalid order ID in payment initiation', { orderId: validatedData.order_id });
      return NextRes.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    // 5. Verify user is the client
    if (order.client_id !== user.id) {
      log.warn('Unauthorized payment attempt', { userId: user.id, orderId: validatedData.order_id });
      return NextRes.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // 6. Check order status
    if (order.status !== 'pending_payment') {
      return NextRes.json(
        { success: false, error: 'Order already paid or cancelled' },
        { status: 400 }
      );
    }

    // 7. Generate secure transaction reference
    const txRef = `TX-${Date.now()}-${uuidv4().slice(0, 8)}`;

    // 8. Initialize Flutterwave payment
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

    const flutterwaveResponse = await FlutterwaveServerService.initializePayment(paymentData);

    // 9. Create transaction record
    await supabase.from('transactions').insert({
      order_id: order.id,
      transaction_ref: txRef,
      amount: order.amount,
      transaction_type: 'payment',
      status: 'pending',
    });

    log.info('Payment initiated successfully', {
      orderId: order.id,
      userId: user.id,
      txRef,
      amount: order.amount
    });

    return NextRes.json({
      success: true,
      data: {
        payment_link: flutterwaveResponse.data.link,
        tx_ref: txRef,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      log.warn('Payment validation failed', undefined, { errors: error.errors });
      return NextRes.json(
        { success: false, error: 'Invalid request data' },
        { status: 400 }
      );
    }

    log.error('Payment initiation error', error as Error);
    return NextRes.json(
      { success: false, error: 'Payment initiation failed' },
      { status: 500 }
    );
  }
}