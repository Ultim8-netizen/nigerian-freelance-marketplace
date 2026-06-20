// src/app/api/payments/verify/route.ts
// Manual fallback verification for when webhooks are delayed.
// Idempotent: calling this twice produces the same result as calling it once.
// Accepts tx_ref (flutterwave_tx_ref) in the request body.
//
// FIX (confirmed via live RLS export): this route previously performed its
// own table writes (transactions.update, orders.update, escrow.insert) using
// the caller's session-bound, RLS-scoped client. Your actual policies are:
//   - transactions has NO UPDATE policy at all       → the status write to
//     'successful' silently affected 0 rows (Postgres does not raise an
//     error for a non-matching UPDATE under RLS), so transactions.status
//     never actually became 'successful' through this path, regardless of
//     how many times it was retried.
//   - escrow has NO INSERT policy at all              → the escrow insert
//     was guaranteed to fail on every call. The error was never checked.
//   - There was also no check that the caller owns the order before
//     triggering any of this.
//
// Fix: authenticate the caller, use THEIR OWN RLS-scoped client to look up
// the transaction. transactions' SELECT policy already restricts visible
// rows to order participants, so this lookup doubles as the ownership
// check — if the tx_ref belongs to someone else's order, this returns null,
// and we treat it as "not found" rather than running a separate query.
// Then delegate the actual state transition to the SAME
// process_successful_payment() SECURITY DEFINER RPC the webhook calls, via
// the admin client. This collapses two independently-drifting
// implementations of "mark paid -> activate order -> create escrow" into
// one, and uses verified.amountPaid (re-verified server-side) rather than
// any client-supplied or payload value.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { FlutterwaveServerService } from '@/lib/flutterwave/server-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { tx_ref } = body as { tx_ref?: string };

    if (!tx_ref) {
      return NextResponse.json(
        { success: false, error: 'tx_ref is required' },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      );
    }

    // ── Fetch transaction by flutterwave_tx_ref ───────────────────────────────
    // Uses the CALLER's RLS-scoped client deliberately. transactions' SELECT
    // policy restricts visible rows to participants of the linked order — if
    // this tx_ref belongs to an order this user isn't part of, this query
    // returns null. That null doubles as our authorization check; no
    // separate "is this my order?" lookup is needed.
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .select('id, order_id, marketplace_order_id, status, amount, flutterwave_tx_ref')
      .eq('flutterwave_tx_ref', tx_ref)
      .single();

    if (txError || !transaction) {
      return NextResponse.json(
        { success: false, error: 'Transaction not found' },
        { status: 404 },
      );
    }

    // Guard: this manual verify path only handles standard freelance orders.
    // Marketplace orders go through the webhook (process_marketplace_payment RPC).
    if (!transaction.order_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Transaction is not associated with a standard order',
        },
        { status: 400 },
      );
    }

    // From here on, every write needs privileges the authenticated role does
    // not have (transactions has no UPDATE policy, escrow has no INSERT
    // policy) — the admin client is required, not optional.
    const adminClient = createAdminClient();

    // ── Idempotency guard ─────────────────────────────────────────────────────
    if (transaction.status === 'successful') {
      const { data: order } = await adminClient
        .from('orders')
        .select('*')
        .eq('id', transaction.order_id)
        .single();

      return NextResponse.json({
        success: true,
        data: { transaction, order },
        message: 'Payment already verified',
      });
    }

    // ── Server-to-server re-verification (never trust client-supplied status) ─
    const verified = await FlutterwaveServerService.verifyTransactionByRef(tx_ref);

    if (verified.paymentStatus !== 'successful') {
      // Admin client required — transactions has no UPDATE policy for the
      // authenticated role.
      await adminClient
        .from('transactions')
        .update({
          status:               'failed',
          flutterwave_response: {
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

    // ── Delegate the state transition to the canonical RPC ────────────────────
    // Identical to what the webhook does for charge.completed: mark the
    // transaction successful, advance the order, create the escrow row
    // (idempotent via ON CONFLICT (order_id) DO NOTHING), notify the
    // freelancer. Uses verified.amountPaid — the re-verified figure — never
    // a client-supplied or unverified amount.
    const { data: rpcResult, error: rpcError } = await adminClient.rpc(
      'process_successful_payment',
      {
        p_transaction_id: transaction.id,
        p_order_id:       transaction.order_id,
        p_flw_tx_id:      verified.transactionId,
        p_amount:         verified.amountPaid,
      },
    );

    if (rpcError) {
      console.error('[payments/verify] RPC error:', rpcError.message);
      return NextResponse.json(
        { success: false, error: 'Failed to finalize payment' },
        { status: 500 },
      );
    }

    const result = rpcResult as { success: boolean; error?: string } | null;
    if (!result?.success) {
      console.error('[payments/verify] RPC returned failure:', result?.error);
      return NextResponse.json(
        { success: false, error: result?.error ?? 'Failed to finalize payment' },
        { status: 500 },
      );
    }

    // ── Re-fetch the now-updated rows for the frontend ─────────────────────────
    // usePayments.verifyPayment()/the callback page expect { transaction, order }
    // in the response — preserved here even though the RPC itself only
    // returns { success, order_id }.
    const [{ data: updatedTransaction }, { data: order }] = await Promise.all([
      adminClient.from('transactions').select('*').eq('id', transaction.id).single(),
      adminClient.from('orders').select('*').eq('id', transaction.order_id).single(),
    ]);

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