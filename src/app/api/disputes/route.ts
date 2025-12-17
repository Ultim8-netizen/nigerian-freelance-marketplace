// src/app/api/disputes/route.ts
// Dispute management API

import { NextRequest, NextResponse } from 'next/server';
import { applyMiddleware } from '@/lib/api/enhanced-middleware';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const createDisputeSchema = z.object({
  order_id: z.string().uuid(),
  reason: z.string().min(5).max(100),
  description: z.string().min(50).max(2000),
  evidence: z.array(z.string().url()).max(10).optional(),
});

/**
 * GET /api/disputes
 * List disputes for current user
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await applyMiddleware(request, {
      auth: 'required',
      rateLimit: 'api',
    });

    if (error || !user) return error || NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );

    const supabase = await createClient();
    const { data: disputes, error: queryError } = await supabase
      .from('disputes')
      .select(`
        *,
        order:orders(*),
        raised_by_user:profiles!disputes_raised_by_fkey(*),
        against_user:profiles!disputes_against_fkey(*)
      `)
      .or(`raised_by.eq.${user.id},against.eq.${user.id}`)
      .order('created_at', { ascending: false });

    if (queryError) throw queryError;

    return NextResponse.json({
      success: true,
      data: disputes || [],
    });
  } catch (error) {
    logger.error('Disputes fetch error', error as Error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch disputes' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/disputes
 * Create a new dispute
 */
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await applyMiddleware(request, {
      auth: 'required',
      rateLimit: 'api',
    });

    if (error || !user) return error || NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );

    const body = await request.json();
    const validated = createDisputeSchema.parse(body);

    const supabase = await createClient();

    // Verify order exists and user is party to it
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('client_id, freelancer_id, status')
      .eq('id', validated.order_id)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    const isParty = order.client_id === user.id || order.freelancer_id === user.id;
    if (!isParty) {
      return NextResponse.json(
        { success: false, error: 'Not authorized for this order' },
        { status: 403 }
      );
    }

    // Check dispute doesn't already exist
    const { data: existing } = await supabase
      .from('disputes')
      .select('id')
      .eq('order_id', validated.order_id)
      .eq('status', 'open')
      .single();

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Open dispute already exists for this order' },
        { status: 409 }
      );
    }

    const againstId = order.client_id === user.id ? order.freelancer_id : order.client_id;

    // Create dispute
    const { data: dispute, error: createError } = await supabase
      .from('disputes')
      .insert({
        order_id: validated.order_id,
        raised_by: user.id,
        against: againstId,
        reason: validated.reason,
        description: validated.description,
        evidence: validated.evidence,
        status: 'open',
      })
      .select()
      .single();

    if (createError) throw createError;

    // Update order status
    await supabase
      .from('orders')
      .update({ status: 'disputed' })
      .eq('id', validated.order_id);

    // Notify other party
    await supabase.from('notifications').insert({
      user_id: againstId,
      type: 'dispute_raised',
      title: 'Dispute Raised',
      message: `A dispute has been raised for order ${validated.order_id}`,
      link: `/disputes/${dispute.id}`,
    });

    logger.info('Dispute created', {
      disputeId: dispute.id,
      userId: user.id,
      orderId: validated.order_id,
    });

    return NextResponse.json({
      success: true,
      data: dispute,
      message: 'Dispute raised successfully. Our team will review within 48 hours.',
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0]?.message || 'Validation failed' },
        { status: 400 }
      );
    }

    logger.error('Dispute creation error', error as Error);
    return NextResponse.json(
      { success: false, error: 'Failed to create dispute' },
      { status: 500 }
    );
  }
}