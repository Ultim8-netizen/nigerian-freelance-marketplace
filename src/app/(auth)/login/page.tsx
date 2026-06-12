'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { loginSchema } from '@/lib/validations';
import { createClient } from '@/lib/supabase/client';
import { SupabaseClient } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { AlertCircle, Loader2, Beaker, ShieldCheck, ArrowLeft } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type LoginFormInput = {
  email: string;
  password: string;
  remember_me?: boolean;
};

type LoginFormData = z.infer<typeof loginSchema>;

// Two-step flow: credentials first, then optional MFA challenge.
type LoginStep = 'credentials' | 'mfa';

// ── Component ─────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();

  // ── Core state ──────────────────────────────────────────────────────────────
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isDev, setIsDev] = useState(false);

  // ── MFA state ───────────────────────────────────────────────────────────────
  // loginStep drives which panel is rendered. mfaFactorId / mfaChallengeId
  // are stored after challenge() succeeds and consumed by verify().
  const [loginStep, setLoginStep] = useState<LoginStep>('credentials');
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaChallengeId, setMfaChallengeId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaError, setMfaError] = useState<string | null>(null);

  // ── Supabase client (stable ref across renders) ──────────────────────────
  const [supabase] = useState(() => createClient() as SupabaseClient);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormInput, unknown, LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', remember_me: false },
  });

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') setIsDev(true);
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const handleDevFill = () => {
    setValue('email', 'user@example.com', { shouldValidate: true });
    setValue('password', 'password123', { shouldValidate: true });
  };

  /**
   * Final step shared by both the no-MFA and post-MFA paths.
   * Ensures profile/wallet exist before redirecting to dashboard.
   */
  const completeLogin = async () => {
    const profileResponse = await fetch('/api/auth/create-profile', { method: 'POST' });

    if (!profileResponse.ok) {
      const errData = await profileResponse.json();
      throw new Error(
        errData.error || 'Login succeeded but profile creation failed. Please contact support.'
      );
    }

    router.push('/dashboard');
    router.refresh();
  };

  // ── Credential submission ─────────────────────────────────────────────────

  const onSubmit: SubmitHandler<LoginFormInput> = async (data) => {
    setIsLoading(true);
    setAuthError(null);

    try {
      // 1. Authenticate with password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });
      if (signInError) throw signInError;

      // 2. Check whether MFA is required (AAL2 enforcement)
      //    getAuthenticatorAssuranceLevel is only meaningful after a valid
      //    session exists, which signInWithPassword just created (at aal1).
      const { data: aalData, error: aalError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

      if (aalError) {
        // Non-fatal — if we can't determine the level, skip MFA check and
        // proceed. Worst case: a user with MFA enrolled is let through at
        // aal1, which Supabase's server-side policies can enforce separately.
        console.warn('AAL check failed, proceeding without MFA:', aalError.message);
        await completeLogin();
        return;
      }

      if (
        aalData.nextLevel === 'aal2' &&
        aalData.currentLevel !== 'aal2'
      ) {
        // MFA is enrolled and required — initiate challenge.
        const { data: factorsData, error: factorsError } =
          await supabase.auth.mfa.listFactors();

        if (factorsError || !factorsData?.totp?.length) {
          // Edge case: aal2 required but no TOTP factor found.
          // This indicates a broken MFA state. Surface it clearly.
          throw new Error(
            'Two-factor authentication is required but no authenticator app is enrolled. ' +
              'Please contact support.'
          );
        }

        const totpFactor = factorsData.totp[0];

        const { data: challengeData, error: challengeError } =
          await supabase.auth.mfa.challenge({ factorId: totpFactor.id });

        if (challengeError) throw challengeError;

        // Store challenge identifiers and switch UI to MFA step.
        setMfaFactorId(totpFactor.id);
        setMfaChallengeId(challengeData.id);
        setLoginStep('mfa');
        setIsLoading(false);
        return; // Do NOT redirect yet — wait for TOTP code.
      }

      // 3. No MFA required — proceed directly.
      await completeLogin();
    } catch (error: unknown) {
      console.error('Login error:', error);
      setAuthError(error instanceof Error ? error.message : 'Failed to sign in');
    } finally {
      setIsLoading(false);
    }
  };

  // ── MFA verification ──────────────────────────────────────────────────────

  const handleMfaVerify = async () => {
    if (!mfaFactorId || !mfaChallengeId) return;

    setIsLoading(true);
    setMfaError(null);

    try {
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: mfaChallengeId,
        code: mfaCode.trim(),
      });

      if (verifyError) throw verifyError;

      // Session is now at aal2 — complete login.
      await completeLogin();
    } catch (error: unknown) {
      console.error('MFA verification error:', error);
      setMfaError(
        error instanceof Error ? error.message : 'Invalid verification code. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * User wants to sign in with different credentials.
   * Sign out the existing aal1 session before returning to the form.
   */
  const handleMfaBack = async () => {
    await supabase.auth.signOut();
    setLoginStep('credentials');
    setMfaFactorId(null);
    setMfaChallengeId(null);
    setMfaCode('');
    setMfaError(null);
    setAuthError(null);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="container mx-auto flex items-center justify-center min-h-[calc(100vh-4rem)] px-4 py-8">
      <Card className="max-w-md w-full p-8 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xl rounded-2xl">

        {/* ── Header — title changes per step ── */}
        <div className="text-center mb-8">
          {loginStep === 'mfa' ? (
            <>
              <div className="flex justify-center mb-4">
                <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                  <ShieldCheck className="w-7 h-7 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <h1 className="text-3xl font-bold bg-linear-to-r from-primary to-blue-600 bg-clip-text text-transparent mb-2">
                Two-Factor Verification
              </h1>
              <p className="text-gray-500 dark:text-gray-400">
                Enter the 6-digit code from your authenticator app
              </p>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-bold bg-linear-to-r from-primary to-blue-600 bg-clip-text text-transparent mb-2">
                Welcome Back
              </h1>
              <p className="text-gray-500 dark:text-gray-400">
                Sign in to access your dashboard
              </p>
            </>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            STEP: CREDENTIALS
        ══════════════════════════════════════════════════════════════════════ */}
        {loginStep === 'credentials' && (
          <>
            {/* Dev Mode Toolbar */}
            {isDev && (
              <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2 text-blue-700 text-sm font-medium">
                  <Beaker className="w-4 h-4" />
                  <span>Dev Mode Active</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDevFill}
                  className="h-7 text-xs border-blue-300 text-blue-700 hover:bg-blue-100"
                >
                  Fill Test User
                </Button>
              </div>
            )}

            {/* Error Display */}
            {authError && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3 text-red-600 dark:text-red-400">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p className="text-sm font-medium">{authError}</p>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  {...register('email')}
                  className={errors.email ? 'border-red-500 focus-visible:ring-red-500' : ''}
                  disabled={isLoading}
                />
                {errors.email && (
                  <p className="text-sm text-red-500 mt-1">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    href="/forgot-password"
                    className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  {...register('password')}
                  className={errors.password ? 'border-red-500 focus-visible:ring-red-500' : ''}
                  disabled={isLoading}
                />
                {errors.password && (
                  <p className="text-sm text-red-500 mt-1">{errors.password.message}</p>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="remember_me"
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  {...register('remember_me')}
                  disabled={isLoading}
                />
                <Label
                  htmlFor="remember_me"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Remember me
                </Label>
              </div>

              <Button
                type="submit"
                className="w-full h-11 text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>

            <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
              Don&apos;t have an account?{' '}
              <Link
                href="/register"
                className="font-semibold text-primary hover:text-primary/80 transition-colors hover:underline"
              >
                Create account
              </Link>
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            STEP: MFA
        ══════════════════════════════════════════════════════════════════════ */}
        {loginStep === 'mfa' && (
          <>
            {/* MFA Error Display */}
            {mfaError && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3 text-red-600 dark:text-red-400">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p className="text-sm font-medium">{mfaError}</p>
              </div>
            )}

            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="mfa_code">Verification Code</Label>
                <Input
                  id="mfa_code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="000000"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                  className="text-center text-2xl tracking-[0.5em] font-mono h-14"
                  disabled={isLoading}
                  autoFocus
                  autoComplete="one-time-code"
                />
                <p className="text-xs text-gray-500 text-center">
                  Open your authenticator app and enter the current 6-digit code.
                </p>
              </div>

              <Button
                onClick={handleMfaVerify}
                disabled={isLoading || mfaCode.length !== 6}
                className="w-full h-11 text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify & Sign In'
                )}
              </Button>

              <button
                type="button"
                onClick={handleMfaBack}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors disabled:opacity-50"
              >
                <ArrowLeft className="w-4 h-4" />
                Use a different account
              </button>
            </div>
          </>
        )}

      </Card>
    </div>
  );
}