// src/app/api/webhooks/monnify/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServiceClient } from '@/lib/supabase/service';
import { MonnifyServerService } from '@/lib/monnify/server-service';
import { serverEnv } from '@/lib/env';
import type { Json } from '@/types/database.types';

// ─────────────────────────────────────────────────────────────────────────────
// Payload types — inbound payment collections
// ─────────────────────────────────────────────────────────────────────────────

interface MonnifyCustomer {
  email: string;
  name: string;
}

interface MonnifyProduct {
  reference: string;
}

interface MonnifyEventData {
  transactionReference: string; // Monnify internal ref — passed as p_monnify_ref
  paymentReference:     string; // our generated ref — maps to transactions.monnify_payment_ref
  amountPaid:           number;
  totalPayable:         number;
  paidOn:               string;
  paymentStatus:        'PAID' | 'FAILED' | string;
  customer:             MonnifyCustomer;
  product:              MonnifyProduct;
}

// ─────────────────────────────────────────────────────────────────────────────
// Payload types — outbound disbursements
//
// Monnify fires SUCCESSFUL_DISBURSEMENT / FAILED_DISBURSEMENT for transfers
// initiated via the Single Transfer API. The `reference` field here is the
// same value we generated as `transferRef` in the execute route and stored in
// withdrawals.monnify_transfer_ref.
// ─────────────────────────────────────────────────────────────────────────────

interface MonnifyDisbursementEventData {
  reference:                string; // our PAYOUT-{id}-{ts} ref — maps to withdrawals.monnify_transfer_ref
  amount:                   number;
  fee:                      number;
  narration:                string;
  destinationAccountNumber: string;
  destinationBankCode:      string;
  destinationAccountName:   string;
  status:                   'SUCCESS' | 'FAILED' | string;
}

interface MonnifyWebhookPayload {
  eventType: 'SUCCESSFUL_TRANSACTION'
           | 'FAILED_TRANSACTION'
           | 'REVERSED_TRANSACTION'
           | 'SUCCESSFUL_DISBURSEMENT'
           | 'FAILED_DISBURSEMENT'
           | string;
  eventData: MonnifyEventData | MonnifyDisbursementEventData;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper — narrow eventData to disbursement shape
// ─────────────────────────────────────────────────────────────────────────────

function isDisbursementData(
  eventData: MonnifyWebhookPayload['eventData']
): eventData is MonnifyDisbursementEventData {
  return 'reference' in eventData && !('paymentReference' in eventData);
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // service-role client — no authenticated session in webhook context
  const adminClient = createServiceClient();

  // ── 1. Read raw body BEFORE any parsing ──────────────────────────────────
  const rawBody = await request.text();

  // ── 2. Signature verification ─────────────────────────────────────────────
  const signatureHeader = request.headers.get('monnify-signature');
  const webhookSecret   = serverEnv.MONNIFY_WEBHOOK_SECRET;

  if (!webhookSecret) {
    await adminClient.from('security_logs').insert({
      event_type:  'webhook_config_error',
      severity:    'high',
      description: 'MONNIFY_WEBHOOK_SECRET is not configured',
      metadata:    { provider: 'monnify' } as Json,
    });
    // 200 so Monnify doesn't retry a config problem indefinitely
    return NextResponse.json({ received: true });
  }

  if (!signatureHeader) {
    await adminClient.from('security_logs').insert({
      event_type:  'webhook_signature_missing',
      severity:    'high',
      description: 'Monnify webhook received without signature header',
      metadata:    { provider: 'monnify' } as Json,
    });
    return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
  }

  const expectedSignature = crypto
    .createHmac('sha512', webhookSecret)
    .update(rawBody)
    .digest('hex');

  let isValidSignature: boolean;
  try {
    isValidSignature = crypto.timingSafeEqual(
      Buffer.from(signatureHeader,   'utf8'),
      Buffer.from(expectedSignature, 'utf8')
    );
  } catch {
    isValidSignature = false;
  }

  if (!isValidSignature) {
    await adminClient.from('security_logs').insert({
      event_type:  'webhook_signature_invalid',
      severity:    'high',
      description: 'Monnify webhook signature verification failed',
      metadata:    { provider: 'monnify' } as Json,
    });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── 3. Parse payload ──────────────────────────────────────────────────────
  let payload: MonnifyWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as MonnifyWebhookPayload;
  } catch {
    await adminClient.from('security_logs').insert({
      event_type:  'webhook_parse_error',
      severity:    'high',
      description: 'Monnify webhook body failed JSON parse after signature passed',
      metadata:    { provider: 'monnify', rawBody: rawBody.slice(0, 500) } as Json,
    });
    return NextResponse.json({ received: true });
  }

  // ── 4. Log raw payload (always) ───────────────────────────────────────────
  await adminClient.from('webhook_logs').insert({
    provider:    'monnify',
    event:       payload.eventType ?? 'unknown',
    verified:    true,
    payload:     payload as unknown as Json,
    received_at: new Date().toISOString(),
  });

  // ── 5. Route by event type ────────────────────────────────────────────────

  switch (payload.eventType) {

    // ── 5a. Inbound payment collection ─────────────────────────────────────
    case 'SUCCESSFUL_TRANSACTION':
      return handleSuccessfulTransaction(payload, adminClient);

    // ── 5b. Outbound disbursement — SUCCESS ─────────────────────────────────
    //
    // This is the event that was previously dropped. When it arrives it means
    // Monnify has successfully settled the bank transfer. We must:
    //   1. Look up the withdrawal row via monnify_transfer_ref
    //   2. Idempotency-guard (already completed → skip)
    //   3. Flip status → 'completed'
    //      ↳ sync_wallet_on_withdrawal_complete trigger fires and deducts
    //        wallet.balance — this is the canonical deduction point.
    //   4. Audit log + user notification
    case 'SUCCESSFUL_DISBURSEMENT':
      return handleSuccessfulDisbursement(payload, adminClient);

    // ── 5c. Outbound disbursement — FAILURE ─────────────────────────────────
    //
    // Transfer was rejected by the receiving bank or Monnify's clearing.
    // Flip status → 'failed'. The trigger does NOT fire on 'failed', so the
    // wallet balance is left intact — the user's money was never moved.
    case 'FAILED_DISBURSEMENT':
      return handleFailedDisbursement(payload, adminClient);

    default:
      console.log('[Monnify Webhook] Unhandled event type, acknowledging:', payload.eventType);
      return NextResponse.json({ received: true });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Branch: SUCCESSFUL_TRANSACTION (inbound collection)
// ─────────────────────────────────────────────────────────────────────────────

async function handleSuccessfulTransaction(
  payload:     MonnifyWebhookPayload,
  adminClient: ReturnType<typeof createServiceClient>
): Promise<NextResponse> {
  const eventData = payload.eventData as MonnifyEventData;
  const { transactionReference, paymentReference, amountPaid } = eventData;

  try {
    const { data: transaction, error: txError } = await adminClient
      .from('transactions')
      .select('id, order_id, marketplace_order_id, status, amount, monnify_payment_ref')
      .eq('monnify_payment_ref', paymentReference)
      .single();

    if (txError || !transaction) {
      console.warn('[Monnify Webhook] Transaction not found for paymentReference:', paymentReference);
      return NextResponse.json({ received: true });
    }

    if (transaction.status === 'successful') {
      console.log('[Monnify Webhook] Already processed, skipping:', transaction.id);
      return NextResponse.json({ received: true, message: 'Already processed' });
    }

    // Server-to-server re-verification — never trust webhook amount alone
    const verified = await MonnifyServerService.verifyTransaction(paymentReference);

    if (verified.paymentStatus !== 'PAID') {
      await adminClient
        .from('transactions')
        .update({
          status:           'failed',
          monnify_response: {
            paymentStatus: verified.paymentStatus,
            verifiedAt:    new Date().toISOString(),
            source:        'webhook_reverification',
          } as Json,
        })
        .eq('id', transaction.id);

      console.warn('[Monnify Webhook] Re-verification non-PAID:', verified.paymentStatus);
      return NextResponse.json({ received: true });
    }

    let rpcError: { message: string } | null = null;

    if (transaction.order_id && !transaction.marketplace_order_id) {
      // Freelance order — transactionReference is Monnify's internal ref,
      // stored in monnify_payment_ref inside the function body.
      const res = await adminClient.rpc('process_successful_payment', {
        p_transaction_id: transaction.id,
        p_order_id:       transaction.order_id,
        p_monnify_ref:    transactionReference, // was: p_flw_tx_id
        p_amount:         amountPaid,
      });
      rpcError = res.error;
    } else if (transaction.marketplace_order_id) {
      // Marketplace order
      const res = await adminClient.rpc('process_marketplace_payment', {
        p_transaction_id: transaction.id,
        p_order_id:       transaction.marketplace_order_id,
        p_monnify_ref:    transactionReference, // was: p_flw_tx_id
        p_amount:         amountPaid,
      });
      rpcError = res.error;
    } else {
      console.error('[Monnify Webhook] Unlinked inflow:', transaction.id);
      await adminClient.from('security_logs').insert({
        event_type:  'unlinked_payment_inflow',
        severity:    'high',
        description: 'Monnify payment received for a transaction not linked to any order',
        metadata:    {
          transaction_id:        transaction.id,
          payment_reference:     paymentReference,
          transaction_reference: transactionReference,
          amount_paid:           amountPaid,
        } as Json,
      });
      return NextResponse.json({ received: true });
    }

    if (rpcError) {
      console.error('[Monnify Webhook] RPC error:', rpcError.message);
      await adminClient.from('security_logs').insert({
        event_type:  'webhook_rpc_failure',
        severity:    'high',
        description: `Monnify webhook RPC failed: ${rpcError.message}`,
        metadata:    {
          transaction_id:    transaction.id,
          payment_reference: paymentReference,
          rpc_error:         rpcError.message,
        } as Json,
      });
      return NextResponse.json({ received: true });
    }

    return NextResponse.json({ received: true, processed: true });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Monnify Webhook] SUCCESSFUL_TRANSACTION unhandled exception:', message);
    await adminClient.from('security_logs').insert({
      event_type:  'webhook_unhandled_exception',
      severity:    'high',
      description: `Monnify webhook unhandled exception: ${message}`,
      metadata:    {
        payment_reference: (payload.eventData as MonnifyEventData).paymentReference ?? null,
        error:             message,
      } as Json,
    });
    return NextResponse.json({ received: true });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Branch: SUCCESSFUL_DISBURSEMENT
//
// Monnify confirms the bank transfer settled. Flipping the withdrawal status
// to 'completed' causes sync_wallet_on_withdrawal_complete to fire and deduct
// wallet.balance. This is the ONLY place that deduction happens — it must not
// be done earlier or in the execute route.
// ─────────────────────────────────────────────────────────────────────────────

async function handleSuccessfulDisbursement(
  payload:     MonnifyWebhookPayload,
  adminClient: ReturnType<typeof createServiceClient>
): Promise<NextResponse> {
  if (!isDisbursementData(payload.eventData)) {
    console.error('[Monnify Webhook] SUCCESSFUL_DISBURSEMENT payload shape unexpected');
    return NextResponse.json({ received: true });
  }

  const { reference, amount } = payload.eventData;

  try {
    // ── Look up withdrawal by the transfer ref we stored ──────────────────
    const { data: withdrawal, error: fetchErr } = await adminClient
      .from('withdrawals')
      .select('id, status, user_id, amount')
      .eq('monnify_transfer_ref', reference)
      .single();

    if (fetchErr || !withdrawal) {
      // Could be a test transfer or a ref mismatch — log and move on
      console.warn('[Monnify Webhook] SUCCESSFUL_DISBURSEMENT: withdrawal not found for ref:', reference);
      await adminClient.from('security_logs').insert({
        event_type:  'disbursement_withdrawal_not_found',
        severity:    'medium',
        description: 'SUCCESSFUL_DISBURSEMENT received but no matching withdrawal row found',
        metadata:    { monnify_transfer_ref: reference, amount } as Json,
      });
      return NextResponse.json({ received: true });
    }

    // ── Idempotency guard ─────────────────────────────────────────────────
    if (withdrawal.status === 'completed') {
      console.log('[Monnify Webhook] SUCCESSFUL_DISBURSEMENT already processed:', withdrawal.id);
      return NextResponse.json({ received: true, message: 'Already completed' });
    }

    // ── Transition to completed ────────────────────────────────────────────
    // This is the transition that fires the DB trigger.
    // sync_wallet_on_withdrawal_complete deducts wallet.balance here.
    const { error: updateErr } = await adminClient
      .from('withdrawals')
      .update({ status: 'completed' })
      .eq('id', withdrawal.id)
      .eq('status', 'processing'); // extra guard: only advance from 'processing'

    if (updateErr) {
      console.error('[Monnify Webhook] Failed to mark withdrawal completed:', updateErr.message);
      await adminClient.from('security_logs').insert({
        event_type:  'disbursement_completion_update_failed',
        severity:    'high',
        description: `Could not set withdrawal ${withdrawal.id} to completed: ${updateErr.message}`,
        metadata:    { monnify_transfer_ref: reference, withdrawal_id: withdrawal.id } as Json,
      });
      // Still 200 — we'll reconcile manually; no retry storms
      return NextResponse.json({ received: true });
    }

    // ── Audit log ─────────────────────────────────────────────────────────
    void adminClient.from('audit_logs').insert({
      user_id:       withdrawal.user_id,
      action:        'withdrawal_completed',
      resource_type: 'withdrawals',
      resource_id:   withdrawal.id,
      metadata:      {
        monnify_transfer_ref: reference,
        amount:               withdrawal.amount,
        source:               'monnify_disbursement_webhook',
      },
    });

    // ── Notify user ───────────────────────────────────────────────────────
    void adminClient.from('notifications').insert({
      user_id: withdrawal.user_id,
      type:    'withdrawal_completed',
      title:   'Withdrawal Successful',
      message: `Your withdrawal of ₦${withdrawal.amount.toLocaleString('en-NG')} has been sent to your bank account.`,
      link:    '/freelancer/earnings',
    });

    console.log('[Monnify Webhook] Withdrawal completed and wallet deduction triggered:', withdrawal.id);
    return NextResponse.json({ received: true, processed: true });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Monnify Webhook] SUCCESSFUL_DISBURSEMENT unhandled exception:', message);
    await adminClient.from('security_logs').insert({
      event_type:  'webhook_unhandled_exception',
      severity:    'high',
      description: `SUCCESSFUL_DISBURSEMENT unhandled exception: ${message}`,
      metadata:    { monnify_transfer_ref: reference, error: message } as Json,
    });
    return NextResponse.json({ received: true });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Branch: FAILED_DISBURSEMENT
//
// Monnify's bank transfer failed (invalid account, bank downtime, etc.).
// Mark the withdrawal 'failed'. The trigger does NOT fire. Wallet balance is
// preserved — the user's funds were never moved.
// ─────────────────────────────────────────────────────────────────────────────

async function handleFailedDisbursement(
  payload:     MonnifyWebhookPayload,
  adminClient: ReturnType<typeof createServiceClient>
): Promise<NextResponse> {
  if (!isDisbursementData(payload.eventData)) {
    console.error('[Monnify Webhook] FAILED_DISBURSEMENT payload shape unexpected');
    return NextResponse.json({ received: true });
  }

  const { reference, amount } = payload.eventData;

  try {
    const { data: withdrawal, error: fetchErr } = await adminClient
      .from('withdrawals')
      .select('id, status, user_id, amount')
      .eq('monnify_transfer_ref', reference)
      .single();

    if (fetchErr || !withdrawal) {
      console.warn('[Monnify Webhook] FAILED_DISBURSEMENT: withdrawal not found for ref:', reference);
      await adminClient.from('security_logs').insert({
        event_type:  'disbursement_withdrawal_not_found',
        severity:    'medium',
        description: 'FAILED_DISBURSEMENT received but no matching withdrawal row found',
        metadata:    { monnify_transfer_ref: reference, amount } as Json,
      });
      return NextResponse.json({ received: true });
    }

    // Already in a terminal state — nothing to do
    if (withdrawal.status === 'failed' || withdrawal.status === 'completed') {
      console.log('[Monnify Webhook] FAILED_DISBURSEMENT already in terminal state:', withdrawal.id, withdrawal.status);
      return NextResponse.json({ received: true, message: 'Already in terminal state' });
    }

    const failureReason = 'Monnify FAILED_DISBURSEMENT webhook — transfer rejected by receiving bank or clearing';

    const { error: updateErr } = await adminClient
      .from('withdrawals')
      .update({
        status:         'failed',
        failure_reason: failureReason,
      })
      .eq('id', withdrawal.id)
      .eq('status', 'processing'); // only regress from 'processing'

    if (updateErr) {
      console.error('[Monnify Webhook] Failed to mark withdrawal failed:', updateErr.message);
      await adminClient.from('security_logs').insert({
        event_type:  'disbursement_failure_update_failed',
        severity:    'high',
        description: `Could not set withdrawal ${withdrawal.id} to failed: ${updateErr.message}`,
        metadata:    { monnify_transfer_ref: reference, withdrawal_id: withdrawal.id } as Json,
      });
      return NextResponse.json({ received: true });
    }

    // Audit log
    void adminClient.from('audit_logs').insert({
      user_id:       withdrawal.user_id,
      action:        'withdrawal_failed_by_bank',
      resource_type: 'withdrawals',
      resource_id:   withdrawal.id,
      metadata:      {
        monnify_transfer_ref: reference,
        amount:               withdrawal.amount,
        reason:               failureReason,
        source:               'monnify_disbursement_webhook',
      },
    });

    // Notify user — their money is safe, they should retry
    void adminClient.from('notifications').insert({
      user_id: withdrawal.user_id,
      type:    'withdrawal_failed',
      title:   'Withdrawal Failed',
      message: `Your withdrawal of ₦${withdrawal.amount.toLocaleString('en-NG')} could not be processed by the bank. Your wallet balance has not been affected — please verify your bank details and try again.`,
      link:    '/freelancer/earnings',
    });

    console.log('[Monnify Webhook] Withdrawal marked failed (bank rejection):', withdrawal.id);
    return NextResponse.json({ received: true, processed: true });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Monnify Webhook] FAILED_DISBURSEMENT unhandled exception:', message);
    await adminClient.from('security_logs').insert({
      event_type:  'webhook_unhandled_exception',
      severity:    'high',
      description: `FAILED_DISBURSEMENT unhandled exception: ${message}`,
      metadata:    { monnify_transfer_ref: reference, error: message } as Json,
    });
    return NextResponse.json({ received: true });
  }
}