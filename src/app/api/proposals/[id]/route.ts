// src/app/api/proposals/[id]/route.ts
// Proposal lifecycle: GET detail, PATCH accept|reject (client) or withdraw (freelancer).
//
// NOTE: accept is two sequential writes (proposal → accepted, job → in_progress).
// Without a Supabase RPC transaction both must succeed; if the job update fails
// after the proposal accept we log a CRITICAL error and surface a 500 — the
// client will retry and the proposal is already accepted, so the next accept
// attempt short-circuits on the status !== 'pending' guard. This is a known
// limitation to be resolved by adding an atomic accept_proposal() RPC.

import { NextRequest, NextResponse } from 'next/server';
import { applyMiddleware } from '@/lib/api/enhanced-middleware';
import { createClient } from '@/lib/supabase/server';
import { sanitizeUuid } from '@/lib/security/sanitize';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const patchSchema = z.object({
  action: z.enum(['accept', 'reject', 'withdraw']),
});

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;

    const { user, error: authError } = await applyMiddleware(request, {
      auth: 'required',
      rateLimit: 'api',
    });
    if (authError) return authError;
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const proposalId = sanitizeUuid(id);
    if (!proposalId) {
      return NextResponse.json(
        { success: false, error: 'Invalid proposal ID' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data: proposal, error } = await supabase
      .from('proposals')
      .select(`
        *,
        job:jobs!proposals_job_id_fkey(
          id, title, status, client_id, budget_min, budget_max, budget_type
        ),
        freelancer:profiles!proposals_freelancer_id_fkey(
          id, full_name, profile_image_url, freelancer_rating, total_jobs_completed
        )
      `)
      .eq('id', proposalId)
      .single();

    if (error || !proposal) {
      return NextResponse.json(
        { success: false, error: 'Proposal not found' },
        { status: 404 }
      );
    }

    // Only the submitting freelancer or the job's client may read this proposal
    const isFreelancer = proposal.freelancer_id === user.id;
    const isJobClient =
      proposal.job && 'client_id' in proposal.job
        ? (proposal.job as { client_id: string }).client_id === user.id
        : false;

    if (!isFreelancer && !isJobClient) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json({ success: true, data: proposal });
  } catch (err) {
    logger.error('Proposal GET error', err as Error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch proposal' },
      { status: 500 }
    );
  }
}

// ─── PATCH ────────────────────────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;

    const { user, error: authError } = await applyMiddleware(request, {
      auth: 'required',
      rateLimit: 'api',
    });
    if (authError) return authError;
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const proposalId = sanitizeUuid(id);
    if (!proposalId) {
      return NextResponse.json(
        { success: false, error: 'Invalid proposal ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { action } = patchSchema.parse(body);

    const supabase = await createClient();

    // Fetch proposal
    const { data: proposal, error: fetchErr } = await supabase
      .from('proposals')
      .select('id, freelancer_id, job_id, status, proposed_price, delivery_days')
      .eq('id', proposalId)
      .single();

    if (fetchErr || !proposal) {
      return NextResponse.json(
        { success: false, error: 'Proposal not found' },
        { status: 404 }
      );
    }

    if (proposal.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: `Cannot act on a proposal that is already ${proposal.status}` },
        { status: 400 }
      );
    }

    // Fetch associated job (proposals_count included for withdraw decrement)
    const { data: job, error: jobErr } = await supabase
      .from('jobs')
      .select('id, client_id, status, title, proposals_count')
      .eq('id', proposal.job_id)
      .single();

    if (jobErr || !job) {
      return NextResponse.json(
        { success: false, error: 'Associated job not found' },
        { status: 404 }
      );
    }

    // ── WITHDRAW ─────────────────────────────────────────────────────────────
    if (action === 'withdraw') {
      if (proposal.freelancer_id !== user.id) {
        return NextResponse.json(
          { success: false, error: 'You can only withdraw your own proposals' },
          { status: 403 }
        );
      }

      if (job.status !== 'open') {
        return NextResponse.json(
          { success: false, error: 'Cannot withdraw from a job that is no longer open' },
          { status: 400 }
        );
      }

      const { error: withdrawErr } = await supabase
        .from('proposals')
        .update({ status: 'withdrawn', updated_at: new Date().toISOString() })
        .eq('id', proposalId);

      if (withdrawErr) throw withdrawErr;

      // Decrement proposals_count on the job (best-effort, floored at 0).
      // No decrement RPC exists in database.types.ts (only
      // increment_proposals_count, which has no amount param), so this is
      // a direct table update using the nullable-numeric `?? 0` pattern.
      const currentCount = job.proposals_count ?? 0;
      const { error: decrementErr } = await supabase
        .from('jobs')
        .update({ proposals_count: Math.max(0, currentCount - 1) })
        .eq('id', proposal.job_id);

      if (decrementErr) {
        logger.warn('Failed to decrement jobs.proposals_count', {
          error: decrementErr.message,
          jobId: proposal.job_id,
        });
      }

      logger.info('Proposal withdrawn', { proposalId, userId: user.id });
      return NextResponse.json({ success: true, message: 'Proposal withdrawn successfully' });
    }

    // ── ACCEPT / REJECT — client only ────────────────────────────────────────
    if (job.client_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Only the job owner can accept or reject proposals' },
        { status: 403 }
      );
    }

    if (job.status !== 'open') {
      return NextResponse.json(
        { success: false, error: 'Job is no longer accepting proposal actions' },
        { status: 400 }
      );
    }

    // ── REJECT ───────────────────────────────────────────────────────────────
    if (action === 'reject') {
      const { error: rejectErr } = await supabase
        .from('proposals')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', proposalId);

      if (rejectErr) throw rejectErr;

      void supabase.from('notifications').insert({
        user_id: proposal.freelancer_id,
        type: 'proposal_rejected',
        title: 'Proposal Not Selected',
        message: `Your proposal for "${job.title}" was not selected by the client.`,
        link: `/jobs/${proposal.job_id}`,
      });

      logger.info('Proposal rejected', { proposalId, jobId: proposal.job_id, clientId: user.id });
      return NextResponse.json({ success: true, message: 'Proposal rejected' });
    }

    // ── ACCEPT ───────────────────────────────────────────────────────────────
    // Step 1 (critical): mark proposal accepted
    const { error: acceptErr } = await supabase
      .from('proposals')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', proposalId);

    if (acceptErr) {
      logger.error('Failed to accept proposal', acceptErr, { proposalId });
      throw acceptErr;
    }

    // Step 2 (critical): move job to in_progress
    const { error: jobUpdateErr } = await supabase
      .from('jobs')
      .update({ status: 'in_progress', updated_at: new Date().toISOString() })
      .eq('id', proposal.job_id);

    if (jobUpdateErr) {
      // CRITICAL: proposal is accepted but job is still open. Log for manual remediation.
      logger.error('CRITICAL: job status update failed after proposal accept', jobUpdateErr, {
        proposalId,
        jobId: proposal.job_id,
      });
      throw jobUpdateErr;
    }

    // Step 3 (best-effort): bulk-reject all other pending proposals
    const { data: others, error: fetchOthersErr } = await supabase
      .from('proposals')
      .select('id, freelancer_id')
      .eq('job_id', proposal.job_id)
      .eq('status', 'pending')
      .neq('id', proposalId);

    if (fetchOthersErr) {
      logger.warn('Failed to fetch sibling proposals for bulk rejection', {
        error: fetchOthersErr.message,
        jobId: proposal.job_id,
      });
    } else if (others && others.length > 0) {
      const { error: bulkErr } = await supabase
        .from('proposals')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .in('id', others.map((p) => p.id));

      if (bulkErr) {
        logger.warn('Bulk proposal rejection partial failure', {
          error: bulkErr.message,
          jobId: proposal.job_id,
        });
      }

      // Notify rejected freelancers (fire-and-forget)
      void supabase.from('notifications').insert(
        others.map((p) => ({
          user_id: p.freelancer_id,
          type: 'proposal_rejected',
          title: 'Proposal Not Selected',
          message: `Another freelancer was selected for "${job.title}". Keep applying!`,
          link: `/jobs/${proposal.job_id}`,
        }))
      );
    }

    // Step 4 (best-effort): notify the hired freelancer
    void supabase.from('notifications').insert({
      user_id: proposal.freelancer_id,
      type: 'proposal_accepted',
      title: '🎉 Proposal Accepted!',
      message: `Your proposal for "${job.title}" was accepted. Reach out to the client to begin.`,
      link: `/jobs/${proposal.job_id}`,
    });

    logger.info('Proposal accepted — job now in_progress', {
      proposalId,
      jobId: proposal.job_id,
      clientId: user.id,
      freelancerId: proposal.freelancer_id,
    });

    return NextResponse.json({
      success: true,
      message: 'Proposal accepted. Job is now in progress.',
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Must be accept, reject, or withdraw.' },
        { status: 400 }
      );
    }
    logger.error('Proposal PATCH error', err as Error);
    return NextResponse.json(
      { success: false, error: 'Failed to update proposal' },
      { status: 500 }
    );
  }
}