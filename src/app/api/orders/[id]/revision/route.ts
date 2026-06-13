// src/app/api/orders/[id]/revision/route.ts
// POST — Client requests a revision on a delivered order.
// Extracted from the incorrect PATCH handler in approve/route.ts.
// Validates revision count ceiling, updates order status, notifies freelancer,
// and logs the request to audit_logs.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const revisionSchema = z.object({
  revision_note: z
    .string()
    .min(20, 'Revision note must be at least 20 characters')
    .max(500, 'Revision note cannot exceed 500 characters'),
});

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

    const orderId = params.id;
    const body = await request.json();
    const { revision_note: revisionNote } = revisionSchema.parse(body);

    // Fetch order for ownership + state checks
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(
        'client_id, freelancer_id, status, revision_count, max_revisions, title'
      )
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    if (order.client_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    if (order.status !== 'delivered') {
      return NextResponse.json(
        { success: false, error: 'Can only request revisions on delivered orders' },
        { status: 400 }
      );
    }

    const revisionCount = order.revision_count ?? 0;
    const maxRevisions = order.max_revisions ?? 0;

    if (revisionCount >= maxRevisions) {
      return NextResponse.json(
        {
          success: false,
          error: `Maximum revisions reached (${maxRevisions})`,
        },
        { status: 400 }
      );
    }

    const newRevisionCount = revisionCount + 1;

    // Update order status
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'revision_requested',
        revision_count: newRevisionCount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (updateError) {
      console.error('Revision update error:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to request revision' },
        { status: 500 }
      );
    }

    // Notify freelancer
    await supabase.from('notifications').insert({
      user_id: order.freelancer_id,
      type: 'revision_requested',
      title: 'Revision Requested',
      message: `Client requested revision ${newRevisionCount}/${maxRevisions} for: ${order.title}`,
      link: `/freelancer/orders/${orderId}`,
    });

    // Audit trail
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'revision_requested',
      resource_type: 'order',
      resource_id: orderId,
      metadata: {
        revision_count: newRevisionCount,
        max_revisions: maxRevisions,
        revision_note: revisionNote,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Revision requested',
      data: {
        revision_count: newRevisionCount,
        max_revisions: maxRevisions,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: error.issues[0]?.message ?? 'Validation failed',
        },
        { status: 400 }
      );
    }

    console.error('Revision request error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to request revision' },
      { status: 500 }
    );
  }
}