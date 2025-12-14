// src/app/api/orders/route.ts
// PRODUCTION-READY: Secure orders management with comprehensive validation

import { NextRequest, NextResponse } from 'next/server';
import { applyMiddleware } from '@/lib/api/enhanced-middleware';
import { createClient } from '@/lib/supabase/server';
import { sanitizeText, sanitizeHtml, sanitizeUuid } from '@/lib/security/sanitize';
import { logger } from '@/lib/logger';
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
    const { user, error } = await applyMiddleware(request, {
      auth: 'required',
      rateLimit: 'api',
    });

    if (error) return error;
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const status = sanitizeText(searchParams.get('status') || '');
    const userType = sanitizeText(searchParams.get('user_type') || '');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get('per_page') || '20')));

    const supabase = await createClient();

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

    const { data, error: queryError, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (queryError) {
      logger.error('Orders fetch error', queryError);
      throw queryError;
    }

    logger.info('Orders query executed', {
      userId: user.id,
      resultCount: data?.length || 0
    });

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
  } catch (error) {
    logger.error('Orders GET error', error as Error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}

// POST - Create order
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await applyMiddleware(request, {
      auth: 'required',
      rateLimit: 'api',
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
      freelancer_id: sanitizeUuid(body.freelancer_id) || '',
      service_id: body.service_id ? sanitizeUuid(body.service_id) : undefined,
      job_id: body.job_id ? sanitizeUuid(body.job_id) : undefined,
      proposal_id: body.proposal_id ? sanitizeUuid(body.proposal_id) : undefined,
      title: sanitizeText(body.title || ''),
      description: sanitizeHtml(body.description || ''),
    };

    const validatedData = createOrderSchema.parse(sanitizedBody);

    const supabase = await createClient();

    // Verify freelancer exists and is active
    const { data: freelancer, error: freelancerError } = await supabase
      .from('profiles')
      .select('id, account_status')
      .eq('id', validatedData.freelancer_id)
      .single();

    if (freelancerError || !freelancer) {
      logger.warn('Invalid freelancer ID', { freelancerId: validatedData.freelancer_id });
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

    // Calculate fees
    const platformFee = Math.round(validatedData.amount * 0.1);
    const freelancerEarnings = validatedData.amount - platformFee;

    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + validatedData.delivery_days);

    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

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

    if (orderError) {
      logger.error('Order creation failed', orderError, { userId: user.id });
      throw orderError;
    }

    // Update related records
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

    // Notify freelancer
    await supabase.from('notifications').insert({
      user_id: validatedData.freelancer_id,
      type: 'new_order',
      title: 'New Order Received',
      message: `You have a new order: ${validatedData.title}`,
      link: `/freelancer/orders/${order.id}`,
    });

    logger.info('Order created successfully', {
      orderId: order.id,
      clientId: user.id,
      freelancerId: validatedData.freelancer_id,
      amount: validatedData.amount
    });

    return NextResponse.json({
      success: true,
      data: order,
      message: 'Order created successfully. Proceed to payment.',
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Order validation failed', { errors: error.issues });
      return NextResponse.json(
        { 
          success: false, 
          error: error.issues[0]?.message || 'Validation failed',
          details: error.issues 
        },
        { status: 400 }
      );
    }

    logger.error('Order creation error', error as Error);
    return NextResponse.json(
      { success: false, error: 'Failed to create order' },
      { status: 500 }
    );
  }
}