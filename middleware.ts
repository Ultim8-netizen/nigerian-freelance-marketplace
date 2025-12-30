// middleware.ts
// OPTIMIZED: Fast token validation only, no DB queries
import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { SerializeOptions } from 'cookie';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ============================================================================
  // CORS HANDLING FOR API ROUTES
  // ============================================================================
  if (pathname.startsWith('/api/')) {
    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_APP_URL || '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        },
      });
    }
  }

  // ============================================================================
  // SESSION REFRESH (NO DB QUERIES)
  // ============================================================================
  // FIXED: Changed 'let' to 'const' as the response object reference is never reassigned
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options?: SerializeOptions) {
          const opts = { path: '/', ...(options as Record<string, unknown> | undefined) };
          response.cookies.set({ name, value, ...opts });
        },
        remove(name: string, options?: SerializeOptions) {
          const opts = { path: '/', ...(options as Record<string, unknown> | undefined), maxAge: 0 };
          response.cookies.set({ name, value: '', ...opts });
        },
      },
    }
  );

  // CRITICAL: Use getSession() instead of getUser()
  // getSession() only validates the JWT token locally (no DB call)
  const { data: { session } } = await supabase.auth.getSession();

  // ============================================================================
  // ROUTE PROTECTION (TOKEN-BASED ONLY)
  // ============================================================================
  const protectedPaths = [
    '/dashboard',
    '/freelancer',
    '/client',
    '/onboarding',
    '/marketplace',
  ];
  
  const apiProtectedPaths = [
    '/api/orders',
    '/api/services',
    '/api/payments',
    '/api/proposals',
    '/api/reviews',
  ];

  const isProtectedPath = protectedPaths.some((path) => pathname.startsWith(path));
  const isProtectedApi = apiProtectedPaths.some((path) => pathname.startsWith(path));

  // Redirect to login if accessing protected routes without session
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
  // ADD CORS HEADERS FOR API ROUTES
  // ============================================================================
  if (pathname.startsWith('/api/')) {
    response.headers.set('Access-Control-Allow-Origin', process.env.NEXT_PUBLIC_APP_URL || '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  // ============================================================================
  // ATTACH USER ID TO REQUEST HEADERS (FOR API ROUTES)
  // ============================================================================
  if (session?.user && pathname.startsWith('/api/')) {
    response.headers.set('x-user-id', session.user.id);
    response.headers.set('x-user-email', session.user.email || '');
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};