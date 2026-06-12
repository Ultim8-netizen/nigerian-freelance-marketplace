// src/components/verification/LivenessCapture.tsx
//
// FIXES applied:
//  1. Export VerificationResult interface — consumed by LivenessVerificationCard
//     to POST real face metrics to the submit API.
//  2. LivenessCaptureProps.onSuccess now accepts VerificationResult instead
//     of (videoId, challenges) — so all necessary API fields travel together.
//  3. faceConfidence was hardcoded to 0.9. The submit route rejects < 0.7,
//     but the hardcode meant the gate was permanently bypassed regardless
//     of actual detection quality. Confidence is now derived from landmark
//     coverage: FaceLandmarker returns up to 478 landmarks; we scale
//     min((count/478)*0.95 + 0.05, 1.0) giving ~1.0 for a full face and
//     proportionally less for partial detections.
//  4. saveVerification now passes a full VerificationResult to onSuccess.
//  5. leftIcon prop on Button (doesn't exist in shadcn Button) fixed to
//     inline JSX pattern throughout the error UI.

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FaceDetector } from '@/lib/mediapipe/face-detector';
import { ChallengeValidator, type ChallengeType } from '@/lib/mediapipe/challenge-validator';
import { livenessDB } from '@/lib/storage/indexedDB';
import { Camera, X, CheckCircle, AlertCircle, Loader2, RotateCcw } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import type { FaceLandmarkerResult, NormalizedLandmark } from '@mediapipe/tasks-vision';

// ── Public types ─────────────────────────────────────────────────────────────

export interface Challenge {
  type: ChallengeType;
  direction?: 'left' | 'right' | 'up' | 'down';
  count?: number;
  completed: boolean;
  progress: number;
  instruction: string;
}

/**
 * Passed to onSuccess so the coordinator (LivenessVerificationCard) has
 * everything it needs to call /api/verification/liveness/submit without
 * reading from IndexedDB.
 */
export interface VerificationResult {
  videoId:             string;
  challenges:          Challenge[];
  faceDetected:        boolean;
  allChallengesPassed: boolean;
  faceConfidence:      number;
  timestamp:           number;
}

// ── Component props ───────────────────────────────────────────────────────────

interface LivenessCaptureProps {
  onSuccess: (result: VerificationResult) => void;
  onCancel:  () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_RETRY_ATTEMPTS   = 3;
const PROCESSING_TIMEOUT   = 60_000; // ms
const MEDIAPIPE_INIT_TIMEOUT = 15_000; // ms
// Maximum landmarks FaceLandmarker returns for a single face.
// Used to compute a meaningful confidence score from landmark coverage.
const FACE_LANDMARKS_TOTAL = 478;

// ── Component ─────────────────────────────────────────────────────────────────

export function LivenessCapture({ onSuccess, onCancel }: LivenessCaptureProps) {
  // ── Refs ────────────────────────────────────────────────────────────────────
  const videoRef               = useRef<HTMLVideoElement>(null);
  const canvasRef              = useRef<HTMLCanvasElement>(null);
  const streamRef              = useRef<MediaStream | null>(null);
  const mediaRecorderRef       = useRef<MediaRecorder | null>(null);
  const recordedChunksRef      = useRef<Blob[]>([]);
  const faceDetectorRef        = useRef<FaceDetector | null>(null);
  const challengeValidatorRef  = useRef<ChallengeValidator | null>(null);
  const animationFrameRef      = useRef<number | null>(null);
  const processingTimeoutRef   = useRef<NodeJS.Timeout | null>(null);

  // ── State ───────────────────────────────────────────────────────────────────
  const [isInitializing,   setIsInitializing]   = useState(true);
  const [initRetryCount,   setInitRetryCount]   = useState(0);
  const [error,            setError]            = useState<string | null>(null);
  const [errorType,        setErrorType]        = useState<'camera' | 'mediapipe' | 'general' | null>(null);
  const [faceDetected,     setFaceDetected]     = useState(false);
  const [faceConfidence,   setFaceConfidence]   = useState(0);
  const [challenges,       setChallenges]       = useState<Challenge[]>([]);
  const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
  const [isRecording,      setIsRecording]      = useState(false);
  const [isProcessing,     setIsProcessing]     = useState(false);

  // ── Challenge generation ─────────────────────────────────────────────────

  const generateChallenges = useCallback((): Challenge[] => {
    const allChallenges: Challenge[] = [
      {
        type:        'head_turn',
        direction:   Math.random() > 0.5 ? 'left' : 'right',
        completed:   false,
        progress:    0,
        instruction: '', // filled below
      },
      {
        type:        'blink',
        count:       2,
        completed:   false,
        progress:    0,
        instruction: 'Blink 2 times',
      },
      {
        type:        'smile',
        completed:   false,
        progress:    0,
        instruction: 'Smile for the camera',
      },
    ];

    allChallenges[0].instruction = `Turn your head ${allChallenges[0].direction}`;
    return allChallenges.sort(() => Math.random() - 0.5);
  }, []);

  // ── MediaPipe init with retry ─────────────────────────────────────────────

  const initializeMediaPipe = useCallback(async (): Promise<boolean> => {
    try {
      console.log('🔧 Initializing MediaPipe (attempt', initRetryCount + 1, ')...');

      const detector = new FaceDetector();

      const initPromise = detector.initialize();
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('MediaPipe initialization timeout')), MEDIAPIPE_INIT_TIMEOUT)
      );

      await Promise.race([initPromise, timeoutPromise]);

      faceDetectorRef.current        = detector;
      challengeValidatorRef.current  = new ChallengeValidator();

      console.log('✅ MediaPipe initialized successfully');
      return true;
    } catch (err) {
      console.error('❌ MediaPipe initialization failed:', err);

      if (initRetryCount < MAX_RETRY_ATTEMPTS - 1) {
        setInitRetryCount((prev) => prev + 1);
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return initializeMediaPipe();
      }

      throw err;
    }
  }, [initRetryCount]);

  // ── Canvas landmark rendering ─────────────────────────────────────────────

  const drawLandmarks = useCallback((landmarks: NormalizedLandmark[]) => {
    if (!canvasRef.current || !videoRef.current) return;

    const canvas = canvasRef.current;
    const video  = videoRef.current;
    const ctx    = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#22c55e';
    landmarks.forEach((landmark) => {
      const x = landmark.x * canvas.width;
      const y = landmark.y * canvas.height;
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, 2 * Math.PI);
      ctx.fill();
    });

    if (landmarks.length > 0) {
      const xs   = landmarks.map((l) => l.x * canvas.width);
      const ys   = landmarks.map((l) => l.y * canvas.height);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth   = 3;
      ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
    }
  }, []);

  // ── Finish recording ──────────────────────────────────────────────────────

  const finishVerification = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  // ── Challenge validation per frame ────────────────────────────────────────

  const validateCurrentChallenge = useCallback(
    (landmarks: NormalizedLandmark[]) => {
      if (!challengeValidatorRef.current) return;

      const currentChallenge = challenges[currentChallengeIndex];
      if (!currentChallenge || currentChallenge.completed) return;

      let result: { passed: boolean; confidence: number } | null = null;

      switch (currentChallenge.type) {
        case 'head_turn':
          result = challengeValidatorRef.current.validateHeadTurn(
            landmarks,
            currentChallenge.direction as 'left' | 'right'
          );
          break;
        case 'blink':
          result = challengeValidatorRef.current.validateBlink(
            landmarks,
            currentChallenge.count ?? 2
          );
          break;
        case 'smile':
          result = challengeValidatorRef.current.validateSmile(landmarks);
          break;
        case 'head_nod':
          result = challengeValidatorRef.current.validateHeadNod(landmarks);
          break;
      }

      if (result) {
        setChallenges((prev) =>
          prev.map((c, i) =>
            i === currentChallengeIndex
              ? { ...c, progress: Math.min(result!.confidence, 1) }
              : c
          )
        );

        if (result.passed && result.confidence >= 0.8) {
          setChallenges((prev) =>
            prev.map((c, i) =>
              i === currentChallengeIndex
                ? { ...c, completed: true, progress: 1 }
                : c
            )
          );

          setTimeout(() => {
            if (currentChallengeIndex + 1 < challenges.length) {
              setCurrentChallengeIndex((prev) => prev + 1);
            } else {
              finishVerification();
            }
          }, 500);
        }
      }
    },
    [challenges, currentChallengeIndex, finishVerification]
  );

  // ── Detection loop ────────────────────────────────────────────────────────

  const startDetectionLoop = useCallback(() => {
    const detect = async () => {
      if (!videoRef.current || !faceDetectorRef.current) {
        animationFrameRef.current = requestAnimationFrame(detect);
        return;
      }

      try {
        const result: FaceLandmarkerResult | null =
          await faceDetectorRef.current.detectFace(videoRef.current);

        if (result?.faceLandmarks?.length) {
          const landmarks = result.faceLandmarks[0];

          setFaceDetected(true);

          // ── FIX: realistic confidence from landmark coverage ──────────
          // FaceLandmarker emits up to FACE_LANDMARKS_TOTAL (478) per face.
          // Scale: full detection ≈ 1.0, proportionally less for partial.
          // Capped at 1.0; minimum 0.05 when at least 1 landmark is found.
          // The submit route's gate is faceConfidence >= 0.7, which requires
          // roughly 280+ landmarks — enforcing a real detection threshold.
          const confidence = Math.min(
            (landmarks.length / FACE_LANDMARKS_TOTAL) * 0.95 + 0.05,
            1.0
          );
          setFaceConfidence(confidence);

          drawLandmarks(landmarks);

          if (isRecording && currentChallengeIndex < challenges.length) {
            validateCurrentChallenge(landmarks);
          }
        } else {
          setFaceDetected(false);
          setFaceConfidence(0);

          if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          }
        }
      } catch (err) {
        console.error('Detection error:', err);
      }

      animationFrameRef.current = requestAnimationFrame(detect);
    };

    detect();
  }, [isRecording, currentChallengeIndex, challenges.length, drawLandmarks, validateCurrentChallenge]);

  // ── Save to IndexedDB and invoke onSuccess ────────────────────────────────

  const saveVerification = useCallback(async () => {
    setIsProcessing(true);

    processingTimeoutRef.current = setTimeout(() => {
      setError('Processing timed out. Please try again.');
      setIsProcessing(false);
    }, PROCESSING_TIMEOUT);

    try {
      const blob               = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      const videoId            = uuidv4();
      const allChallengesPassed = challenges.every((c) => c.completed);

      // Capture the current confidence snapshot (state value at save time).
      // Because this callback closes over faceConfidence from the render
      // where finishVerification ran, it reflects the last real detection.
      const snapshotConfidence = faceConfidence;

      await livenessDB.saveVideo({
        id:         videoId,
        blob,
        timestamp:  Date.now(),
        challenges: challenges.map((c) => ({
          type:      c.type,
          direction: c.direction,
          count:     c.count,
        })),
        metadata: {
          faceDetected:        true,
          faceConfidence:      snapshotConfidence,
          allChallengesPassed,
        },
      });

      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }

      // ── FIX: pass full VerificationResult — coordinator needs all fields ──
      onSuccess({
        videoId,
        challenges,
        faceDetected:        true,
        allChallengesPassed,
        faceConfidence:      snapshotConfidence,
        timestamp:           Date.now(),
      });
    } catch (err) {
      console.error('❌ Save error:', err);

      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }

      setError('Failed to save verification. Please try again.');
      setIsProcessing(false);
    }
  }, [challenges, faceConfidence, onSuccess]);

  // ── Cleanup ───────────────────────────────────────────────────────────────

  const cleanup = useCallback(() => {
    if (animationFrameRef.current)  cancelAnimationFrame(animationFrameRef.current);
    if (processingTimeoutRef.current) clearTimeout(processingTimeoutRef.current);
    if (mediaRecorderRef.current && isRecording) mediaRecorderRef.current.stop();
    if (streamRef.current)          streamRef.current.getTracks().forEach((t) => t.stop());
    if (faceDetectorRef.current)    faceDetectorRef.current.destroy();
  }, [isRecording]);

  // ── Initialization effect ─────────────────────────────────────────────────

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      try {
        console.log('🎥 Requesting camera access...');

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: false,
        });

        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          console.log('✅ Video stream started');
        }

        await initializeMediaPipe();

        const newChallenges = generateChallenges();
        setChallenges(newChallenges);

        await livenessDB.deleteOldVideos(1);

        setIsInitializing(false);
        startDetectionLoop();
      } catch (err) {
        if (!mounted) return;

        console.error('❌ Initialization error:', err);

        if (err instanceof Error) {
          if (err.message.includes('Permission denied') || err.name === 'NotAllowedError') {
            setErrorType('camera');
            setError(
              'Camera access denied. Please allow camera access in your browser settings and refresh the page.'
            );
          } else if (
            err.message.includes('MediaPipe') ||
            err.message.includes('timeout')
          ) {
            setErrorType('mediapipe');
            setError(
              'Failed to initialize face detection. This might be a network issue. Please check your connection and try again.'
            );
          } else {
            setErrorType('general');
            setError('Something went wrong during initialization. Please refresh and try again.');
          }
        } else {
          setErrorType('general');
          setError('Failed to start verification. Please try again.');
        }

        setIsInitializing(false);
      }
    }

    initialize();

    return () => {
      mounted = false;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Start recording ───────────────────────────────────────────────────────

  const startVerification = useCallback(async () => {
    if (!videoRef.current || !streamRef.current || !faceDetected) {
      setError('Please ensure your face is visible in the frame');
      return;
    }

    try {
      challengeValidatorRef.current?.reset();

      const mediaRecorder = new MediaRecorder(streamRef.current, {
        mimeType: 'video/webm;codecs=vp9',
      });

      recordedChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        await saveVerification();
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('❌ Recording error:', err);
      setError('Failed to start recording. Please try again.');
    }
  }, [faceDetected, saveVerification]);

  // ── Retry ─────────────────────────────────────────────────────────────────

  const handleRetry = useCallback(() => {
    setError(null);
    setErrorType(null);
    setInitRetryCount(0);
    setIsInitializing(true);
    window.location.reload();
  }, []);

  // ── Error UI ──────────────────────────────────────────────────────────────

  if (error) {
    return (
      <Card className="p-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">
          {errorType === 'camera'
            ? 'Camera Access Required'
            : errorType === 'mediapipe'
            ? 'Initialization Failed'
            : 'Something Went Wrong'}
        </h3>
        <p className="text-sm text-gray-600 mb-4">{error}</p>

        {/* FIX: leftIcon prop does not exist on Button — icon inlined as child */}
        <div className="flex gap-2 justify-center">
          <Button onClick={handleRetry}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Retry
          </Button>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>

        {errorType === 'camera' && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-left">
            <p className="font-semibold mb-2">How to enable camera:</p>
            <ul className="text-xs space-y-1 text-blue-800">
              <li>• Click the camera icon in your browser&apos;s address bar</li>
              <li>• Select &ldquo;Allow&rdquo; for camera access</li>
              <li>• Refresh the page and try again</li>
            </ul>
          </div>
        )}
      </Card>
    );
  }

  // ── Main UI ───────────────────────────────────────────────────────────────

  return (
    <Card className="p-6">
      <div className="relative mb-6 bg-black rounded-lg overflow-hidden aspect-video">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
          autoPlay
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        {/* Face detection indicator */}
        <div className="absolute top-4 right-4 z-10">
          {faceDetected ? (
            <div className="bg-green-500 text-white px-3 py-1.5 rounded-full text-sm flex items-center gap-2 shadow-lg">
              <CheckCircle className="w-4 h-4" />
              Face Detected
            </div>
          ) : (
            <div className="bg-red-500 text-white px-3 py-1.5 rounded-full text-sm flex items-center gap-2 shadow-lg">
              <AlertCircle className="w-4 h-4" />
              {isInitializing ? 'Initializing...' : 'No Face Detected'}
            </div>
          )}
        </div>

        {/* Active challenge instruction */}
        {isRecording && currentChallengeIndex < challenges.length && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10 w-11/12 max-w-md">
            <div className="bg-white/95 backdrop-blur-sm px-6 py-4 rounded-xl shadow-xl">
              <p className="text-center font-semibold text-lg mb-3 text-gray-900">
                {challenges[currentChallengeIndex].instruction}
              </p>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-linear-to-r from-blue-500 to-purple-500 transition-all duration-300"
                  style={{
                    width: `${challenges[currentChallengeIndex].progress * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Processing overlay */}
        {isProcessing && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-20">
            <div className="text-center text-white">
              <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
              <p className="text-lg font-semibold">Processing verification...</p>
              <p className="text-sm text-gray-300 mt-2">This may take a moment</p>
            </div>
          </div>
        )}
      </div>

      {/* Challenge progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-gray-700">
            {isRecording
              ? `Challenge ${currentChallengeIndex + 1} of ${challenges.length}`
              : 'Position your face in the frame to begin'}
          </p>
          {isRecording && (
            <span className="text-xs text-gray-500">
              {challenges.filter((c) => c.completed).length}/{challenges.length} completed
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {challenges.map((challenge, index) => (
            <div key={index} className="flex-1">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  challenge.completed
                    ? 'bg-green-500'
                    : index === currentChallengeIndex && isRecording
                    ? 'bg-blue-500'
                    : 'bg-gray-200'
                }`}
              />
              <p className="text-xs text-center mt-1 text-gray-600 truncate">
                {challenge.type.replace('_', ' ')}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Instructions panel (shown before recording) */}
      {!isRecording && !isInitializing && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800 font-medium mb-2">📋 Verification Instructions:</p>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Make sure your face is clearly visible</li>
            <li>• Ensure good lighting</li>
            <li>• Follow each challenge instruction carefully</li>
            <li>• This is 100% free — no payment required</li>
          </ul>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        {!isRecording && !isProcessing && (
          <>
            <Button
              onClick={startVerification}
              disabled={!faceDetected || isInitializing}
              className="flex-1"
              size="lg"
            >
              {isInitializing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Initializing...
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4 mr-2" />
                  Start Verification
                </>
              )}
            </Button>
            <Button onClick={onCancel} variant="outline" size="lg">
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
          </>
        )}

        {isRecording && (
          <div className="flex-1 text-center py-3">
            <div className="inline-flex items-center gap-2 text-red-600">
              <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse" />
              <p className="text-sm font-semibold">Recording in progress...</p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}