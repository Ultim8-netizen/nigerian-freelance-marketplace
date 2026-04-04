'use client';
// src/components/admin/AdminSessionGuard.tsx
//
// Two-layer admin session enforcement:
//
// Layer 1 — SERVER (authoritative)
//   The middleware in src/lib/admin/session-guard.ts checks the
//   f9_admin_activity cookie on every admin page request.  If the cookie is
//   absent (2-hour maxAge elapsed with no navigation or pings), the request
//   is redirected to /f9-control/login?reason=timeout before React even loads.
//
// Layer 2 — CLIENT (UX / fast-feedback)
//   This component provides immediate feedback when the browser is idle:
//   • Tracks DOM activity (mousemove, keydown, etc.).
//   • Pings POST /api/admin/session/refresh on activity (debounced to max
//     once per 30 s) so the server-side cookie stays alive while the admin
//     reads a page without navigating.
//   • Independently counts down TIMEOUT_MS; on expiry it signs the user out
//     and redirects without waiting for the next page navigation.
//   • If the server ping returns 401/403, an expired/revoked session is
//     detected immediately instead of waiting for the next navigation.
//
// Result: the timeout is enforced regardless of JS availability (server layer)
// AND gives instant feedback when JS is present (client layer).

import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toast } from '@/hooks/use-toast';

// Must match ADMIN_TIMEOUT_SECONDS in src/lib/admin/session.ts
const TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours

// How often the client proactively pings the server while the page is open.
// Even without DOM events this ensures the cookie survives long reading sessions.
const PERIODIC_PING_MS = 10 * 60 * 1000; // 10 minutes

// Minimum gap between pings triggered by DOM events (debounce floor).
const PING_DEBOUNCE_MS = 30 * 1000; // 30 seconds

export function AdminSessionGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  // Client-side countdown timer
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Periodic server ping interval
  const periodicPingRef = useRef<NodeJS.Timeout | null>(null);

  // Timestamp of the last successful server ping (debounce guard)
  const lastPingRef = useRef<number>(0);

  // ── Server ping ───────────────────────────────────────────────────────────

  const pingServer = useCallback(async () => {
    const now = Date.now();
    if (now - lastPingRef.current < PING_DEBOUNCE_MS) return;
    lastPingRef.current = now;

    try {
      const res = await fetch('/api/admin/session/refresh', {
        method: 'POST',
        // Credentials ensure the Supabase auth cookie is sent cross-origin
        credentials: 'same-origin',
      });

      if (res.status === 401 || res.status === 403) {
        // Server already considers the session invalid — don't wait for the
        // countdown; redirect immediately.
        router.push('/f9-control/login?reason=timeout');
      }
    } catch {
      // Network error: leave the client countdown running.
      // The middleware will catch the expired cookie on the next navigation.
    }
  }, [router]);

  // ── Client-side countdown (UX layer) ──────────────────────────────────────

  useEffect(() => {
    const supabase = createClient();

    /** Called when the client-side countdown reaches zero. */
    const handleClientExpiry = async () => {
      // Sign out the Supabase session on the client.
      await supabase.auth.signOut();
      toast({
        title: 'Session Expired',
        description: 'You have been logged out due to 2 hours of inactivity.',
        variant: 'destructive',
      });
      router.push('/f9-control/login');
    };

    /** Resets the 2-hour client countdown. */
    const resetCountdown = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(handleClientExpiry, TIMEOUT_MS);
    };

    /** Fired on every tracked DOM event. */
    const handleActivity = () => {
      resetCountdown();
      pingServer(); // Refresh the server-side cookie (debounced)
    };

    // ── Initialise ──────────────────────────────────────────────────────────
    resetCountdown();

    // Periodic ping keeps the cookie alive even if the admin just reads without
    // interacting with the DOM (e.g. reading a long report).
    periodicPingRef.current = setInterval(pingServer, PERIODIC_PING_MS);

    // Passive listeners don't block scroll/paint — safe to attach broadly.
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, handleActivity, { passive: true }));

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (periodicPingRef.current) clearInterval(periodicPingRef.current);
      events.forEach((e) => window.removeEventListener(e, handleActivity));
    };
  }, [router, pingServer]);

  return <>{children}</>;
}