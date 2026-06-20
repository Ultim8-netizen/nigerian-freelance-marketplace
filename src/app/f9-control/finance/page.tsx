// src/app/f9-control/finance/page.tsx
//
// FIX (root cause — confirmed against live RLS export): every privileged
// read and write in this file previously used createClient() — the
// session-scoped client bound to the logged-in admin's own RLS context.
// Your actual policies are:
//   withdrawals      — SELECT/INSERT only where user_id = auth.uid()
//   transactions     — SELECT only for order participants
//   escrow           — SELECT only for order participants
//   platform_config  — no public SELECT at all (admin-only, service-role)
//
// Postgres RLS does not raise an error for an UPDATE/SELECT that simply
// matches zero rows because of policy filtering — it returns empty/null
// with no error. That means every read on this page returned nothing
// relevant to "all pending withdrawals" / "the full ledger" / "active
// escrow", and every write (approve, hold, release, freeze, cancel, status
// override, gate toggle, threshold) silently affected 0 rows while the UI
// reported success. The admin finance panel was non-functional end to end.
//
// Fix: use createAdminClient() (service role — bypasses RLS entirely) for
// every table interaction in this file. createClient() (session-scoped) is
// now used ONLY to resolve auth.getUser() — the admin client has no
// cookie/session context and can't tell you who's logged in, so both
// clients are still needed, just for different jobs.
//
// Also fixed: approveWithdrawal() was fetching
// /api/admin/withdrawals/execute, but the route file lived at the typo'd
// path /api/admin/withrawal/execute — every approval call 404'd. The route
// now actually exists at the correct path (see the file provided alongside
// this fix); delete the old src/app/api/admin/withrawal/ folder.
//
// Also fixed: every server action and the page load now call
// requireStaffRole(adminClient, <id>, FINANCE_ROLES) before acting. Before
// this, the only check anywhere in this file was "is someone logged in" —
// execute/route.ts (one file over) already checked staff_roles, so this
// file lacking the same check was itself an inconsistency within the same
// domain, independent of whatever RLS or middleware does or doesn't cover.

import { revalidatePath }               from 'next/cache';
import { createClient }                 from '@/lib/supabase/server';
import { createAdminClient }            from '@/lib/supabase/admin';
import { FlutterwaveServerService }     from '@/lib/flutterwave/server-service';
import { requireStaffRole }             from '@/lib/auth/require-staff-role';
import FinanceClient                    from './FinanceClient';

// Staff roles permitted to act on this page — mirrors the convention
// already established in execute/route.ts. Centralized here so every
// server action and the page load itself check the same list.
const FINANCE_ROLES = ['admin', 'financial_analyst'];

// ─── Server Actions ───────────────────────────────────────────────────────────

/**
 * Approve a pending withdrawal.
 *
 * Flow:
 *   1. Set withdrawal status → 'approved' (admin client — withdrawals has no
 *      UPDATE policy for the authenticated role at all).
 *   2. POST to /api/admin/withdrawals/execute to trigger the Flutterwave transfer.
 *   3. Log the admin action.
 */
async function approveWithdrawal(fd: FormData) {
  'use server';
  const withdrawalId = fd.get('withdrawal_id') as string;

  const supabase = await createClient();
  const { data: { user: admin } } = await supabase.auth.getUser();
  if (!admin) throw new Error('Unauthenticated');

  const adminClient = createAdminClient();
  await requireStaffRole(adminClient, admin.id, FINANCE_ROLES);

  const { data: updated, error: updateErr } = await adminClient
    .from('withdrawals')
    .update({ status: 'approved', processed_at: new Date().toISOString() })
    .eq('id', withdrawalId)
    .eq('status', 'pending') // only advance from pending — avoids re-approving
    .select('id');

  if (updateErr) {
    throw new Error(`Failed to approve withdrawal: ${updateErr.message}`);
  }
  if (!updated || updated.length === 0) {
    throw new Error('Withdrawal was not in pending status — could not approve.');
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  // FIX: corrected path (was /api/admin/withdrawals/execute pointed at a
  // route file that lived under the typo'd /api/admin/withrawal/ folder).
  const executeRes = await fetch(`${baseUrl}/api/admin/withdrawals/execute`, {
    method:      'POST',
    headers:     { 'Content-Type': 'application/json' },
    body:        JSON.stringify({ withdrawal_id: withdrawalId }),
    credentials: 'include',
  });

  const executeJson = await executeRes.json().catch(() => ({}));

  if (!executeRes.ok && !executeJson?.idempotent) {
    console.error('[approveWithdrawal] execute route error:', executeJson);
  }

  await adminClient.from('admin_action_logs').insert({
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

  const adminClient = createAdminClient();
  await requireStaffRole(adminClient, admin.id, FINANCE_ROLES);

  const { error } = await adminClient
    .from('withdrawals')
    .update({
      status:         'held',
      failure_reason: 'Manual 24-hour hold applied by admin.',
    })
    .eq('id', withdrawalId);

  if (error) throw new Error(`Failed to hold withdrawal: ${error.message}`);

  await adminClient.from('admin_action_logs').insert({
    admin_id:    admin.id,
    action_type: 'hold_withdrawal',
    reason:      `Withdrawal ${withdrawalId} placed on 24h hold`,
  });

  revalidatePath('/f9-control/finance');
}

/**
 * Manually release an escrow entry.
 *
 * release_escrow_to_wallet is now SECURITY DEFINER (fixed via migration —
 * see SQL provided alongside this fix) and atomically flips escrow.status
 * to a terminal value as part of the same call, closing the double-credit
 * path that existed when the RPC only touched the wallet.
 */
async function releaseEscrow(fd: FormData) {
  'use server';
  const escrowId = fd.get('escrow_id') as string;

  const supabase = await createClient();
  const { data: { user: admin } } = await supabase.auth.getUser();
  if (!admin) throw new Error('Unauthenticated');

  const adminClient = createAdminClient();
  await requireStaffRole(adminClient, admin.id, FINANCE_ROLES);

  const { data: escrow, error: escrowFetchErr } = await adminClient
    .from('escrow')
    .select('id, amount, order_id, status')
    .eq('id', escrowId)
    .single();

  if (escrowFetchErr || !escrow) {
    throw new Error(`Escrow entry not found: ${escrowFetchErr?.message ?? 'no row'}`);
  }

  if (!escrow.order_id) {
    // FIX: escrow_status_check only permits 'held' | 'released_to_freelancer'
    // | 'refunded_to_client' | 'disputed' — 'released' is not a valid value
    // and this UPDATE would always fail the CHECK constraint. There is no
    // marketplace-specific "released" status in this schema; using
    // 'released_to_freelancer' here as the generic "payout completed" value
    // is the only valid terminal-release state available. If marketplace
    // escrow actually needs its own distinct status, that's a schema
    // decision beyond what this fix can safely infer — flagging it rather
    // than guessing further.
    const { error } = await adminClient
      .from('escrow')
      .update({ status: 'released_to_freelancer', released_at: new Date().toISOString() })
      .eq('id', escrowId)
      .eq('status', escrow.status ?? 'held'); // guard against double-click

    if (error) throw new Error(`Escrow release failed: ${error.message}`);
  } else {
    const { data: order, error: orderFetchErr } = await adminClient
      .from('orders')
      .select('freelancer_id')
      .eq('id', escrow.order_id)
      .single();

    if (orderFetchErr || !order?.freelancer_id) {
      // FIX: same as the no-order_id branch above — 'released' is not a
      // valid escrow_status_check value. This branch is a defensive
      // fallback (orders.freelancer_id is NOT NULL in the schema, so
      // reaching here implies the order lookup itself failed) — corrected
      // to a value the constraint actually permits regardless.
      const { error } = await adminClient
        .from('escrow')
        .update({ status: 'released_to_freelancer', released_at: new Date().toISOString() })
        .eq('id', escrowId)
        .eq('status', escrow.status ?? 'held');

      if (error) throw new Error(`Escrow release failed: ${error.message}`);
    } else {
      const { error: rpcError } = await adminClient.rpc('release_escrow_to_wallet', {
        p_order_id:      escrow.order_id,
        p_freelancer_id: order.freelancer_id,
        p_amount:        escrow.amount,
      });

      if (rpcError) {
        throw new Error(`Escrow release failed: ${rpcError.message}`);
      }
    }
  }

  await adminClient.from('admin_action_logs').insert({
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

  const adminClient = createAdminClient();
  await requireStaffRole(adminClient, admin.id, FINANCE_ROLES);

  const { error } = await adminClient
    .from('escrow')
    .update({ status: 'held' })
    .eq('id', escrowId);

  if (error) throw new Error(`Escrow freeze failed: ${error.message}`);

  await adminClient.from('admin_action_logs').insert({
    admin_id:    admin.id,
    action_type: 'freeze_escrow',
    reason:      `Escrow ${escrowId} manually frozen`,
  });

  revalidatePath('/f9-control/finance');
}

/**
 * Cancel/refund an escrow entry to the client.
 */
async function cancelEscrow(fd: FormData) {
  'use server';
  const escrowId = fd.get('escrow_id') as string;
  const reason   = (fd.get('reason') as string | null)?.trim();

  if (!reason) throw new Error('A reason is required to cancel an escrow entry.');

  const supabase = await createClient();
  const { data: { user: admin } } = await supabase.auth.getUser();
  if (!admin) throw new Error('Unauthenticated');

  const adminClient = createAdminClient();
  await requireStaffRole(adminClient, admin.id, FINANCE_ROLES);

  const { error } = await adminClient
    .from('escrow')
    .update({ status: 'refunded_to_client' })
    .eq('id', escrowId);

  if (error) throw new Error(`Escrow cancel failed: ${error.message}`);

  await adminClient.from('admin_action_logs').insert({
    admin_id:    admin.id,
    action_type: 'cancel_escrow',
    reason:      `[${reason}] Escrow ${escrowId} cancelled and refunded to client`,
  });

  revalidatePath('/f9-control/finance');
}

/**
 * Update a transaction's status manually, with full internal ledger reversal.
 *
 * When `new_status` is 'refunded', three reversal paths are attempted:
 *   PATH A — Gateway payment (flutterwave_tx_ref present): refund via Flutterwave.
 *   PATH B — Internal wallet_credit reversal: decrement wallet balance.
 *   PATH C — Internal wallet_debit reversal: increment wallet balance.
 *   PATH D — All other types: status marked 'refunded' for audit trail only.
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

  const adminClient = createAdminClient();
  await requireStaffRole(adminClient, admin.id, FINANCE_ROLES);

  if (newStatus === 'refunded') {
    const { data: tx, error: txFetchError } = await adminClient
      .from('transactions')
      .select('transaction_type, recipient_user_id, amount, flutterwave_tx_ref')
      .eq('id', txId)
      .single();

    if (txFetchError || !tx) {
      throw new Error(`Failed to fetch transaction: ${txFetchError?.message ?? 'not found'}`);
    }

    // ── PATH A: Gateway payment reversal via Flutterwave ──────────────────
    if (tx.flutterwave_tx_ref) {
      const verified = await FlutterwaveServerService.verifyTransactionByRef(
        tx.flutterwave_tx_ref,
      );
      await FlutterwaveServerService.refundTransaction(verified.transactionId, tx.amount);

    // ── PATH B: Internal wallet_credit reversal ───────────────────────────
    } else if (tx.transaction_type === 'wallet_credit' && tx.recipient_user_id) {
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
      // Status advanced to 'refunded' below for audit trail.
    }
  }

  const { error: updateError } = await adminClient
    .from('transactions')
    .update({ status: newStatus })
    .eq('id', txId);

  if (updateError) throw new Error(`Status update failed: ${updateError.message}`);

  await adminClient.from('admin_action_logs').insert({
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

  const adminClient = createAdminClient();
  await requireStaffRole(adminClient, admin.id, FINANCE_ROLES);

  const { error } = await adminClient
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

  if (error) throw new Error(`Failed to toggle withdrawal gate: ${error.message}`);

  await adminClient.from('admin_action_logs').insert({
    admin_id:    admin.id,
    action_type: 'toggle_withdrawal_gate',
    reason:      `Withdrawals ${enabled ? 'resumed' : 'paused'} by admin`,
  });

  revalidatePath('/f9-control/finance');
}

/**
 * Set the withdrawal gate threshold.
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

  const adminClient = createAdminClient();
  await requireStaffRole(adminClient, admin.id, FINANCE_ROLES);

  const { error } = await adminClient
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

  await adminClient.from('admin_action_logs').insert({
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
  // Used ONLY to confirm there's a logged-in session for this render — every
  // actual data read below uses the admin client, since none of these
  // queries would return anything meaningful under the authenticated role's
  // RLS policies (see file header).
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Unauthenticated');
  }

  const adminClient = createAdminClient();
  await requireStaffRole(adminClient, user.id, FINANCE_ROLES);

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

  const { data: withdrawals } = await adminClient
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
    const { data: profiles, error: profileErr } = await adminClient
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
    let txQuery = adminClient
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

  // NOTE: your RPCs (process_successful_payment / process_marketplace_payment)
  // write status = 'successful', not 'completed'. 'successful' is included
  // here so admins can filter/find it; see FinanceClient.tsx for the
  // matching badge-colour fix.
  const knownTypes = Array.from(
    new Set([
      ...transactions.map((t) => t.transaction_type),
      'escrow_payment', 'withdrawal', 'platform_fee', 'refund', 'wallet_credit', 'wallet_debit',
    ])
  ).filter(Boolean).sort();

  // ── Active escrow entries ────────────────────────────────────────────────

  // FIX: 'funded' removed from the filter. Confirmed against every RPC in
  // your live schema (process_successful_payment, process_marketplace_payment,
  // complete_order_with_payment, release_escrow_to_wallet) — none of them
  // ever write escrow.status = 'funded'. The only non-terminal value any
  // function produces is 'held'. The 'funded' branch was dead — filtering
  // on it changed nothing, it's just removed now for clarity.
  const { data: escrowEntries } = await adminClient
    .from('escrow')
    .select('id, amount, status, order_id, marketplace_order_id, created_at, released_at')
    .eq('status', 'held')
    .order('created_at', { ascending: false })
    .limit(100);

  const { data: escrowTotal } = await adminClient.rpc('get_escrow_total');

  // ── Withdrawal gate state ────────────────────────────────────────────────

  const { data: withdrawalGateConfig } = await adminClient
    .from('platform_config')
    .select('enabled')
    .eq('key', 'withdrawals_paused')
    .single();

  const withdrawalsPaused = withdrawalGateConfig?.enabled ?? false;

  const { data: withdrawalThresholdConfig } = await adminClient
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