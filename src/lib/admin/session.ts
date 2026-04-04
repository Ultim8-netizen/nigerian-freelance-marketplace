// src/lib/admin/session.ts
// Server-side admin session timeout enforcement — cookie utilities
// Used by: middleware, /api/admin/session/refresh, admin login route

import type { NextResponse } from 'next/server';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Matches the client-side TIMEOUT_MS in AdminSessionGuard */
export const ADMIN_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours in ms
export const ADMIN_TIMEOUT_SECONDS = 2 * 60 * 60; // 7 200 s — used as cookie maxAge

export const ADMIN_ACTIVITY_COOKIE = 'f9_admin_activity';
export const ADMIN_LOGIN_PATH = '/f9-control/login';
export const ADMIN_BASE_PATH = '/f9-control';

// ─── Cookie options ───────────────────────────────────────────────────────────

/**
 * Returns the options object for the activity cookie.
 * `secure` is gated on NODE_ENV so local dev doesn't require HTTPS.
 * `path` scoped to /f9-control so the cookie is never sent to public routes.
 */
export function adminCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    maxAge: ADMIN_TIMEOUT_SECONDS,
    path: ADMIN_BASE_PATH,
  };
}

// ─── Stamp helper ─────────────────────────────────────────────────────────────

/**
 * Writes the activity cookie onto any NextResponse.
 * Calling this resets the 2-hour sliding window.
 *
 * Call sites:
 *  1. enforceAdminSessionTimeout()  — middleware (every admin page request)
 *  2. POST /api/admin/session/refresh — activity ping from AdminSessionGuard
 *  3. Admin login route              — after successful supabase.auth.signIn
 *
 * @param response  A NextResponse instance (from NextResponse.next(),
 *                  NextResponse.json(), etc.)
 * @returns The same response object, mutated in place, for easy chaining.
 */
export function stampAdminActivity<T extends NextResponse>(response: T): T {
  response.cookies.set(
    ADMIN_ACTIVITY_COOKIE,
    Date.now().toString(),
    adminCookieOptions(),
  );
  return response;
}

/**
 * Removes the activity cookie, effectively ending the admin session.
 * Call from the admin logout handler alongside supabase.auth.signOut().
 */
export function clearAdminActivityCookie<T extends NextResponse>(response: T): T {
  response.cookies.set(ADMIN_ACTIVITY_COOKIE, '', {
    ...adminCookieOptions(),
    maxAge: 0,
  });
  return response;
}