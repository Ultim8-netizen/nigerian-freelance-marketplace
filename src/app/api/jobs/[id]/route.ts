// src/app/api/jobs/[id]/route.ts
// PRODUCTION-READY: Individual job operations with comprehensive security

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOwnership } from '@/lib/api/middleware';
import { checkRateLimit } from '@/lib/rate-limit-upstash';
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

    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitResult = await checkRateLimit('api', ip);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { success: false, error: 'Too many requests', resetAt: rateLimitResult.reset },
        { status: 429 }
      );
    }

    const supabase = createClient();

    const { data: job, error } = await supabase
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

    if (error || !job) {
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
    // 1. Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    // 2. Validate job ID
    const jobId = sanitizeUuid(params.id);
    if (!jobId) {
      return NextResponse.json(
        { success: false, error: 'Invalid job ID' },
        { status: 400 }
      );
    }

    // 3. Ownership verification
    const ownershipResult = await requireOwnership(
      request,
      'jobs',
      jobId,
      'client_id'
    );
    if (ownershipResult instanceof NextResponse) return ownershipResult;

    // 4. Rate limiting
    const rateLimitResult = await checkRateLimit('api', user.id);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { success: false, error: 'Too many requests', resetAt: rateLimitResult.reset },
        { status: 429 }
      );
    }

    // 5. Parse and sanitize updates
    const body = await request.json();
    
    const sanitizedBody = {
      ...body,
      title: body.title ? sanitizeText(body.title) : undefined,
      description: body.description ? sanitizeHtml(body.description) : undefined,
      category: body.category ? sanitizeText(body.category) : undefined,
      skills_required: body.skills_required?.map((skill: string) => sanitizeText(skill)) || undefined,
    };

    // 6. Validate with partial schema
    const validatedData = jobSchema.partial().parse(sanitizedBody);

    const supabase = createClient();

    // 7. Check if job can be updated (no accepted proposals yet)
    const { data: jobStatus } = await supabase
      .from('jobs')
      .select('status')
      .eq('id', jobId)
      .single();

    if (jobStatus?.status === 'in_progress' || jobStatus?.status === 'completed') {
      return NextResponse.json(
        { success: false, error: 'Cannot update job that is in progress or completed' },
        { status: 400 }
      );
    }

    // 8. Update job
    const { data: updatedJob, error } = await supabase
      .from('jobs')
      .update({
        ...validatedData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)
      .select()
      .single();

    if (error) {
      logger.error('Job update failed', error, { jobId, userId: user.id });
      throw error;
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
    // 1. Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    // 2. Validate job ID
    const jobId = sanitizeUuid(params.id);
    if (!jobId) {
      return NextResponse.json(
        { success: false, error: 'Invalid job ID' },
        { status: 400 }
      );
    }

    // 3. Rate limiting
    const rateLimitResult = await checkRateLimit('api', user.id);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { success: false, error: 'Too many requests', resetAt: rateLimitResult.reset },
        { status: 429 }
      );
    }

    const supabase = createClient();

    // 4. Verify ownership and status
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

    // 5. Can't delete if already in progress
    if (job.status === 'in_progress' || job.status === 'completed') {
      return NextResponse.json(
        { success: false, error: 'Cannot delete job that is in progress or completed' },
        { status: 400 }
      );
    }

    // 6. Update to cancelled instead of hard delete
    await supabase
      .from('jobs')
      .update({ 
        status: 'cancelled',
        updated_at: new Date().toISOString() 
      })
      .eq('id', jobId);

    // 7. Notify freelancers who submitted proposals
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