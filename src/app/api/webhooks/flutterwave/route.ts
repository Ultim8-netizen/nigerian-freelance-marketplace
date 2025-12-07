// src/app/api/webhooks/flutterwave/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('verif-hash');
    const payload = await request.json();
    
    // CRITICAL: Verify webhook signature
    const secretHash = process.env.FLUTTERWAVE_WEBHOOK_SECRET;
    if (!secretHash || signature !== secretHash) {
      console.error('Invalid webhook signature');
      return NextResponse.json(
        { error: 'Unauthorized' }, 
        { status: 401 }
      );
    }

    // Only process successful charges
    if (payload.event !== 'charge.completed' || payload.data.status !== 'successful') {
      return NextResponse.json({ received: true });
    }

    const supabase = createClient();
    const { tx_ref, amount, id: flw_tx_id } = payload.data;

    // Find transaction
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .select('id, order_id, status')
      .eq('transaction_ref', tx_ref)
      .single();

    if (txError || !transaction) {
      console.error('Transaction not found:', tx_ref);
      return NextResponse.json({ received: true });
    }

    // Prevent duplicate processing (idempotency)
    if (transaction.status === 'successful') {
      console.log('Transaction already processed:', tx_ref);
      return NextResponse.json({ received: true, message: 'Already processed' });
    }

    // ATOMIC: Update transaction, escrow, and order
    const { data: result, error: rpcError } = await supabase
      .rpc('process_successful_payment', {
        p_transaction_id: transaction.id,
        p_order_id: transaction.order_id,
        p_flw_tx_id: flw_tx_id,
        p_amount: amount
      });

    if (rpcError) {
      console.error('Payment processing failed:', rpcError);
      return NextResponse.json(
        { error: 'Processing failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      received: true, 
      processed: true 
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500 }
    );
  }
}