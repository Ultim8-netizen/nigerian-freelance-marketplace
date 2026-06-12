// src/components/verification/LivenessVerificationCard.tsx
//
// FIXES applied:
//  Previously this was a complete mock: hardcoded success, fake setTimeout
//  delay, no real MediaPipe, no call to /api/verification/liveness/submit.
//  Every user who went through the UI was fraudulently "verified".
//
//  This file is now the real coordinator component:
//    1. Renders an intro screen (idle state).
//    2. Mounts <LivenessCapture> which runs actual MediaPipe face detection
//       and challenge validation.
//    3. On LivenessCapture.onSuccess, POSTs the real face metrics to
//       /api/verification/liveness/submit.
//    4. On success response: navigates to /verification/liveness/success.
//    5. On failure (API error or network): shows error with retry.
//    6. Exposes a "Contact Support" path that goes to /verification/liveness/failed.

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LivenessCapture, type VerificationResult } from '@/components/verification/LivenessCapture';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, Camera, Loader2, AlertCircle } from 'lucide-react';

type VerificationStage = 'idle' | 'capturing' | 'submitting' | 'error';

export default function LivenessVerificationCard() {
  const router = useRouter();
  const [stage, setStage] = useState<VerificationStage>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // ── Capture success handler ───────────────────────────────────────────────
  // Called by LivenessCapture with the real MediaPipe result. We forward it
  // to the server-side submit route for DB persistence and trust score award.

  const handleCaptureSuccess = async (result: VerificationResult) => {
    setStage('submitting');

    try {
      const response = await fetch('/api/verification/liveness/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId:             result.videoId,
          // Map Challenge[] to the schema the submit route expects.
          challenges:          result.challenges.map((c) => ({
            type:      c.type,
            direction: c.direction,
            count:     c.count,
          })),
          faceDetected:        result.faceDetected,
          allChallengesPassed: result.allChallengesPassed,
          faceConfidence:      result.faceConfidence,
          timestamp:           result.timestamp,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        // Surface the server's message when available (rate-limit, replay, etc.).
        throw new Error(data.message ?? data.error ?? 'Verification failed. Please try again.');
      }

      router.push('/verification/liveness/success');
    } catch (err) {
      console.error('Verification submission error:', err);
      setErrorMessage(
        err instanceof Error ? err.message : 'Verification failed. Please try again.'
      );
      setStage('error');
    }
  };

  // ── Capture cancel handler ─────────────────────────────────────────────────
  const handleCaptureCancel = () => setStage('idle');

  // ── Retry handler ──────────────────────────────────────────────────────────
  const handleRetry = () => {
    setErrorMessage('');
    setStage('idle');
  };

  // ── Routes the user to the dedicated failure/support page ─────────────────
  const handleContactSupport = () => router.push('/verification/liveness/failed');

  // ── Stage: capturing — delegate entirely to LivenessCapture ───────────────
  if (stage === 'capturing') {
    return (
      <LivenessCapture
        onSuccess={handleCaptureSuccess}
        onCancel={handleCaptureCancel}
      />
    );
  }

  // ── Stage: submitting ──────────────────────────────────────────────────────
  if (stage === 'submitting') {
    return (
      <Card className="p-12 text-center shadow-xl">
        <Loader2 className="w-16 h-16 text-blue-600 mx-auto mb-6 animate-spin" />
        <h2 className="text-2xl font-bold mb-3">Submitting Verification</h2>
        <p className="text-gray-600">Analysing your liveness check — this takes a moment.</p>
        <div className="mt-6 w-full bg-gray-200 rounded-full h-1.5">
          <div
            className="bg-linear-to-r from-blue-600 to-indigo-600 h-1.5 rounded-full animate-pulse"
            style={{ width: '70%' }}
          />
        </div>
      </Card>
    );
  }

  // ── Stage: error ───────────────────────────────────────────────────────────
  if (stage === 'error') {
    return (
      <Card className="p-8 text-center shadow-xl">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-8 h-8 text-red-600" />
        </div>
        <h2 className="text-2xl font-bold text-red-900 mb-3">Verification Failed</h2>
        <p className="text-gray-600 mb-6 text-sm">{errorMessage}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={handleRetry} size="lg">
            Try Again
          </Button>
          <Button variant="outline" size="lg" onClick={handleContactSupport}>
            Contact Support
          </Button>
        </div>
      </Card>
    );
  }

  // ── Stage: idle (intro) ────────────────────────────────────────────────────
  return (
    <Card className="p-8 shadow-xl">
      <div className="text-center">
        <div className="w-20 h-20 bg-linear-to-br from-blue-600 to-indigo-600 rounded-full mx-auto mb-6 flex items-center justify-center shadow-lg">
          <Shield className="w-10 h-10 text-white" />
        </div>

        <h2 className="text-3xl font-bold mb-3 text-gray-900">Liveness Verification</h2>
        <p className="text-gray-600 mb-8 text-lg">
          Complete a quick liveness check to verify your identity and build trust with clients.
        </p>

        <div className="bg-linear-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 mb-8 text-left">
          <h3 className="font-semibold mb-4 text-lg text-gray-900">What to expect:</h3>
          <ul className="space-y-3 text-gray-700">
            <li className="flex items-start">
              <span className="text-blue-600 mr-3 text-xl">✓</span>
              <span>We&apos;ll ask you to make 2–3 simple face movements</span>
            </li>
            <li className="flex items-start">
              <span className="text-blue-600 mr-3 text-xl">✓</span>
              <span>The whole process takes about 15–30 seconds</span>
            </li>
            <li className="flex items-start">
              <span className="text-blue-600 mr-3 text-xl">✓</span>
              <span>Your video stays on your device — only the result is sent</span>
            </li>
            <li className="flex items-start">
              <span className="text-blue-600 mr-3 text-xl">✓</span>
              <span>Get your verified badge instantly — 100% free</span>
            </li>
          </ul>
        </div>

        <Button
          onClick={() => setStage('capturing')}
          size="lg"
          className="w-full h-14 text-lg bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
        >
          <Camera className="w-6 h-6 mr-2" />
          Start Verification
        </Button>

        <p className="text-xs text-gray-500 mt-4">
          By continuing you agree to our{' '}
          <a href="/privacy" className="underline hover:text-gray-700">
            privacy policy
          </a>{' '}
          and{' '}
          <a href="/terms" className="underline hover:text-gray-700">
            terms of service
          </a>
          .
        </p>
      </div>
    </Card>
  );
}