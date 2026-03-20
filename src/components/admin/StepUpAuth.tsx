'use client';

/**
 * StepUpAuth — TOTP re-authentication gate for nuclear admin actions.
 *
 * Usage pattern:
 *
 *   const { requireStepUp, StepUpModal } = useStepUpAuth();
 *
 *   // In JSX:
 *   <StepUpModal />
 *
 *   // Before a nuclear server action:
 *   await requireStepUp(async () => {
 *     await onBan(formData);
 *   });
 *
 * `requireStepUp` opens the modal and resolves only after the admin
 * enters a valid fresh TOTP code. If they cancel or the code is wrong
 * the promise rejects and the caller's action is never executed.
 */

import { useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Loader2, ShieldCheck, X } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type StepUpStatus =
  | 'idle'
  | 'loading_challenge'   // fetching factor + creating MFA challenge
  | 'awaiting_code'       // challenge ready, waiting for admin to type code
  | 'verifying'           // code submitted, calling mfa.verify
  | 'error';

interface StepUpModalProps {
  isOpen:    boolean;
  status:    StepUpStatus;
  errorMsg:  string | null;
  code:      string;
  onCodeChange: (v: string) => void;
  onSubmit:  () => void;
  onCancel:  () => void;
}

// ─── Modal UI ─────────────────────────────────────────────────────────────────

function StepUpModalUI({
  isOpen,
  status,
  errorMsg,
  code,
  onCodeChange,
  onSubmit,
  onCancel,
}: StepUpModalProps) {
  if (!isOpen) return null;

  const isPending = status === 'loading_challenge' || status === 'verifying';
  const isReady   = status === 'awaiting_code' || status === 'error';

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      {/* Dialog */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-5">

        {/* Close button */}
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="absolute top-4 right-4 p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
          aria-label="Cancel"
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div className="flex flex-col items-center text-center gap-2">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
            <ShieldCheck size={24} className="text-red-600" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">Step-Up Authentication</h2>
          <p className="text-sm text-gray-500">
            This action requires a fresh verification code from your authenticator app.
          </p>
        </div>

        {/* Loading challenge */}
        {status === 'loading_challenge' && (
          <div className="flex items-center justify-center gap-2 py-4 text-sm text-gray-500">
            <Loader2 size={16} className="animate-spin" />
            Preparing challenge…
          </div>
        )}

        {/* Code input */}
        {isReady && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2 text-center uppercase tracking-wider">
                6-digit Authenticator Code
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => onCodeChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={(e) => { if (e.key === 'Enter' && code.length === 6) onSubmit(); }}
                placeholder="000000"
                autoFocus
                className="w-full text-center text-2xl font-mono tracking-[0.5em] px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-colors"
              />
            </div>

            {errorMsg && (
              <p className="text-xs text-red-600 text-center font-medium">{errorMsg}</p>
            )}

            <button
              type="button"
              onClick={onSubmit}
              disabled={code.length !== 6 || isPending}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl transition-colors"
            >
              {isPending && <Loader2 size={14} className="animate-spin" />}
              Verify & Proceed
            </button>

            <button
              type="button"
              onClick={onCancel}
              disabled={isPending}
              className="w-full py-2 text-sm text-gray-500 hover:text-gray-800 font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Returns:
 *   requireStepUp(action) — opens the modal; resolves after successful
 *                           TOTP verification then runs `action`, or
 *                           rejects if the admin cancels / fails.
 *   StepUpModal           — the React element to mount once in the component.
 */
export function useStepUpAuth() {
  const [isOpen,    setIsOpen]    = useState(false);
  const [status,    setStatus]    = useState<StepUpStatus>('idle');
  const [errorMsg,  setErrorMsg]  = useState<string | null>(null);
  const [code,      setCode]      = useState('');

  // We park the pending action + resolve/reject callbacks here while the
  // modal is open so the hook never needs to close over them in render.
  const pendingAction  = useRef<(() => Promise<void>) | null>(null);
  const resolveRef     = useRef<(() => void) | null>(null);
  const rejectRef      = useRef<((reason?: unknown) => void) | null>(null);
  const challengeIdRef = useRef<string | null>(null);
  const factorIdRef    = useRef<string | null>(null);

  // ── Open modal & kick off MFA challenge ─────────────────────────────────

  const requireStepUp = useCallback(async (action: () => Promise<void>): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      pendingAction.current = action;
      resolveRef.current    = resolve;
      rejectRef.current     = reject;

      setCode('');
      setErrorMsg(null);
      setStatus('loading_challenge');
      setIsOpen(true);

      // Kick off challenge creation as a side-effect after state is queued
      void (async () => {
        try {
          const supabase = createClient();

          // Retrieve the admin's verified TOTP factor
          const { data: factorData, error: factorError } =
            await supabase.auth.mfa.listFactors();

          if (factorError) throw new Error('Failed to retrieve MFA factors.');

          const totp = factorData?.totp?.find((f) => f.factor_type === 'totp' && f.status === 'verified');

          if (!totp) {
            throw new Error(
              'No verified TOTP factor found on this account. Enrol in MFA before performing nuclear actions.'
            );
          }

          factorIdRef.current = totp.id;

          // Create a fresh challenge
          const { data: challengeData, error: challengeError } =
            await supabase.auth.mfa.challenge({ factorId: totp.id });

          if (challengeError || !challengeData) {
            throw new Error('Failed to create MFA challenge. Please try again.');
          }

          challengeIdRef.current = challengeData.id;
          setStatus('awaiting_code');
        } catch (err) {
          const message = err instanceof Error ? err.message : 'MFA setup error.';
          setErrorMsg(message);
          setStatus('error');
        }
      })();
    });
  }, []);

  // ── Verify submitted code ────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (!factorIdRef.current || !challengeIdRef.current) return;
    if (code.length !== 6) return;

    setStatus('verifying');
    setErrorMsg(null);

    try {
      const supabase = createClient();
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId:    factorIdRef.current,
        challengeId: challengeIdRef.current,
        code,
      });

      if (verifyError) {
        // Most common case: wrong / expired code
        setErrorMsg('Invalid or expired code. Please try again with a fresh code.');
        setStatus('error');

        // Create a new challenge automatically so the admin can retry
        // without having to reopen the modal
        const { data: newChallenge } = await supabase.auth.mfa.challenge({
          factorId: factorIdRef.current,
        });
        if (newChallenge) {
          challengeIdRef.current = newChallenge.id;
          setStatus('awaiting_code');
        }
        return;
      }

      // ✓ Verified — run the action
      setIsOpen(false);
      setStatus('idle');

      if (pendingAction.current) {
        try {
          await pendingAction.current();
          resolveRef.current?.();
        } catch (actionErr) {
          rejectRef.current?.(actionErr);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Verification failed.';
      setErrorMsg(message);
      setStatus('error');
    } finally {
      setCode('');
      pendingAction.current  = null;
      factorIdRef.current    = null;
      challengeIdRef.current = null;
    }
  }, [code]);

  // ── Cancel ───────────────────────────────────────────────────────────────

  const handleCancel = useCallback(() => {
    setIsOpen(false);
    setStatus('idle');
    setCode('');
    setErrorMsg(null);
    pendingAction.current  = null;
    challengeIdRef.current = null;
    factorIdRef.current    = null;
    rejectRef.current?.(new Error('Step-up authentication cancelled.'));
    resolveRef.current  = null;
    rejectRef.current   = null;
  }, []);

  // ── Return ────────────────────────────────────────────────────────────────

  const StepUpModal = (
    <StepUpModalUI
      isOpen={isOpen}
      status={status}
      errorMsg={errorMsg}
      code={code}
      onCodeChange={setCode}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
    />
  );

  return { requireStepUp, StepUpModal };
}