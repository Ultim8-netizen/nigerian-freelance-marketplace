// src/app/api/orders/[id]/approve/route.ts
// CHANGED: Removed PATCH/revision handler — it is now at POST /api/orders/[id]/revision.
// Standardized auth to direct createClient() (consistent with all other action routes).

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const approvalSchema = z.object({
  rating: z.number().int().min(1).max(5),
  review: z.string().min(10).max(500).optional(),
  communication_rating: z.number().int().min(1).max(5).optional(),
  quality_rating: z.number().int().min(1).max(5).optional(),
  professionalism_rating: z.number().int().min(1).max(5).optional(),
});

interface OrderCompletionResult {
  success: boolean;
  error?: string;
  [key: string]: unknown;
}

/**
 * POST — Approve delivered work and release payment atomically.
 * Delegates to the complete_order_with_payment SECURITY DEFINER RPC which:
 *   1. Sets order.status = 'completed'
 *   2. Sets escrow.status = 'released_to_freelancer'
 *   3. Inserts a review record
 *   4. Updates freelancer profile stats (total_jobs_completed, freelancer_rating)
 *   5. Closes linked job if present
 *   6. Notifies freelancer (funds pending 7-day clearance, not immediate credit)
 */
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
    const validatedData = approvalSchema.parse(body);

    // Verify order exists and user is the client
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('client_id, status')
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
        { success: false, error: 'Order must be in delivered status before approval' },
        { status: 400 }
      );
    }

    // Atomically complete the order via SECURITY DEFINER RPC
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      'complete_order_with_payment',
      {
        p_order_id: orderId,
        p_client_rating: validatedData.rating,
        p_client_review: validatedData.review ?? null,
        p_communication_rating: validatedData.communication_rating ?? null,
        p_quality_rating: validatedData.quality_rating ?? null,
        p_professionalism_rating: validatedData.professionalism_rating ?? null,
      }
    );

    if (rpcError) {
      console.error('Order completion RPC error:', rpcError);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to complete order',
          details:
            process.env.NODE_ENV === 'development' ? rpcError.message : undefined,
        },
        { status: 500 }
      );
    }

    const result = rpcResult as OrderCompletionResult;

    if (!result?.success) {
      return NextResponse.json(
        {
          success: false,
          error: result?.error || 'Order completion failed',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Order completed — payment queued for release',
      data: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid input',
          details: error.issues[0]?.message ?? 'Validation failed',
        },
        { status: 400 }
      );
    }

    console.error('Approval error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details:
          process.env.NODE_ENV === 'development' && error instanceof Error
            ? error.message
            : undefined,
      },
      { status: 500 }
    );
  }
}