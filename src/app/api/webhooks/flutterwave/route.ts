// src/app/api/webhooks/flutterwave/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  let supabase: ReturnType<typeof createClient>;
  let rawBody: string;
  let payload: any;
  
  try {
    supabase = createClient();
    
    // Get raw body for signature verification
    rawBody = await request.text();
    const signature = request.headers.get('verif-hash');
    
    // Enhanced signature verification
    const secretHash = process.env.FLUTTERWAVE_WEBHOOK_SECRET;
    if (!secretHash) {
      console.error('FLUTTERWAVE_WEBHOOK_SECRET not configured');
      await logWebhook(supabase, null, false, 'Missing webhook secret');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    
    if (!signature) {
      console.error('Missing verif-hash header');
      await logWebhook(supabase, null, false, 'Missing signature header');
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }
    
    // Verify signature using constant-time comparison
    const isValidSignature = crypto.timingSafeEqual(
      Buffer.from(signature, 'utf8'),
      Buffer.from(secretHash, 'utf8')
    );
    
    if (!isValidSignature) {
      console.error('Invalid webhook signature');
      await logWebhook(supabase, null, false, 'Invalid signature');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Parse payload after signature verification
    try {
      payload = JSON.parse(rawBody);
    } catch (parseError) {
      console.error('Invalid JSON payload:', parseError);
      await logWebhook(supabase, null, false, 'Invalid JSON payload');
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
    
    // Log verified webhook for audit trail
    await logWebhook(supabase, payload, true);
    
    // Only process successful charges
    if (payload.event !== 'charge.completed' || payload.data?.status !== 'successful') {
      console.log(`Ignoring event: ${payload.event} with status: ${payload.data?.status}`);
      return NextResponse.json({ received: true });
    }
    
    const { tx_ref, amount, id: flw_tx_id } = payload.data;
    
    // Validate required fields
    if (!tx_ref || !amount || !flw_tx_id) {
      console.error('Missing required fields in payload:', { tx_ref, amount, flw_tx_id });
      await logWebhook(supabase, payload, true, 'Missing required fields');
      return NextResponse.json({ error: 'Invalid payload data' }, { status: 400 });
    }
    
    // Find transaction
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .select('id, order_id, status, amount as expected_amount')
      .eq('transaction_ref', tx_ref)
      .single();
    
    if (txError || !transaction) {
      console.error('Transaction not found:', tx_ref, txError);
      await logWebhook(supabase, payload, true, `Transaction not found: ${tx_ref}`);
      return NextResponse.json({ received: true });
    }
    
    // Prevent duplicate processing (idempotency)
    if (transaction.status === 'successful') {
      console.log('Transaction already processed:', tx_ref);
      await logWebhook(supabase, payload, true, 'Transaction already processed');
      return NextResponse.json({ 
        received: true, 
        message: 'Already processed' 
      });
    }
    
    // Validate amount matches expected amount
    if (parseFloat(amount) !== parseFloat(transaction.expected_amount)) {
      console.error('Amount mismatch:', { 
        received: amount, 
        expected: transaction.expected_amount 
      });
      await logWebhook(supabase, payload, true, 'Amount mismatch detected');
      return NextResponse.json({ error: 'Amount validation failed' }, { status: 400 });
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
      await logWebhook(supabase, payload, true, `Processing failed: ${rpcError.message}`);
      return NextResponse.json(
        { error: 'Processing failed' },
        { status: 500 }
      );
    }
    
    // Log successful processing
    await logWebhook(supabase, payload, true, 'Successfully processed payment');
    
    console.log(`Successfully processed payment for transaction: ${tx_ref}`);
    return NextResponse.json({ 
      received: true, 
      processed: true 
    });
    
  } catch (error) {
    console.error('Webhook error:', error);
    
    // Attempt to log the error if supabase is available
    if (supabase) {
      try {
        await logWebhook(
          supabase, 
          payload || null, 
          false, 
          `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      } catch (logError) {
        console.error('Failed to log webhook error:', logError);
      }
    }
    
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500 }
    );
  }
}

// Helper function to log webhook events
async function logWebhook(
  supabase: ReturnType<typeof createClient>,
  payload: any,
  verified: boolean,
  notes?: string
) {
  try {
    await supabase.from('webhook_logs').insert({
      provider: 'flutterwave',
      event: payload?.event || 'unknown',
      verified,
      payload: payload,
      notes,
      received_at: new Date().toISOString(),
      ip_address: null,
    });
  } catch (error) {
    console.error('Failed to log webhook:', error);
  }
}