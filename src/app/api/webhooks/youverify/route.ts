// src/app/api/webhooks/youverify/route.ts
// Webhook handler for async verification updates from Youverify
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

function verifyYouverifySignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hash = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return hash === signature;
}

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('x-youverify-signature');
    const webhookSecret = process.env.YOUVERIFY_WEBHOOK_SECRET!;

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 401 }
      );
    }

    const body = await request.text();
    
    // Verify signature
    if (!verifyYouverifySignature(body, signature, webhookSecret)) {
      console.error('Invalid webhook signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    const payload = JSON.parse(body);
    
    // Log webhook
    const supabase = createClient();
    await supabase
      .from('webhook_logs')
      .insert({
        provider: 'youverify',
        event: payload.event_type || 'nin_verification',
        verified: true,
        payload: payload,
        received_at: new Date().toISOString(),
      });

    // Handle verification status update
    if (payload.event_type === 'verification.completed') {
      const { reference, status, data } = payload;

      // Find verification request
      const { data: verificationRequest } = await supabase
        .from('nin_verification_requests')
        .select('*')
        .eq('youverify_request_id', reference)
        .single();

      if (verificationRequest) {
        const verificationStatus = status === 'approved' ? 'approved' : 'rejected';

        // Update verification request
        await supabase
          .from('nin_verification_requests')
          .update({
            verification_status: verificationStatus,
            verification_response: data,
            verified_at: status === 'approved' ? new Date().toISOString() : null,
          })
          .eq('id', verificationRequest.id);

        // Update profile if approved
        if (status === 'approved') {
          await supabase
            .from('profiles')
            .update({
              nin_verified: true,
              identity_verified: true,
              nin_verification_status: 'approved',
              nin_verification_date: new Date().toISOString(),
            })
            .eq('id', verificationRequest.user_id);

          // Send success notification
          await supabase
            .from('notifications')
            .insert({
              user_id: verificationRequest.user_id,
              type: 'nin_verification_success',
              title: '✅ NIN Verified!',
              message: 'Your identity has been verified. You now have a verified badge.',
              link: '/dashboard/profile',
            });
        }
      }
    }

    return NextResponse.json({ received: true });

  } catch (error: any) {
    console.error('Webhook error:', error);
    
    // Log failed webhook
    const supabase = createClient();
    await supabase
      .from('webhook_logs')
      .insert({
        provider: 'youverify',
        event: 'webhook_error',
        verified: false,
        payload: { error: error.message },
        received_at: new Date().toISOString(),
        error: error.message,
      });

    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}