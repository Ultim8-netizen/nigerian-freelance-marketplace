// src/app/api/verification/nin/callback/route.ts
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const txRef = searchParams.get('tx_ref');
    const transactionId = searchParams.get('transaction_id');

    if (!txRef || !transactionId) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/verification/nin?error=invalid_callback`
      );
    }

    const supabase = createClient();

    // Verify payment
    const verificationResult = await FlutterwaveServerService.verifyPayment(transactionId);

    if (verificationResult.status !== 'success' || 
        verificationResult.data?.status !== 'successful') {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/verification/nin?error=payment_failed`
      );
    }

    // Get verification request
    const { data: verificationRequest } = await supabase
      .from('nin_verification_requests')
      .select('*')
      .eq('transaction_ref', txRef)
      .single();

    if (!verificationRequest) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/verification/nin?error=request_not_found`
      );
    }

    // Process NIN verification with Youverify
    const ninResult = await YouverifyService.verifyNIN(
      verificationRequest.nin,
      verificationRequest.user_id,
      verificationRequest.id
    );

    // Update verification request
    await supabase
      .from('nin_verification_requests')
      .update({
        verification_status: ninResult.status === 'approved' ? 'approved' : 'rejected',
        youverify_request_id: ninResult.youverify_request_id,
        verification_response: ninResult.data || null,
        rejection_reason: ninResult.error,
        verified_at: ninResult.status === 'approved' ? new Date().toISOString() : null,
      })
      .eq('id', verificationRequest.id);

    // Update profile
    if (ninResult.status === 'approved') {
      await supabase
        .from('profiles')
        .update({
          nin_verified: true,
          identity_verified: true,
          nin_verification_status: 'approved',
          nin_verification_date: new Date().toISOString(),
          nin_last_four: verificationRequest.nin.slice(-4),
        })
        .eq('id', verificationRequest.user_id);

      // Track platform revenue
      await supabase
        .from('platform_revenue')
        .insert({
          revenue_type: 'nin_verification',
          amount: verificationRequest.amount_paid,
          source_user_id: verificationRequest.user_id,
          transaction_ref: txRef,
          metadata: {
            youverify_request_id: ninResult.youverify_request_id,
          },
        });

      // Send notification
      await supabase
        .from('notifications')
        .insert({
          user_id: verificationRequest.user_id,
          type: 'nin_verification_success',
          title: '✅ NIN Verified!',
          message: 'Your identity has been verified. You now have a verified badge on your profile.',
          link: '/dashboard/profile',
        });
    } else {
      await supabase
        .from('profiles')
        .update({
          nin_verification_status: 'rejected',
        })
        .eq('id', verificationRequest.user_id);

      // Send notification
      await supabase
        .from('notifications')
        .insert({
          user_id: verificationRequest.user_id,
          type: 'nin_verification_failed',
          title: '❌ Verification Failed',
          message: `NIN verification was unsuccessful: ${ninResult.error || 'Invalid NIN'}`,
          link: '/verification/nin',
        });
    }

    const redirectUrl = ninResult.status === 'approved'
      ? '/verification/nin/success'
      : '/verification/nin/failed';

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}${redirectUrl}`
    );

  } catch (error: any) {
    console.error('NIN callback error:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/verification/nin?error=processing_failed`
    );
  }
}