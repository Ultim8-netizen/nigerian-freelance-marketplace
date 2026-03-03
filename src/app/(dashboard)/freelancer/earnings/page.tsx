// src/app/(dashboard)/freelancer/earnings/page.tsx
// FIX: Next.js 15 made `searchParams` a Promise — it must be awaited before use.
// Previously accessing searchParams.success synchronously caused a hydration crash
// at line 127 because the server and client resolved the param differently.

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import {
  DollarSign,
  TrendingUp,
  AlertCircle,
  Building2,
  CheckCircle,
  ArrowDownToLine,
  Clock,
  ShieldCheck,
} from 'lucide-react';

async function initiateWithdrawal(formData: FormData) {
  'use server';

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const amount         = parseFloat(formData.get('amount') as string);
  const bank_name      = (formData.get('bank_name') as string)?.trim();
  const account_number = (formData.get('account_number') as string)?.trim();
  const account_name   = (formData.get('account_name') as string)?.trim();

  if (!amount || !bank_name || !account_number || !account_name)
    redirect('/freelancer/earnings?error=missing_fields');

  if (account_number.length !== 10 || !/^\d+$/.test(account_number))
    redirect('/freelancer/earnings?error=invalid_account');

  const { data: wallet } = await supabase
    .from('wallets')
    .select('id, balance')
    .eq('user_id', user.id)
    .single();

  const balance = wallet?.balance ?? 0;
  if (amount < 5000)    redirect('/freelancer/earnings?error=below_minimum');
  if (amount > balance) redirect('/freelancer/earnings?error=insufficient_funds');

  const { error } = await supabase.from('withdrawals').insert({
    user_id:        user.id,
    wallet_id:      wallet?.id ?? null,
    amount,
    bank_name,
    account_number,
    account_name,
    status:         'pending',
  });

  if (error) {
    console.error('Withdrawal error:', error);
    redirect('/freelancer/earnings?error=request_failed');
  }

  revalidatePath('/freelancer/earnings');
  redirect('/freelancer/earnings?success=withdrawal_requested');
}

const ERROR_MESSAGES: Record<string, string> = {
  missing_fields:     'Please fill in all required fields.',
  invalid_account:    'Account number must be exactly 10 digits.',
  below_minimum:      'Minimum withdrawal amount is ₦5,000.',
  insufficient_funds: 'Withdrawal amount exceeds your available balance.',
  request_failed:     'Something went wrong. Please try again.',
};

// FIX: Next.js 15 — searchParams is now a Promise and must be awaited.
export default async function EarningsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  // CRITICAL FIX: await searchParams before any access
  const params = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: wallet } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', user.id)
    .single();

  const { data: completedOrders } = await supabase
    .from('orders')
    .select('amount, delivered_at, title')
    .eq('freelancer_id', user.id)
    .eq('status', 'completed')
    .not('delivered_at', 'is', null)
    .order('delivered_at', { ascending: false });

  const totalEarnings = completedOrders?.reduce((s, o) => s + (o.amount || 0), 0) || 0;

  const now = new Date();
  const thisMonthOrders = completedOrders?.filter((o) => {
    if (!o.delivered_at) return false;
    const d = new Date(o.delivered_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }) ?? [];
  const thisMonth = thisMonthOrders.reduce((s, o) => s + (o.amount || 0), 0);

  const availableBalance  = wallet?.balance          ?? 0;
  const pendingClearance  = wallet?.pending_clearance ?? 0;
  const minimumWithdrawal = 5000;
  const canWithdraw       = availableBalance >= minimumWithdrawal;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
          Earnings &amp; Wallet
        </h1>
        <p className="text-gray-600 dark:text-gray-400">Track your income and manage withdrawals</p>
      </div>

      {/* FIX: Use awaited `params` instead of raw `searchParams` */}
      {params.success === 'withdrawal_requested' && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
          <p className="text-green-800 dark:text-green-200 font-medium">
            Withdrawal request submitted! Processing takes 1–3 business days.
          </p>
        </div>
      )}
      {params.error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
          <p className="text-red-800 dark:text-red-200 font-medium">
            {ERROR_MESSAGES[params.error] ?? 'An error occurred.'}
          </p>
        </div>
      )}

      {/* Wallet Summary */}
      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <Card className="p-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Available Balance</p>
            <div className="w-9 h-9 rounded-lg bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(availableBalance)}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Ready to withdraw</p>
        </Card>

        <Card className="p-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Pending Clearance</p>
            <div className="w-9 h-9 rounded-lg bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center">
              <Clock className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{formatCurrency(pendingClearance)}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">14-day holding period</p>
        </Card>

        <Card className="p-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Earned</p>
            <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{formatCurrency(totalEarnings)}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">All-time earnings</p>
        </Card>
      </div>

      {/* This Month */}
      <Card className="p-6 mb-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">This Month</h2>
          <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{formatCurrency(thisMonth)}</span>
        </div>
        <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-linear-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-700"
            style={{ width: totalEarnings > 0 ? `${Math.min((thisMonth / totalEarnings) * 100, 100)}%` : '0%' }}
          />
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
          {thisMonthOrders.length} order{thisMonthOrders.length !== 1 ? 's' : ''} completed this month
        </p>
      </Card>

      {/* Withdrawal */}
      <Card className="p-6 mb-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
            <ArrowDownToLine className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Withdraw Funds</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Transfer to your Nigerian bank account</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-5 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
          <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
          <p className="text-xs text-blue-700 dark:text-blue-300">
            Minimum withdrawal: ₦5,000 · Processing time: 1–3 business days
          </p>
        </div>

        {canWithdraw ? (
          <form action={initiateWithdrawal} className="space-y-4">
            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Withdrawal Amount (₦) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium select-none">₦</span>
                <input
                  type="number" id="amount" name="amount"
                  min={minimumWithdrawal} max={availableBalance} step="100" required
                  placeholder={`Max: ${formatCurrency(availableBalance)}`}
                  className="w-full pl-8 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Available: {formatCurrency(availableBalance)}</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="bank_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Bank Name *
                </label>
                <select
                  id="bank_name" name="bank_name" required
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="">Select bank...</option>
                  <option>Access Bank</option>
                  <option>GTBank</option>
                  <option>First Bank</option>
                  <option>UBA</option>
                  <option>Zenith Bank</option>
                  <option>Fidelity Bank</option>
                  <option>FCMB</option>
                  <option>Polaris Bank</option>
                  <option>Sterling Bank</option>
                  <option>Wema Bank</option>
                  <option>Opay</option>
                  <option>Kuda Bank</option>
                  <option>PalmPay</option>
                  <option>Moniepoint</option>
                </select>
              </div>

              <div>
                <label htmlFor="account_number" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Account Number *
                </label>
                <input
                  type="text" id="account_number" name="account_number"
                  maxLength={10} pattern="\d{10}" required
                  placeholder="10-digit number"
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label htmlFor="account_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Account Name *
              </label>
              <input
                type="text" id="account_name" name="account_name" required
                placeholder="As it appears on your bank account"
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <Button type="submit" className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-3">
              <Building2 className="w-4 h-4" />
              Request Withdrawal
            </Button>
          </form>
        ) : (
          <div className="text-center py-6">
            <p className="text-gray-700 dark:text-gray-300 font-medium mb-1">Minimum balance not reached yet</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              You need{' '}
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                {formatCurrency(Math.max(minimumWithdrawal - availableBalance, 0))}
              </span>{' '}
              more to withdraw
            </p>
            <div className="mt-4 w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${Math.min((availableBalance / minimumWithdrawal) * 100, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
              {formatCurrency(availableBalance)} / {formatCurrency(minimumWithdrawal)}
            </p>
          </div>
        )}
      </Card>

      {/* Earnings History */}
      <Card className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Earnings History</h2>
        {completedOrders && completedOrders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 text-gray-600 dark:text-gray-400 font-medium">Date</th>
                  <th className="text-left py-3 text-gray-600 dark:text-gray-400 font-medium">Order</th>
                  <th className="text-left py-3 text-gray-600 dark:text-gray-400 font-medium">Amount</th>
                  <th className="text-left py-3 text-gray-600 dark:text-gray-400 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {completedOrders.slice(0, 15).map((order, i) => (
                  <tr key={i} className="border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="py-3 text-gray-600 dark:text-gray-400">
                      {order.delivered_at
                        ? new Date(order.delivered_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
                        : 'N/A'}
                    </td>
                    <td className="py-3 text-gray-800 dark:text-gray-200 max-w-[180px] truncate">
                      {(order as { title?: string }).title ?? '—'}
                    </td>
                    <td className="py-3 font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(order.amount || 0)}
                    </td>
                    <td className="py-3">
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 text-xs rounded-full font-medium">
                        <CheckCircle className="w-3 h-3" />
                        Completed
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-600 dark:text-gray-400 font-medium">No completed orders yet</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
              Your earnings will appear here once orders are completed.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}