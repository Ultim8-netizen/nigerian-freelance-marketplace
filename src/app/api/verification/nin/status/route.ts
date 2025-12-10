// src/app/api/verification/nin/status/route.ts
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

    // Get user's verification status
    const { data: profile } = await supabase
      .from('profiles')
      .select('nin_verified, nin_verification_status, nin_verification_date, nin_last_four')
      .eq('id', user.id)
      .single();

    // Get latest verification request
    const { data: latestRequest } = await supabase
      .from('nin_verification_requests')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({
      success: true,
      data: {
        is_verified: profile?.nin_verified || false,
        status: profile?.nin_verification_status || 'not_started',
        verification_date: profile?.nin_verification_date,
        nin_last_four: profile?.nin_last_four,
        latest_request: latestRequest ? {
          id: latestRequest.id,
          status: latestRequest.verification_status,
          created_at: latestRequest.created_at,
          rejection_reason: latestRequest.rejection_reason,
        } : null,
        cost: YouverifyService.getVerificationCost(),
      },
    });

  } catch (error: any) {
    console.error('Status check error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check status' },
      { status: 500 }
    );
  }
}