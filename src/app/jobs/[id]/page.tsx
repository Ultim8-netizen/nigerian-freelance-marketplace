// src/app/jobs/[id]/page.tsx
// FIXED:
//   1. params + searchParams are now Promise types (Next.js 15 async params)
//   2. Broken server action removed entirely — replaced with ProposalSubmitForm
//      client component that calls POST /api/proposals with full validation,
//      duplicate check, rate limiting, and notification (all in the API route)
//   3. revalidatePath import removed (no longer needed)

import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatRelativeTime } from '@/lib/utils';
import Link from 'next/link';
import { ProposalSubmitForm } from '@/components/proposals/ProposalSubmitForm';
import {
  MapPin,
  Clock,
  DollarSign,
  Users,
  Briefcase,
  CheckCircle,
  ArrowLeft,
} from 'lucide-react';

export default async function JobDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { id }                          = await params;
  const { error: qError, success: qSuccess } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=/jobs/${id}`);
  }

  const { data: job, error } = await supabase
    .from('jobs')
    .select(`
      *,
      client:profiles!jobs_client_id_fkey(
        id, full_name, location, client_rating,
        profile_image_url, created_at, identity_verified
      )
    `)
    .eq('id', id)
    .single();

  if (error || !job) notFound();

  const { data: existingProposal } = await supabase
    .from('proposals')
    .select('id, status, proposed_price, delivery_days, created_at')
    .eq('job_id', id)
    .eq('freelancer_id', user.id)
    .maybeSingle();

  const isJobOwner = user.id === job.client_id;

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_type')
    .eq('id', user.id)
    .single();

  const isFreelancer =
    profile?.user_type === 'freelancer' || profile?.user_type === 'both';

  const budgetDisplay = () => {
    if (job.budget_type === 'fixed' && job.budget_min)
      return formatCurrency(job.budget_min);
    if (job.budget_type === 'hourly' && job.budget_min)
      return `${formatCurrency(job.budget_min)}/hr`;
    if (job.budget_min && job.budget_max)
      return `${formatCurrency(job.budget_min)} – ${formatCurrency(job.budget_max)}`;
    return 'Negotiable';
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Back */}
        <Link
          href="/freelancer/jobs"
          className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Job Listings
        </Link>

        {/* Legacy query-param banners (kept for backwards compat) */}
        {qSuccess === 'proposal_submitted' && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
            <p className="text-green-800 dark:text-green-200 font-medium">
              Proposal submitted successfully!
            </p>
          </div>
        )}
        {qError && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-800 dark:text-red-200 font-medium">
              {qError === 'missing_fields'
                ? 'Please fill in all required fields.'
                : 'Submission failed. Please try again.'}
            </p>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          {/* ── Left: job details ── */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              {/* Title + status */}
              <div className="flex flex-wrap items-start gap-3 mb-4">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex-1">
                  {job.title}
                </h1>
                <Badge
                  variant={job.status === 'open' ? 'success' : 'secondary'}
                  className="capitalize"
                >
                  {job.status ?? 'open'}
                </Badge>
              </div>

              {/* Key stats */}
              <div className="flex flex-wrap gap-5 text-sm mb-6 pb-6 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                  <DollarSign className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <span className="font-semibold">{budgetDisplay()}</span>
                  <span className="text-gray-500 capitalize">
                    ({job.budget_type ?? 'fixed'})
                  </span>
                </div>
                {job.deadline && (
                  <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                    <Clock className="w-4 h-4 text-orange-500" />
                    <span>
                      Deadline:{' '}
                      {new Date(job.deadline).toLocaleDateString('en-NG', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                )}
                {job.experience_level && (
                  <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                    <Users className="w-4 h-4 text-blue-500" />
                    <span className="capitalize">{job.experience_level} level</span>
                  </div>
                )}
                {job.category && (
                  <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                    <Briefcase className="w-4 h-4 text-purple-500" />
                    <span>{job.category}</span>
                  </div>
                )}
              </div>

              {/* Description */}
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  Job Description
                </h2>
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                  {job.description}
                </p>
              </div>

              {/* Required skills — FIXED: skills_required (was required_skills) */}
              {job.skills_required && job.skills_required.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    Required Skills
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {(job.skills_required as string[]).map((skill: string, i: number) => (
                      <Badge key={i} variant="outline">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            {/* ── Proposal section ── */}
            {!isJobOwner && isFreelancer && job.status === 'open' && (
              <Card className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                  {existingProposal ? 'Your Proposal' : 'Submit a Proposal'}
                </h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-5">
                  {existingProposal
                    ? 'You have already submitted a proposal for this job.'
                    : 'Craft a compelling proposal to win this job.'}
                </p>

                {existingProposal ? (
                  <div className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Your Bid</p>
                        <p className="text-xl font-bold text-gray-900 dark:text-white">
                          {formatCurrency(existingProposal.proposed_price)}
                        </p>
                      </div>
                      <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                          Delivery Time
                        </p>
                        <p className="text-xl font-bold text-gray-900 dark:text-white">
                          {existingProposal.delivery_days} days
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Status:</span>
                      <Badge
                        variant={
                          existingProposal.status === 'accepted'
                            ? 'success'
                            : existingProposal.status === 'rejected'
                            ? 'destructive'
                            : 'warning'
                        }
                        className="capitalize"
                      >
                        {existingProposal.status ?? 'pending'}
                      </Badge>
                    </div>
                    <p
                      className="text-xs text-gray-500 dark:text-gray-400"
                      suppressHydrationWarning
                    >
                      Submitted{' '}
                      {existingProposal.created_at
                        ? formatRelativeTime(existingProposal.created_at)
                        : ''}
                    </p>
                    <Link href="/freelancer/proposals">
                      <Button variant="outline" className="w-full">
                        View All My Proposals
                      </Button>
                    </Link>
                  </div>
                ) : (
                  // Client form — calls POST /api/proposals (no server action)
                  <ProposalSubmitForm jobId={id} />
                )}
              </Card>
            )}

            {/* Client viewing their own job */}
            {isJobOwner && (
              <Card className="p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <p className="text-blue-800 dark:text-blue-200 font-medium mb-3">
                  This is your job posting.
                </p>
                <Link href={`/client/jobs/${job.id}`}>
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                    Manage This Job &amp; View Proposals
                  </Button>
                </Link>
              </Card>
            )}
          </div>

          {/* ── Right: client info + meta ── */}
          <div className="space-y-6">
            <Card className="p-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                About the Client
              </h3>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center text-lg font-bold shrink-0">
                  {job.client?.full_name?.charAt(0)?.toUpperCase() ?? 'C'}
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {job.client?.full_name ?? 'Client'}
                  </p>
                  {job.client?.location && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {job.client.location}
                    </p>
                  )}
                </div>
              </div>
              <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                {job.client?.client_rating != null && (
                  <div className="flex justify-between">
                    <span>Rating</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      ⭐ {Number(job.client.client_rating).toFixed(1)}
                    </span>
                  </div>
                )}
                {job.client?.identity_verified && (
                  <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                    <CheckCircle className="w-4 h-4" />
                    <span>Identity Verified</span>
                  </div>
                )}
              </div>
            </Card>

            <Card className="p-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Job Overview</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Budget</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {budgetDisplay()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Budget Type</span>
                  <span className="font-medium text-gray-900 dark:text-white capitalize">
                    {job.budget_type ?? 'fixed'}
                  </span>
                </div>
                {job.experience_level && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Level</span>
                    <span className="font-medium text-gray-900 dark:text-white capitalize">
                      {job.experience_level}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Proposals</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {job.proposals_count ?? 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Posted</span>
                  <span
                    className="font-medium text-gray-900 dark:text-white"
                    suppressHydrationWarning
                  >
                    {job.created_at ? formatRelativeTime(job.created_at) : '—'}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}