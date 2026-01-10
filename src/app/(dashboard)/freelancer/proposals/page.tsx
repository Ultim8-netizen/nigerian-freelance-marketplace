import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatRelativeTime } from '@/lib/utils';
import Link from 'next/link';

export default async function ProposalsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: proposals } = await supabase
    .from('proposals')
    .select(`
      *,
      job:jobs(id, title, budget_type, budget_min, budget_max)
    `)
    .eq('freelancer_id', user.id)
    .order('created_at', { ascending: false });

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'accepted': return 'success';
      case 'rejected': return 'destructive';
      case 'pending': return 'warning';
      default: return 'secondary';
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">My Proposals</h1>
      
      <div className="space-y-4">
        {proposals?.map((proposal) => (
          <Card key={proposal.id} className="p-6 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start">
              <div>
                <Link href={`/jobs/${proposal.job_id}`} className="hover:underline">
                  <h3 className="text-lg font-semibold text-blue-600 mb-1">
                    {proposal.job?.title}
                  </h3>
                </Link>
                <div className="text-sm text-gray-500 mb-2">
                  Submitted {formatRelativeTime(proposal.created_at)}
                </div>
                <div className="text-sm">
                  <span className="font-medium">Your Bid: </span> 
                  {formatCurrency(proposal.proposed_price)}
                  <span className="mx-2">•</span>
                  <span>{proposal.delivery_days} Days delivery</span>
                </div>
              </div>
              <Badge variant={getStatusVariant(proposal.status)}>
                {proposal.status.toUpperCase()}
              </Badge>
            </div>
          </Card>
        ))}

        {(!proposals || proposals.length === 0) && (
          <Card className="p-8 text-center text-gray-500">
            You have not submitted any proposals yet.
          </Card>
        )}
      </div>
    </div>
  );
}