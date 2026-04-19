// src/app/api/payments/initiate/route.ts
// Initialises a Monnify hosted-checkout transaction for a pending order.
// NOTE: Withdrawal hold logic does NOT live here — it belongs exclusively in
//       src/app/(dashboard)/freelancer/earnings/page.tsx (initiateWithdrawal).

import { NextRequest, NextResponse } from 'next/server';
import { applyMiddleware } from '@/lib/api/enhanced-middleware';
import { createClient } from '@/lib/supabase/server';
import { MonnifyServerService } from '@/lib/monnify/server-service';
import { serverEnv } from '@/lib/env';
import { sanitizeUuid } from '@/lib/security/sanitize';
import { logger } from '@/lib/logger';
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
        { status: 401 },
      );
    }

    const body = await request.json();
    const sanitizedBody = {
      order_id:     sanitizeUuid(body.order_id) || '',
      redirect_url: body.redirect_url,
    };

    const validatedData = initiateSchema.parse(sanitizedBody);
    const supabase = await createClient();

    // ── Fetch order + client profile ─────────────────────────────────────────
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, client:profiles!orders_client_id_fkey(*)')
      .eq('id', validatedData.order_id)
      .single();

    if (orderError || !order) {
      logger.warn('Invalid order ID in payment initiation', {
        orderId: validatedData.order_id,
      });
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 },
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
        { status: 403 },
      );
    }

    if (order.status !== 'pending_payment') {
      return NextResponse.json(
        { success: false, error: 'Order already paid or cancelled' },
        { status: 400 },
      );
    }

    // ── Generate payment reference (server-side, cryptographically secure) ───
    const paymentRef = MonnifyServerService.generatePaymentRef();

    const redirectUrl =
      validatedData.redirect_url ||
      `${process.env.NEXT_PUBLIC_APP_URL}/payment/callback`;

    // ── Initialise Monnify hosted-checkout transaction ────────────────────────
    const monnifyResponse = await MonnifyServerService.initializeTransaction({
      amount:             order.amount,
      currencyCode:       'NGN',
      contractCode:       serverEnv.MONNIFY_CONTRACT_CODE,
      paymentReference:   paymentRef,
      paymentDescription: order.title,
      customerEmail:      order.client.email,
      customerName:       order.client.full_name,
      customerPhone:      order.client.phone_number || '',
      redirectUrl,
      paymentMethods:     ['ACCOUNT_TRANSFER', 'CARD', 'USSD'],
    });

    // ── Persist pending transaction ───────────────────────────────────────────
    // transaction_ref is the canonical ref used internally across the platform;
    // monnify_payment_ref is the ref Monnify uses for lookup / webhook matching.
    // Both are set to the same value — one source of truth per transaction.
    const { error: insertError } = await supabase.from('transactions').insert({
      order_id:          order.id,
      transaction_ref:   paymentRef,
      monnify_payment_ref: paymentRef,
      amount:            order.amount,
      transaction_type:  'payment',
      status:            'pending',
      currency:          'NGN',
    });

    if (insertError) {
      logger.error('Failed to persist transaction record', insertError as Error);
      return NextResponse.json(
        { success: false, error: 'Failed to create transaction record' },
        { status: 500 },
      );
    }

    logger.info('Monnify payment initiated', {
      orderId:    order.id,
      userId:     user.id,
      paymentRef,
      amount:     order.amount,
    });

    return NextResponse.json({
      success: true,
      data: {
        checkout_url: monnifyResponse.checkoutUrl,
        payment_ref:  paymentRef,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Payment validation failed', { errors: error.issues });
      return NextResponse.json(
        { success: false, error: 'Invalid request data' },
        { status: 400 },
      );
    }

    logger.error('Payment initiation error', error as Error);
    return NextResponse.json(
      { success: false, error: 'Payment initiation failed' },
      { status: 500 },
    );
  }
}