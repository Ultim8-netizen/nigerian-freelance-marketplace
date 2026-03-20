import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
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
      // Use the safe 3-param RPC
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

/** Update a transaction's status manually. */
async function updateTransactionStatus(fd: FormData) {
  'use server';
  const txId     = fd.get('transaction_id') as string;
  const newStatus = fd.get('new_status') as string;
  const supabase = await createClient();
  const { data: { user: admin } } = await supabase.auth.getUser();
  if (!admin) throw new Error('Unauthenticated');

  await supabase
    .from('transactions')
    .update({ status: newStatus })
    .eq('id', txId);

  await supabase.from('admin_action_logs').insert({
    admin_id:    admin.id,
    action_type: 'update_transaction_status',
    reason:      `Transaction ${txId} status set to '${newStatus}'`,
  });

  revalidatePath('/f9-control/finance');
}

/** Toggle the platform-wide withdrawal gate via platform_config. */
async function toggleWithdrawalGate(fd: FormData) {
  'use server';
  const enabled = fd.get('enabled') === 'true';
  const supabase = await createClient();
  const { data: { user: admin } } = await supabase.auth.getUser();
  if (!admin) throw new Error('Unauthenticated');

  // Upsert — create the row if it doesn't exist yet
  await supabase
    .from('platform_config')
    .upsert({
      key:         'withdrawals_paused',
      enabled:     !enabled, // toggle: current value is `enabled`, new value is opposite
      description: 'When ON, all withdrawal processing is paused platform-wide.',
      value:       null,
      string_value: null,
    }, { onConflict: 'key' });

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