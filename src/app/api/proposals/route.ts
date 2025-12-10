// src/app/api/proposals/route.ts
// PRODUCTION-READY: Secure proposal submission with comprehensive checks

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/api/middleware';
import { checkRateLimit } from '@/lib/rate-limit-upstash';
import { createClient } from '@/lib/supabase/server';
import { proposalSchema } from '@/lib/validations';
import { sanitizeText, sanitizeHtml, sanitizeUuid, sanitizeUrl } from '@/lib/security/sanitize';
import { logger } from '@/lib/logger';
import { z } from 'zod';

export async function POST(request: NextRequest) {
  try {
    // 1. Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    // 2. Role verification - only freelancers
    const roleResult = await requireRole(request, ['freelancer', 'both']);
    if (roleResult instanceof NextResponse) return roleResult;

    // 3. Rate limiting (20 proposals per day)
    const rateLimitResult = await checkRateLimit('submitProposal', user.id);
    if (!rateLimitResult.success) {
      logger.warn('Rate limit exceeded for proposals', { userId: user.id });
      return NextResponse.json(
        { 
          success: false, 
          error: 'Maximum daily proposals reached (20). Please try tomorrow.',
          resetAt: rateLimitResult.reset 
        },
        { status: 429 }
      );
    }

    // 4. Parse and sanitize request
    const body = await request.json();
    
    const sanitizedBody = {
      ...body,
      job_id: sanitizeUuid(body.job_id) || '',
      cover_letter: sanitizeHtml(body.cover_letter || ''),
      portfolio_links: body.portfolio_links?.map((link: string) => sanitizeUrl(link)).filter(Boolean) || [],
    };

    // 5. Validate with Zod
    const validatedData = proposalSchema.parse(sanitizedBody);

    const supabase = createClient();

    // 6. Check if job exists and is open
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, status, client_id')
      .eq('id', validatedData.job_id)
      .single();

    if (jobError || !job) {
      logger.warn('Invalid job ID in proposal', { jobId: validatedData.job_id });
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: 404 }
      );
    }

    if (job.status !== 'open') {
      return NextResponse.json(
        { success: false, error: 'Job is no longer accepting proposals' },
        { status: 400 }
      );
    }

    // 7. Prevent applying to own jobs
    if (job.client_id === user.id) {
      logger.warn('User attempted to apply to own job', { userId: user.id, jobId: validatedData.job_id });
      return NextResponse.json(
        { success: false, error: 'You cannot apply to your own job' },
        { status: 400 }
      );
    }

    // 8. Check for duplicate proposals
    const { data: existing } = await supabase
      .from('proposals')
      .select('id')
      .eq('job_id', validatedData.job_id)
      .eq('freelancer_id', user.id)
      .single();

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'You have already submitted a proposal for this job' },
        { status: 409 }
      );
    }

    // 9. Create proposal
    const { data, error } = await supabase
      .from('proposals')
      .insert({
        freelancer_id: user.id,
        job_id: validatedData.job_id,
        cover_letter: validatedData.cover_letter,
        proposed_price: validatedData.proposed_price,
        delivery_days: validatedData.delivery_days,
        portfolio_links: validatedData.portfolio_links,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      logger.error('Proposal creation failed', error, { userId: user.id });
      throw error;
    }

    // 10. Increment proposals count
    await supabase.rpc('increment_proposals_count', { job_id: validatedData.job_id });

    // 11. Notify client
    await supabase.from('notifications').insert({
      user_id: job.client_id,
      type: 'new_proposal',
      title: 'New Proposal Received',
      message: 'You received a new proposal for your job posting',
      link: `/client/jobs/${validatedData.job_id}`,
    });

    logger.info('Proposal submitted successfully', {
      proposalId: data.id,
      userId: user.id,
      jobId: validatedData.job_id
    });

    return NextResponse.json({
      success: true,
      data,
      message: 'Proposal submitted successfully',
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Proposal validation failed', undefined, { errors: error.errors });
      return NextResponse.json(
        { 
          success: false, 
          error: error.errors[0]?.message || 'Validation failed',
          details: error.errors 
        },
        { status: 400 }
      );
    }

    logger.error('Proposal submission error', error as Error);
    return NextResponse.json(
      { success: false, error: 'Failed to submit proposal' },
      { status: 500 }
    );
  }
}