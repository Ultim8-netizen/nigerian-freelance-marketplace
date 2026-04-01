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

  // Fetch escrow + resolve freelancer_id via order join
  const { data: escrow } = await supabase
    .from('escrow')
    .select('id, amount, order_id')
    .eq('id', escrowId)
    .single();

  if (!escrow || !escrow.order_id) {
    // Fallback: direct status update if no linked order
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

/** Cancel/refund an escrow entry to the client. */
async function cancelEscrow(fd: FormData) {
  'use server';
  const escrowId = fd.get('escrow_id') as string;
  const supabase = await createClient();
  const { data: { user: admin } } = await supabase.auth.getUser();
  if (!admin) throw new Error('Unauthenticated');

  await supabase
    .from('escrow')
    .update({ status: 'refunded_to_client' })
    .eq('id', escrowId);

  await supabase.from('admin_action_logs').insert({
    admin_id:    admin.id,
    action_type: 'cancel_escrow',
    reason:      `Escrow ${escrowId} cancelled and refunded to client`,
  });

  revalidatePath('/f9-control/finance');
}

/**
 * Update a transaction's status manually.
 *
 * Requires a non-empty `reason` from FormData — enforced here and expected
 * to be collected by FinanceClient before submitting (text input on the modal).
 *
 * When `new_status` is 'refunded':
 *   1. Fetch the transaction row to obtain flutterwave_tx_ref.
 *   2. Call FlutterwaveServerService.refundTransaction — this is a PLACEHOLDER
 *      and will be replaced by the Monnify refund call during the gateway migration.
 *   3. Only update the DB row after the gateway call resolves successfully, so a
 *      failed gateway call leaves the transaction status unchanged.
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
    // Resolve the Flutterwave reference so the gateway knows which payment to refund.
    const { data: tx, error: txFetchError } = await supabase
      .from('transactions')
      .select('flutterwave_tx_ref')
      .eq('id', txId)
      .single();

    if (txFetchError) throw new Error(`Failed to fetch transaction: ${txFetchError.message}`);

    if (tx?.flutterwave_tx_ref) {
      // TODO [MONNIFY MIGRATION]: Replace this call.
      // Throws on gateway error — DB update intentionally skipped in that case.
      await FlutterwaveServerService.refundTransaction(tx.flutterwave_tx_ref, reason);
    }
    // If flutterwave_tx_ref is null the transaction was never paid via the gateway
    // (e.g. manually created test record) — skip the gateway call and fall through
    // to the DB status update below.
  }

  const { error: updateError } = await supabase
    .from('transactions')
    .update({ status: newStatus })
    .eq('id', txId);

  if (updateError) throw new Error(`Status update failed: ${updateError.message}`);

  await supabase.from('admin_action_logs').insert({
    admin_id:    admin.id,
    action_type: 'update_transaction_status',
    // Reason is prepended in square brackets so it's easily scannable in audit logs.
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

  // Upsert — create the row if it doesn't exist yet
  await supabase
    .from('platform_config')
    .upsert(
      {
        key:          'withdrawals_paused',
        enabled:      !enabled, // toggle: current value is `enabled`, new value is opposite
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

// ─── Data fetches ─────────────────────────────────────────────────────────────

export default async function AdminFinancePage() {
  const supabase = await createClient();

  // Pending withdrawals with user profile join
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

  // Recent transactions — all statuses, last 100
  const { data: transactions } = await supabase
    .from('transactions')
    .select('id, transaction_ref, transaction_type, amount, currency, status, order_id, created_at, paid_at')
    .order('created_at', { ascending: false })
    .limit(100);

  // Active escrow entries (funded + held)
  const { data: escrowEntries } = await supabase
    .from('escrow')
    .select('id, amount, status, order_id, marketplace_order_id, created_at, released_at')
    .in('status', ['funded', 'held'])
    .order('created_at', { ascending: false })
    .limit(100);

  // Escrow total via RPC
  const { data: escrowTotal } = await supabase.rpc('get_escrow_total');

  // Withdrawal gate state
  const { data: withdrawalGateConfig } = await supabase
    .from('platform_config')
    .select('enabled')
    .eq('key', 'withdrawals_paused')
    .single();

  const withdrawalsPaused = withdrawalGateConfig?.enabled ?? false;

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
        transactions={transactions ?? []}
        escrowEntries={escrowEntries ?? []}
        withdrawalsPaused={withdrawalsPaused}
        onApproveWithdrawal={approveWithdrawal}
        onHoldWithdrawal={holdWithdrawal}
        onReleaseEscrow={releaseEscrow}
        onFreezeEscrow={freezeEscrow}
        onCancelEscrow={cancelEscrow}
        onUpdateTransactionStatus={updateTransactionStatus}
        onToggleWithdrawalGate={toggleWithdrawalGate}
      />
    </div>
  );
}