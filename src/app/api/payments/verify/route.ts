// src/app/api/payments/verify/route.ts
// Payment verification webhook

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { FlutterwaveService } from '@/lib/flutterwave/config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transaction_id, tx_ref } = body;

    const supabase = createClient();

    // Verify payment with Flutterwave
    const verification = await FlutterwaveService.verifyPayment(transaction_id);

    if (verification.status !== 'success') {
      return NextResponse.json(
        { success: false, error: 'Payment verification failed' },
        { status: 400 }
      );
    }

    // Update transaction
    const { data: transaction } = await supabase
      .from('transactions')
      .update({
        status: 'successful',
        flutterwave_tx_ref: transaction_id,
        flutterwave_response: verification.data,
        paid_at: new Date().toISOString(),
      })
      .eq('transaction_ref', tx_ref)
      .select()
      .single();

    if (!transaction) {
      return NextResponse.json(
        { success: false, error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Update order status
    await supabase
      .from('orders')
      .update({ status: 'awaiting_delivery' })
      .eq('id', transaction.order_id);

    // Create escrow record
    await supabase.from('escrow').insert({
      order_id: transaction.order_id,
      transaction_id: transaction.id,
      amount: transaction.amount,
      status: 'held',
    });

    // Get order details for notifications
    const { data: order } = await supabase
      .from('orders')
      .select('*, freelancer:profiles!orders_freelancer_id_fkey(*)')
      .eq('id', transaction.order_id)
      .single();

    if (order) {
      // Notify freelancer
      await supabase.from('notifications').insert({
        user_id: order.freelancer_id,
        type: 'new_order',
        title: 'New Order Received',
        message: `You have a new order: ${order.title}`,
        link: `/freelancer/orders/${order.id}`,
      });
    }

    return NextResponse.json({
      success: true,
      data: { transaction, order },
      message: 'Payment verified successfully',
    });
  } catch (error: unknown) {
    console.error('Payment verification error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'An error occurred' },
      { status: 500 }
    );
  }
}