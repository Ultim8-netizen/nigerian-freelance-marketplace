// src/app/api/admin/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function verifyAdminAccess(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('user_type, account_status')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || profile.user_type !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    if (profile.account_status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Account is not active' },
        { status: 403 }
      );
    }

    return { user, profile };
  } catch (_error) {
    return NextResponse.json(
      { success: false, error: 'Authentication failed' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const auth = await verifyAdminAccess(request);

  if (auth instanceof NextResponse) {
    return auth;
  }

  return NextResponse.json({
    success: true,
    message: 'Admin API operational',
    timestamp: new Date().toISOString()
  });
}