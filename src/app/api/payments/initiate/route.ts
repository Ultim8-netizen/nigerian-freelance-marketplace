// src/app/api/payments/initiate/route.ts
// PRODUCTION-READY: Secure payment initiation with withdrawal hold guards

import { NextRequest, NextResponse } from 'next/server';
import { applyMiddleware } from '@/lib/api/enhanced-middleware';
import { createClient } from '@/lib/supabase/server';
import { FlutterwaveServerService } from '@/lib/flutterwave/server-service';
import { sanitizeUuid } from '@/lib/security/sanitize';
import { logger } from '@/lib/logger';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

const initiateSchema = z.object({
  order_id: z.string().uuid(),
  redirect_url: z.string().url().optional(),
});

// Thresholds (milliseconds)
// Check 1 — wallet.updated_at within 2 h is used as the proxy for "recently funded"
// since `wallets` has no dedicated `last_funded_at` column.
const WALLET_HOLD_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 h

// Check 2 — wallet.updated_at within 48 h is used as the proxy for "bank account
// recently configured". The `wallets` table stores bank details inline
// (account_name / account_number / bank_name); there is no separate bank_accounts
// table in the schema. Any change to those fields updates wallets.updated_at.
const BANK_HOLD_WINDOW_MS = 48 * 60 * 60 * 1000; // 48 h

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await applyMiddleware(request, {
      auth: 'required',
      rateLimit: 'initiatePayment',
    });

    if (error) return error;

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const sanitizedBody = {
      order_id: sanitizeUuid(body.order_id) || '',
      redirect_url: body.redirect_url,
    };

    const validatedData = initiateSchema.parse(sanitizedBody);
    const supabase = await createClient();

    // ── Fetch order ──────────────────────────────────────────────────────────
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, client:profiles!orders_client_id_fkey(*)')
      .eq('id', validatedData.order_id)
      .single();

    if (orderError || !order) {
      logger.warn('Invalid order ID in payment initiation', { orderId: validatedData.order_id });
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    if (order.client_id !== user.id) {
      logger.warn('Unauthorized payment attempt', {
        userId: user.id,
        orderId: validatedData.order_id,
      });
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    if (order.status !== 'pending_payment') {
      return NextResponse.json(
        { success: false, error: 'Order already paid or cancelled' },
        { status: 400 }
      );
    }

    // ── Withdrawal hold checks (against the freelancer / payee) ─────────────
    //
    // Schema constraints addressed:
    //
    // (a) `wallets` has no `last_funded_at` column — `wallets.updated_at` is
    //     used as the closest proxy. Any credit to the wallet (balance update)
    //     also updates this timestamp.
    //
    // (b) There is no `bank_accounts` table in the schema. Bank details are
    //     stored inline on `wallets` (account_name / account_number / bank_name).
    //     `wallets.updated_at` within 48 h is therefore also the proxy for a
    //     recently configured bank account, since saving bank details updates
    //     the wallet row.
    //
    // (c) `withdrawals` Insert type requires non-nullable account_name,
    //     account_number, bank_name, and amount. These are populated from the
    //     wallet row fetched below. `order_id` and `hold_reason` are not columns
    //     on `withdrawals`; `failure_reason` is used to carry the hold message.
    const freelancerId: string = order.freelancer_id;
    const now = Date.now();

    let withdrawalHoldReason: string | null = null;

    // Fetch freelancer wallet — needed for both hold checks and for the
    // withdrawal insert (required bank detail fields).
    const { data: wallet } = await supabase
      .from('wallets')
      .select('id, updated_at, account_name, account_number, bank_name')
      .eq('user_id', freelancerId)
      .single();

    if (wallet?.updated_at) {
      const walletUpdatedAt = new Date(wallet.updated_at).getTime();

      // Check 1 — wallet updated (funded) within the last 2 h
      if (now - walletUpdatedAt < WALLET_HOLD_WINDOW_MS) {
        withdrawalHoldReason =
          'Withdrawal held: wallet was recently funded. Funds will be released after the 2-hour hold window expires.';
        logger.info('Withdrawal held — wallet updated recently', {
          freelancerId,
          wallet_updated_at: wallet.updated_at,
        });
      }

      // Check 2 — wallet (bank details) updated within the last 48 h
      // Only evaluated if check 1 did not already trigger.
      if (!withdrawalHoldReason && now - walletUpdatedAt < BANK_HOLD_WINDOW_MS) {
        withdrawalHoldReason =
          'Withdrawal held: bank account details were recently configured. Funds will be released after the 48-hour hold window expires.';
        logger.info('Withdrawal held — bank details configured recently', {
          freelancerId,
          wallet_updated_at: wallet.updated_at,
        });
      }
    }

    // If either hold condition is met, record a held withdrawal and surface
    // a clear message. Do NOT proceed to Flutterwave.
    if (withdrawalHoldReason) {
      // withdrawals.Insert requires account_name, account_number, bank_name
      // as non-nullable strings. Only insert the held record when bank details
      // are present on the wallet; otherwise just notify.
      if (
        wallet?.account_name &&
        wallet?.account_number &&
        wallet?.bank_name
      ) {
        await supabase.from('withdrawals').insert({
          user_id: freelancerId,
          wallet_id: wallet.id,
          amount: order.amount,
          account_name: wallet.account_name,
          account_number: wallet.account_number,
          bank_name: wallet.bank_name,
          status: 'held',
          // `failure_reason` is the closest available column for a hold note
          failure_reason: withdrawalHoldReason,
        });
      }

      await supabase.from('notifications').insert({
        user_id: freelancerId,
        type: 'withdrawal_held',
        title: 'Withdrawal On Hold',
        message: withdrawalHoldReason,
      });

      return NextResponse.json(
        {
          success: false,
          error: 'withdrawal_held',
          message: withdrawalHoldReason,
        },
        { status: 202 } // Accepted but not immediately processed
      );
    }

    // ── Proceed to Flutterwave ───────────────────────────────────────────────
    const txRef = `TX-${Date.now()}-${uuidv4().slice(0, 8)}`;

    const paymentData = {
      tx_ref: txRef,
      amount: order.amount,
      currency: 'NGN',
      redirect_url:
        validatedData.redirect_url ||
        `${process.env.NEXT_PUBLIC_APP_URL}/payment/callback`,
      customer: {
        email: order.client.email,
        phone_number: order.client.phone_number || '',
        name: order.client.full_name,
      },
      customizations: {
        title: process.env.NEXT_PUBLIC_APP_NAME || 'F9',
        description: order.title,
        logo: `${process.env.NEXT_PUBLIC_APP_URL}/logo.png`,
      },
    };

    const flutterwaveResponse =
      await FlutterwaveServerService.initializePayment(paymentData);

    await supabase.from('transactions').insert({
      order_id: order.id,
      transaction_ref: txRef,
      amount: order.amount,
      transaction_type: 'payment',
      status: 'pending',
    });

    logger.info('Payment initiated successfully', {
      orderId: order.id,
      userId: user.id,
      txRef,
      amount: order.amount,
    });

    return NextResponse.json({
      success: true,
      data: {
        payment_link: flutterwaveResponse.data.link,
        tx_ref: txRef,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Payment validation failed', { errors: error.issues });
      return NextResponse.json(
        { success: false, error: 'Invalid request data' },
        { status: 400 }
      );
    }

    logger.error('Payment initiation error', error as Error);
    return NextResponse.json(
      { success: false, error: 'Payment initiation failed' },
      { status: 500 }
    );
  }
}