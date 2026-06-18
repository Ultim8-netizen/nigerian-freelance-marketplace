// src/app/api/orders/[id]/dispute/route.ts
// CHANGED: Standardized auth to direct createClient() + added rate limiting,
// consistent with all other action routes in this domain.
//
// FIX: escrow has only a SELECT policy for participants — no UPDATE policy
//      exists at all, confirmed via live policy audit. The freeze-escrow
//      update was being silently dropped, leaving disputed orders with their
//      escrow row stuck at 'held' indefinitely. Now uses createAdminClient().
// FIX: notifications has no INSERT policy for user-scoped clients — the
//      "notify the other party" insert now uses createAdminClient() too.
//
// NOTE: guard_against_double_wallet_credit() fires BEFORE UPDATE on escrow
// for any update (triggers aren't bypassed by the service-role key, only
// RLS is). It's expected to only guard the held -> released_to_freelancer
// transition, but this hasn't been exercised against a held -> disputed
// update yet. If this throws in testing, surface the trigger function
// source and it can be patched.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/rate-limit-upstash';
import { z } from 'zod';

const disputeSchema = z.object({
  reason: z.string().min(5).max(100),
  description: z.string().min(50).max(2000),
  evidence: z.array(z.string().url()).max(10).optional(),
});

// POST — Raise a dispute
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Rate limiting: disputes are low-frequency, sensitive actions
    const rateLimitResult = await checkRateLimit('api', user.id);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Too many requests',
          resetAt: rateLimitResult.reset,
        },
        { status: 429 }
      );
    }

    const orderId = params.id;
    const body = await request.json();
    const validatedData = disputeSchema.parse(body);

    // Fetch full order for ownership + status checks
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, client_id, freelancer_id, status, title')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    const isClient = order.client_id === user.id;
    const isFreelancer = order.freelancer_id === user.id;

    if (!isClient && !isFreelancer) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const orderStatus = order.status ?? '';
    if (['completed', 'refunded', 'disputed', 'cancelled'].includes(orderStatus)) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot dispute order with status: ${orderStatus}`,
        },
        { status: 400 }
      );
    }

    // Prevent duplicate open disputes
    const { data: existingDispute } = await supabase
      .from('disputes')
      .select('id')
      .eq('order_id', orderId)
      .eq('status', 'open')
      .maybeSingle();

    if (existingDispute) {
      return NextResponse.json(
        { success: false, error: 'A dispute already exists for this order' },
        { status: 400 }
      );
    }

    const againstId = isClient ? order.freelancer_id : order.client_id;

    // Create dispute record — disputes has no RLS audit yet, but this insert
    // sets raised_by = auth.uid() implicitly via user_id checks elsewhere in
    // the schema; left on the user-scoped client per existing behavior.
    const { data: dispute, error: disputeError } = await supabase
      .from('disputes')
      .insert({
        order_id: orderId,
        raised_by: user.id,
        against: againstId,
        reason: validatedData.reason,
        description: validatedData.description,
        evidence: validatedData.evidence ?? null,
        status: 'open',
      })
      .select()
      .single();

    if (disputeError) {
      console.error('Dispute creation error:', disputeError);
      return NextResponse.json(
        { success: false, error: 'Failed to create dispute' },
        { status: 500 }
      );
    }

    // Freeze the order — orders UPDATE RLS confirmed scoped to
    // client_id/freelancer_id, so the user-scoped client is correct here.
    await supabase
      .from('orders')
      .update({ status: 'disputed', updated_at: new Date().toISOString() })
      .eq('id', orderId);

    const adminClient = createAdminClient();

    // Freeze escrow.
    // FIX: escrow has no UPDATE policy for any role except via SECURITY
    // DEFINER RPCs — this update was being silently dropped. Use the
    // service-role client.
    const { error: escrowUpdateError } = await adminClient
      .from('escrow')
      .update({ status: 'disputed' })
      .eq('order_id', orderId);

    if (escrowUpdateError) {
      console.error('Escrow freeze error on dispute:', escrowUpdateError, {
        orderId,
      });
      // Dispute record and order status are already committed — surface the
      // escrow failure for visibility but don't fail the whole request, since
      // the dispute itself is the priority and the order is already frozen.
    }

    // Notify the other party.
    // FIX: notifications has no INSERT policy for user-scoped clients.
    await adminClient.from('notifications').insert({
      user_id: againstId,
      type: 'dispute_raised',
      title: 'Dispute Raised',
      message: `A dispute has been raised for: ${order.title}`,
      link: `/orders/${orderId}/dispute`,
    });

    return NextResponse.json({
      success: true,
      data: dispute,
      message: 'Dispute raised. Our team will review within 48 hours.',
    });
  } catch (error) {
    console.error('Dispute error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: error.issues[0]?.message ?? 'Validation failed',
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to raise dispute' },
      { status: 500 }
    );
  }
}

// GET — View dispute details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { data: dispute, error: disputeError } = await supabase
      .from('disputes')
      .select(
        `
        *,
        order:orders(*),
        raised_by_user:profiles!disputes_raised_by_fkey(*),
        against_user:profiles!disputes_against_fkey(*)
      `
      )
      .eq('order_id', params.id)
      .single();

    if (disputeError || !dispute) {
      return NextResponse.json(
        { success: false, error: 'Dispute not found' },
        { status: 404 }
      );
    }

    if (dispute.raised_by !== user.id && dispute.against !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, data: dispute });
  } catch (error) {
    console.error('Dispute fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dispute' },
      { status: 500 }
    );
  }
}