// src/app/api/payments/initiate/route.ts
// PRODUCTION-READY: Secure payment initiation for clients paying for orders.
// NOTE: Withdrawal hold logic previously placed here has been removed.
//       It was misplaced — this route handles CLIENT payments, not freelancer
//       withdrawal requests. The hold checks now live exclusively in
//       src/app/(dashboard)/freelancer/earnings/page.tsx inside initiateWithdrawal.

import { NextRequest, NextResponse } from 'next/server';
import { applyMiddleware } from '@/lib/api/enhanced-middleware';
import { createClient } from '@/lib/supabase/server';
import { FlutterwaveServerService } from '@/lib/flutterwave/server-service';
import { sanitizeUuid } from '@/lib/security/sanitize';
import { logger } from '@/lib/logger';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

const initiateSchema = z.object({
  order_id:     z.string().uuid(),
  redirect_url: z.string().url().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await applyMiddleware(request, {
      auth:      'required',
      rateLimit: 'initiatePayment',
    });

    if (error) return error;

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const sanitizedBody = {
      order_id:     sanitizeUuid(body.order_id) || '',
      redirect_url: body.redirect_url,
    };

    const validatedData = initiateSchema.parse(sanitizedBody);
    const supabase = await createClient();

    // ── Fetch order ──────────────────────────────────────────────────────────
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, client:profiles!orders_client_id_fkey(*)')
      .eq('id', validatedData.order_id)
      .single();

    if (orderError || !order) {
      logger.warn('Invalid order ID in payment initiation', { orderId: validatedData.order_id });
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    // Verify the caller is the client who placed this order
    if (order.client_id !== user.id) {
      logger.warn('Unauthorized payment attempt', {
        userId:  user.id,
        orderId: validatedData.order_id,
      });
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    if (order.status !== 'pending_payment') {
      return NextResponse.json(
        { success: false, error: 'Order already paid or cancelled' },
        { status: 400 }
      );
    }

    // ── Proceed to Flutterwave ───────────────────────────────────────────────
    const txRef = `TX-${Date.now()}-${uuidv4().slice(0, 8)}`;

    const paymentData = {
      tx_ref:       txRef,
      amount:       order.amount,
      currency:     'NGN',
      redirect_url:
        validatedData.redirect_url ||
        `${process.env.NEXT_PUBLIC_APP_URL}/payment/callback`,
      customer: {
        email:        order.client.email,
        phone_number: order.client.phone_number || '',
        name:         order.client.full_name,
      },
      customizations: {
        title:       process.env.NEXT_PUBLIC_APP_NAME || 'F9',
        description: order.title,
        logo:        `${process.env.NEXT_PUBLIC_APP_URL}/logo.png`,
      },
    };

    const flutterwaveResponse =
      await FlutterwaveServerService.initializePayment(paymentData);

    await supabase.from('transactions').insert({
      order_id:         order.id,
      transaction_ref:  txRef,
      amount:           order.amount,
      transaction_type: 'payment',
      status:           'pending',
    });

    logger.info('Payment initiated successfully', {
      orderId: order.id,
      userId:  user.id,
      txRef,
      amount:  order.amount,
    });

    return NextResponse.json({
      success: true,
      data: {
        payment_link: flutterwaveResponse.data.link,
        tx_ref:       txRef,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Payment validation failed', { errors: error.issues });
      return NextResponse.json(
        { success: false, error: 'Invalid request data' },
        { status: 400 }
      );
    }

    logger.error('Payment initiation error', error as Error);
    return NextResponse.json(
      { success: false, error: 'Payment initiation failed' },
      { status: 500 }
    );
  }
}