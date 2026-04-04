// middleware.ts
// FIXED: Added '/jobs' to protectedPaths — the new /jobs/[id] page requires authentication.
// ADDED: Admin route protection for '/f9-control' — enforces session + 'admin' user_type role.
// ADDED: Automation route protection for '/api/admin/automation' — enforces CRON_SECRET bearer token.
// FIX #5: maintenance_mode platform_config flag is now read and enforced here.
// FIX #6: registrations_enabled, marketplace_enabled, new_orders_enabled,
//         new_proposals_enabled flags are now read and enforced here.
// ADDED: Server-side 2-hour inactivity timeout for admin routes via sliding-window
//        HttpOnly cookie (f9_admin_activity).  The check is inlined into the admin
//        protection block so it shares the same NextResponse as the Supabase session
//        refresh — using a separate function would drop those cookies.

import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { SerializeOptions } from 'cookie';
import {
  ADMIN_ACTIVITY_COOKIE,
  adminCookieOptions,
} from '@/lib/admin/session';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ============================================================================
  // CORS PRE-FLIGHT
  // ============================================================================
  if (pathname.startsWith('/api/') && request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin':  process.env.NEXT_PUBLIC_APP_URL || '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age':       '86400',
      },
    });
  }

  // ============================================================================
  // AUTOMATION ROUTE PROTECTION (CRON SECRET)
  // Checked before session logic — scheduler calls, not authenticated users.
  // ============================================================================
  if (pathname.startsWith('/api/admin/automation')) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // ============================================================================
  // SESSION REFRESH (shared client for all subsequent checks)
  //
  // IMPORTANT: Every early-return path that passes the admin check MUST use
  // this shared `response` object so that Supabase session refresh cookies
  // (written via the set/remove callbacks below) are preserved on the response.
  // Creating a separate NextResponse inside a sub-function would silently drop
  // those cookies — that is why the activity cookie check is inlined here rather
  // than delegated to session-guard.ts.
  // ============================================================================
  const response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options?: SerializeOptions) {
          response.cookies.set({ name, value, path: '/', ...(options as Record<string, unknown>) });
        },
        remove(name: string, options?: SerializeOptions) {
          response.cookies.set({ name, value: '', path: '/', maxAge: 0, ...(options as Record<string, unknown>) });
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();

  // ============================================================================
  // PLATFORM CONFIG GATES — FIX #5 & #6
  //
  // Reads maintenance_mode and feature flags from platform_config in a single
  // batched query.  Runs for every non-exempt route so the admin can toggle
  // flags in the Emergency Controls page and have them take effect immediately.
  //
  // Exempt routes (never blocked):
  //   • /f9-control/* — admin portal must always remain accessible
  //   • /maintenance   — the destination page itself (prevents redirect loop)
  //   • /api/admin/*   — internal automation / cron endpoints
  //   • /_next/*       — already excluded by the matcher, belt-and-suspenders
  //
  // Performance note: this is a single indexed primary-key-range read on a
  // tiny table (≤ 20 rows). At startup scale this is acceptable.  When load
  // grows, move to an edge KV store (Vercel Edge Config or Upstash) and cache
  // the result for 30 seconds.
  // ============================================================================
  const isExemptFromFlags =
    pathname.startsWith('/f9-control') ||
    pathname.startsWith('/maintenance') ||
    pathname.startsWith('/api/admin/');

  if (!isExemptFromFlags) {
    // Determine which keys are relevant for this specific route so the
    // in-clause stays as narrow as possible.
    const keysToCheck: string[] = [
      'maintenance_mode', // always checked for all non-exempt routes
    ];

    const isApiRoute = pathname.startsWith('/api/');
    const isPost     = request.method === 'POST';

    if (pathname.startsWith('/register') || pathname.startsWith('/api/auth')) {
      keysToCheck.push('registrations_enabled');
    }
    if (pathname.startsWith('/marketplace') || pathname.startsWith('/api/marketplace')) {
      keysToCheck.push('marketplace_enabled');
    }
    if (isApiRoute && pathname.startsWith('/api/orders') && isPost) {
      keysToCheck.push('new_orders_enabled');
    }
    if (isApiRoute && pathname.startsWith('/api/proposals') && isPost) {
      keysToCheck.push('new_proposals_enabled');
    }

    const { data: configs } = await supabase
      .from('platform_config')
      .select('key, enabled')
      .in('key', keysToCheck);

    // Build a key → boolean map.  Missing keys default to their safe state
    // so that a freshly toggled-off row is required to block access.
    const flags: Record<string, boolean | undefined> = {};
    configs?.forEach((c) => { flags[c.key] = c.enabled ?? undefined; });

    // ── FIX #5: Maintenance mode ────────────────────────────────────────────
    // maintenance_mode uses normal logic: enabled = true → maintenance is ON.
    if (flags['maintenance_mode'] === true) {
      if (isApiRoute) {
        return NextResponse.json(
          {
            success: false,
            error:   'Platform is currently undergoing maintenance. Please try again shortly.',
            code:    'MAINTENANCE_MODE',
          },
          { status: 503 }
        );
      }
      return NextResponse.redirect(new URL('/maintenance', request.url));
    }

    // ── FIX #6: Feature flags (invertLogic — enabled=false means the feature is OFF) ─
    //
    // These flags use invertLogic per the EmergencyClient spec:
    //   • "Off is the alarming state" — the row defaults to enabled=true (safe).
    //   • We block only when the row explicitly exists with enabled=false.
    //   • If the row doesn't exist yet (undefined) we do NOT block — safe default.

    const featureChecks: Array<{
      key:     string;
      paths:   string[];
      message: string;
      code:    string;
    }> = [
      {
        key:     'registrations_enabled',
        paths:   ['/register', '/api/auth'],
        message: 'New user registrations are temporarily disabled.',
        code:    'REGISTRATIONS_DISABLED',
      },
      {
        key:     'marketplace_enabled',
        paths:   ['/marketplace', '/api/marketplace'],
        message: 'The marketplace is temporarily unavailable.',
        code:    'MARKETPLACE_DISABLED',
      },
      {
        key:     'new_orders_enabled',
        paths:   ['/api/orders'],
        message: 'New orders are temporarily disabled.',
        code:    'ORDERS_DISABLED',
      },
      {
        key:     'new_proposals_enabled',
        paths:   ['/api/proposals'],
        message: 'New proposals are temporarily disabled.',
        code:    'PROPOSALS_DISABLED',
      },
    ];

    for (const check of featureChecks) {
      // Only evaluate if this route matches one of the feature's paths
      const routeMatches = check.paths.some((p) => pathname.startsWith(p));
      if (!routeMatches) continue;

      // Block only when explicitly disabled (enabled === false)
      if (flags[check.key] === false) {
        if (isApiRoute) {
          return NextResponse.json(
            { success: false, error: check.message, code: check.code },
            { status: 503 }
          );
        }
        // Page route — redirect to maintenance with a context param so
        // the maintenance page can display a feature-specific message.
        const dest = new URL('/maintenance', request.url);
        dest.searchParams.set('reason', check.code);
        return NextResponse.redirect(dest);
      }
    }
  }

  // ============================================================================
  // ADMIN ROUTE PROTECTION (SESSION + ROLE CHECK + INACTIVITY TIMEOUT)
  // A DB query is intentional — role must be verified server-side on every
  // request to reflect real-time profile changes.
  //
  // Three-stage check for every /f9-control/** route except the login page:
  //
  //   Stage 1 — Supabase session present?
  //             No  → redirect to login (not authenticated at all)
  //
  //   Stage 2 — profiles.user_type === 'admin'?
  //             No  → redirect to /dashboard (authenticated but not admin)
  //
  //   Stage 3 — f9_admin_activity cookie present?
  //             No  → redirect to login?reason=timeout (2-hour inactivity lapse)
  //             Yes → refresh the cookie (sliding window) on the shared `response`
  //
  // Stage 3 is inlined here (not delegated to session-guard.ts) because the
  // cookie must be written onto `response` — the same object that already holds
  // Supabase session refresh cookies from the createServerClient callbacks above.
  // A separate NextResponse.next() call inside a helper would silently discard
  // those cookies.
  //
  // Cookie birth: POST /api/admin/session/refresh is called by the login page
  // immediately after successful MFA verification, before router.push('/f9-control').
  // That endpoint verifies the admin role and stamps the initial cookie.
  // Subsequent navigations are refreshed here; idle-reading sessions are kept
  // alive by AdminSessionGuard's periodic pings to the same endpoint.
  // ============================================================================
  const isAdminPath = pathname.startsWith('/f9-control');

  if (isAdminPath && pathname !== '/f9-control/login') {
    // Stage 1: Supabase session
    if (!session) {
      return NextResponse.redirect(new URL('/f9-control/login', request.url));
    }

    // Stage 2: Admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('user_type')
      .eq('id', session.user.id)
      .single();

    if (profile?.user_type !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    // Stage 3: Inactivity timeout via sliding-window cookie
    const activityCookie = request.cookies.get(ADMIN_ACTIVITY_COOKIE);

    if (!activityCookie?.value) {
      // Cookie absent — either never set (should not happen after the login
      // page fix) or expired after 2 hours of zero navigation + zero pings.
      const loginUrl = new URL('/f9-control/login', request.url);
      loginUrl.searchParams.set('reason', 'timeout');
      return NextResponse.redirect(loginUrl);
    }

    // Cookie present — refresh the sliding window.
    // Written onto `response` (the shared object) so Supabase session cookies
    // set in the callbacks above are carried on the same response.
    response.cookies.set(
      ADMIN_ACTIVITY_COOKIE,
      Date.now().toString(),
      adminCookieOptions(),
    );

    // Falls through to `return response` at the bottom.
  }

  // ============================================================================
  // USER ROUTE PROTECTION (TOKEN-BASED ONLY)
  // ============================================================================
  const protectedPaths = [
    '/dashboard',
    '/freelancer',
    '/client',
    '/onboarding',
    '/marketplace',
    '/jobs',
    '/messages',
    '/services',
    '/analytics',
    '/settings',
  ];

  const apiProtectedPaths = [
    '/api/orders',
    '/api/services',
    '/api/payments',
    '/api/proposals',
    '/api/reviews',
  ];

  const isProtectedPath    = protectedPaths.some((p) => pathname.startsWith(p));
  const isProtectedApi     = apiProtectedPaths.some((p) => pathname.startsWith(p));

  if ((isProtectedPath || isProtectedApi) && !session) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Redirect authenticated users away from auth pages
  const authPaths = ['/login', '/register'];
  if (authPaths.includes(pathname) && session) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // ============================================================================
  // CORS HEADERS FOR API RESPONSES
  // ============================================================================
  if (pathname.startsWith('/api/')) {
    response.headers.set('Access-Control-Allow-Origin',  process.env.NEXT_PUBLIC_APP_URL || '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  // ============================================================================
  // ATTACH USER ID TO REQUEST HEADERS (FOR API ROUTES)
  // ============================================================================
  if (session?.user && pathname.startsWith('/api/')) {
    response.headers.set('x-user-id',    session.user.id);
    response.headers.set('x-user-email', session.user.email || '');
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};