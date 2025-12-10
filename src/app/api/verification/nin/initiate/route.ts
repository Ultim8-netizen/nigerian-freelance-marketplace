// src/app/api/verification/nin/initiate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { YouverifyService } from '@/lib/verification/youverify';
import { FlutterwaveServerService } from '@/lib/flutterwave/server-service';
import { generateReference } from '@/lib/utils';

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

    const body = await request.json();
    const { nin } = body;

    // Validate NIN format
    const validation = YouverifyService.validateNINFormat(nin);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    // Check if user already has verified NIN
    const { data: profile } = await supabase
      .from('profiles')
      .select('nin_verified, nin_verification_status')
      .eq('id', user.id)
      .single();

    if (profile?.nin_verified) {
      return NextResponse.json(
        { success: false, error: 'Your NIN is already verified' },
        { status: 400 }
      );
    }

    // Check for pending verification
    const { data: pendingVerification } = await supabase
      .from('nin_verification_requests')
      .select('*')
      .eq('user_id', user.id)
      .eq('verification_status', 'pending')
      .single();

    if (pendingVerification) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'You already have a pending verification request',
          pending_request_id: pendingVerification.id 
        },
        { status: 400 }
      );
    }

    // Generate payment reference
    const txRef = generateReference('NIN-VER');
    const verificationCost = YouverifyService.getVerificationCost();

    // Get user profile for payment
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('email, full_name, phone_number')
      .eq('id', user.id)
      .single();

    // Initialize payment with Flutterwave
    const paymentResult = await FlutterwaveServerService.initializePayment({
      tx_ref: txRef,
      amount: verificationCost,
      currency: 'NGN',
      redirect_url: `${process.env.NEXT_PUBLIC_APP_URL}/verification/nin/callback`,
      customer: {
        email: userProfile!.email,
        phone_number: userProfile!.phone_number || '',
        name: userProfile!.full_name,
      },
      customizations: {
        title: 'F9 NIN Verification',
        description: 'Identity verification fee',
        logo: `${process.env.NEXT_PUBLIC_APP_URL}/logo.png`,
      },
      meta: {
        user_id: user.id,
        nin: nin,
        verification_type: 'nin',
      },
    });

    if (paymentResult.status !== 'success') {
      return NextResponse.json(
        { success: false, error: 'Payment initialization failed' },
        { status: 500 }
      );
    }

    // Create verification request record
    const { data: verificationRequest, error: dbError } = await supabase
      .from('nin_verification_requests')
      .insert({
        user_id: user.id,
        nin: nin,
        amount_paid: verificationCost,
        transaction_ref: txRef,
        verification_status: 'pending',
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json(
        { success: false, error: 'Failed to create verification request' },
        { status: 500 }
      );
    }

    // Update profile status
    await supabase
      .from('profiles')
      .update({ nin_verification_status: 'pending' })
      .eq('id', user.id);

    return NextResponse.json({
      success: true,
      data: {
        request_id: verificationRequest.id,
        payment_link: paymentResult.data.link,
        amount: verificationCost,
        tx_ref: txRef,
      },
    });

  } catch (error: any) {
    console.error('NIN verification initiation error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Verification initiation failed' },
      { status: 500 }
    );
  }
}



