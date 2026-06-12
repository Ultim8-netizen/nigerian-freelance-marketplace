// src/lib/security/csrf.ts
//
// FIX 1: Removed the exported `POST` function. This file is a utility module
// in src/lib/security/ — it is not a Next.js route file. The POST export was
// a non-functional example handler: Next.js routing never invokes exports from
// lib/ directories, nothing imported it, and re-exporting it via the barrel
// (index.ts) would pollute @/lib/security with a stray route handler symbol.
// The example logic is preserved below as JSDoc on verifyCsrfRequest.
//
// FIX 2: verifyCsrfToken now uses crypto.timingSafeEqual. The previous
// implementation used `===` (string equality), which returns early on the first
// character mismatch. An attacker timing response latency across many requests
// can determine how many leading characters match and reconstruct the token
// incrementally. timingSafeEqual always runs in constant time regardless of
// where the strings diverge, eliminating that side channel.

import { timingSafeEqual, randomBytes } from 'crypto';
import { NextRequest, NextResponse }     from 'next/server';

// ── Constants ─────────────────────────────────────────────────────────────────

export const CSRF_COOKIE_NAME = 'csrf-token'   as const;
export const CSRF_HEADER_NAME = 'x-csrf-token' as const;

// ── Token generation ──────────────────────────────────────────────────────────

/**
 * Generates a cryptographically random CSRF token (32 URL-safe base64 chars).
 * Uses Node.js crypto.randomBytes which sources from the OS CSPRNG.
 */
export function generateCsrfToken(): string {
  return randomBytes(24).toString('base64url'); // 24 bytes → 32 base64url chars
}

// ── Token verification ────────────────────────────────────────────────────────

/**
 * Constant-time comparison of two CSRF token strings.
 *
 * timingSafeEqual requires both buffers to be the same byte length. We check
 * length first and return false early — the length of our tokens is not secret
 * (all are 32 chars from generateCsrfToken), so this early exit is safe.
 * Buffers of different lengths cannot be equal by definition.
 */
export function verifyCsrfToken(token: string, storedToken: string): boolean {
  try {
    const a = Buffer.from(token);
    const b = Buffer.from(storedToken);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ── Cookie management ─────────────────────────────────────────────────────────

/**
 * Generates a fresh CSRF token, writes it as an HttpOnly cookie onto the
 * provided response, and returns the raw token value.
 *
 * The token should then be embedded in the page for JavaScript to read and
 * attach to mutating requests via the x-csrf-token header. Common patterns:
 *   • A <meta name="csrf-token"> tag read by a fetch wrapper
 *   • Injected into a Zustand / Redux store on hydration
 *
 * Call this during session establishment (login success, registration success,
 * or the initial authenticated page load) so the token is ready before any
 * state-mutating request is made.
 */
export function setCsrfCookie(response: NextResponse): string {
  const token = generateCsrfToken();
  response.cookies.set(CSRF_COOKIE_NAME, token, {
    httpOnly: true,   // not accessible via document.cookie — prevents XSS theft
    sameSite: 'strict',
    secure:   process.env.NODE_ENV === 'production',
    path:     '/',
  });
  return token;
}

// ── Request helpers ───────────────────────────────────────────────────────────

/**
 * Extracts the CSRF header value and cookie value from an incoming request.
 * Returns null for each when absent rather than throwing.
 */
export function extractCsrfFromRequest(request: NextRequest): {
  header: string | null;
  cookie: string | null;
} {
  return {
    header: request.headers.get(CSRF_HEADER_NAME),
    cookie: request.cookies.get(CSRF_COOKIE_NAME)?.value ?? null,
  };
}

/**
 * One-call CSRF guard for state-mutating route handlers (POST, PUT, PATCH, DELETE).
 * Returns true when the request header token matches the cookie token; false otherwise.
 *
 * Usage in a route handler:
 *
 *   export async function POST(request: NextRequest) {
 *     if (!verifyCsrfRequest(request)) {
 *       return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
 *     }
 *     // ... process the request
 *   }
 */
export function verifyCsrfRequest(request: NextRequest): boolean {
  const { header, cookie } = extractCsrfFromRequest(request);
  if (!header || !cookie) return false;
  return verifyCsrfToken(header, cookie);
}