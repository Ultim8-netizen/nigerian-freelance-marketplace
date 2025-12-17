// src/app/api/admin/route.ts
// Admin API utilities and checks

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Verify user has admin privileges
 */
export async function verifyAdminAccess(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user has admin role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.is_admin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    return { user, profile };
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Authentication failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin
 * Health check endpoint
 */
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