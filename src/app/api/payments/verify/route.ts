// src/app/api/payments/verify/route.ts
// Manual fallback verification for when webhooks are delayed.
// Idempotent: calling this twice produces the same result as calling it once.
// Accepts payment_ref (monnify_payment_ref) in the request body.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { MonnifyServerService } from '@/lib/monnify/server-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { payment_ref } = body as { payment_ref?: string };

    if (!payment_ref) {
      return NextResponse.json(
        { success: false, error: 'payment_ref is required' },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    // ── Fetch transaction by monnify_payment_ref ──────────────────────────────
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .select('id, order_id, marketplace_order_id, status, amount, monnify_payment_ref')
      .eq('monnify_payment_ref', payment_ref)
      .single();

    if (txError || !transaction) {
      return NextResponse.json(
        { success: false, error: 'Transaction not found' },
        { status: 404 },
      );
    }

    // ── Idempotency guard ─────────────────────────────────────────────────────
    if (transaction.status === 'successful') {
      // Already fully processed — return success without re-running side effects
      const { data: order } = await supabase
        .from('orders')
        .select('*')
        .eq('id', transaction.order_id!)
        .single();

      return NextResponse.json({
        success: true,
        data: { transaction, order },
        message: 'Payment already verified',
      });
    }

    // ── Server-to-server re-verification (never trust client-supplied status) ─
    const verified = await MonnifyServerService.verifyTransaction(payment_ref);

    if (verified.paymentStatus !== 'PAID') {
      // Mark the transaction failed so we don't re-verify endlessly
      await supabase
        .from('transactions')
        .update({
          status:           'failed',
          monnify_response: {
            paymentStatus: verified.paymentStatus,
            verifiedAt:    new Date().toISOString(),
            source:        'manual_verify',
          },
        })
        .eq('id', transaction.id);

      return NextResponse.json(
        {
          success: false,
          error: `Payment not completed. Status: ${verified.paymentStatus}`,
        },
        { status: 400 },
      );
    }

    // ── Mark transaction successful ───────────────────────────────────────────
    const { data: updatedTransaction, error: updateError } = await supabase
      .from('transactions')
      .update({
        status:           'successful',
        paid_at:          verified.paidOn ?? new Date().toISOString(),
        monnify_response: {
          paymentStatus:        verified.paymentStatus,
          amountPaid:           verified.amountPaid,
          transactionReference: verified.transactionReference,
          verifiedAt:           new Date().toISOString(),
          source:               'manual_verify',
        },
      })
      .eq('id', transaction.id)
      .select()
      .single();

    if (updateError || !updatedTransaction) {
      return NextResponse.json(
        { success: false, error: 'Failed to update transaction' },
        { status: 500 },
      );
    }

    // Guard: this manual verify path only handles standard freelance orders.
    // Marketplace orders go through the webhook (process_marketplace_payment RPC).
    if (!updatedTransaction.order_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Transaction is not associated with a standard order',
        },
        { status: 400 },
      );
    }

    const orderId = updatedTransaction.order_id;

    // ── Update order status ───────────────────────────────────────────────────
    await supabase
      .from('orders')
      .update({ status: 'awaiting_delivery' })
      .eq('id', orderId);

    // ── Create escrow record ──────────────────────────────────────────────────
    await supabase.from('escrow').insert({
      order_id:       orderId,
      transaction_id: updatedTransaction.id,
      amount:         updatedTransaction.amount,
      status:         'held',
    });

    // ── Notify freelancer ─────────────────────────────────────────────────────
    const { data: order } = await supabase
      .from('orders')
      .select('*, freelancer:profiles!orders_freelancer_id_fkey(*)')
      .eq('id', orderId)
      .single();

    if (order) {
      await supabase.from('notifications').insert({
        user_id: order.freelancer_id,
        type:    'new_order',
        title:   'New Order Received',
        message: `You have a new order: ${order.title}`,
        link:    `/freelancer/orders/${order.id}`,
      });
    }

    return NextResponse.json({
      success: true,
      data:    { transaction: updatedTransaction, order },
      message: 'Payment verified successfully',
    });
  } catch (error: unknown) {
    console.error('Payment verification error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      },
      { status: 500 },
    );
  }
}