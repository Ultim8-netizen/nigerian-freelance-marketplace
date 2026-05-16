import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { FlutterwaveServerService } from '@/lib/flutterwave/server-service';
import { timingSafeEqual } from 'crypto';
import { serverEnv } from '@/lib/env';
import type { Json } from '@/types/database.types';

// ─────────────────────────────────────────────────────────────────────────────
// Payload types — inbound payment collections
//
// Flutterwave fires `charge.completed` when a customer payment settles.
// `data.tx_ref` is our generated ref (maps to transactions.flutterwave_tx_ref).
// `data.id` is Flutterwave's numeric transaction ID — used for verification.
// ─────────────────────────────────────────────────────────────────────────────

interface FlutterwaveChargeData {
  id:             number;
  tx_ref:         string;
  flw_ref:        string;
  amount:         number;
  amount_settled: number;
  currency:       string;
  status:         'successful' | 'failed' | 'pending' | string;
  created_at:     string;
  customer: {
    email: string;
    name:  string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Payload types — outbound disbursements
//
// Flutterwave fires `transfer.completed` for settled transfers and
// `transfer.failed` for hard failures (rejected by bank / clearing).
// Both shapes carry `data.reference` which maps to
// withdrawals.flutterwave_transfer_ref.
// ─────────────────────────────────────────────────────────────────────────────

interface FlutterwaveTransferData {
  id:             number;
  reference:      string;
  amount:         number;
  fee:            number;
  status:         'SUCCESSFUL' | 'FAILED' | 'NEW' | 'PENDING' | string;
  narration:      string;
  bank_code:      string;
  account_number: string;
  account_name:   string;
  created_at:     string;
}

interface FlutterwaveWebhookPayload {
  event: 'charge.completed'
       | 'transfer.completed'
       | 'transfer.failed'
       | string;
  data:  FlutterwaveChargeData | FlutterwaveTransferData;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper — narrow data to transfer shape
// ─────────────────────────────────────────────────────────────────────────────

function isTransferData(
  data: FlutterwaveWebhookPayload['data'],
): data is FlutterwaveTransferData {
  return 'reference' in data && !('tx_ref' in data);
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const adminClient = createServiceClient();

  // ── 1. Read raw body BEFORE any parsing ──────────────────────────────────
  const rawBody = await request.text();

  // ── 2. Signature verification ─────────────────────────────────────────────
  // Flutterwave sends the secret hash in `verif-hash`.
  // This is a direct string equality check — NOT an HMAC.
  // We use timingSafeEqual to prevent timing oracle attacks.
  const signatureHeader = request.headers.get('verif-hash');
  const webhookSecret   = serverEnv.FLUTTERWAVE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    await adminClient.from('security_logs').insert({
      event_type:  'webhook_config_error',
      severity:    'high',
      description: 'FLUTTERWAVE_WEBHOOK_SECRET is not configured',
      metadata:    { provider: 'flutterwave' } as Json,
    });
    // 200 so Flutterwave doesn't retry a config problem indefinitely
    return NextResponse.json({ received: true });
  }

  if (!signatureHeader) {
    await adminClient.from('security_logs').insert({
      event_type:  'webhook_signature_missing',
      severity:    'high',
      description: 'Flutterwave webhook received without verif-hash header',
      metadata:    { provider: 'flutterwave' } as Json,
    });
    return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
  }

  let isValidSignature: boolean;
  try {
    const headerBuf = Buffer.from(signatureHeader, 'utf8');
    const secretBuf = Buffer.from(webhookSecret,   'utf8');
    isValidSignature =
      headerBuf.length === secretBuf.length &&
      timingSafeEqual(headerBuf, secretBuf);
  } catch {
    isValidSignature = false;
  }

  if (!isValidSignature) {
    await adminClient.from('security_logs').insert({
      event_type:  'webhook_signature_invalid',
      severity:    'high',
      description: 'Flutterwave webhook verif-hash verification failed',
      metadata:    { provider: 'flutterwave' } as Json,
    });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── 3. Parse payload ──────────────────────────────────────────────────────
  let payload: FlutterwaveWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as FlutterwaveWebhookPayload;
  } catch {
    await adminClient.from('security_logs').insert({
      event_type:  'webhook_parse_error',
      severity:    'high',
      description: 'Flutterwave webhook body failed JSON parse after signature passed',
      metadata:    { provider: 'flutterwave', rawBody: rawBody.slice(0, 500) } as Json,
    });
    return NextResponse.json({ received: true });
  }

  // ── 4. Log raw payload (always) ───────────────────────────────────────────
  await adminClient.from('webhook_logs').insert({
    provider:    'flutterwave',
    event:       payload.event ?? 'unknown',
    verified:    true,
    payload:     payload as unknown as Json,
    received_at: new Date().toISOString(),
  });

  // ── 5. Route by event type ────────────────────────────────────────────────

  switch (payload.event) {

    // ── 5a. Inbound payment collection ───────────────────────────────────────
    case 'charge.completed':
      return handleChargeCompleted(payload, adminClient);

    // ── 5b. Outbound disbursement — settled ───────────────────────────────────
    // data.status === 'SUCCESSFUL': wallet deduction trigger fires via the
    // sync_wallet_on_withdrawal_complete DB trigger when row flips to 'completed'.
    case 'transfer.completed':
      return handleTransferCompleted(payload, adminClient);

    // ── 5c. Outbound disbursement — hard failure ──────────────────────────────
    // Flutterwave fires transfer.failed as a distinct event when a transfer is
    // definitively rejected (e.g. invalid account, bank-side refusal).
    // Routed to the same handler: data.status === 'FAILED' takes the failure
    // branch. Wallet balance is preserved — money was never moved.
    case 'transfer.failed':
      return handleTransferCompleted(payload, adminClient);

    default:
      console.log('[Flutterwave Webhook] Unhandled event type, acknowledging:', payload.event);
      return NextResponse.json({ received: true });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Branch: charge.completed (inbound collection)
// ─────────────────────────────────────────────────────────────────────────────

async function handleChargeCompleted(
  payload:     FlutterwaveWebhookPayload,
  adminClient: ReturnType<typeof createServiceClient>,
): Promise<NextResponse> {
  const eventData = payload.data as FlutterwaveChargeData;
  const { id: flwTransactionId, tx_ref, amount_settled } = eventData;

  try {
    const { data: transaction, error: txError } = await adminClient
      .from('transactions')
      .select('id, order_id, marketplace_order_id, status, amount, flutterwave_tx_ref')
      .eq('flutterwave_tx_ref', tx_ref)
      .single();

    if (txError || !transaction) {
      console.warn('[Flutterwave Webhook] Transaction not found for tx_ref:', tx_ref);
      return NextResponse.json({ received: true });
    }

    if (transaction.status === 'successful') {
      console.log('[Flutterwave Webhook] Already processed, skipping:', transaction.id);
      return NextResponse.json({ received: true, message: 'Already processed' });
    }

    // Server-to-server re-verification using the numeric transaction ID —
    // never trust the webhook payload amount or status alone.
    const verified = await FlutterwaveServerService.verifyTransaction(flwTransactionId);

    if (verified.paymentStatus !== 'successful') {
      await adminClient
        .from('transactions')
        .update({
          status:               'failed',
          flutterwave_response: {
            paymentStatus: verified.paymentStatus,
            verifiedAt:    new Date().toISOString(),
            source:        'webhook_reverification',
          } as Json,
        })
        .eq('id', transaction.id);

      console.warn('[Flutterwave Webhook] Re-verification non-successful:', verified.paymentStatus);
      return NextResponse.json({ received: true });
    }

    let rpcError: { message: string } | null = null;

    if (transaction.order_id && !transaction.marketplace_order_id) {
      // Freelance order
      const res = await adminClient.rpc('process_successful_payment', {
        p_transaction_id: transaction.id,
        p_order_id:       transaction.order_id,
        p_flw_tx_id:      String(flwTransactionId),
        p_amount:         amount_settled,
      });
      rpcError = res.error;
    } else if (transaction.marketplace_order_id) {
      // Marketplace order
      const res = await adminClient.rpc('process_marketplace_payment', {
        p_transaction_id: transaction.id,
        p_order_id:       transaction.marketplace_order_id,
        p_flw_tx_id:      String(flwTransactionId),
        p_amount:         amount_settled,
      });
      rpcError = res.error;
    } else {
      console.error('[Flutterwave Webhook] Unlinked inflow:', transaction.id);
      await adminClient.from('security_logs').insert({
        event_type:  'unlinked_payment_inflow',
        severity:    'high',
        description: 'Flutterwave payment received for a transaction not linked to any order',
        metadata:    {
          transaction_id:     transaction.id,
          tx_ref,
          flw_transaction_id: flwTransactionId,
          amount_settled,
        } as Json,
      });
      return NextResponse.json({ received: true });
    }

    if (rpcError) {
      console.error('[Flutterwave Webhook] RPC error:', rpcError.message);
      await adminClient.from('security_logs').insert({
        event_type:  'webhook_rpc_failure',
        severity:    'high',
        description: `Flutterwave webhook RPC failed: ${rpcError.message}`,
        metadata:    {
          transaction_id: transaction.id,
          tx_ref,
          rpc_error:      rpcError.message,
        } as Json,
      });
      return NextResponse.json({ received: true });
    }

    return NextResponse.json({ received: true, processed: true });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Flutterwave Webhook] charge.completed unhandled exception:', message);
    await adminClient.from('security_logs').insert({
      event_type:  'webhook_unhandled_exception',
      severity:    'high',
      description: `Flutterwave webhook unhandled exception: ${message}`,
      metadata:    {
        tx_ref: (payload.data as FlutterwaveChargeData).tx_ref ?? null,
        error:  message,
      } as Json,
    });
    return NextResponse.json({ received: true });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Branch: transfer.completed / transfer.failed
//
// Both event types are routed here. data.status distinguishes the outcome:
//   SUCCESSFUL → flip withdrawal to 'completed', fire wallet deduction trigger.
//   FAILED     → flip withdrawal to 'failed', wallet balance preserved.
//
// transfer.failed arrives with data.status === 'FAILED' just like the FAILED
// branch inside transfer.completed, so no additional logic is needed — the
// status branches below cover both entry points.
// ─────────────────────────────────────────────────────────────────────────────

async function handleTransferCompleted(
  payload:     FlutterwaveWebhookPayload,
  adminClient: ReturnType<typeof createServiceClient>,
): Promise<NextResponse> {
  if (!isTransferData(payload.data)) {
    console.error('[Flutterwave Webhook] transfer event payload shape unexpected');
    return NextResponse.json({ received: true });
  }

  const { reference, amount, status: transferStatus } = payload.data;

  try {
    const { data: withdrawal, error: fetchErr } = await adminClient
      .from('withdrawals')
      .select('id, status, user_id, amount')
      .eq('flutterwave_transfer_ref', reference)
      .single();

    if (fetchErr || !withdrawal) {
      console.warn('[Flutterwave Webhook] transfer event: withdrawal not found for ref:', reference);
      await adminClient.from('security_logs').insert({
        event_type:  'disbursement_withdrawal_not_found',
        severity:    'medium',
        description: `${payload.event} received but no matching withdrawal row found`,
        metadata:    { flutterwave_transfer_ref: reference, amount } as Json,
      });
      return NextResponse.json({ received: true });
    }

    // ── SUCCESSFUL transfer ───────────────────────────────────────────────
    if (transferStatus === 'SUCCESSFUL') {

      if (withdrawal.status === 'completed') {
        console.log('[Flutterwave Webhook] transfer already processed:', withdrawal.id);
        return NextResponse.json({ received: true, message: 'Already completed' });
      }

      // This transition fires sync_wallet_on_withdrawal_complete trigger.
      // Wallet deduction happens here — nowhere else.
      const { error: updateErr } = await adminClient
        .from('withdrawals')
        .update({ status: 'completed' })
        .eq('id', withdrawal.id)
        .eq('status', 'processing'); // only advance from 'processing'

      if (updateErr) {
        console.error('[Flutterwave Webhook] Failed to mark withdrawal completed:', updateErr.message);
        await adminClient.from('security_logs').insert({
          event_type:  'disbursement_completion_update_failed',
          severity:    'high',
          description: `Could not set withdrawal ${withdrawal.id} to completed: ${updateErr.message}`,
          metadata:    { flutterwave_transfer_ref: reference, withdrawal_id: withdrawal.id } as Json,
        });
        return NextResponse.json({ received: true });
      }

      void adminClient.from('audit_logs').insert({
        user_id:       withdrawal.user_id,
        action:        'withdrawal_completed',
        resource_type: 'withdrawals',
        resource_id:   withdrawal.id,
        metadata:      {
          flutterwave_transfer_ref: reference,
          amount:                   withdrawal.amount,
          source:                   'flutterwave_transfer_webhook',
        },
      });

      void adminClient.from('notifications').insert({
        user_id: withdrawal.user_id,
        type:    'withdrawal_completed',
        title:   'Withdrawal Successful',
        message: `Your withdrawal of ₦${withdrawal.amount.toLocaleString('en-NG')} has been sent to your bank account.`,
        link:    '/freelancer/earnings',
      });

      console.log('[Flutterwave Webhook] Withdrawal completed, wallet deduction triggered:', withdrawal.id);
      return NextResponse.json({ received: true, processed: true });
    }

    // ── FAILED transfer ───────────────────────────────────────────────────
    if (transferStatus === 'FAILED') {

      if (withdrawal.status === 'failed' || withdrawal.status === 'completed') {
        console.log('[Flutterwave Webhook] transfer already in terminal state:', withdrawal.id, withdrawal.status);
        return NextResponse.json({ received: true, message: 'Already in terminal state' });
      }

      const failureReason =
        payload.event === 'transfer.failed'
          ? 'Flutterwave transfer.failed — hard rejection by receiving bank or clearing network'
          : 'Flutterwave transfer.completed FAILED — transfer rejected by receiving bank or clearing';

      const { error: updateErr } = await adminClient
        .from('withdrawals')
        .update({ status: 'failed', failure_reason: failureReason })
        .eq('id', withdrawal.id)
        .eq('status', 'processing');

      if (updateErr) {
        console.error('[Flutterwave Webhook] Failed to mark withdrawal failed:', updateErr.message);
        await adminClient.from('security_logs').insert({
          event_type:  'disbursement_failure_update_failed',
          severity:    'high',
          description: `Could not set withdrawal ${withdrawal.id} to failed: ${updateErr.message}`,
          metadata:    { flutterwave_transfer_ref: reference, withdrawal_id: withdrawal.id } as Json,
        });
        return NextResponse.json({ received: true });
      }

      void adminClient.from('audit_logs').insert({
        user_id:       withdrawal.user_id,
        action:        'withdrawal_failed_by_bank',
        resource_type: 'withdrawals',
        resource_id:   withdrawal.id,
        metadata:      {
          flutterwave_transfer_ref: reference,
          amount:                   withdrawal.amount,
          reason:                   failureReason,
          source:                   'flutterwave_transfer_webhook',
          event:                    payload.event,
        },
      });

      void adminClient.from('notifications').insert({
        user_id: withdrawal.user_id,
        type:    'withdrawal_failed',
        title:   'Withdrawal Failed',
        message: `Your withdrawal of ₦${withdrawal.amount.toLocaleString('en-NG')} could not be processed by the bank. Your wallet balance has not been affected — please verify your bank details and try again.`,
        link:    '/freelancer/earnings',
      });

      console.log('[Flutterwave Webhook] Withdrawal marked failed:', withdrawal.id, '| event:', payload.event);
      return NextResponse.json({ received: true, processed: true });
    }

    // Any other status (NEW, PENDING) — acknowledge without state change
    console.log('[Flutterwave Webhook] transfer event non-terminal status, acknowledging:', transferStatus);
    return NextResponse.json({ received: true });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Flutterwave Webhook] transfer event unhandled exception:', message);
    await adminClient.from('security_logs').insert({
      event_type:  'webhook_unhandled_exception',
      severity:    'high',
      description: `transfer event unhandled exception: ${message}`,
      metadata:    { flutterwave_transfer_ref: reference, error: message, event: payload.event } as Json,
    });
    return NextResponse.json({ received: true });
  }
}