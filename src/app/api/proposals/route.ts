// src/app/api/proposals/route.ts
// Proposal submission

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { proposalSchema } from '@/lib/validations';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = proposalSchema.parse(body);

    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if proposal already exists
    const { data: existing } = await supabase
      .from('proposals')
      .select('id')
      .eq('job_id', validatedData.job_id)
      .eq('freelancer_id', user.id)
      .single();

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'You have already submitted a proposal for this job' },
        { status: 400 }
      );
    }

    // Create proposal
    const { data, error } = await supabase
      .from('proposals')
      .insert({
        freelancer_id: user.id,
        ...validatedData,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Update job proposals count
    await supabase.rpc('increment_proposals_count', {
      job_id: validatedData.job_id,
    });

    // Create notification for client
    const { data: job } = await supabase
      .from('jobs')
      .select('client_id, title')
      .eq('id', validatedData.job_id)
      .single();

    if (job) {
      await supabase.from('notifications').insert({
        user_id: job.client_id,
        type: 'new_proposal',
        title: 'New Proposal Received',
        message: `You received a new proposal for "${job.title}"`,
        link: `/client/jobs/${validatedData.job_id}`,
      });
    }

    return NextResponse.json({
      success: true,
      data,
      message: 'Proposal submitted successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0].message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
