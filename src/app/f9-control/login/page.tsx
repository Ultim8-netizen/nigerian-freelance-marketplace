'use client';

// src/app/f9-control/login/page.tsx
// UPDATED: Credential validation moved to /api/admin/auth (server-side) for
//          IP-based rate limiting and breach email alerts.
//          MFA challenge/verify remain client-side — they use the session
//          cookies set by the server route during signInWithPassword.
// ADDED:   After successful MFA verification, POST /api/admin/session/refresh
//          is called before router.push('/f9-control').  This stamps the
//          f9_admin_activity HttpOnly cookie that middleware checks on every
//          subsequent admin request.  Without this call the first navigation
//          after login would immediately redirect back here with ?reason=timeout.
// ADDED:   ?reason=timeout search param is read on mount and shown as an error
//          banner — surfaced when middleware redirects an expired session.

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shield } from 'lucide-react';

// ─── Inner component (needs useSearchParams → must be inside Suspense) ────────

function AdminLogin() {
  const router   = useRouter();
  const params   = useSearchParams();
  const supabase = createClient();

  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [mfaCode,     setMfaCode]     = useState('');
  const [requiresMfa, setRequiresMfa] = useState(false);
  const [isLoading,   setIsLoading]   = useState(false);
  const [error,       setError]       = useState('');
  const [retryAfter,  setRetryAfter]  = useState<string | null>(null);

  const [factorId,    setFactorId]    = useState('');
  const [challengeId, setChallengeId] = useState('');

  // ── Show timeout banner when redirected by middleware ─────────────────────
  useEffect(() => {
    if (params.get('reason') === 'timeout') {
      setError('Your session expired after 2 hours of inactivity. Please log in again.');
    }
  }, [params]);

  // ── Step 1: credential login (proxied through server route) ───────────────
  //
  // The /api/admin/auth route applies IP-based rate limiting (3 attempts /
  // 15 min) and sends a breach alert email — neither is possible client-side.
  // It calls supabase.auth.signInWithPassword via the SSR server client, which
  // writes the Supabase session to HttpOnly cookies available to Step 2 below.

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setRetryAfter(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/admin/auth', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.status === 429) {
        const resetAt = data.resetAt ? new Date(data.resetAt).toLocaleTimeString() : null;
        setRetryAfter(resetAt);
        setError(data.error ?? 'Too many login attempts. Please wait before trying again.');
        return;
      }

      if (!response.ok) {
        setError(data.error ?? 'Authentication failed.');
        return;
      }

      // Credentials accepted — server has set Supabase session cookies.
      // Initiate MFA challenge using the browser client (reads those cookies).
      const { data: challengeData, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId: data.factorId });

      if (challengeError || !challengeData) {
        setError('MFA challenge failed. Please try again.');
        return;
      }

      setFactorId(data.factorId);
      setChallengeId(challengeData.id);
      setRequiresMfa(true);
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Step 2: TOTP verification ──────────────────────────────────────────────
  //
  // After mfa.verify() succeeds the Supabase session is fully established.
  // We then call /api/admin/session/refresh to stamp the f9_admin_activity
  // HttpOnly cookie.  Middleware checks for this cookie on every /f9-control
  // request — if it's absent (first navigation, or expired after 2h inactivity)
  // the request is redirected back here with ?reason=timeout.
  //
  // Without this POST the very first router.push('/f9-control') after login
  // would be caught by middleware's Stage 3 check and immediately redirected
  // back to this page, even though the session is valid.

  const verifyMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const { error: mfaError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId,
        code: mfaCode,
      });

      if (mfaError) {
        setError('Invalid or expired MFA code. Please try again with a fresh code from your authenticator app.');
        // Refresh challenge so next attempt doesn't fail with a stale ID
        const { data: newChallenge } = await supabase.auth.mfa.challenge({ factorId });
        if (newChallenge) setChallengeId(newChallenge.id);
        return;
      }

      // ── Stamp the server-side activity cookie before navigating ───────────
      // The Supabase session cookies are now set in the browser.  The refresh
      // endpoint re-validates the session server-side, confirms user_type=admin,
      // and writes f9_admin_activity with maxAge=7200 (2 hours).
      const refreshRes = await fetch('/api/admin/session/refresh', {
        method:      'POST',
        credentials: 'same-origin', // sends Supabase auth cookies
      });

      if (!refreshRes.ok) {
        // This should only happen if the profile row is missing or user_type
        // is not 'admin' — surface as an auth error rather than silently
        // navigating to a page that will immediately redirect back here.
        setError('Session initialisation failed. Verify that this account has admin access.');
        return;
      }
      // ─────────────────────────────────────────────────────────────────────

      router.push('/f9-control');
    } catch {
      setError('Verification failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-gray-900 border border-gray-800 rounded-xl p-8 shadow-2xl">
        <div className="flex justify-center mb-6">
          <Shield className="w-12 h-12 text-blue-500" />
        </div>
        <h1 className="text-2xl font-bold text-white text-center mb-6">F9 Command</h1>

        {error && (
          <div className="p-3 mb-4 bg-red-900/50 text-red-400 text-sm rounded">
            {error}
            {retryAfter && (
              <p className="mt-1 text-red-500 text-xs">
                Access unblocked at approximately {retryAfter}.
              </p>
            )}
          </div>
        )}

        {!requiresMfa ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              type="email"
              placeholder="System Email"
              className="bg-gray-800 text-white border-gray-700"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              required
            />
            <Input
              type="password"
              placeholder="Passphrase"
              className="bg-gray-800 text-white border-gray-700"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              required
            />
            {/* No "Forgot password" link per spec — out-of-band recovery only */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white"
            >
              {isLoading ? 'Authenticating…' : 'Authenticate'}
            </Button>
          </form>
        ) : (
          <form onSubmit={verifyMfa} className="space-y-4">
            <p className="text-gray-400 text-sm text-center">
              Enter the 6-digit code from your authenticator app.
            </p>
            <Input
              type="text"
              inputMode="numeric"
              placeholder="000000"
              className="bg-gray-800 text-white border-gray-700 text-center tracking-widest text-xl"
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              disabled={isLoading}
              required
              maxLength={6}
              autoFocus
            />
            <Button
              type="submit"
              disabled={mfaCode.length !== 6 || isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white"
            >
              {isLoading ? 'Verifying…' : 'Verify & Enter'}
            </Button>
            <button
              type="button"
              onClick={() => { setRequiresMfa(false); setMfaCode(''); setError(''); }}
              className="w-full text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              ← Back
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Page export — Suspense required by Next.js App Router when a Client
//     Component subtree calls useSearchParams() ─────────────────────────────

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950" />}>
      <AdminLogin />
    </Suspense>
  );
}