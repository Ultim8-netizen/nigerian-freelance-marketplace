// src/app/jobs/[id]/page.tsx
// NEW FILE: Job detail page.
// This page: shows job details, handles proposal submission via server action.
// Auth: redirects to login if not authenticated.

import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatRelativeTime } from '@/lib/utils';
import Link from 'next/link';
import {
  MapPin,
  Clock,
  DollarSign,
  Users,
  Briefcase,
  CheckCircle,
  ArrowLeft,
  Send,
} from 'lucide-react';

// Server action for proposal submission
async function submitProposal(jobId: string, formData: FormData) {
  'use server';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const proposed_price = parseFloat(formData.get('proposed_price') as string);
  const delivery_days = parseInt(formData.get('delivery_days') as string, 10);
  const cover_letter = (formData.get('cover_letter') as string)?.trim();

  if (!proposed_price || !delivery_days || !cover_letter) {
    // In production, return proper error state. For now, redirect back.
    redirect(`/jobs/${jobId}?error=missing_fields`);
  }

  const { error } = await supabase.from('proposals').insert({
    job_id: jobId,
    freelancer_id: user.id,
    proposed_price,
    delivery_days,
    cover_letter,
    status: 'pending',
  });

  if (error) {
    console.error('Proposal submission error:', error);
    redirect(`/jobs/${jobId}?error=submission_failed`);
  }

  revalidatePath(`/jobs/${jobId}`);
  redirect(`/jobs/${jobId}?success=proposal_submitted`);
}

export default async function JobDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string; success?: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=/jobs/${params.id}`);
  }

  // Fetch job with client profile
  const { data: job, error } = await supabase
    .from('jobs')
    .select(
      `
      *,
      client:profiles!jobs_client_id_fkey(
        id, full_name, location, client_rating, profile_image_url, created_at, identity_verified
      )
    `
    )
    .eq('id', params.id)
    .single();

  if (error || !job) {
    notFound();
  }

  // Check if user already submitted a proposal for this job
  const { data: existingProposal } = await supabase
    .from('proposals')
    .select('id, status, proposed_price, delivery_days, created_at')
    .eq('job_id', params.id)
    .eq('freelancer_id', user.id)
    .maybeSingle();

  // Check if current user is the job owner (clients shouldn't submit proposals)
  const isJobOwner = user.id === job.client_id;

  // Get user profile to check role
  const { data: profile } = await supabase
    .from('profiles')
    .select('user_type')
    .eq('id', user.id)
    .single();

  const isFreelancer =
    profile?.user_type === 'freelancer' || profile?.user_type === 'both';

  const submitProposalWithId = submitProposal.bind(null, params.id);

  const budgetDisplay = () => {
    if (job.budget_type === 'fixed' && job.budget_min) {
      return formatCurrency(job.budget_min);
    }
    if (job.budget_type === 'hourly' && job.budget_min) {
      return `${formatCurrency(job.budget_min)}/hr`;
    }
    if (job.budget_min && job.budget_max) {
      return `${formatCurrency(job.budget_min)} – ${formatCurrency(job.budget_max)}`;
    }
    return 'Negotiable';
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Back link */}
        <Link
          href="/freelancer/jobs"
          className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Job Listings
        </Link>

        {/* Feedback banners */}
        {searchParams.success === 'proposal_submitted' && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
            <p className="text-green-800 dark:text-green-200 font-medium">
              Proposal submitted successfully! The client will review it shortly.
            </p>
          </div>
        )}
        {searchParams.error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-800 dark:text-red-200 font-medium">
              {searchParams.error === 'missing_fields'
                ? 'Please fill in all required fields.'
                : 'Submission failed. Please try again.'}
            </p>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          {/* ── Left column: Job details ── */}
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

              {/* Key stats row */}
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

              {/* Required skills */}
              {job.required_skills && job.required_skills.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    Required Skills
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {job.required_skills.map((skill: string, i: number) => (
                      <Badge key={i} variant="outline">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            {/* ── Proposal form ── */}
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
                  /* Show submitted proposal details */
                  <div className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                          Your Bid
                        </p>
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
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Status:
                      </span>
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
                    <p className="text-xs text-gray-500 dark:text-gray-400" suppressHydrationWarning>
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
                  /* Proposal submission form */
                  <form action={submitProposalWithId} className="space-y-5">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label
                          htmlFor="proposed_price"
                          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
                        >
                          Your Bid (₦) *
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                            ₦
                          </span>
                          <input
                            type="number"
                            id="proposed_price"
                            name="proposed_price"
                            min="0"
                            step="100"
                            required
                            placeholder="0"
                            className="w-full pl-8 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor="delivery_days"
                          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
                        >
                          Delivery Time (days) *
                        </label>
                        <input
                          type="number"
                          id="delivery_days"
                          name="delivery_days"
                          min="1"
                          max="365"
                          required
                          placeholder="e.g. 7"
                          className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="cover_letter"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
                      >
                        Cover Letter *
                      </label>
                      <textarea
                        id="cover_letter"
                        name="cover_letter"
                        rows={6}
                        required
                        placeholder="Introduce yourself, explain your relevant experience, and why you're the best fit for this project..."
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Tip: Personalise your proposal to this specific job for better results.
                      </p>
                    </div>

                    <Button
                      type="submit"
                      className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Send className="w-4 h-4" />
                      Submit Proposal
                    </Button>
                  </form>
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
                    Manage This Job & View Proposals
                  </Button>
                </Link>
              </Card>
            )}
          </div>

          {/* ── Right column: Client info + meta ── */}
          <div className="space-y-6">
            {/* Client card */}
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

            {/* Job meta */}
            <Card className="p-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                Job Overview
              </h3>
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