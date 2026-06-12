// middleware.ts
import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { SerializeOptions } from 'cookie';
import { createAdminClient } from '@/lib/supabase/admin';
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
  // SESSION REFRESH
  // All subsequent checks share this single response object so Supabase session
  // refresh cookies are never dropped by an accidental NextResponse.next() call
  // inside a sub-function.
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

  // FIX (Critical): getUser() performs a server-side JWT verification against
  // the Supabase auth server. getSession() only reads the cookie without
  // cryptographic validation — a forged cookie would bypass every guard below.
  const { data: { user } } = await supabase.auth.getUser();

  // ============================================================================
  // PLATFORM CONFIG GATES
  // FIX (Critical): platform_config is read via the service-role client.
  // Using the anon client here means configs is null for unauthenticated
  // visitors when RLS does not grant anon SELECT — maintenance mode and all
  // feature flags silently do nothing for logged-out users.
  // @supabase/supabase-js v2 is Edge-runtime compatible; createAdminClient is
  // safe to call here.
  // ============================================================================
  const isExemptFromFlags =
    pathname.startsWith('/f9-control') ||
    pathname.startsWith('/maintenance') ||
    pathname.startsWith('/api/admin/');

  if (!isExemptFromFlags) {
    const keysToCheck: string[] = ['maintenance_mode'];

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

    const adminClient = createAdminClient();
    const { data: configs } = await adminClient
      .from('platform_config')
      .select('key, enabled')
      .in('key', keysToCheck);

    const flags: Record<string, boolean | undefined> = {};
    configs?.forEach((c) => { flags[c.key] = c.enabled ?? undefined; });

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
      const routeMatches = check.paths.some((p) => pathname.startsWith(p));
      if (!routeMatches) continue;

      if (flags[check.key] === false) {
        if (isApiRoute) {
          return NextResponse.json(
            { success: false, error: check.message, code: check.code },
            { status: 503 }
          );
        }
        const dest = new URL('/maintenance', request.url);
        dest.searchParams.set('reason', check.code);
        return NextResponse.redirect(dest);
      }
    }
  }

  // ============================================================================
  // ADMIN ROUTE PROTECTION (SESSION + ROLE CHECK + INACTIVITY TIMEOUT)
  // ============================================================================
  const isAdminPath = pathname.startsWith('/f9-control');

  if (isAdminPath && pathname !== '/f9-control/login') {
    // Stage 1: verified session
    if (!user) {
      return NextResponse.redirect(new URL('/f9-control/login', request.url));
    }

    // Stage 2: admin role (intentional DB round-trip — reflects real-time changes)
    const { data: profile } = await supabase
      .from('profiles')
      .select('user_type')
      .eq('id', user.id)
      .single();

    if (profile?.user_type !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    // Stage 3: sliding-window inactivity cookie
    const activityCookie = request.cookies.get(ADMIN_ACTIVITY_COOKIE);

    if (!activityCookie?.value) {
      const loginUrl = new URL('/f9-control/login', request.url);
      loginUrl.searchParams.set('reason', 'timeout');
      return NextResponse.redirect(loginUrl);
    }

    // Refresh the window onto the shared response so Supabase cookies are preserved.
    response.cookies.set(
      ADMIN_ACTIVITY_COOKIE,
      Date.now().toString(),
      adminCookieOptions(),
    );
  }

  // ============================================================================
  // USER ROUTE PROTECTION
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

  const isProtectedPath = protectedPaths.some((p) => pathname.startsWith(p));
  const isProtectedApi  = apiProtectedPaths.some((p) => pathname.startsWith(p));

  if ((isProtectedPath || isProtectedApi) && !user) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  const authPaths = ['/login', '/register'];
  if (authPaths.includes(pathname) && user) {
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
  if (user && pathname.startsWith('/api/')) {
    response.headers.set('x-user-id',    user.id);
    response.headers.set('x-user-email', user.email || '');
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};