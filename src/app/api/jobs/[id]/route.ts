// src/app/api/jobs/[id]/route.ts
// PRODUCTION-READY: Individual job operations with comprehensive security

import { NextRequest, NextResponse } from 'next/server';
import { applyMiddleware } from '@/lib/api/enhanced-middleware';
import { createClient } from '@/lib/supabase/server';
import { jobSchema } from '@/lib/validations';
import { sanitizeHtml, sanitizeText, sanitizeUuid } from '@/lib/security/sanitize';
import { logger } from '@/lib/logger';
import { z } from 'zod';

// GET - Get job details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const jobId = sanitizeUuid(params.id);
    if (!jobId) {
      return NextResponse.json(
        { success: false, error: 'Invalid job ID' },
        { status: 400 }
      );
    }

    // Rate limiting for public endpoint
    const { error } = await applyMiddleware(request, {
      auth: 'optional',
      rateLimit: 'api',
    });

    if (error) return error;

    const supabase = createClient();

    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select(`
        *,
        client:profiles!jobs_client_id_fkey(
          id,
          full_name,
          profile_image_url,
          client_rating,
          total_jobs_posted,
          identity_verified,
          created_at
        ),
        proposals(
          id,
          freelancer_id,
          proposed_price,
          delivery_days,
          status,
          created_at,
          freelancer:profiles!proposals_freelancer_id_fkey(
            id,
            full_name,
            profile_image_url,
            freelancer_rating,
            total_jobs_completed,
            identity_verified
          )
        )
      `)
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      logger.warn('Job not found', { jobId });
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: 404 }
      );
    }

    // Increment view count
    supabase
      .from('jobs')
      .update({ views_count: job.views_count + 1 })
      .eq('id', jobId)
      .then();

    logger.info('Job viewed', { jobId, viewCount: job.views_count + 1 });

    return NextResponse.json({
      success: true,
      data: job,
    });
  } catch (error) {
    logger.error('Job fetch error', error as Error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch job' },
      { status: 500 }
    );
  }
}

// PATCH - Update job (owner only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await applyMiddleware(request, {
      auth: 'required',
      rateLimit: 'api',
    });

    if (error) return error;

    const jobId = sanitizeUuid(params.id);
    if (!jobId) {
      return NextResponse.json(
        { success: false, error: 'Invalid job ID' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Verify ownership
    const { data: job } = await supabase
      .from('jobs')
      .select('client_id, status')
      .eq('id', jobId)
      .single();

    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: 404 }
      );
    }

    if (job.client_id !== user.id) {
      logger.warn('Unauthorized job update attempt', { jobId, userId: user.id });
      return NextResponse.json(
        { success: false, error: 'You can only update your own jobs' },
        { status: 403 }
      );
    }

    if (job.status === 'in_progress' || job.status === 'completed') {
      return NextResponse.json(
        { success: false, error: 'Cannot update job that is in progress or completed' },
        { status: 400 }
      );
    }

    const body = await request.json();
    
    const sanitizedBody = {
      ...body,
      title: body.title ? sanitizeText(body.title) : undefined,
      description: body.description ? sanitizeHtml(body.description) : undefined,
      category: body.category ? sanitizeText(body.category) : undefined,
      skills_required: body.skills_required?.map((skill: string) => sanitizeText(skill)) || undefined,
    };

    const validatedData = jobSchema.partial().parse(sanitizedBody);

    const { data: updatedJob, error: updateError } = await supabase
      .from('jobs')
      .update({
        ...validatedData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)
      .select()
      .single();

    if (updateError) {
      logger.error('Job update failed', updateError, { jobId, userId: user.id });
      throw updateError;
    }

    logger.info('Job updated', { jobId, userId: user.id });

    return NextResponse.json({
      success: true,
      data: updatedJob,
      message: 'Job updated successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0]?.message || 'Validation failed' },
        { status: 400 }
      );
    }

    logger.error('Job update error', error as Error);
    return NextResponse.json(
      { success: false, error: 'Failed to update job' },
      { status: 500 }
    );
  }
}

// DELETE - Close/cancel job (owner only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await applyMiddleware(request, {
      auth: 'required',
      rateLimit: 'api',
    });

    if (error) return error;

    const jobId = sanitizeUuid(params.id);
    if (!jobId) {
      return NextResponse.json(
        { success: false, error: 'Invalid job ID' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    const { data: job } = await supabase
      .from('jobs')
      .select('client_id, status, proposals_count')
      .eq('id', jobId)
      .single();

    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: 404 }
      );
    }

    if (job.client_id !== user.id) {
      logger.warn('Unauthorized job deletion attempt', { jobId, userId: user.id });
      return NextResponse.json(
        { success: false, error: 'You can only delete your own jobs' },
        { status: 403 }
      );
    }

    if (job.status === 'in_progress' || job.status === 'completed') {
      return NextResponse.json(
        { success: false, error: 'Cannot delete job that is in progress or completed' },
        { status: 400 }
      );
    }

    await supabase
      .from('jobs')
      .update({ 
        status: 'cancelled',
        updated_at: new Date().toISOString() 
      })
      .eq('id', jobId);

    // Notify freelancers who submitted proposals
    if (job.proposals_count > 0) {
      const { data: proposals } = await supabase
        .from('proposals')
        .select('freelancer_id')
        .eq('job_id', jobId)
        .eq('status', 'pending');

      if (proposals) {
        const notifications = proposals.map(p => ({
          user_id: p.freelancer_id,
          type: 'job_cancelled',
          title: 'Job Cancelled',
          message: 'A job you applied to has been cancelled by the client',
          link: `/jobs/${jobId}`,
        }));

        await supabase.from('notifications').insert(notifications);
      }
    }

    logger.info('Job cancelled', { jobId, userId: user.id });

    return NextResponse.json({
      success: true,
      message: 'Job cancelled successfully',
    });
  } catch (error) {
    logger.error('Job deletion error', error as Error);
    return NextResponse.json(
      { success: false, error: 'Failed to cancel job' },
      { status: 500 }
    );
  }
}