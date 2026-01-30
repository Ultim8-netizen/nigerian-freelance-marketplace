// src/app/api/proposals/route.ts
// PRODUCTION-READY: Secure proposal submission with comprehensive checks

import { NextRequest, NextResponse } from 'next/server';
import { applyMiddleware } from '@/lib/api/enhanced-middleware';
import { createClient } from '@/lib/supabase/server';
import { proposalSchema } from '@/lib/validations';
import { sanitizeHtml, sanitizeUuid, sanitizeUrl } from '@/lib/security/sanitize';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import type { ProposalInsert, NotificationInsert } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await applyMiddleware(request, {
      auth: 'required',
      roles: ['freelancer', 'both'],
      rateLimit: 'submitProposal',
    });

    if (error) return error;
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    
    const sanitizedBody = {
      ...body,
      job_id: sanitizeUuid(body.job_id) || '',
      cover_letter: sanitizeHtml(body.cover_letter || ''),
      portfolio_links: body.portfolio_links?.map((link: string) => sanitizeUrl(link)).filter(Boolean) || [],
    };

    const validatedData = proposalSchema.parse(sanitizedBody);

    const supabase = await createClient();

    // Check if job exists and is open
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

    // TypeScript now correctly infers the type
    if (job.status !== 'open') {
      return NextResponse.json(
        { success: false, error: 'Job is no longer accepting proposals' },
        { status: 400 }
      );
    }

    // Prevent applying to own jobs
    if (job.client_id === user.id) {
      logger.warn('User attempted to apply to own job', { userId: user.id, jobId: validatedData.job_id });
      return NextResponse.json(
        { success: false, error: 'You cannot apply to your own job' },
        { status: 400 }
      );
    }

    // Check for duplicate proposals
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

    // Create proposal with proper typing
    const proposalData: ProposalInsert = {
      freelancer_id: user.id,
      job_id: validatedData.job_id,
      cover_letter: validatedData.cover_letter,
      proposed_price: validatedData.proposed_price,
      delivery_days: validatedData.delivery_days,
      portfolio_items: validatedData.portfolio_links,
      status: 'pending',
    };

    const { data, error: proposalError } = await supabase
      .from('proposals')
      .insert(proposalData)
      .select()
      .single();

    if (proposalError) {
      logger.error('Proposal creation failed', { 
        error: proposalError.message,
        code: proposalError.code,
        userId: user.id 
      });
      throw proposalError;
    }

    // Increment proposals count
    const { error: rpcError } = await supabase.rpc('increment_proposals_count', { 
      p_job_id: validatedData.job_id 
    });

    if (rpcError) {
      logger.warn('Failed to increment proposal count', { 
        error: rpcError.message,
        code: rpcError.code
      });
      // Don't fail the whole operation if this fails
    }

    // Notify client with proper typing
    const notificationData: NotificationInsert = {
      user_id: job.client_id,
      type: 'new_proposal',
      title: 'New Proposal Received',
      message: 'You received a new proposal for your job posting',
      link: `/client/jobs/${validatedData.job_id}`,
    };

    const { error: notifError } = await supabase
      .from('notifications')
      .insert(notificationData);

    if (notifError) {
      logger.warn('Failed to send notification', { 
        error: notifError.message,
        code: notifError.code
      });
      // Don't fail the whole operation if notification fails
    }

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
      logger.warn('Proposal validation failed', { errors: error.issues });
      return NextResponse.json(
        { 
          success: false, 
          error: error.issues[0]?.message || 'Validation failed',
          details: error.issues 
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