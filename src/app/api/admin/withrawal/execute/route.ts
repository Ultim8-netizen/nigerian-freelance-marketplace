// src/app/api/admin/withdrawals/execute/route.ts
// Executes the actual Monnify bank transfer for an approved withdrawal.
//
// Called by approveWithdrawal() in finance/page.tsx after the withdrawal row
// has been set to status='approved'. This separation keeps the Server Action
// lean and puts the transfer logic in a proper API route with auth guards.
//
// IDEMPOTENCY: If this route is called twice with the same withdrawal_id, the
// second call detects status='processing' and returns early without re-calling
// Monnify, preventing duplicate disbursements.
//
// WALLET DEDUCTION: Deliberately absent. The existing
// sync_wallet_on_withdrawal_complete DB trigger fires when status →
// 'completed' (set by the Monnify webhook handler). This route never touches
// wallet.balance directly.

import { NextRequest, NextResponse } from 'next/server';
import { createClient }      from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { MonnifyServerService } from '@/lib/monnify/server-service';
// REQUIRED ENV VAR: MONNIFY_SOURCE_ACCOUNT_NUMBER
// This is the Monnify settlement/disbursement wallet account number for F9.
// Add it to your .env.local and Vercel environment variables.

// ── Nigerian bank code map ────────────────────────────────────────────────────
// Must cover every bank in the earnings page dropdown exactly.
// Missing bank = failed transfer at Monnify.

const BANK_CODES: Record<string, string> = {
  'Access Bank':  '044',
  'GTBank':       '058',
  'First Bank':   '011',
  'UBA':          '033',
  'Zenith Bank':  '057',
  'Fidelity Bank': '070',
  'FCMB':         '214',
  'Polaris Bank': '076',
  'Sterling Bank': '232',
  'Wema Bank':    '035',
  'Opay':         '305',
  'Kuda Bank':    '090267',
  'PalmPay':      '100033',
  'Moniepoint':   '50515',
};

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
    // Use the session client to identify the admin user, then check
    // staff_roles with the admin client (bypasses RLS on that table).
    const supabase    = await createClient();
    const adminClient = createAdminClient();

    const { data: { user: admin } } = await supabase.auth.getUser();
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthenticated' },
        { status: 401 }
      );
    }

    const { data: staffRole } = await adminClient
      .from('staff_roles')
      .select('role_type, is_active')
      .eq('user_id', admin.id)
      .single();

    const allowedRoles = ['admin', 'financial_analyst'];
    if (
      !staffRole ||
      !staffRole.is_active ||
      !allowedRoles.includes(staffRole.role_type ?? '')
    ) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: admin or financial_analyst role required' },
        { status: 403 }
      );
    }

    // ── 3. Fetch withdrawal row ─────────────────────────────────────────────
    const { data: withdrawal, error: fetchErr } = await adminClient
      .from('withdrawals')
      .select('id, amount, bank_name, account_number, account_name, status, user_id, wallet_id')
      .eq('id', withdrawalId)
      .single();

    if (fetchErr || !withdrawal) {
      return NextResponse.json(
        { success: false, error: 'Withdrawal not found' },
        { status: 404 }
      );
    }

    // ── 4. Idempotency check ────────────────────────────────────────────────
    // If already processing/completed/failed, do not call Monnify again.
    if (withdrawal.status === 'processing') {
      return NextResponse.json({
        success: true,
        idempotent: true,
        message: 'Transfer already in processing state — no duplicate call made',
      });
    }

    if (withdrawal.status === 'completed') {
      return NextResponse.json({
        success: true,
        idempotent: true,
        message: 'Withdrawal already completed',
      });
    }

    if (withdrawal.status !== 'approved') {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot execute withdrawal in status '${withdrawal.status}'. Must be 'approved'.`,
        },
        { status: 409 }
      );
    }

    // ── 5. Verify wallet is not frozen and has sufficient balance ───────────
    if (!withdrawal.wallet_id && !withdrawal.user_id) {
      return NextResponse.json(
        { success: false, error: 'Withdrawal has no associated wallet or user' },
        { status: 400 }
      );
    }

    const walletQuery = withdrawal.wallet_id
      ? adminClient.from('wallets').select('id, balance, is_frozen').eq('id', withdrawal.wallet_id).single()
      : adminClient.from('wallets').select('id, balance, is_frozen').eq('user_id', withdrawal.user_id!).single();

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

    if ((wallet.balance ?? 0) < withdrawal.amount) {
      await adminClient
        .from('withdrawals')
        .update({
          status:         'failed',
          failure_reason: `Insufficient wallet balance: ₦${wallet.balance} < ₦${withdrawal.amount}`,
        })
        .eq('id', withdrawalId);

      return NextResponse.json(
        { success: false, error: 'Insufficient wallet balance' },
        { status: 409 }
      );
    }

    // ── 6. Resolve bank code ────────────────────────────────────────────────
    const bankCode = BANK_CODES[withdrawal.bank_name];
    if (!bankCode) {
      const reason = `Unsupported bank: '${withdrawal.bank_name}' has no mapped Monnify code`;
      await adminClient
        .from('withdrawals')
        .update({ status: 'failed', failure_reason: reason })
        .eq('id', withdrawalId);

      return NextResponse.json({ success: false, error: reason }, { status: 422 });
    }

    // ── 7. Generate unique transfer reference ───────────────────────────────
    // Format: PAYOUT-{withdrawalId}-{timestamp}
    // Both components are needed: withdrawalId for traceability,
    // timestamp to guarantee uniqueness if Monnify rejects duplicates.
    const transferRef = `PAYOUT-${withdrawalId}-${Date.now()}`;

    // ── 8. Call Monnify ─────────────────────────────────────────────────────
    let monnifyResult: Awaited<ReturnType<typeof MonnifyServerService.initiateTransfer>>;
    let monnifyFailed = false;
    let monnifyError  = '';

    try {
      monnifyResult = await MonnifyServerService.initiateTransfer({
        amount:                   withdrawal.amount,
        reference:                transferRef,
        narration:                'F9 Earnings Withdrawal',
        destinationBankCode:      bankCode,
        destinationAccountNumber: withdrawal.account_number,
        currency:                 'NGN',
        sourceAccountNumber:      process.env.MONNIFY_SOURCE_ACCOUNT_NUMBER ?? '',
      });
    } catch (err) {
      monnifyFailed = true;
      monnifyError  = err instanceof Error ? err.message : String(err);
      // Construct a minimal failed result so the finally-block path is uniform
      monnifyResult = { status: 'FAILED', reference: transferRef };
    }

    // ── 9. Handle Monnify response ──────────────────────────────────────────

    if (!monnifyFailed && (monnifyResult.status === 'SUCCESS' || monnifyResult.status === 'PENDING')) {
      // Transfer accepted — mark as processing.
      // Wallet deduction is handled by the sync_wallet_on_withdrawal_complete
      // trigger when status later transitions to 'completed' via webhook.
      await adminClient
        .from('withdrawals')
        .update({
          status:               'processing',
          monnify_transfer_ref: monnifyResult.reference,
        })
        .eq('id', withdrawalId);

      // Audit log
      void adminClient.from('audit_logs').insert({
        user_id:       admin.id,
        action:        'withdrawal_transfer_initiated',
        resource_type: 'withdrawals',
        resource_id:   withdrawalId,
        metadata: {
          monnify_ref: monnifyResult.reference,
          amount:      withdrawal.amount,
          bank:        withdrawal.bank_name,
        },
      });

      // Notify freelancer — fire-and-forget
      void adminClient.from('notifications').insert({
        user_id: withdrawal.user_id,
        type:    'withdrawal_processing',
        title:   'Withdrawal Processing',
        message: `Your withdrawal of ₦${withdrawal.amount.toLocaleString('en-NG')} is being processed. Funds typically arrive within 1–3 business days.`,
        link:    '/freelancer/earnings',
      });

      return NextResponse.json({
        success:     true,
        status:      monnifyResult.status,
        transfer_ref: monnifyResult.reference,
      });
    }

    // Transfer failed — mark withdrawal as failed.
    // Wallet balance is NOT touched (trigger only fires on 'completed').
    const failureReason = monnifyFailed
      ? `Monnify transfer error: ${monnifyError}`
      : `Monnify returned status: ${monnifyResult.status}`;

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
      metadata: { reason: failureReason, amount: withdrawal.amount },
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