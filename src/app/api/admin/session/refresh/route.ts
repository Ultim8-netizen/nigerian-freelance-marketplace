// src/app/api/admin/session/refresh/route.ts
// Lightweight endpoint called by AdminSessionGuard on DOM activity.
//
// PURPOSE
// ───────
// Navigation requests reset the sliding-window cookie via middleware.
// But an admin who spends 2+ hours reading a single page without navigating
// would be logged out at the middleware layer the next time they click a link
// — even though they were visibly active.
//
// AdminSessionGuard fires a POST here (debounced / max once per 30s) whenever
// it detects DOM activity.  This endpoint validates the Supabase session,
// confirms the caller is still an active admin, and re-stamps the cookie.
//
// If Supabase says the user is gone (401) or is not admin (403), the guard
// treats that as a session termination and redirects to the login page.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stampAdminActivity } from '@/lib/admin/session';

export async function POST(_request: NextRequest): Promise<NextResponse> {
  // ── 1. Validate Supabase session ──────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { success: false, code: 'UNAUTHENTICATED' },
      { status: 401 },
    );
  }

  // ── 2. Confirm caller is still an active admin ────────────────────────────
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('user_type, account_status')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json(
      { success: false, code: 'PROFILE_NOT_FOUND' },
      { status: 403 },
    );
  }

  if (profile.user_type !== 'admin' || profile.account_status !== 'active') {
    return NextResponse.json(
      { success: false, code: 'FORBIDDEN' },
      { status: 403 },
    );
  }

  // ── 3. Re-stamp the sliding-window cookie ─────────────────────────────────
  const response = NextResponse.json({
    success: true,
    refreshedAt: new Date().toISOString(),
  });

  return stampAdminActivity(response);
}