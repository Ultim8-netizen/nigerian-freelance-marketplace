// src/app/api/admin/withdrawals/execute/route.ts
//
// FIX (path): this file was previously at
// src/app/api/admin/withrawal/execute/route.ts (typo — "withrawal", missing
// the "d"). finance/page.tsx's approveWithdrawal() fetches
// `${baseUrl}/api/admin/withdrawals/execute` (correctly spelled), so every
// admin approval call was 404ing against the old path. DELETE
// src/app/api/admin/withrawal/ once this file is in place.
//
// Executes the actual Flutterwave bank transfer for an approved withdrawal.
//
// Called by approveWithdrawal() in finance/page.tsx after the withdrawal row
// has been set to status='approved'. This separation keeps the Server Action
// lean and puts the transfer logic in a proper API route with auth guards.
//
// IDEMPOTENCY: If this route is called twice with the same withdrawal_id, the
// second call detects status='processing'/'completed' and returns early
// without re-calling Flutterwave, preventing duplicate disbursements.
//
// WALLET DEDUCTION: Deliberately absent here. The existing
// sync_wallet_on_withdrawal DB trigger fires when status → 'completed' (set
// by the Flutterwave transfer.completed webhook handler). This route never
// touches wallet.balance directly.
//
// IN-FLIGHT GUARD: Before calling Flutterwave we sum every other withdrawal
// for this user that is currently in 'approved' or 'processing' state and verify:
//   wallet.balance >= this_withdrawal.amount + in_flight_sum
// This prevents a second concurrent withdrawal from being approved against
// the same undeducted balance, closing the window between 'processing' and
// 'completed' (when the trigger fires).
//
// FIX (race with webhook): status is now flipped to 'processing' BEFORE
// calling Flutterwave, not after. For instant-settling rails
// (Opay/Kuda/PalmPay/Moniepoint can complete in milliseconds), the
// transfer.completed webhook could previously arrive before the
// post-call 'processing' write landed, finding the row still 'approved' and
// silently failing to advance it (see the matching fix in
// webhooks/flutterwave/route.ts, which also widened its own guard). Writing
// 'processing' first — atomically, guarded by .eq('status','approved') so a
// concurrent double-click can't fire two transfers — closes most of the
// remaining window.
//
// FIX: flutterwave_transfer_id is now a real column (added via migration —
// see the SQL provided alongside this fix). Until `database.types.ts` is
// regenerated, the field is written via a narrowly-scoped cast (see below),
// matching the pattern already used elsewhere in this codebase for
// not-yet-generated columns/RPCs.

import { NextRequest, NextResponse } from 'next/server';
import { createClient }      from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { FlutterwaveServerService } from '@/lib/flutterwave/server-service';
import { requireStaffRole, UnauthorizedError } from '@/lib/auth/require-staff-role';
import { resolveBankCode } from '@/lib/flutterwave/bank-list';

// ── Bank code resolution ──────────────────────────────────────────────────────
// FIX: the hardcoded BANK_CODES map (14 entries) was both incomplete —
// Nigeria's actual NIP-enabled institution list (commercial banks,
// microfinance banks, payment service banks, fintechs) runs into the
// hundreds — and prone to silent drift even within those 14: two entries
// (Opay, Moniepoint) were already confirmed wrong against Flutterwave's
// live list via scripts/verify-bank-codes.ts. Replaced entirely with
// resolveBankCode() (src/lib/flutterwave/bank-list.ts), which resolves
// against Flutterwave's actual live bank list rather than a finite,
// hand-maintained snapshot. See that file for the full rationale.

// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // ── 1. Parse body ───────────────────────────────────────────────────────
    const body = await request.json().catch(() => ({}));
    const withdrawalId = typeof body?.withdrawal_id === 'string'
      ? body.withdrawal_id.trim()
      : null;

    if (!withdrawalId) {
      return NextResponse.json(
        { success: false, error: 'withdrawal_id is required' },
        { status: 400 }
      );
    }

    // ── 2. Verify caller has admin / financial_analyst role ─────────────────
    // FIX: now uses the shared requireStaffRole() helper (see
    // src/lib/auth/require-staff-role.ts) instead of an inline duplicate of
    // this exact check — the same logic previously existed only here, while
    // finance/page.tsx and flags/page.tsx had no equivalent at all. Centralizing
    // it means a future change to the role-check rule only needs to happen
    // once. UnauthorizedError is caught specifically (rather than falling
    // through to the generic catch block at the bottom of this file) so the
    // existing 403 JSON contract for this route is preserved exactly as it
    // was — only its implementation moved.
    const supabase    = await createClient();
    const adminClient = createAdminClient();

    const { data: { user: admin } } = await supabase.auth.getUser();
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthenticated' },
        { status: 401 }
      );
    }

    try {
      await requireStaffRole(adminClient, admin.id, ['admin', 'financial_analyst']);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: admin or financial_analyst role required' },
          { status: 403 }
        );
      }
      throw err;
    }

    // ── 3. Fetch withdrawal row ─────────────────────────────────────────────
    // Cast to add bank_code until database.types.ts is regenerated — same
    // scoped-cast convention used elsewhere in this codebase for
    // not-yet-generated columns (e.g. process_referral_reward in
    // cron/automation/route.ts).
    const { data: withdrawal, error: fetchErr } = await adminClient
      .from('withdrawals')
      .select('id, amount, bank_name, bank_code, account_number, account_name, status, user_id, wallet_id')
      .eq('id', withdrawalId)
      .single() as {
        data: {
          id: string;
          amount: number;
          bank_name: string;
          bank_code: string | null;
          account_number: string;
          account_name: string;
          status: string | null;
          user_id: string | null;
          wallet_id: string | null;
        } | null;
        error: unknown;
      };

    if (fetchErr || !withdrawal) {
      return NextResponse.json(
        { success: false, error: 'Withdrawal not found' },
        { status: 404 }
      );
    }

    // ── 4. Idempotency check ────────────────────────────────────────────────
    if (withdrawal.status === 'processing') {
      return NextResponse.json({
        success:    true,
        idempotent: true,
        message:    'Transfer already in processing state — no duplicate call made',
      });
    }

    if (withdrawal.status === 'completed') {
      return NextResponse.json({
        success:    true,
        idempotent: true,
        message:    'Withdrawal already completed',
      });
    }

    if (withdrawal.status !== 'approved') {
      return NextResponse.json(
        {
          success: false,
          error:   `Cannot execute withdrawal in status '${withdrawal.status}'. Must be 'approved'.`,
        },
        { status: 409 }
      );
    }

    // ── 5. Fetch wallet ─────────────────────────────────────────────────────
    if (!withdrawal.wallet_id && !withdrawal.user_id) {
      return NextResponse.json(
        { success: false, error: 'Withdrawal has no associated wallet or user' },
        { status: 400 }
      );
    }

    const walletQuery = withdrawal.wallet_id
      ? adminClient
          .from('wallets')
          .select('id, balance, is_frozen, user_id')
          .eq('id', withdrawal.wallet_id)
          .single()
      : adminClient
          .from('wallets')
          .select('id, balance, is_frozen, user_id')
          .eq('user_id', withdrawal.user_id!)
          .single();

    const { data: wallet, error: walletErr } = await walletQuery;

    if (walletErr || !wallet) {
      return NextResponse.json(
        { success: false, error: 'Could not fetch wallet for this withdrawal' },
        { status: 500 }
      );
    }

    if (wallet.is_frozen) {
      await adminClient
        .from('withdrawals')
        .update({ status: 'failed', failure_reason: 'Wallet is frozen — transfer blocked' })
        .eq('id', withdrawalId);

      return NextResponse.json(
        { success: false, error: 'Wallet is frozen — transfer blocked' },
        { status: 409 }
      );
    }

    // ── 6. In-flight balance guard ──────────────────────────────────────────
    const effectiveUserId: string | null = withdrawal.user_id ?? wallet.user_id;

    if (!effectiveUserId) {
      return NextResponse.json(
        { success: false, error: 'Cannot determine user_id for in-flight guard — aborting' },
        { status: 400 }
      );
    }

    const { data: inFlightRows, error: inFlightErr } = await adminClient
      .from('withdrawals')
      .select('amount')
      .eq('user_id', effectiveUserId)
      .in('status', ['approved', 'processing'])
      .neq('id', withdrawalId);

    if (inFlightErr) {
      console.error('[execute-withdrawal] in-flight query failed:', inFlightErr.message);
      return NextResponse.json(
        { success: false, error: 'Could not verify in-flight withdrawals — aborting for safety' },
        { status: 500 }
      );
    }

    const inFlightSum = (inFlightRows ?? []).reduce(
      (acc, row) => acc + (row.amount ?? 0),
      0
    );

    const requiredBalance = withdrawal.amount + inFlightSum;

    if ((wallet.balance ?? 0) < requiredBalance) {
      const reason = inFlightSum > 0
        ? `Insufficient balance accounting for in-flight withdrawals: ` +
          `wallet ₦${wallet.balance} < this withdrawal ₦${withdrawal.amount} + ` +
          `in-flight ₦${inFlightSum} = ₦${requiredBalance}`
        : `Insufficient wallet balance: ₦${wallet.balance} < ₦${withdrawal.amount}`;

      await adminClient
        .from('withdrawals')
        .update({ status: 'failed', failure_reason: reason })
        .eq('id', withdrawalId);

      return NextResponse.json(
        { success: false, error: reason },
        { status: 409 }
      );
    }

    // ── 7. Resolve bank code ────────────────────────────────────────────────
    // FIX: previously a static BANK_CODES[withdrawal.bank_name] lookup —
    // replaced with a live resolution against Flutterwave's actual bank
    // list. withdrawal.bank_code is used directly when present (every
    // withdrawal created after the bank_code column existed); older rows
    // fall back to a name-based match against the live list inside
    // resolveBankCode() itself. See src/lib/flutterwave/bank-list.ts.
    let bankCode: string;
    try {
      bankCode = await resolveBankCode(withdrawal.bank_name, withdrawal.bank_code);
    } catch (err) {
      const reason = err instanceof Error
        ? err.message
        : `Unsupported bank: '${withdrawal.bank_name}' has no mapped Flutterwave code`;

      await adminClient
        .from('withdrawals')
        .update({ status: 'failed', failure_reason: reason })
        .eq('id', withdrawalId);

      return NextResponse.json({ success: false, error: reason }, { status: 422 });
    }

    // ── 8. Generate unique transfer reference ───────────────────────────────
    const transferRef = `PAYOUT-${withdrawalId}-${Date.now()}`;

    // ── 9. Reserve the row BEFORE calling Flutterwave ───────────────────────
    // Flip to 'processing' first, guarded by .eq('status','approved') so a
    // concurrent double-call can't both pass. This shrinks the race window
    // with the transfer.completed webhook described above. .select('id')
    // lets us detect a lost race here too — if 0 rows come back, someone
    // else already advanced this withdrawal.
    const { data: reserved, error: reserveErr } = await adminClient
      .from('withdrawals')
      .update({ status: 'processing', flutterwave_transfer_ref: transferRef })
      .eq('id', withdrawalId)
      .eq('status', 'approved')
      .select('id');

    if (reserveErr) {
      console.error('[execute-withdrawal] failed to reserve withdrawal:', reserveErr.message);
      return NextResponse.json(
        { success: false, error: 'Failed to reserve withdrawal for processing' },
        { status: 500 }
      );
    }

    if (!reserved || reserved.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Withdrawal was already advanced by a concurrent request' },
        { status: 409 }
      );
    }

    // ── 10. Call Flutterwave ─────────────────────────────────────────────────
    let flutterwaveResult: Awaited<ReturnType<typeof FlutterwaveServerService.initiateTransfer>>;
    let transferFailed = false;
    let transferError  = '';

    try {
      flutterwaveResult = await FlutterwaveServerService.initiateTransfer({
        amount:                   withdrawal.amount,
        reference:                transferRef,
        narration:                'F9 Earnings Withdrawal',
        destinationBankCode:      bankCode,
        destinationAccountNumber: withdrawal.account_number,
        destinationAccountName:   withdrawal.account_name ?? undefined,
        currency:                 'NGN',
      });
    } catch (err) {
      transferFailed      = true;
      transferError       = err instanceof Error ? err.message : String(err);
      flutterwaveResult   = { status: 'FAILED', reference: transferRef };
    }

    // ── 11. Handle Flutterwave response ─────────────────────────────────────
    const acceptedStatuses = ['NEW', 'PENDING', 'SUCCESSFUL'];

    if (!transferFailed && acceptedStatuses.includes(flutterwaveResult.status)) {
      // Already 'processing' from step 9. Only the transfer_id (known only
      // after the call resolves) needs writing now.
      //
      // flutterwave_transfer_id — Flutterwave's internal numeric transfer ID.
      // Column added via migration; cast with `as Record<string, unknown>`
      // until database.types.ts is regenerated to include it (do not hand-
      // edit that file — see project convention already used for
      // process_referral_reward in cron/automation/route.ts).
      if (flutterwaveResult.transferId) {
        await adminClient
          .from('withdrawals')
          .update({
            flutterwave_transfer_id: flutterwaveResult.transferId,
          } as Record<string, unknown>)
          .eq('id', withdrawalId);
      }

      // Audit log
      void adminClient.from('audit_logs').insert({
        user_id:       admin.id,
        action:        'withdrawal_transfer_initiated',
        resource_type: 'withdrawals',
        resource_id:   withdrawalId,
        metadata: {
          flutterwave_transfer_ref: flutterwaveResult.reference,
          flutterwave_transfer_id:  flutterwaveResult.transferId ?? null,
          amount:                   withdrawal.amount,
          bank:                     withdrawal.bank_name,
          in_flight_sum:            inFlightSum,
        },
      });

      // Notify freelancer — fire-and-forget
      void adminClient.from('notifications').insert({
        user_id: withdrawal.user_id,
        type:    'withdrawal_processing',
        title:   'Withdrawal Processing',
        message: `Your withdrawal of ₦${withdrawal.amount.toLocaleString('en-NG')} is being processed. Funds typically arrive within 1 business day.`,
        link:    '/freelancer/earnings',
      });

      return NextResponse.json({
        success:      true,
        status:       flutterwaveResult.status,
        transfer_ref: flutterwaveResult.reference,
        transfer_id:  flutterwaveResult.transferId ?? null,
      });
    }

    // Transfer failed — mark withdrawal as failed.
    // Wallet balance is NOT touched (trigger only fires on 'completed').
    // Row is currently 'processing' (set in step 9) — advance it to 'failed'.
    const failureReason = transferFailed
      ? `Flutterwave transfer error: ${transferError}`
      : `Flutterwave returned status: ${flutterwaveResult.status}`;

    await adminClient
      .from('withdrawals')
      .update({ status: 'failed', failure_reason: failureReason })
      .eq('id', withdrawalId);

    // Audit log
    void adminClient.from('audit_logs').insert({
      user_id:       admin.id,
      action:        'withdrawal_transfer_failed',
      resource_type: 'withdrawals',
      resource_id:   withdrawalId,
      metadata:      { reason: failureReason, amount: withdrawal.amount },
    });

    // Notify freelancer of failure — fire-and-forget
    void adminClient.from('notifications').insert({
      user_id: withdrawal.user_id,
      type:    'withdrawal_failed',
      title:   'Withdrawal Failed',
      message: `Your withdrawal of ₦${withdrawal.amount.toLocaleString('en-NG')} could not be processed. Please contact support or try again.`,
      link:    '/freelancer/earnings',
    });

    return NextResponse.json(
      { success: false, error: failureReason },
      { status: 502 }
    );
  } catch (err) {
    console.error('[execute-withdrawal] unexpected error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}