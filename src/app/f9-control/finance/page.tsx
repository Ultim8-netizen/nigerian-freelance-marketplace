import { createClient } from '@/lib/supabase/server';
import type { Withdrawal } from '@/types';
import { Card } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// FIXED: Define proper type for withdrawal with nested user relationship
// When selecting with user_id(full_name, trust_score), the user_id field becomes an object
type WithdrawalWithUser = Withdrawal & {
  user_id: { full_name: string | null; trust_score: number | null } | null;
};

export default async function AdminFinancePage() {
  const supabase = await createClient();

  // FIXED: Use user_id(field) for explicit relationship hint (not profiles)
  // withdrawals has one foreign key: user_id → profiles.id
  const { data: withdrawals } = await supabase
    .from('withdrawals')
    .select('*, user_id(full_name, trust_score)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false }) as { data: WithdrawalWithUser[] | null };

  // Escrow overview
  const { data: escrowTotal } = await supabase.rpc('get_escrow_total');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Financial Controls</h1>
        <div className="bg-blue-50 text-blue-800 px-4 py-2 rounded-lg font-bold">
          Total in Escrow: {formatCurrency(escrowTotal || 0)}
        </div>
      </div>

      <h2 className="text-lg font-semibold mt-6">Pending Withdrawals</h2>
      <Card className="overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 font-medium text-gray-500">User</th>
              <th className="px-6 py-3 font-medium text-gray-500">Amount</th>
              <th className="px-6 py-3 font-medium text-gray-500">Bank Details</th>
              <th className="px-6 py-3 font-medium text-gray-500">Trust Score</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {withdrawals?.map((req) => (
              <tr key={req.id} className="hover:bg-gray-50">
                {/* FIXED: Use optional chaining for nullable user_id object */}
                <td className="px-6 py-4 font-medium">{req.user_id?.full_name || 'Unknown User'}</td>
                <td className="px-6 py-4 font-bold text-gray-900">{formatCurrency(req.amount)}</td>
                <td className="px-6 py-4">
                  <div className="text-xs">
                    <p className="font-semibold">{req.bank_name}</p>
                    <p className="text-gray-500">{req.account_number}</p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  {/* FIXED: Use nullish coalescing (?? 0) for nullable trust_score per established pattern */}
                  <span className={`px-2 py-1 rounded text-xs font-bold ${(req.user_id?.trust_score ?? 0) < 40 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                    {req.user_id?.trust_score ?? 0}
                  </span>
                </td>
                <td className="px-6 py-4 text-right space-x-2">
                  <Button size="sm" className="bg-green-600 hover:bg-green-700">Approve</Button>
                  <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50">Hold 24h</Button>
                </td>
              </tr>
            ))}
            {(!withdrawals || withdrawals.length === 0) && (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">No pending withdrawals</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}