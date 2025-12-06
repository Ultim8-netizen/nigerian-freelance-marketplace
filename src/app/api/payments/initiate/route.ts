// src/app/api/payments/initiate/route.ts
// Payment initialization

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { FlutterwaveService } from '@/lib/flutterwave/config';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { order_id, redirect_url } = body;

    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, client:profiles!orders_client_id_fkey(*)')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    // Verify user is the client
    if (order.client_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Generate transaction reference
    const txRef = `TX-${Date.now()}-${uuidv4()}`;

    // Initialize Flutterwave payment
    const paymentData = {
      tx_ref: txRef,
      amount: order.amount,
      currency: 'NGN',
      redirect_url: redirect_url || `${process.env.NEXT_PUBLIC_APP_URL}/payment/callback`,
      customer: {
        email: order.client.email,
        phone_number: order.client.phone_number || '',
        name: order.client.full_name,
      },
      customizations: {
        title: process.env.NEXT_PUBLIC_APP_NAME || 'NigerianFreelance',
        description: order.title,
        logo: `${process.env.NEXT_PUBLIC_APP_URL}/logo.png`,
      },
    };

    const flutterwaveResponse = await FlutterwaveService.initializePayment(paymentData);

    // Create transaction record
    await supabase.from('transactions').insert({
      order_id: order.id,
      transaction_ref: txRef,
      amount: order.amount,
      transaction_type: 'payment',
      status: 'pending',
    });

    return NextResponse.json({
      success: true,
      data: {
        payment_link: flutterwaveResponse.data.link,
        tx_ref: txRef,
      },
    });
  } catch (error: any) {
    console.error('Payment initiation error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Payment initiation failed' },
      { status: 500 }
    );
  }
}