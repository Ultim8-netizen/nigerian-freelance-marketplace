// ============================================================================
// src/app/api/orders/route.ts
// Orders management with validation
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';
import { z } from 'zod';

const createOrderSchema = z.object({
  freelancer_id: z.string().uuid(),
  service_id: z.string().uuid().optional(),
  job_id: z.string().uuid().optional(),
  proposal_id: z.string().uuid().optional(),
  title: z.string().min(10).max(200),
  description: z.string().min(20).max(2000),
  amount: z.number().min(1000).max(10000000),
  delivery_days: z.number().int().min(1).max(90),
  max_revisions: z.number().int().min(0).max(10).default(1),
});

// GET - List orders
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const userType = searchParams.get('user_type');
    const page = parseInt(searchParams.get('page') || '1');
    const perPage = Math.min(parseInt(searchParams.get('per_page') || '20'), 50);

    let query = supabase
      .from('orders')
      .select(`
        *,
        client:profiles!orders_client_id_fkey(*),
        freelancer:profiles!orders_freelancer_id_fkey(*),
        service:services(*),
        job:jobs(*)
      `, { count: 'exact' });

    // Filter by user role
    if (userType === 'client') {
      query = query.eq('client_id', user.id);
    } else if (userType === 'freelancer') {
      query = query.eq('freelancer_id', user.id);
    } else {
      query = query.or(`client_id.eq.${user.id},freelancer_id.eq.${user.id}`);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        page,
        per_page: perPage,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / perPage),
      },
    });
  } catch (error: any) {
    console.error('Orders fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}

// POST - Create order
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

    // Rate limiting (10 orders per hour)
    if (!rateLimit(`create_order:${user.id}`, 10, 3600000)) {
      return NextResponse.json(
        { success: false, error: 'Too many order creations. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const validatedData = createOrderSchema.parse(body);

    // Verify freelancer exists and is active
    const { data: freelancer, error: freelancerError } = await supabase
      .from('profiles')
      .select('id, account_status')
      .eq('id', validatedData.freelancer_id)
      .single();

    if (freelancerError || !freelancer) {
      return NextResponse.json(
        { success: false, error: 'Freelancer not found' },
        { status: 404 }
      );
    }

    if (freelancer.account_status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Freelancer account is not active' },
        { status: 400 }
      );
    }

    // Calculate fees (10% platform fee)
    const platformFee = Math.round(validatedData.amount * 0.1);
    const freelancerEarnings = validatedData.amount - platformFee;

    // Calculate delivery date
    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + validatedData.delivery_days);

    // Generate order number
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    // Create order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        client_id: user.id,
        freelancer_id: validatedData.freelancer_id,
        service_id: validatedData.service_id,
        job_id: validatedData.job_id,
        proposal_id: validatedData.proposal_id,
        title: validatedData.title,
        description: validatedData.description,
        amount: validatedData.amount,
        platform_fee: platformFee,
        freelancer_earnings: freelancerEarnings,
        delivery_date: deliveryDate.toISOString(),
        max_revisions: validatedData.max_revisions,
        status: 'pending_payment',
        revision_count: 0,
      })
      .select()
      .single();

    if (orderError) throw orderError;

    // If from proposal, update proposal status
    if (validatedData.proposal_id) {
      await supabase
        .from('proposals')
        .update({ status: 'accepted' })
        .eq('id', validatedData.proposal_id);

      if (validatedData.job_id) {
        await supabase
          .from('jobs')
          .update({ status: 'in_progress' })
          .eq('id', validatedData.job_id);
      }
    }

    // Create notification for freelancer
    await supabase.from('notifications').insert({
      user_id: validatedData.freelancer_id,
      type: 'new_order',
      title: 'New Order Received',
      message: `You have a new order: ${validatedData.title}`,
      link: `/freelancer/orders/${order.id}`,
    });

    return NextResponse.json({
      success: true,
      data: order,
      message: 'Order created successfully. Proceed to payment.',
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0].message },
        { status: 400 }
      );
    }

    console.error('Order creation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create order' },
      { status: 500 }
    );
  }
}