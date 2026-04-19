// src/app/f9-control/finance/page.tsx

import { createClient }             from '@/lib/supabase/server';
import { revalidatePath }           from 'next/cache';
import { MonnifyServerService }     from '@/lib/monnify/server-service';
import { createAdminClient }        from '@/lib/supabase/admin';
import FinanceClient                from './FinanceClient';

// ─── Server Actions ───────────────────────────────────────────────────────────

/**
 * Approve a pending withdrawal.
 *
 * Flow:
 *   1. Set withdrawal status → 'approved'
 *   2. POST to /api/admin/withdrawals/execute to trigger the Monnify transfer
 *   3. Log the admin action
 *
 * The execute route is responsible for idempotency, role-checking the *route*
 * layer, and all Monnify interaction. approveWithdrawal's only job here is to
 * advance the status and hand off to the execute route.
 */
async function approveWithdrawal(fd: FormData) {
  'use server';
  const withdrawalId = fd.get('withdrawal_id') as string;
  const supabase = await createClient();
  const { data: { user: admin } } = await supabase.auth.getUser();
  if (!admin) throw new Error('Unauthenticated');

  // Step 1 — advance status so the execute route sees 'approved'
  const { error: updateErr } = await supabase
    .from('withdrawals')
    .update({ status: 'approved', processed_at: new Date().toISOString() })
    .eq('id', withdrawalId);

  if (updateErr) {
    throw new Error(`Failed to approve withdrawal: ${updateErr.message}`);
  }

  // Step 2 — call the execute route to trigger the actual Monnify transfer.
  // We pass the admin session cookie so the route can authenticate the caller.
  // The execute route handles idempotency: if called twice it returns early.
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  const executeRes = await fetch(`${baseUrl}/api/admin/withdrawals/execute`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ withdrawal_id: withdrawalId }),
    // Forward cookies so the route can verify the admin session
    credentials: 'include',
  });

  const executeJson = await executeRes.json().catch(() => ({}));

  if (!executeRes.ok && !executeJson?.idempotent) {
    // Transfer failed or route error — log and surface; withdrawal is already
    // 'approved' in DB but execute route will have set it to 'failed' if
    // Monnify rejected. Admin can retry from the failed state.
    console.error('[approveWithdrawal] execute route error:', executeJson);
  }

  // Step 3 — log admin action regardless of transfer outcome
  await supabase.from('admin_action_logs').insert({
    admin_id:    admin.id,
    action_type: 'approve_withdrawal',
    reason:      `Withdrawal ${withdrawalId} approved — transfer ${executeJson?.transfer_ref ?? 'attempted'}`,
  });

  revalidatePath('/f9-control/finance');
}

/** Place a 24-hour hold on a withdrawal. */
async function holdWithdrawal(fd: FormData) {
  'use server';
  const withdrawalId = fd.get('withdrawal_id') as string;
  const supabase = await createClient();
  const { data: { user: admin } } = await supabase.auth.getUser();
  if (!admin) throw new Error('Unauthenticated');

  await supabase
    .from('withdrawals')
    .update({
      status:         'held',
      failure_reason: 'Manual 24-hour hold applied by admin.',
    })
    .eq('id', withdrawalId);

  await supabase.from('admin_action_logs').insert({
    admin_id:    admin.id,
    action_type: 'hold_withdrawal',
    reason:      `Withdrawal ${withdrawalId} placed on 24h hold`,
  });

  revalidatePath('/f9-control/finance');
}

/**
 * Manually release an escrow entry.
 * Calls the existing `release_escrow_to_wallet` RPC which requires
 * p_freelancer_id — resolved by joining the escrow's order_id to orders.freelancer_id.
 */
async function releaseEscrow(fd: FormData) {
  'use server';
  const escrowId = fd.get('escrow_id') as string;
  const supabase = await createClient();
  const { data: { user: admin } } = await supabase.auth.getUser();
  if (!admin) throw new Error('Unauthenticated');

  const { data: escrow } = await supabase
    .from('escrow')
    .select('id, amount, order_id')
    .eq('id', escrowId)
    .single();

  if (!escrow || !escrow.order_id) {
    await supabase
      .from('escrow')
      .update({ status: 'released', released_at: new Date().toISOString() })
      .eq('id', escrowId);
  } else {
    const { data: order } = await supabase
      .from('orders')
      .select('freelancer_id')
      .eq('id', escrow.order_id)
      .single();

    if (order?.freelancer_id) {
      await supabase.rpc('release_escrow_to_wallet', {
        p_order_id:      escrow.order_id,
        p_freelancer_id: order.freelancer_id,
        p_amount:        escrow.amount,
      });
    } else {
      await supabase
        .from('escrow')
        .update({ status: 'released', released_at: new Date().toISOString() })
        .eq('id', escrowId);
    }
  }

  await supabase.from('admin_action_logs').insert({
    admin_id:    admin.id,
    action_type: 'release_escrow',
    reason:      `Escrow ${escrowId} manually released`,
  });

  revalidatePath('/f9-control/finance');
}

/** Freeze an escrow entry — sets status back to 'held'. */
async function freezeEscrow(fd: FormData) {
  'use server';
  const escrowId = fd.get('escrow_id') as string;
  const supabase = await createClient();
  const { data: { user: admin } } = await supabase.auth.getUser();
  if (!admin) throw new Error('Unauthenticated');

  await supabase
    .from('escrow')
    .update({ status: 'held' })
    .eq('id', escrowId);

  await supabase.from('admin_action_logs').insert({
    admin_id:    admin.id,
    action_type: 'freeze_escrow',
    reason:      `Escrow ${escrowId} manually frozen`,
  });

  revalidatePath('/f9-control/finance');
}

/**
 * Cancel/refund an escrow entry to the client.
 * Requires a non-empty `reason` from FormData.
 */
async function cancelEscrow(fd: FormData) {
  'use server';
  const escrowId = fd.get('escrow_id') as string;
  const reason   = (fd.get('reason') as string | null)?.trim();

  if (!reason) throw new Error('A reason is required to cancel an escrow entry.');

  const supabase = await createClient();
  const { data: { user: admin } } = await supabase.auth.getUser();
  if (!admin) throw new Error('Unauthenticated');

  const { error } = await supabase
    .from('escrow')
    .update({ status: 'refunded_to_client' })
    .eq('id', escrowId);

  if (error) throw new Error(`Escrow cancel failed: ${error.message}`);

  await supabase.from('admin_action_logs').insert({
    admin_id:    admin.id,
    action_type: 'cancel_escrow',
    reason:      `[${reason}] Escrow ${escrowId} cancelled and refunded to client`,
  });

  revalidatePath('/f9-control/finance');
}

/**
 * Update a transaction's status manually, with full internal ledger reversal.
 *
 * Requires a non-empty `reason` from FormData.
 *
 * When `new_status` is 'refunded', three reversal paths are attempted in order
 * of applicability — exactly one will execute per transaction type:
 *
 *   PATH A — Gateway payment (monnify_payment_ref present):
 *     Calls MonnifyServerService.refundTransaction to reverse the charge at
 *     the gateway level. No internal wallet mutation needed.
 *
 *   PATH B — Internal wallet_credit (recipient credited from platform funds):
 *     Reversal: decrement wallets.balance by amount for recipient_user_id.
 *     Uses createAdminClient() — wallets have no admin-session RLS write path.
 *     Guard: balance is floored at 0.
 *
 *   PATH C — Internal wallet_debit (recipient was debited by platform):
 *     Reversal: increment wallets.balance by amount for recipient_user_id.
 *
 *   PATH D — All other types (escrow_payment, platform_fee, etc.):
 *     Status is marked 'refunded' for audit trail; manual balance correction
 *     via escrow release controls if required.
 */
async function updateTransactionStatus(fd: FormData) {
  'use server';
  const txId      = fd.get('transaction_id') as string;
  const newStatus = fd.get('new_status')      as string;
  const reason    = (fd.get('reason') as string | null)?.trim();

  if (!reason) throw new Error('A reason is required for transaction status overrides.');

  const supabase = await createClient();
  const { data: { user: admin } } = await supabase.auth.getUser();
  if (!admin) throw new Error('Unauthenticated');

  if (newStatus === 'refunded') {
    const { data: tx, error: txFetchError } = await supabase
      .from('transactions')
      .select('transaction_type, recipient_user_id, amount, monnify_payment_ref')
      .eq('id', txId)
      .single();

    if (txFetchError || !tx) {
      throw new Error(`Failed to fetch transaction: ${txFetchError?.message ?? 'not found'}`);
    }

    // ── PATH A: Gateway payment reversal via Monnify ──────────────────────
    if (tx.monnify_payment_ref) {
      await MonnifyServerService.refundTransaction(tx.monnify_payment_ref, tx.amount);

    // ── PATH B: Internal wallet_credit reversal ───────────────────────────
    } else if (tx.transaction_type === 'wallet_credit' && tx.recipient_user_id) {
      const adminClient = createAdminClient();

      const { data: wallet, error: walletFetchErr } = await adminClient
        .from('wallets')
        .select('balance')
        .eq('user_id', tx.recipient_user_id)
        .single();

      if (walletFetchErr || !wallet) {
        throw new Error(
          `Wallet reversal failed — could not fetch wallet for user ${tx.recipient_user_id}: ` +
          (walletFetchErr?.message ?? 'wallet not found'),
        );
      }

      const newBalance = Math.max(0, (wallet.balance ?? 0) - tx.amount);

      const { error: debitErr } = await adminClient
        .from('wallets')
        .update({ balance: newBalance })
        .eq('user_id', tx.recipient_user_id);

      if (debitErr) throw new Error(`Wallet debit reversal failed: ${debitErr.message}`);

    // ── PATH C: Internal wallet_debit reversal ────────────────────────────
    } else if (tx.transaction_type === 'wallet_debit' && tx.recipient_user_id) {
      const adminClient = createAdminClient();

      const { data: wallet, error: walletFetchErr } = await adminClient
        .from('wallets')
        .select('balance')
        .eq('user_id', tx.recipient_user_id)
        .single();

      if (walletFetchErr || !wallet) {
        throw new Error(
          `Wallet reversal failed — could not fetch wallet for user ${tx.recipient_user_id}: ` +
          (walletFetchErr?.message ?? 'wallet not found'),
        );
      }

      const newBalance = (wallet.balance ?? 0) + tx.amount;

      const { error: creditErr } = await adminClient
        .from('wallets')
        .update({ balance: newBalance })
        .eq('user_id', tx.recipient_user_id);

      if (creditErr) throw new Error(`Wallet credit reversal failed: ${creditErr.message}`);

    // ── PATH D: Non-automatable types ─────────────────────────────────────
    } else {
      // Status is advanced to 'refunded' below for audit trail.
      // Manual balance correction via escrow release controls if needed.
    }
  }

  const { error: updateError } = await supabase
    .from('transactions')
    .update({ status: newStatus })
    .eq('id', txId);

  if (updateError) throw new Error(`Status update failed: ${updateError.message}`);

  await supabase.from('admin_action_logs').insert({
    admin_id:    admin.id,
    action_type: 'update_transaction_status',
    reason:      `[${reason}] Transaction ${txId} status set to '${newStatus}'`,
  });

  revalidatePath('/f9-control/finance');
}

/** Toggle the platform-wide withdrawal gate via platform_config. */
async function toggleWithdrawalGate(fd: FormData) {
  'use server';
  const enabled  = fd.get('enabled') === 'true';
  const supabase = await createClient();
  const { data: { user: admin } } = await supabase.auth.getUser();
  if (!admin) throw new Error('Unauthenticated');

  await supabase
    .from('platform_config')
    .upsert(
      {
        key:          'withdrawals_paused',
        enabled:      !enabled,
        description:  'When ON, all withdrawal processing is paused platform-wide.',
        value:        null,
        string_value: null,
      },
      { onConflict: 'key' },
    );

  await supabase.from('admin_action_logs').insert({
    admin_id:    admin.id,
    action_type: 'toggle_withdrawal_gate',
    reason:      `Withdrawals ${enabled ? 'resumed' : 'paused'} by admin`,
  });

  revalidatePath('/f9-control/finance');
}

/**
 * Set the withdrawal gate threshold.
 * Withdrawals above this amount are automatically held for manual admin review.
 * A threshold of 0 disables the gate.
 */
async function setWithdrawalGateThreshold(fd: FormData) {
  'use server';
  const raw       = fd.get('threshold') as string;
  const threshold = parseFloat(raw);

  if (isNaN(threshold) || threshold < 0) {
    throw new Error('Threshold must be a non-negative number.');
  }

  const supabase = await createClient();
  const { data: { user: admin } } = await supabase.auth.getUser();
  if (!admin) throw new Error('Unauthenticated');

  const { error } = await supabase
    .from('platform_config')
    .upsert(
      {
        key:          'withdrawal_gate_threshold',
        value:        threshold,
        enabled:      threshold > 0,
        description:  'Withdrawals above this ₦ amount are held for manual admin review. 0 = disabled.',
        string_value: null,
      },
      { onConflict: 'key' },
    );

  if (error) throw new Error(`Failed to save threshold: ${error.message}`);

  await supabase.from('admin_action_logs').insert({
    admin_id:    admin.id,
    action_type: 'set_withdrawal_gate_threshold',
    reason:      threshold > 0
      ? `Withdrawal gate threshold set to ₦${threshold.toLocaleString('en-NG')}`
      : 'Withdrawal gate threshold disabled (set to 0)',
  });

  revalidatePath('/f9-control/finance');
}

// ─── Page Props ───────────────────────────────────────────────────────────────

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminFinancePage({ searchParams }: PageProps) {
  const supabase = await createClient();

  const sp = await searchParams;

  function sp_str(key: string): string {
    const v = sp[key];
    return typeof v === 'string' ? v.trim() : '';
  }

  const filter = {
    q:          sp_str('q'),
    type:       sp_str('type'),
    status:     sp_str('status'),
    date_from:  sp_str('date_from'),
    date_to:    sp_str('date_to'),
    amount_min: sp_str('amount_min'),
    amount_max: sp_str('amount_max'),
  };

  // ── Pending withdrawals ──────────────────────────────────────────────────

  type WithdrawalWithUser = {
    id: string; amount: number; bank_name: string; account_number: string;
    account_name: string; status: string | null; failure_reason: string | null;
    created_at: string | null;
    user_id: { full_name: string | null; trust_score: number | null } | null;
  };

  const { data: withdrawals } = await supabase
    .from('withdrawals')
    .select('id, amount, bank_name, account_number, account_name, status, failure_reason, created_at, user_id(full_name, trust_score)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(50) as { data: WithdrawalWithUser[] | null };

  // ── Filtered transaction ledger ──────────────────────────────────────────

  type TransactionWithUser = {
    id: string;
    transaction_ref: string;
    transaction_type: string;
    amount: number;
    currency: string | null;
    status: string | null;
    order_id: string | null;
    created_at: string | null;
    paid_at: string | null;
    recipient_user_id: { full_name: string | null; email: string | null } | null;
  };

  let userSearchEmpty = false;
  let matchedProfileIds: string[] = [];

  if (filter.q) {
    const { data: profiles, error: profileErr } = await supabase
      .from('profiles')
      .select('id')
      .or(`full_name.ilike.%${filter.q}%,email.ilike.%${filter.q}%`)
      .limit(100);

    if (profileErr) console.error('[finance] profile search error:', profileErr);

    matchedProfileIds = (profiles ?? []).map((p) => p.id);
    if (matchedProfileIds.length === 0) userSearchEmpty = true;
  }

  let transactions: TransactionWithUser[] = [];

  if (!userSearchEmpty) {
    let txQuery = supabase
      .from('transactions')
      .select(
        'id, transaction_ref, transaction_type, amount, currency, status, order_id, created_at, paid_at, recipient_user_id(full_name, email)'
      )
      .order('created_at', { ascending: false })
      .limit(200);

    if (matchedProfileIds.length > 0) {
      txQuery = txQuery.in('recipient_user_id', matchedProfileIds);
    }
    if (filter.type)       txQuery = txQuery.eq('transaction_type', filter.type);
    if (filter.status)     txQuery = txQuery.eq('status', filter.status);
    if (filter.date_from)  txQuery = txQuery.gte('created_at', `${filter.date_from}T00:00:00.000Z`);
    if (filter.date_to)    txQuery = txQuery.lte('created_at', `${filter.date_to}T23:59:59.999Z`);
    if (filter.amount_min && !isNaN(Number(filter.amount_min))) {
      txQuery = txQuery.gte('amount', Number(filter.amount_min));
    }
    if (filter.amount_max && !isNaN(Number(filter.amount_max))) {
      txQuery = txQuery.lte('amount', Number(filter.amount_max));
    }

    const { data: txData, error: txErr } = await txQuery as {
      data: TransactionWithUser[] | null;
      error: unknown;
    };

    if (txErr) console.error('[finance] transactions query error:', txErr);
    transactions = txData ?? [];
  }

  const knownTypes = Array.from(
    new Set([
      ...transactions.map((t) => t.transaction_type),
      'escrow_payment', 'withdrawal', 'platform_fee', 'refund', 'wallet_credit', 'wallet_debit',
    ])
  ).filter(Boolean).sort();

  // ── Active escrow entries ────────────────────────────────────────────────

  const { data: escrowEntries } = await supabase
    .from('escrow')
    .select('id, amount, status, order_id, marketplace_order_id, created_at, released_at')
    .in('status', ['funded', 'held'])
    .order('created_at', { ascending: false })
    .limit(100);

  const { data: escrowTotal } = await supabase.rpc('get_escrow_total');

  // ── Withdrawal gate state ────────────────────────────────────────────────

  const { data: withdrawalGateConfig } = await supabase
    .from('platform_config')
    .select('enabled')
    .eq('key', 'withdrawals_paused')
    .single();

  const withdrawalsPaused = withdrawalGateConfig?.enabled ?? false;

  const { data: withdrawalThresholdConfig } = await supabase
    .from('platform_config')
    .select('value')
    .eq('key', 'withdrawal_gate_threshold')
    .single();

  const withdrawalGateThreshold = Number(withdrawalThresholdConfig?.value ?? 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Financial Controls</h1>
        <div className="bg-blue-50 text-blue-800 px-4 py-2 rounded-lg font-bold text-sm">
          Total in Escrow: ₦{(escrowTotal ?? 0).toLocaleString()}
        </div>
      </div>

      <FinanceClient
        withdrawals={withdrawals ?? []}
        transactions={transactions}
        escrowEntries={escrowEntries ?? []}
        withdrawalsPaused={withdrawalsPaused}
        withdrawalGateThreshold={withdrawalGateThreshold}
        transactionTypes={knownTypes}
        onApproveWithdrawal={approveWithdrawal}
        onHoldWithdrawal={holdWithdrawal}
        onReleaseEscrow={releaseEscrow}
        onFreezeEscrow={freezeEscrow}
        onCancelEscrow={cancelEscrow}
        onUpdateTransactionStatus={updateTransactionStatus}
        onToggleWithdrawalGate={toggleWithdrawalGate}
        onSetWithdrawalGateThreshold={setWithdrawalGateThreshold}
      />
    </div>
  );
}