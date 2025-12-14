// src/app/api/webhooks/flutterwave/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';
import { Json } from '@/types/database.types';

// Define local payload types for the Flutterwave body
interface FlutterwaveData {
  id: number;
  tx_ref: string;
  amount: number;
  status: 'successful' | string;
}

interface FlutterwaveWebhookPayload {
  event: 'charge.completed' | string;
  data: FlutterwaveData;
}

export async function POST(request: NextRequest) {
  try {
    // 1. Initialize Client
    const supabase = await createClient();

    const rawBody = await request.text();
    const signature = request.headers.get('verif-hash');
    const secretHash = process.env.FLUTTERWAVE_WEBHOOK_SECRET;

    if (!secretHash) {
      console.error('FLUTTERWAVE_WEBHOOK_SECRET not configured');
      return NextResponse.json({ error: 'Configuration error' }, { status: 500 });
    }

    if (!signature) {
      await supabase.from('webhook_logs').insert({
        provider: 'flutterwave',
        event: 'unknown',
        verified: false,
        payload: { error: 'Missing signature' } as unknown as Json,
        notes: 'Missing signature header',
        received_at: new Date().toISOString(),
      });
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }

    // 2. Verify Signature
    const isValidSignature = crypto.timingSafeEqual(
      Buffer.from(signature, 'utf8'),
      Buffer.from(secretHash, 'utf8')
    );

    if (!isValidSignature) {
      await supabase.from('webhook_logs').insert({
        provider: 'flutterwave',
        event: 'unknown',
        verified: false,
        payload: { error: 'Invalid signature' } as unknown as Json,
        notes: 'Invalid signature',
        received_at: new Date().toISOString(),
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 3. Parse Payload
    let payload: FlutterwaveWebhookPayload;
    try {
      // FIX: Removed the unused error identifier from the catch block
      payload = JSON.parse(rawBody) as FlutterwaveWebhookPayload;
    } catch { 
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // 4. Log Success
    await supabase.from('webhook_logs').insert({
      provider: 'flutterwave',
      event: payload.event,
      verified: true,
      payload: payload as unknown as Json,
      notes: 'Verified webhook received',
      received_at: new Date().toISOString(),
    });

    // 5. Logic Checks
    if (payload.event !== 'charge.completed' || payload.data?.status !== 'successful') {
      return NextResponse.json({ received: true });
    }

    const { tx_ref, amount, id: flw_tx_id } = payload.data;

    // 6. Fetch Transaction
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .select('id, order_id, status, amount')
      .eq('transaction_ref', tx_ref)
      .single();

    if (txError || !transaction) {
      console.error('Transaction not found:', tx_ref);
      return NextResponse.json({ received: true });
    }

    if (transaction.status === 'successful') {
      return NextResponse.json({ received: true, message: 'Already processed' });
    }

    if (amount !== transaction.amount) {
      console.error('Amount mismatch');
      return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 });
    }

    // 7. Process Payment (RPC)
    const { error: rpcError } = await supabase.rpc('process_successful_payment', {
      p_transaction_id: transaction.id,
      p_order_id: transaction.order_id,
      p_flw_tx_id: flw_tx_id,
      p_amount: amount
    });

    if (rpcError) {
      console.error('RPC Error:', rpcError);
      return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
    }

    return NextResponse.json({ received: true, processed: true });

  } catch (error) {
    console.error('Webhook error:', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}