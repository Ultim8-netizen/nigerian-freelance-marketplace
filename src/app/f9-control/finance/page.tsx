import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { FlutterwaveServerService } from '@/lib/flutterwave/server-service';
import FinanceClient from "./FinanceClient";

// ─── Server Actions ───────────────────────────────────────────────────────────

/** Approve a pending withdrawal — sets status to 'approved'. */
async function approveWithdrawal(fd: FormData) {
  'use server';
  const withdrawalId = fd.get('withdrawal_id') as string;
  const supabase = await createClient();
  const { data: { user: admin } } = await supabase.auth.getUser();
  if (!admin) throw new Error('Unauthenticated');

  await supabase
    .from('withdrawals')
    .update({ status: 'approved', processed_at: new Date().toISOString() })
    .eq('id', withdrawalId);

  await supabase.from('admin_action_logs').insert({
    admin_id:    admin.id,
    action_type: 'approve_withdrawal',
    reason:      `Withdrawal ${withdrawalId} approved`,
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
 * Requires a non-empty `reason` from FormData — collected by the inline
 * EscrowCancelWithReason component before the FormData is submitted.
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
 * Update a transaction's status manually.
 *
 * Requires a non-empty `reason` from FormData — collected by the inline reason
 * input in TransactionStatusSelect before the FormData is submitted.
 *
 * When `new_status` is 'refunded':
 *   1. Fetch the transaction row to obtain flutterwave_tx_ref.
 *   2. Call FlutterwaveServerService.refundTransaction.
 *   3. Only update the DB row after the gateway call resolves, so a failed
 *      gateway call leaves the transaction status unchanged.
 *
 * TODO [MONNIFY MIGRATION]: Replace FlutterwaveServerService.refundTransaction
 *   with the equivalent Monnify call once the gateway switch is complete.
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
      .select('flutterwave_tx_ref')
      .eq('id', txId)
      .single();

    if (txFetchError) throw new Error(`Failed to fetch transaction: ${txFetchError.message}`);

    if (tx?.flutterwave_tx_ref) {
      // TODO [MONNIFY MIGRATION]: Replace this call.
      await FlutterwaveServerService.refundTransaction(tx.flutterwave_tx_ref, reason);
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
 * Withdrawals above this amount are automatically held for manual admin review
 * in the freelancer earnings flow. A threshold of 0 disables the gate.
 *
 * Stored in platform_config as key='withdrawal_gate_threshold', value=<number>.
 * The admin user's session satisfies the admin-only RLS on platform_config, so
 * createClient() is sufficient here (no need for createAdminClient).
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

// Next.js 15: searchParams is a Promise and must be awaited before access.
interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

// ─── Data fetches ─────────────────────────────────────────────────────────────

export default async function AdminFinancePage({ searchParams }: PageProps) {
  const supabase = await createClient();

  // Resolve filter values from URL search params
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

  // ── Pending withdrawals with user profile join ───────────────────────────

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

  // The transactions table links to the user via recipient_user_id → profiles.
  // Filtering by user name/email requires a two-step approach: first resolve
  // matching profile IDs, then filter transactions by those IDs.
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

  // Track whether user search produced zero matches — short-circuits the main query.
  let userSearchEmpty = false;
  let matchedProfileIds: string[] = [];

  if (filter.q) {
    const { data: profiles, error: profileErr } = await supabase
      .from('profiles')
      .select('id')
      .or(`full_name.ilike.%${filter.q}%,email.ilike.%${filter.q}%`)
      .limit(100);

    if (profileErr) {
      console.error('[finance] profile search error:', profileErr);
    }

    matchedProfileIds = (profiles ?? []).map((p) => p.id);
    if (matchedProfileIds.length === 0) {
      userSearchEmpty = true;
    }
  }

  let transactions: TransactionWithUser[] = [];

  if (!userSearchEmpty) {
    // Build the query dynamically; all filters are additive (AND semantics).
    let txQuery = supabase
      .from('transactions')
      .select(
        'id, transaction_ref, transaction_type, amount, currency, status, order_id, created_at, paid_at, recipient_user_id(full_name, email)'
      )
      .order('created_at', { ascending: false })
      .limit(200);

    // User filter — restrict to resolved profile IDs
    if (matchedProfileIds.length > 0) {
      txQuery = txQuery.in('recipient_user_id', matchedProfileIds);
    }

    if (filter.type) {
      txQuery = txQuery.eq('transaction_type', filter.type);
    }

    if (filter.status) {
      txQuery = txQuery.eq('status', filter.status);
    }

    // Date range: date_from is inclusive start of day; date_to is inclusive end of day.
    if (filter.date_from) {
      txQuery = txQuery.gte('created_at', `${filter.date_from}T00:00:00.000Z`);
    }
    if (filter.date_to) {
      txQuery = txQuery.lte('created_at', `${filter.date_to}T23:59:59.999Z`);
    }

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

  // Derive the distinct transaction_type values from the current result set
  // (plus any hardcoded platform types) for the filter datalist in the UI.
  const knownTypes = Array.from(
    new Set([
      ...transactions.map((t) => t.transaction_type),
      // Include canonical platform types so the datalist is useful even on an empty filtered view
      'escrow_payment',
      'withdrawal',
      'platform_fee',
      'refund',
      'wallet_credit',
      'wallet_debit',
    ])
  ).filter(Boolean).sort();

  // ── Active escrow entries (funded + held) ────────────────────────────────

  const { data: escrowEntries } = await supabase
    .from('escrow')
    .select('id, amount, status, order_id, marketplace_order_id, created_at, released_at')
    .in('status', ['funded', 'held'])
    .order('created_at', { ascending: false })
    .limit(100);

  // ── Escrow total via RPC ─────────────────────────────────────────────────

  const { data: escrowTotal } = await supabase.rpc('get_escrow_total');

  // ── Withdrawal gate state ────────────────────────────────────────────────

  const { data: withdrawalGateConfig } = await supabase
    .from('platform_config')
    .select('enabled')
    .eq('key', 'withdrawals_paused')
    .single();

  const withdrawalsPaused = withdrawalGateConfig?.enabled ?? false;

  // ── Withdrawal gate threshold ────────────────────────────────────────────

  const { data: withdrawalThresholdConfig } = await supabase
    .from('platform_config')
    .select('value')
    .eq('key', 'withdrawal_gate_threshold')
    .single();

  // value=0 when row is absent or threshold is disabled
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