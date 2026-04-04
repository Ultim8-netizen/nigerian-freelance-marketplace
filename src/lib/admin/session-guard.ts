// src/lib/admin/session-guard.ts
// Middleware-layer enforcement of the 2-hour admin inactivity timeout.
//
// HOW IT WORKS
// ─────────────
// The f9_admin_activity cookie is a sliding-window token:
//   • maxAge = 7 200 s (2 hours).
//   • Set on successful admin login (call stampAdminActivity there).
//   • Refreshed on every admin page navigation (this function).
//   • Refreshed on DOM activity pings (POST /api/admin/session/refresh).
//
// If the cookie is absent — because 2 hours passed with no navigation AND
// no activity pings — the request is redirected to the login page with
// ?reason=timeout.  This check cannot be bypassed via JS because it runs
// inside Next.js Edge Middleware before any page or API handler executes.
//
// INTEGRATION (src/middleware.ts)
// ────────────────────────────────
//   import { enforceAdminSessionTimeout } from '@/lib/admin/session-guard';
//
//   export async function middleware(request: NextRequest) {
//     // … your existing updateSession(request) call …
//
//     const adminGuardResponse = enforceAdminSessionTimeout(request);
//     if (adminGuardResponse) return adminGuardResponse;
//
//     // … rest of your middleware …
//   }

import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_ACTIVITY_COOKIE,
  ADMIN_LOGIN_PATH,
  ADMIN_BASE_PATH,
  stampAdminActivity,
} from '@/lib/admin/session';

/** Routes under /f9-control that must NOT be redirected (public admin pages). */
const ADMIN_PUBLIC_PATHS = new Set([
  ADMIN_LOGIN_PATH,
  `${ADMIN_LOGIN_PATH}/`,
]);

/**
 * Call this from your root middleware.ts for every incoming request.
 *
 * Returns:
 *  • A redirect Response  → middleware should return it immediately.
 *  • A NextResponse.next() → middleware should return it (cookie refreshed).
 *  • null                  → not an admin route; caller handles normally.
 */
export function enforceAdminSessionTimeout(
  request: NextRequest,
): NextResponse | null {
  const { pathname } = request.nextUrl;

  // ── 1. Only intercept /f9-control/** ──────────────────────────────────────
  if (!pathname.startsWith(ADMIN_BASE_PATH)) {
    return null;
  }

  // ── 2. Never block the login page itself or its sub-paths ─────────────────
  if (
    ADMIN_PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith(`${ADMIN_LOGIN_PATH}/`)
  ) {
    return null;
  }

  // ── 3. The activity ping endpoint must not be gated by itself ─────────────
  if (pathname === '/api/admin/session/refresh') {
    return null;
  }

  // ── 4. Check for the sliding-window cookie ────────────────────────────────
  const activityCookie = request.cookies.get(ADMIN_ACTIVITY_COOKIE);

  if (!activityCookie?.value) {
    // Cookie absent → timed out.  Redirect to login with reason param so the
    // login page can surface an appropriate message.
    const loginUrl = new URL(ADMIN_LOGIN_PATH, request.url);
    loginUrl.searchParams.set('reason', 'timeout');
    return NextResponse.redirect(loginUrl);
  }

  // ── 5. Cookie present → session is valid.  Refresh the sliding window ─────
  // We must propagate the original request headers so Supabase SSR continues
  // to read cookies correctly downstream.
  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  return stampAdminActivity(response);
}