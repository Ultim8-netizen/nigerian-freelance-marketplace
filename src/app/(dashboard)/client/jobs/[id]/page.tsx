// src/app/(dashboard)/client/jobs/[id]/page.tsx
// Client's job management view: full job details, all proposals with
// accept/reject actions, accepted freelancer highlight, job cancellation.
// Ownership enforced at query level (.eq('client_id', user.id)).
//
// FIXED (Domain 4 audit): the select list requested `skills_required`, which
// is not a column on `jobs` (database.types.ts defines `required_skills`).
// This made the entire query throw "column jobs.skills_required does not
// exist", breaking this page outright. Changed the select to
// `required_skills` and updated the two JSX references below.

import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatRelativeTime } from '@/lib/utils';
import Link from 'next/link';
import { ProposalActionButtons } from '@/components/proposals/ProposalActionButtons';
import { CancelJobButton } from '@/components/jobs/CancelJobButton';
import {
  ArrowLeft,
  Users,
  Eye,
  Clock,
  DollarSign,
  CheckCircle,
  Star,
  Briefcase,
  Calendar,
  MessageSquare,
} from 'lucide-react';

// ── Local types ───────────────────────────────────────────────────────────────

type FreelancerProfile = {
  id: string;
  full_name: string;
  profile_image_url: string | null;
  bio: string | null;
  freelancer_rating: number | null;
  total_jobs_completed: number | null;
  identity_verified: boolean | null;
};

type ProposalRow = {
  id: string;
  freelancer_id: string;
  proposed_price: number;
  delivery_days: number;
  status: string;
  created_at: string;
  cover_letter: string | null;
  freelancer: FreelancerProfile | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function proposalStatusBadge(status: string) {
  const map: Record<string, string> = {
    pending:   'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    accepted:  'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    rejected:  'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    withdrawn: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  };
  return map[status] || 'bg-gray-100 text-gray-600';
}

function jobStatusBadge(status: string | null) {
  const map: Record<string, string> = {
    open:        'bg-green-100 text-green-800',
    in_progress: 'bg-blue-100 text-blue-800',
    completed:   'bg-gray-100 text-gray-700',
    cancelled:   'bg-red-100 text-red-800',
  };
  return map[status ?? ''] || 'bg-gray-100 text-gray-600';
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ClientJobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: jobId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Ownership enforced at query level — non-owners get notFound()
  const { data: job, error } = await supabase
    .from('jobs')
    .select(`
      id, title, description, status, budget_type, budget_min, budget_max,
      experience_level, category, deadline, created_at, updated_at,
      views_count, proposals_count, required_skills,
      proposals(
        id, freelancer_id, proposed_price, delivery_days, status,
        created_at, cover_letter,
        freelancer:profiles!proposals_freelancer_id_fkey(
          id, full_name, profile_image_url, bio,
          freelancer_rating, total_jobs_completed, identity_verified
        )
      )
    `)
    .eq('id', jobId)
    .eq('client_id', user.id)
    .single();

  if (error || !job) notFound();

  const proposals = ((job.proposals ?? []) as ProposalRow[]).sort((a, b) => {
    const order: Record<string, number> = { accepted: 0, pending: 1, rejected: 2, withdrawn: 3 };
    const diff = (order[a.status] ?? 4) - (order[b.status] ?? 4);
    if (diff !== 0) return diff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const pendingCount  = proposals.filter((p) => p.status === 'pending').length;
  const acceptedCount = proposals.filter((p) => p.status === 'accepted').length;

  const budgetDisplay = () => {
    if (job.budget_type === 'fixed' && job.budget_min) return formatCurrency(job.budget_min);
    if (job.budget_type === 'hourly' && job.budget_min) return `${formatCurrency(job.budget_min)}/hr`;
    if (job.budget_min && job.budget_max)
      return `${formatCurrency(job.budget_min)} – ${formatCurrency(job.budget_max)}`;
    return 'Negotiable';
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Back */}
      <Link
        href="/client/jobs"
        className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to My Jobs
      </Link>

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{job.title}</h1>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${jobStatusBadge(job.status)}`}
            >
              {job.status ?? 'open'}
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400" suppressHydrationWarning>
            Posted {job.created_at ? formatRelativeTime(job.created_at) : ''}
          </p>
        </div>
        {job.status === 'open' && <CancelJobButton jobId={job.id} />}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* ── Left: job details + proposals ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Job description */}
          <Card className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              Job Description
            </h2>
            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
              {job.description}
            </p>

            {job.required_skills && job.required_skills.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Required Skills
                </p>
                <div className="flex flex-wrap gap-2">
                  {(job.required_skills as string[]).map((skill, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-700"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Proposals */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Proposals
                <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                  ({proposals.length} total
                  {pendingCount > 0 && `, ${pendingCount} pending`}
                  {acceptedCount > 0 && `, ${acceptedCount} accepted`})
                </span>
              </h2>
            </div>

            {proposals.length === 0 ? (
              <Card className="p-8 text-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <Users className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-600 dark:text-gray-400 font-medium">No proposals yet.</p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                  Proposals from freelancers will appear here.
                </p>
              </Card>
            ) : (
              <div className="space-y-4">
                {proposals.map((proposal) => (
                  <Card
                    key={proposal.id}
                    className={`p-5 bg-white dark:bg-gray-800 border transition-shadow ${
                      proposal.status === 'accepted'
                        ? 'border-green-300 dark:border-green-700 shadow-md'
                        : 'border-gray-200 dark:border-gray-700 hover:shadow-md'
                    }`}
                  >
                    {/* Accepted banner */}
                    {proposal.status === 'accepted' && (
                      <div className="flex items-center gap-1.5 text-green-700 dark:text-green-400 text-sm font-medium mb-3 pb-3 border-b border-green-200 dark:border-green-800">
                        <CheckCircle className="w-4 h-4" />
                        Hired — this freelancer is working on your job
                      </div>
                    )}

                    <div className="flex flex-wrap gap-4 justify-between">
                      {/* Freelancer info */}
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-11 h-11 rounded-full bg-blue-600 text-white flex items-center justify-center text-base font-bold shrink-0 overflow-hidden">
                          {proposal.freelancer?.profile_image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={proposal.freelancer.profile_image_url}
                              alt={proposal.freelancer.full_name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            proposal.freelancer?.full_name?.charAt(0)?.toUpperCase() ?? 'F'
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-gray-900 dark:text-white">
                              {proposal.freelancer?.full_name ?? 'Freelancer'}
                            </p>
                            {proposal.freelancer?.identity_verified && (
                              <span className="inline-flex items-center gap-0.5 text-xs text-green-600 dark:text-green-400">
                                <CheckCircle className="w-3 h-3" />
                                Verified
                              </span>
                            )}
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${proposalStatusBadge(proposal.status)}`}
                            >
                              {proposal.status}
                            </span>
                          </div>
                          {proposal.freelancer?.freelancer_rating != null && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                              {Number(proposal.freelancer.freelancer_rating).toFixed(1)}
                              {proposal.freelancer.total_jobs_completed != null && (
                                <span>· {proposal.freelancer.total_jobs_completed} jobs</span>
                              )}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Bid + delivery */}
                      <div className="text-right shrink-0">
                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                          {formatCurrency(proposal.proposed_price)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {proposal.delivery_days} day{proposal.delivery_days !== 1 ? 's' : ''} delivery
                        </p>
                        <p
                          className="text-xs text-gray-400 dark:text-gray-500 mt-0.5"
                          suppressHydrationWarning
                        >
                          {proposal.created_at ? formatRelativeTime(proposal.created_at) : ''}
                        </p>
                      </div>
                    </div>

                    {/* Cover letter */}
                    {proposal.cover_letter && (
                      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 flex items-center gap-1">
                          <MessageSquare className="w-3.5 h-3.5" />
                          Cover Letter
                        </p>
                        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                          {proposal.cover_letter}
                        </p>
                      </div>
                    )}

                    {/* Action buttons */}
                    {proposal.status === 'pending' && (
                      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-end">
                        <ProposalActionButtons
                          proposalId={proposal.id}
                          jobStatus={job.status ?? 'open'}
                          proposalStatus={proposal.status}
                        />
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: job meta ── */}
        <div className="space-y-4">
          <Card className="p-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Job Overview</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <DollarSign className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
                <span className="font-medium">{budgetDisplay()}</span>
                <span className="text-gray-400 capitalize">({job.budget_type ?? 'fixed'})</span>
              </div>

              <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <Users className="w-4 h-4 text-blue-500 shrink-0" />
                <span>{proposals.length} proposal{proposals.length !== 1 ? 's' : ''}</span>
              </div>

              <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <Eye className="w-4 h-4 text-purple-500 shrink-0" />
                <span>{job.views_count ?? 0} views</span>
              </div>

              {job.experience_level && (
                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  <Briefcase className="w-4 h-4 text-orange-500 shrink-0" />
                  <span className="capitalize">{job.experience_level} level</span>
                </div>
              )}

              {job.deadline && (
                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  <Calendar className="w-4 h-4 text-red-500 shrink-0" />
                  <span>
                    Due{' '}
                    {new Date(job.deadline).toLocaleDateString('en-NG', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              )}

              {job.created_at && (
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                  <Clock className="w-4 h-4 shrink-0" />
                  <span suppressHydrationWarning>
                    Posted {formatRelativeTime(job.created_at)}
                  </span>
                </div>
              )}
            </div>
          </Card>

          <Link href={`/jobs/${job.id}`} className="block">
            <Button variant="outline" className="w-full text-sm">
              View Public Listing
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}