// src/components/verification/LivenessCapture.tsx
/**
 * Liveness Capture Component - Production Ready
 * Uses actual MediaPipe Face Landmarker and existing challenge validator
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FaceDetector } from '@/lib/mediapipe/face-detector';
import { ChallengeValidator, type ChallengeType } from '@/lib/mediapipe/challenge-validator';
import { livenessDB } from '@/lib/storage/indexedDB';
import { Camera, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import type { FaceLandmarkerResult } from '@mediapipe/tasks-vision';

interface Challenge {
  type: ChallengeType;
  direction?: 'left' | 'right' | 'up' | 'down';
  count?: number;
  completed: boolean;
  progress: number;
  instruction: string;
}

interface LivenessCaptureProps {
  onSuccess: (videoId: string, challenges: Challenge[]) => void;
  onCancel: () => void;
}

export function LivenessCapture({ onSuccess, onCancel }: LivenessCaptureProps) {
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const faceDetectorRef = useRef<FaceDetector | null>(null);
  const challengeValidatorRef = useRef<ChallengeValidator | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // State
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [faceConfidence, setFaceConfidence] = useState(0);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  /**
   * Generate random challenges
   */
  const generateChallenges = useCallback((): Challenge[] => {
    const allChallenges: Challenge[] = [
      {
        type: 'head_turn',
        direction: Math.random() > 0.5 ? 'left' : 'right',
        completed: false,
        progress: 0,
        instruction: '',
      },
      {
        type: 'blink',
        count: 2,
        completed: false,
        progress: 0,
        instruction: 'Blink 2 times',
      },
      {
        type: 'smile',
        completed: false,
        progress: 0,
        instruction: 'Smile for the camera',
      },
    ];

    // Set instruction for head turn
    allChallenges[0].instruction = `Turn your head ${allChallenges[0].direction}`;

    // Shuffle for randomness
    return allChallenges.sort(() => Math.random() - 0.5);
  }, []);

  /**
   * Initialize camera and face detector
   */
  useEffect(() => {
    let mounted = true;

    async function initialize() {
      try {
        console.log('🎥 Requesting camera access...');

        // Request camera access
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user',
          },
          audio: false,
        });

        if (!mounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        // Setup video element
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          console.log('✅ Video stream started');
        }

        // Initialize MediaPipe Face Detector
        console.log('🔧 Initializing MediaPipe Face Detector...');
        const detector = new FaceDetector();
        await detector.initialize();
        faceDetectorRef.current = detector;
        console.log('✅ Face Detector initialized');

        // Initialize Challenge Validator
        challengeValidatorRef.current = new ChallengeValidator();
        console.log('✅ Challenge Validator initialized');

        // Generate challenges
        const newChallenges = generateChallenges();
        setChallenges(newChallenges);
        console.log('✅ Challenges generated:', newChallenges);

        // Cleanup old videos
        await livenessDB.deleteOldVideos(1); // Delete videos older than 1 day
        console.log('✅ Old videos cleaned up');

        setIsInitializing(false);

        // Start detection loop
        startDetectionLoop();
      } catch (err) {
        console.error('❌ Initialization error:', err);
        if (mounted) {
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to access camera. Please grant camera permissions and try again.'
          );
          setIsInitializing(false);
        }
      }
    }

    initialize();

    return () => {
      mounted = false;
      cleanup();
    };
  }, [generateChallenges]);

  /**
   * Start face detection loop
   */
  const startDetectionLoop = useCallback(() => {
    const detect = async () => {
      if (!videoRef.current || !faceDetectorRef.current) {
        animationFrameRef.current = requestAnimationFrame(detect);
        return;
      }

      try {
        const result: FaceLandmarkerResult | null = await faceDetectorRef.current.detectFace(
          videoRef.current
        );

        if (result && result.faceLandmarks && result.faceLandmarks.length > 0) {
          const landmarks = result.faceLandmarks[0];
          
          // Face detected
          setFaceDetected(true);
          
          // Calculate confidence (simplified)
          const confidence = landmarks.length > 0 ? 0.9 : 0;
          setFaceConfidence(confidence);

          // Draw face landmarks on canvas
          drawLandmarks(landmarks);

          // If recording, validate current challenge
          if (isRecording && currentChallengeIndex < challenges.length) {
            validateCurrentChallenge(landmarks);
          }
        } else {
          setFaceDetected(false);
          setFaceConfidence(0);
          
          // Clear canvas
          if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
              ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            }
          }
        }
      } catch (err) {
        console.error('Detection error:', err);
      }

      animationFrameRef.current = requestAnimationFrame(detect);
    };

    detect();
  }, [isRecording, currentChallengeIndex, challenges.length]);

  /**
   * Draw face landmarks on canvas
   */
  const drawLandmarks = useCallback((landmarks: any[]) => {
    if (!canvasRef.current || !videoRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw landmarks
    ctx.fillStyle = '#22c55e';
    landmarks.forEach((landmark) => {
      const x = landmark.x * canvas.width;
      const y = landmark.y * canvas.height;
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, 2 * Math.PI);
      ctx.fill();
    });

    // Draw bounding box
    if (landmarks.length > 0) {
      const xs = landmarks.map((l) => l.x * canvas.width);
      const ys = landmarks.map((l) => l.y * canvas.height);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 3;
      ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
    }
  }, []);

  /**
   * Validate current challenge
   */
  const validateCurrentChallenge = useCallback((landmarks: any[]) => {
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
          currentChallenge.count || 2
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
      // Update progress
      setChallenges((prev) =>
        prev.map((c, i) =>
          i === currentChallengeIndex
            ? { ...c, progress: Math.min(result!.confidence, 1) }
            : c
        )
      );

      // Check if challenge passed
      if (result.passed && result.confidence >= 0.8) {
        console.log(`✅ Challenge ${currentChallengeIndex + 1} passed!`);
        
        // Mark as completed
        setChallenges((prev) =>
          prev.map((c, i) =>
            i === currentChallengeIndex ? { ...c, completed: true, progress: 1 } : c
          )
        );

        // Move to next challenge after delay
        setTimeout(() => {
          if (currentChallengeIndex + 1 < challenges.length) {
            setCurrentChallengeIndex((prev) => prev + 1);
          } else {
            // All challenges completed
            finishVerification();
          }
        }, 500);
      }
    }
  }, [challenges, currentChallengeIndex]);

  /**
   * Start verification (begin recording)
   */
  const startVerification = useCallback(async () => {
    if (!videoRef.current || !streamRef.current || !faceDetected) {
      setError('Please ensure your face is visible in the frame');
      return;
    }

    try {
      console.log('🎬 Starting recording...');

      // Reset challenge validator
      challengeValidatorRef.current?.reset();

      // Start recording
      const mediaRecorder = new MediaRecorder(streamRef.current, {
        mimeType: 'video/webm;codecs=vp9',
      });

      recordedChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('🎬 Recording stopped');
        await saveVerification();
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      console.log('✅ Recording started');
    } catch (err) {
      console.error('❌ Recording error:', err);
      setError('Failed to start recording. Please try again.');
    }
  }, [faceDetected]);

  /**
   * Finish verification (stop recording)
   */
  const finishVerification = useCallback(() => {
    console.log('🏁 Finishing verification...');
    
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  /**
   * Save verification video to IndexedDB
   */
  const saveVerification = useCallback(async () => {
    setIsProcessing(true);

    try {
      console.log('💾 Saving verification...');

      // Create blob from recorded chunks
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      const videoId = uuidv4();

      // Check if all challenges passed
      const allChallengesPassed = challenges.every((c) => c.completed);

      // Save to IndexedDB
      await livenessDB.saveVideo({
        id: videoId,
        blob,
        timestamp: Date.now(),
        challenges: challenges.map((c) => ({
          type: c.type,
          direction: c.direction,
          count: c.count,
        })),
        metadata: {
          faceDetected: true,
          faceConfidence,
          allChallengesPassed,
        },
      });

      console.log('✅ Verification saved:', videoId);

      // Callback with success
      onSuccess(videoId, challenges);
    } catch (err) {
      console.error('❌ Save error:', err);
      setError('Failed to save verification. Please try again.');
      setIsProcessing(false);
    }
  }, [challenges, faceConfidence, onSuccess]);

  /**
   * Cleanup resources
   */
  const cleanup = useCallback(() => {
    console.log('🧹 Cleaning up resources...');

    // Stop animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Stop recording
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }

    // Stop video stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // Cleanup face detector
    if (faceDetectorRef.current) {
      faceDetectorRef.current.destroy();
      faceDetectorRef.current = null;
    }

    console.log('✅ Cleanup complete');
  }, [isRecording]);

  /**
   * Handle cancel
   */
  const handleCancel = useCallback(() => {
    cleanup();
    onCancel();
  }, [cleanup, onCancel]);

  // Error UI
  if (error) {
    return (
      <Card className="p-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">Camera Error</h3>
        <p className="text-sm text-gray-600 mb-4">{error}</p>
        <div className="flex gap-2 justify-center">
          <Button onClick={() => window.location.reload()}>Retry</Button>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
        </div>
      </Card>
    );
  }

  // Main UI
  return (
    <Card className="p-6">
      {/* Video Container */}
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

        {/* Face Detection Indicator */}
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

        {/* Challenge Instructions */}
        {isRecording && currentChallengeIndex < challenges.length && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10 w-11/12 max-w-md">
            <div className="bg-white/95 backdrop-blur-sm px-6 py-4 rounded-xl shadow-xl">
              <p className="text-center font-semibold text-lg mb-3 text-gray-900">
                {challenges[currentChallengeIndex].instruction}
              </p>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                  style={{
                    width: `${challenges[currentChallengeIndex].progress * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Processing Overlay */}
        {isProcessing && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-20">
            <div className="text-center text-white">
              <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
              <p className="text-lg font-semibold">Processing verification...</p>
            </div>
          </div>
        )}
      </div>

      {/* Challenge Progress */}
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

      {/* Instructions */}
      {!isRecording && !isInitializing && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800 font-medium mb-2">
            📋 Verification Instructions:
          </p>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Make sure your face is clearly visible</li>
            <li>• Ensure good lighting</li>
            <li>• Follow each challenge instruction carefully</li>
            <li>• The verification takes about 30-60 seconds</li>
          </ul>
        </div>
      )}

      {/* Action Buttons */}
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
            <Button onClick={handleCancel} variant="outline" size="lg">
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

      {/* Debug Info (Development Only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-4 p-3 bg-gray-100 rounded text-xs font-mono">
          <p>Face Detected: {faceDetected ? 'Yes' : 'No'}</p>
          <p>Confidence: {(faceConfidence * 100).toFixed(1)}%</p>
          <p>Recording: {isRecording ? 'Yes' : 'No'}</p>
          <p>Current Challenge: {currentChallengeIndex + 1}/{challenges.length}</p>
        </div>
      )}
    </Card>
  );
}