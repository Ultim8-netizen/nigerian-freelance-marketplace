// src/app/api/webhooks/monnify/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServiceClient } from '@/lib/supabase/service';
import { MonnifyServerService } from '@/lib/monnify/server-service';
import { serverEnv } from '@/lib/env';
import type { Json } from '@/types/database.types';

// ─────────────────────────────────────────────────────────────────────────────
// Payload types
// ─────────────────────────────────────────────────────────────────────────────

interface MonnifyCustomer {
  email: string;
  name: string;
}

interface MonnifyProduct {
  reference: string;
}

interface MonnifyEventData {
  transactionReference: string; // Monnify's internal ref — passed as p_flw_tx_id
  paymentReference: string;     // our generated ref — maps to transactions.monnify_payment_ref
  amountPaid: number;
  totalPayable: number;
  paidOn: string;
  paymentStatus: 'PAID' | 'FAILED' | string;
  customer: MonnifyCustomer;
  product: MonnifyProduct;
}

interface MonnifyWebhookPayload {
  eventType: 'SUCCESSFUL_TRANSACTION' | 'FAILED_TRANSACTION' | 'REVERSED_TRANSACTION' | string;
  eventData: MonnifyEventData;
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // adminClient uses the service role key — required for webhook DB writes
  // (no authenticated session exists in this context)
  const adminClient = createServiceClient();

  // ── 1. Read raw body BEFORE any parsing ──────────────────────────────────
  const rawBody = await request.text();

  // ── 2. Signature verification ─────────────────────────────────────────────
  const signatureHeader = request.headers.get('monnify-signature');
  const webhookSecret = serverEnv.MONNIFY_WEBHOOK_SECRET;

  if (!webhookSecret) {
    // Config error — log and bail without returning 5xx to Monnify
    await adminClient.from('security_logs').insert({
      event_type: 'webhook_config_error',
      severity: 'high',
      description: 'MONNIFY_WEBHOOK_SECRET is not configured',
      metadata: { provider: 'monnify' } as Json,
    });
    // Return 200 so Monnify doesn't retry a config problem infinitely
    return NextResponse.json({ received: true });
  }

  if (!signatureHeader) {
    await adminClient.from('security_logs').insert({
      event_type: 'webhook_signature_missing',
      severity: 'high',
      description: 'Monnify webhook received without signature header',
      metadata: { provider: 'monnify' } as Json,
    });
    return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
  }

  // HMAC-SHA512 of the raw request body, keyed by the webhook secret
  const expectedSignature = crypto
    .createHmac('sha512', webhookSecret)
    .update(rawBody)
    .digest('hex');

  let isValidSignature: boolean;
  try {
    isValidSignature = crypto.timingSafeEqual(
      Buffer.from(signatureHeader, 'utf8'),
      Buffer.from(expectedSignature, 'utf8')
    );
  } catch {
    // timingSafeEqual throws if buffers differ in length — that means invalid
    isValidSignature = false;
  }

  if (!isValidSignature) {
    await adminClient.from('security_logs').insert({
      event_type: 'webhook_signature_invalid',
      severity: 'high',
      description: 'Monnify webhook signature verification failed',
      metadata: { provider: 'monnify' } as Json,
    });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── 3. Parse payload ──────────────────────────────────────────────────────
  let payload: MonnifyWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as MonnifyWebhookPayload;
  } catch {
    // Malformed JSON from a verified source — log, return 200
    await adminClient.from('security_logs').insert({
      event_type: 'webhook_parse_error',
      severity: 'high',
      description: 'Monnify webhook body failed JSON parse after signature passed',
      metadata: { provider: 'monnify', rawBody: rawBody.slice(0, 500) } as Json,
    });
    return NextResponse.json({ received: true });
  }

  // ── 4. Log raw payload to webhook_logs (always, regardless of outcome) ────
  await adminClient.from('webhook_logs').insert({
    provider: 'monnify',
    event: payload.eventType ?? 'unknown',
    verified: true,
    payload: payload as unknown as Json,
    received_at: new Date().toISOString(),
  });

  // ── 5. Only process SUCCESSFUL_TRANSACTION; acknowledge everything else ───
  if (payload.eventType !== 'SUCCESSFUL_TRANSACTION') {
    console.log('[Monnify Webhook] Non-success event received, acknowledging:', payload.eventType);
    return NextResponse.json({ received: true });
  }

  const { transactionReference, paymentReference, amountPaid } = payload.eventData;

  try {
    // ── 6. Look up transaction by monnify_payment_ref ─────────────────────
    const { data: transaction, error: txError } = await adminClient
      .from('transactions')
      .select('id, order_id, marketplace_order_id, status, amount, monnify_payment_ref')
      .eq('monnify_payment_ref', paymentReference)
      .single();

    if (txError || !transaction) {
      console.warn('[Monnify Webhook] Transaction not found for paymentReference:', paymentReference);
      // Not our transaction — acknowledge and move on
      return NextResponse.json({ received: true });
    }

    // ── 7. Idempotency guard ──────────────────────────────────────────────
    if (transaction.status === 'successful') {
      console.log('[Monnify Webhook] Already processed, skipping:', transaction.id);
      return NextResponse.json({ received: true, message: 'Already processed' });
    }

    // ── 8. Server-to-server re-verification (never trust webhook amount alone)
    const verified = await MonnifyServerService.verifyTransaction(paymentReference);

    if (verified.paymentStatus !== 'PAID') {
      // Mark the transaction failed in our DB
      await adminClient
        .from('transactions')
        .update({
          status: 'failed',
          monnify_response: {
            paymentStatus: verified.paymentStatus,
            verifiedAt: new Date().toISOString(),
            source: 'webhook_reverification',
          } as Json,
        })
        .eq('id', transaction.id);

      console.warn(
        '[Monnify Webhook] Re-verification returned non-PAID status:',
        verified.paymentStatus,
        'for transaction:',
        transaction.id
      );
      return NextResponse.json({ received: true });
    }

    // ── 9. Route to the correct RPC based on order linkage ────────────────
    let rpcError: { message: string } | null = null;

    if (transaction.order_id && !transaction.marketplace_order_id) {
      // Standard freelance order
      const res = await adminClient.rpc('process_successful_payment', {
        p_transaction_id: transaction.id,
        p_order_id: transaction.order_id,
        p_flw_tx_id: transactionReference, // Monnify's internal ref stored in the flw column
        p_amount: amountPaid,
      });
      rpcError = res.error;
    } else if (transaction.marketplace_order_id) {
      // Marketplace product order
      const res = await adminClient.rpc('process_marketplace_payment', {
        p_transaction_id: transaction.id,
        p_order_id: transaction.marketplace_order_id,
        p_flw_tx_id: transactionReference,
        p_amount: amountPaid,
      });
      rpcError = res.error;
    } else {
      // Unlinked inflow — fraud detection hook, never 5xx
      console.error('[Monnify Webhook] Unlinked inflow — transaction not tied to any order:', transaction.id);
      await adminClient.from('security_logs').insert({
        event_type: 'unlinked_payment_inflow',
        severity: 'high',
        description: 'Monnify payment received for a transaction not linked to any order',
        metadata: {
          transaction_id: transaction.id,
          payment_reference: paymentReference,
          transaction_reference: transactionReference,
          amount_paid: amountPaid,
        } as Json,
      });
      return NextResponse.json({ received: true });
    }

    if (rpcError) {
      console.error('[Monnify Webhook] RPC error:', rpcError.message);
      await adminClient.from('security_logs').insert({
        event_type: 'webhook_rpc_failure',
        severity: 'high',
        description: `Monnify webhook RPC failed: ${rpcError.message}`,
        metadata: {
          transaction_id: transaction.id,
          payment_reference: paymentReference,
          rpc_error: rpcError.message,
        } as Json,
      });
      // Still return 200 — RPC errors are our problem, not Monnify's
      return NextResponse.json({ received: true });
    }

    return NextResponse.json({ received: true, processed: true });

  } catch (error) {
    // Catch-all: log to security_logs, always return 200
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Monnify Webhook] Unhandled exception:', message);

    await adminClient.from('security_logs').insert({
      event_type: 'webhook_unhandled_exception',
      severity: 'high',
      description: `Monnify webhook unhandled exception: ${message}`,
      metadata: {
        payment_reference: payload?.eventData?.paymentReference ?? null,
        error: message,
      } as Json,
    });

    // Never 5xx — prevents Monnify retry storms
    return NextResponse.json({ received: true });
  }
}