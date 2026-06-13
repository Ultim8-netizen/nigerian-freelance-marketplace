// src/app/api/proposals/[id]/route.ts
// Proposal lifecycle: GET (full details), PATCH (accept | reject | withdraw)
//
// PATCH transitions:
//   accept   — client only; pending → accepted; job → in_progress;
//              all other pending proposals → rejected; notifications sent.
//   reject   — client only; pending → rejected; freelancer notified.
//   withdraw — freelancer only; pending → withdrawn; proposals_count
//              decremented via RPC (fire-and-forget); client notified.

import { NextRequest, NextResponse } from 'next/server';
import { applyMiddleware } from '@/lib/api/enhanced-middleware';
import { createClient } from '@/lib/supabase/server';
import { sanitizeUuid } from '@/lib/security/sanitize';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const patchSchema = z.object({
  action: z.enum(['accept', 'reject', 'withdraw']),
});

// GET — full proposal with freelancer profile + job summary
// Accessible by the job's client OR the proposal's freelancer.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const { user, error } = await applyMiddleware(request, {
      auth: 'required',
      rateLimit: 'api',
    });
    if (error) return error;
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const proposalId = sanitizeUuid(id);
    if (!proposalId) {
      return NextResponse.json({ success: false, error: 'Invalid proposal ID' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: proposal, error: fetchError } = await supabase
      .from('proposals')
      .select(`
        *,
        job:jobs!proposals_job_id_fkey(
          id, title, budget_min, budget_max, budget_type, status, client_id
        ),
        freelancer:profiles!proposals_freelancer_id_fkey(
          id, full_name, profile_image_url, bio,
          freelancer_rating, total_jobs_completed, identity_verified
        )
      `)
      .eq('id', proposalId)
      .single();

    if (fetchError || !proposal) {
      return NextResponse.json({ success: false, error: 'Proposal not found' }, { status: 404 });
    }

    const job = proposal.job as { client_id: string } | null;
    const isJobClient = job?.client_id === user.id;
    const isProposalOwner = proposal.freelancer_id === user.id;

    if (!isJobClient && !isProposalOwner) {
      logger.warn('Unauthorized proposal access attempt', { proposalId, userId: user.id });
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json({ success: true, data: proposal });
  } catch (err) {
    logger.error('Proposal GET error', err as Error);
    return NextResponse.json({ success: false, error: 'Failed to fetch proposal' }, { status: 500 });
  }
}

// PATCH — status transition
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const { user, error } = await applyMiddleware(request, {
      auth: 'required',
      rateLimit: 'api',
    });
    if (error) return error;
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const proposalId = sanitizeUuid(id);
    if (!proposalId) {
      return NextResponse.json({ success: false, error: 'Invalid proposal ID' }, { status: 400 });
    }

    const body = await request.json();
    const { action } = patchSchema.parse(body);

    const supabase = await createClient();

    // Fetch proposal + job for ownership/state validation in one round-trip
    const { data: proposal, error: fetchError } = await supabase
      .from('proposals')
      .select(`
        id, freelancer_id, status, job_id,
        job:jobs!proposals_job_id_fkey(
          id, client_id, status, title
        )
      `)
      .eq('id', proposalId)
      .single();

    if (fetchError || !proposal) {
      return NextResponse.json({ success: false, error: 'Proposal not found' }, { status: 404 });
    }

    // Type narrowing for the nested job object
    type JobRef = { id: string; client_id: string; status: string; title: string };
    const job = proposal.job as JobRef | null;

    if (!job) {
      return NextResponse.json({ success: false, error: 'Associated job not found' }, { status: 404 });
    }

    // ── accept / reject — client only ──────────────────────────────────────
    if (action === 'accept' || action === 'reject') {
      if (job.client_id !== user.id) {
        logger.warn('Non-client tried to accept/reject proposal', { proposalId, userId: user.id });
        return NextResponse.json(
          { success: false, error: 'Only the job client can accept or reject proposals' },
          { status: 403 }
        );
      }

      if (job.status !== 'open') {
        return NextResponse.json(
          { success: false, error: 'Job is no longer open for proposal changes' },
          { status: 400 }
        );
      }

      if (proposal.status !== 'pending') {
        return NextResponse.json(
          {
            success: false,
            error: `Cannot ${action} a proposal that is already ${proposal.status}`,
          },
          { status: 400 }
        );
      }

      if (action === 'accept') {
        // 1. Accept this proposal
        const { error: acceptError } = await supabase
          .from('proposals')
          .update({ status: 'accepted', updated_at: new Date().toISOString() })
          .eq('id', proposalId);

        if (acceptError) {
          logger.error('Failed to accept proposal', acceptError, { proposalId });
          throw acceptError;
        }

        // 2. Advance job to in_progress
        const { error: jobError } = await supabase
          .from('jobs')
          .update({ status: 'in_progress', updated_at: new Date().toISOString() })
          .eq('id', job.id);

        if (jobError) {
          // Proposal is already accepted; log and continue — admin can reconcile
          logger.error('Proposal accepted but job status update failed', jobError, {
            proposalId,
            jobId: job.id,
          });
        }

        // 3. Bulk-reject all remaining pending proposals for this job
        const { data: otherProposals } = await supabase
          .from('proposals')
          .select('id, freelancer_id')
          .eq('job_id', job.id)
          .eq('status', 'pending')
          .neq('id', proposalId);

        if (otherProposals && otherProposals.length > 0) {
          void supabase
            .from('proposals')
            .update({ status: 'rejected', updated_at: new Date().toISOString() })
            .eq('job_id', job.id)
            .eq('status', 'pending')
            .neq('id', proposalId);

          // Notify all rejected freelancers (fire-and-forget)
          void supabase.from('notifications').insert(
            otherProposals.map((p: { freelancer_id: string }) => ({
              user_id: p.freelancer_id,
              type: 'proposal_rejected',
              title: 'Proposal Not Selected',
              message: `The client has selected another freelancer for "${job.title}".`,
              link: `/jobs/${job.id}`,
            }))
          );
        }

        // 4. Notify the accepted freelancer
        void supabase.from('notifications').insert({
          user_id: proposal.freelancer_id,
          type: 'proposal_accepted',
          title: '🎉 Proposal Accepted!',
          message: `Your proposal for "${job.title}" was accepted. Get ready to deliver!`,
          link: `/freelancer/proposals`,
        });

        logger.info('Proposal accepted', { proposalId, jobId: job.id, userId: user.id });

        return NextResponse.json({
          success: true,
          message: 'Proposal accepted. Job is now in progress.',
        });
      }

      // action === 'reject'
      const { error: rejectError } = await supabase
        .from('proposals')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', proposalId);

      if (rejectError) throw rejectError;

      void supabase.from('notifications').insert({
        user_id: proposal.freelancer_id,
        type: 'proposal_rejected',
        title: 'Proposal Not Selected',
        message: `Your proposal for "${job.title}" was not selected by the client.`,
        link: `/jobs/${job.id}`,
      });

      logger.info('Proposal rejected', { proposalId, jobId: job.id, userId: user.id });

      return NextResponse.json({ success: true, message: 'Proposal rejected.' });
    }

    // ── withdraw — freelancer only ────────────────────────────────────────
    if (action === 'withdraw') {
      if (proposal.freelancer_id !== user.id) {
        return NextResponse.json(
          { success: false, error: 'You can only withdraw your own proposals' },
          { status: 403 }
        );
      }

      if (proposal.status !== 'pending') {
        return NextResponse.json(
          { success: false, error: `Cannot withdraw a proposal that is ${proposal.status}` },
          { status: 400 }
        );
      }

      const { error: withdrawError } = await supabase
        .from('proposals')
        .update({ status: 'withdrawn', updated_at: new Date().toISOString() })
        .eq('id', proposalId);

      if (withdrawError) throw withdrawError;

      // Decrement proposals_count — same pattern as increment in proposals POST
      void supabase.rpc('decrement_proposals_count', { p_job_id: proposal.job_id });

      void supabase.from('notifications').insert({
        user_id: job.client_id,
        type: 'proposal_withdrawn',
        title: 'Proposal Withdrawn',
        message: `A freelancer has withdrawn their proposal for "${job.title}".`,
        link: `/client/jobs/${job.id}`,
      });

      logger.info('Proposal withdrawn', { proposalId, jobId: proposal.job_id, userId: user.id });

      return NextResponse.json({ success: true, message: 'Proposal withdrawn.' });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: err.issues[0]?.message || 'Validation failed' },
        { status: 400 }
      );
    }
    logger.error('Proposal PATCH error', err as Error);
    return NextResponse.json({ success: false, error: 'Failed to update proposal' }, { status: 500 });
  }
}