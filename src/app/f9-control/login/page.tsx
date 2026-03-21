'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shield } from 'lucide-react';

export default function AdminLogin() {
  const router   = useRouter();
  const supabase = createClient();

  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [mfaCode,     setMfaCode]     = useState('');
  const [requiresMfa, setRequiresMfa] = useState(false);
  const [error,       setError]       = useState('');

  // FIX #9 — Both factorId AND challengeId must be stored in state.
  // The previous code stored only factorId and then passed factorId as
  // challengeId to mfa.verify(), which is wrong — they are different values.
  // challengeId comes from the .data.id of supabase.auth.mfa.challenge().
  const [factorId,    setFactorId]    = useState('');
  const [challengeId, setChallengeId] = useState('');

  // ── Step 1: credential login ──────────────────────────────────────────────

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError('Invalid credentials.');
      return;
    }

    // Require a verified TOTP factor — block if not enrolled
    const factors    = data.user?.factors ?? [];
    const totpFactor = factors.find(
      (f) => f.factor_type === 'totp' && f.status === 'verified'
    );

    if (!totpFactor) {
      await supabase.auth.signOut();
      setError('MFA is mandatory. This account has no verified TOTP factor. Enrol via the secure setup script before logging in.');
      return;
    }

    // Create MFA challenge
    const { data: challengeData, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId: totpFactor.id });

    if (challengeError || !challengeData) {
      setError('MFA challenge failed. Please try again.');
      return;
    }

    // FIX #9 — Store both IDs separately
    setFactorId(totpFactor.id);
    setChallengeId(challengeData.id);  // ← was discarded in the original code
    setRequiresMfa(true);
  };

  // ── Step 2: TOTP verification ─────────────────────────────────────────────

  const verifyMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const { error: mfaError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId, // FIX #9 — now the real challenge ID, not factorId
      code: mfaCode,
    });

    if (mfaError) {
      setError('Invalid or expired MFA code. Please try again with a fresh code from your authenticator app.');
      // Refresh the challenge so the next attempt doesn't fail with a stale challenge ID
      const { data: newChallenge } = await supabase.auth.mfa.challenge({ factorId });
      if (newChallenge) setChallengeId(newChallenge.id);
      return;
    }

    router.push('/f9-control');
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
              required
            />
            <Input
              type="password"
              placeholder="Passphrase"
              className="bg-gray-800 text-white border-gray-700"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {/* No "Forgot password" link per spec — out-of-band recovery only */}
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white">
              Authenticate
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
              required
              maxLength={6}
              autoFocus
            />
            <Button
              type="submit"
              disabled={mfaCode.length !== 6}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white"
            >
              Verify &amp; Enter
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