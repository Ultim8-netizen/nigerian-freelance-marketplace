// src/lib/supabase/middleware.ts
// Standalone session-refresh utility for simpler middleware use cases.
//
// NOTE: The root middleware.ts does not call updateSession — it builds its own
// inline Supabase client with additional guards (platform flags, admin RBAC,
// inactivity timeout). Use this utility in lighter-weight middleware that only
// needs token refresh.
//
// FIX: The previous implementation reassigned `response` to a new
// NextResponse.next() inside the set/remove cookie callbacks. Each reassignment
// discarded all cookies written by prior callbacks. The response is now created
// once before the client is instantiated and never replaced.

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  // Single response object for the lifetime of this call.
  // All cookie mutations must target this instance.
  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          // Write onto the single response — never create a new NextResponse here.
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: '', maxAge: 0, ...options });
        },
      },
    }
  );

  // FIX: getUser() validates the JWT against the Supabase auth server.
  // getSession() only reads the cookie and does not verify the signature.
  await supabase.auth.getUser();

  return response;
}