// middleware.ts
// FIXED: Added '/jobs' to protectedPaths — the new /jobs/[id] page requires authentication.
// ADDED: Admin route protection for '/f9-control' — enforces session + 'admin' user_type role.
// ADDED: Automation route protection for '/api/admin/automation' — enforces CRON_SECRET bearer token.
// FIX #5: maintenance_mode platform_config flag is now read and enforced here.
// FIX #6: registrations_enabled, marketplace_enabled, new_orders_enabled,
//         new_proposals_enabled flags are now read and enforced here.

import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { SerializeOptions } from 'cookie';

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
  // ADMIN ROUTE PROTECTION (SESSION + ROLE CHECK)
  // A DB query is intentional — role must be verified server-side on every
  // request to reflect real-time profile changes.
  // ============================================================================
  const isAdminPath = pathname.startsWith('/f9-control');

  if (isAdminPath && pathname !== '/f9-control/login') {
    if (!session) {
      return NextResponse.redirect(new URL('/f9-control/login', request.url));
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('user_type')
      .eq('id', session.user.id)
      .single();

    if (profile?.user_type !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
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