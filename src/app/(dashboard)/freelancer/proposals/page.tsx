// src/app/(dashboard)/freelancer/proposals/page.tsx
// Freelancer's proposals dashboard: groups by status, shows job context,
// and exposes withdrawal for pending proposals.

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatRelativeTime } from '@/lib/utils';
import Link from 'next/link';
import { WithdrawProposalButton } from '@/components/proposals/ProposalActionButtons';
import {
  Briefcase,
  Clock,
  DollarSign,
  FileText,
  CheckCircle,
  XCircle,
  Hourglass,
  Undo2,
} from 'lucide-react';

// ── Local types ───────────────────────────────────────────────────────────────

type JobRef = {
  id: string;
  title: string;
  status: string;
  budget_min: number | null;
  budget_max: number | null;
  budget_type: string | null;
} | null;

type ProposalWithJob = {
  id: string;
  proposed_price: number;
  delivery_days: number;
  status: string;
  created_at: string;
  cover_letter: string | null;
  job_id: string;
  job: JobRef;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'pending':
      return <Hourglass className="w-4 h-4 text-amber-500" />;
    case 'accepted':
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    case 'rejected':
      return <XCircle className="w-4 h-4 text-red-500" />;
    case 'withdrawn':
      return <Undo2 className="w-4 h-4 text-gray-400" />;
    default:
      return <FileText className="w-4 h-4 text-gray-400" />;
  }
}

function statusBadgeClass(status: string) {
  const map: Record<string, string> = {
    pending:   'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    accepted:  'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    rejected:  'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    withdrawn: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  };
  return map[status] || 'bg-gray-100 text-gray-600';
}

// ── Proposal card ─────────────────────────────────────────────────────────────

function ProposalCard({ proposal }: { proposal: ProposalWithJob }) {
  return (
    <Card
      className={`p-5 bg-white dark:bg-gray-800 border transition-shadow hover:shadow-md ${
        proposal.status === 'accepted'
          ? 'border-green-300 dark:border-green-700'
          : 'border-gray-200 dark:border-gray-700'
      }`}
    >
      <div className="flex flex-wrap gap-4 justify-between">
        {/* Job info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <StatusIcon status={proposal.status} />
            <Link
              href={`/jobs/${proposal.job_id}`}
              className="font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate"
            >
              {proposal.job?.title ?? 'Job listing'}
            </Link>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusBadgeClass(proposal.status)}`}
            >
              {proposal.status}
            </span>
          </div>

          {proposal.job?.status && (
            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Briefcase className="w-3 h-3" />
              Job status:
              <span className="capitalize font-medium ml-0.5">{proposal.job.status}</span>
            </p>
          )}
        </div>

        {/* Bid details */}
        <div className="text-right shrink-0">
          <p className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-1 justify-end">
            <DollarSign className="w-4 h-4 text-green-600 dark:text-green-400" />
            {formatCurrency(proposal.proposed_price)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {proposal.delivery_days} day{proposal.delivery_days !== 1 ? 's' : ''} delivery
          </p>
        </div>
      </div>

      {/* Cover letter preview */}
      {proposal.cover_letter && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-3 line-clamp-2 leading-relaxed">
          {proposal.cover_letter}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
        <p
          className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1"
          suppressHydrationWarning
        >
          <Clock className="w-3 h-3" />
          Submitted {formatRelativeTime(proposal.created_at)}
        </p>

        <div className="flex items-center gap-2">
          <Link href={`/jobs/${proposal.job_id}`}>
            <Button variant="ghost" size="sm" className="text-xs h-7 px-2">
              View Job
            </Button>
          </Link>
          {proposal.status === 'pending' && (
            <WithdrawProposalButton proposalId={proposal.id} />
          )}
        </div>
      </div>

      {/* Accepted call-to-action */}
      {proposal.status === 'accepted' && (
        <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-800">
          <p className="text-sm text-green-700 dark:text-green-400 font-medium flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4" />
            Your proposal was accepted! Deliver excellent work.
          </p>
        </div>
      )}
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function FreelancerProposalsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: rawProposals } = await supabase
    .from('proposals')
    .select(`
      id, proposed_price, delivery_days, status, created_at, cover_letter, job_id,
      job:jobs!proposals_job_id_fkey(
        id, title, status, budget_min, budget_max, budget_type
      )
    `)
    .eq('freelancer_id', user.id)
    .order('created_at', { ascending: false });

  const proposals = (rawProposals ?? []) as ProposalWithJob[];

  const pending   = proposals.filter((p) => p.status === 'pending');
  const accepted  = proposals.filter((p) => p.status === 'accepted');
  const other     = proposals.filter((p) => p.status !== 'pending' && p.status !== 'accepted');

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">My Proposals</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Track the status of all your job proposals.
        </p>
      </div>

      {proposals.length === 0 ? (
        <Card className="p-12 text-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No Proposals Yet
          </h3>
          <p className="text-gray-700 dark:text-gray-300 mb-6">
            Browse open jobs and submit your first proposal to start working.
          </p>
          <Link href="/freelancer/jobs">
            <Button>Browse Jobs</Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Accepted */}
          {accepted.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                Accepted ({accepted.length})
              </h2>
              <div className="space-y-3">
                {accepted.map((p) => <ProposalCard key={p.id} proposal={p} />)}
              </div>
            </section>
          )}

          {/* Pending */}
          {pending.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Hourglass className="w-5 h-5 text-amber-500" />
                Pending ({pending.length})
              </h2>
              <div className="space-y-3">
                {pending.map((p) => <ProposalCard key={p.id} proposal={p} />)}
              </div>
            </section>
          )}

          {/* Closed (rejected + withdrawn) */}
          {other.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-400" />
                Closed ({other.length})
              </h2>
              <div className="space-y-3">
                {other.map((p) => <ProposalCard key={p.id} proposal={p} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}