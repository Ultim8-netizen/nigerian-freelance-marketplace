// ============================================================================
// src/app/api/proposals/route.ts
// Proposal submission with validation
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { proposalSchema } from '@/lib/validations';
import { rateLimit } from '@/lib/rate-limit';
import { z } from 'zod';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Rate limiting (20 proposals per day)
    if (!rateLimit(`submit_proposal:${user.id}`, 20, 86400000)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Maximum daily proposals reached (20). Please try tomorrow.' 
        },
        { status: 429 }
      );
    }

    // Verify user is freelancer
    const { data: profile } = await supabase
      .from('profiles')
      .select('user_type, account_status')
      .eq('id', user.id)
      .single();

    if (!profile || profile.account_status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Profile not found or inactive' },
        { status: 403 }
      );
    }

    if (profile.user_type === 'client') {
      return NextResponse.json(
        { success: false, error: 'Only freelancers can submit proposals' },
        { status: 403 }
      );
    }

    // Validate request
    const body = await request.json();
    const validatedData = proposalSchema.parse(body);

    // Check if job exists and is open
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, status, client_id')
      .eq('id', validatedData.job_id)
      .single();

    if (jobError || !job) {
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

    // Prevent applying to own jobs
    if (job.client_id === user.id) {
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

    // Create proposal
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

    if (error) throw error;

    // Increment proposals count
    await supabase
      .rpc('increment_proposals_count', { job_id: validatedData.job_id });

    // Notify client
    await supabase.from('notifications').insert({
      user_id: job.client_id,
      type: 'new_proposal',
      title: 'New Proposal Received',
      message: `You received a new proposal for your job posting`,
      link: `/client/jobs/${validatedData.job_id}`,
    });

    return NextResponse.json({
      success: true,
      data,
      message: 'Proposal submitted successfully',
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0].message },
        { status: 400 }
      );
    }

    console.error('Proposal submission error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to submit proposal' },
      { status: 500 }
    );
  }
}