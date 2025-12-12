// src/components/verification/LivenessCapture.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  Camera, Loader2, CheckCircle, AlertCircle, 
  RotateCw, Smile, Eye, MoveVertical 
} from 'lucide-react';
import { livenessDB } from '@/lib/storage/indexedDB';
import { FaceDetector } from '@/lib/mediapipe/face-detector';
import { ChallengeValidator } from '@/lib/mediapipe/challenge-validator';
import { v4 as uuidv4 } from 'uuid';

type Challenge = {
  type: 'head_turn' | 'blink' | 'smile' | 'head_nod';
  direction?: 'left' | 'right';
  count?: number;
  instruction: string;
  icon: React.ReactNode;
};

const CHALLENGES: Challenge[] = [
  { 
    type: 'head_turn', 
    direction: 'left', 
    instruction: 'Turn your head left', 
    icon: <RotateCw className="w-6 h-6" /> 
  },
  { 
    type: 'head_turn', 
    direction: 'right', 
    instruction: 'Turn your head right', 
    icon: <RotateCw className="w-6 h-6 scale-x-[-1]" /> 
  },
  { 
    type: 'blink', 
    count: 2, 
    instruction: 'Blink twice', 
    icon: <Eye className="w-6 h-6" /> 
  },
  { 
    type: 'smile', 
    instruction: 'Smile at the camera', 
    icon: <Smile className="w-6 h-6" /> 
  },
  { 
    type: 'head_nod', 
    instruction: 'Nod your head up and down', 
    icon: <MoveVertical className="w-6 h-6" /> 
  },
];

function generateChallengeSequence(): Challenge[] {
  const shuffled = [...CHALLENGES].sort(() => Math.random() - 0.5);
  const count = 2 + Math.floor(Math.random() * 2); // 2-3 challenges
  return shuffled.slice(0, count);
}

interface LivenessCaptureProps {
  onSuccess: (videoId: string, challenges: Challenge[], metadata: any) => void;
  onError: (error: string) => void;
}

export function LivenessCapture({ onSuccess, onError }: LivenessCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const faceDetectorRef = useRef<FaceDetector | null>(null);
  const validatorRef = useRef<ChallengeValidator | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
  const [challengesPassed, setChallengesPassed] = useState<boolean[]>([]);
  const [faceDetected, setFaceDetected] = useState(false);
  const [faceConfidence, setFaceConfidence] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    // Generate challenges and cleanup old videos on mount
    setChallenges(generateChallengeSequence());
    livenessDB.deleteOldVideos(7).catch(console.error);

    return () => {
      // Cleanup
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (faceDetectorRef.current) {
        faceDetectorRef.current.destroy();
      }
    };
  }, []);

  const startCapture = async () => {
    try {
      setError(null);
      setIsInitializing(true);

      // Initialize MediaPipe
      const detector = new FaceDetector();
      await detector.initialize();
      faceDetectorRef.current = detector;
      validatorRef.current = new ChallengeValidator();

      // Start camera
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        // Wait for video to be ready
        await new Promise((resolve) => {
          videoRef.current!.onloadedmetadata = resolve;
        });
      }

      setStream(mediaStream);
      setIsInitializing(false);
      startRecording(mediaStream);
      startFaceDetection();

    } catch (err) {
      setIsInitializing(false);
      const errorMessage = err instanceof Error ? err.message : 'Failed to start verification';
      setError(errorMessage);
      onError(errorMessage);
    }
  };

  const startRecording = (mediaStream: MediaStream) => {
    const mediaRecorder = new MediaRecorder(mediaStream, {
      mimeType: 'video/webm;codecs=vp8'
    });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      await processRecording();
    };

    mediaRecorder.start();
    mediaRecorderRef.current = mediaRecorder;
    setIsRecording(true);
  };

  const startFaceDetection = () => {
    const detectFrame = async () => {
      if (!videoRef.current || !faceDetectorRef.current || !validatorRef.current) {
        return;
      }

      try {
        const result = await faceDetectorRef.current.detectFace(videoRef.current);

        if (result && result.faceLandmarks && result.faceLandmarks.length > 0) {
          setFaceDetected(true);
          
          // Calculate face confidence (based on landmark visibility)
          const landmarks = result.faceLandmarks[0];
          const avgVisibility = landmarks.reduce((sum, lm) => sum + (lm.visibility || 0), 0) / landmarks.length;
          setFaceConfidence(avgVisibility);

          // Validate current challenge
          const currentChallenge = challenges[currentChallengeIndex];
          if (currentChallenge && !challengesPassed[currentChallengeIndex]) {
            let validation;

            switch (currentChallenge.type) {
              case 'head_turn':
                validation = validatorRef.current.validateHeadTurn(
                  landmarks,
                  currentChallenge.direction!
                );
                break;
              case 'blink':
                validation = validatorRef.current.validateBlink(
                  landmarks,
                  currentChallenge.count!
                );
                break;
              case 'smile':
                validation = validatorRef.current.validateSmile(landmarks);
                break;
              case 'head_nod':
                validation = validatorRef.current.validateHeadNod(landmarks);
                break;
            }

            if (validation?.passed) {
              handleChallengeComplete();
            }
          }
        } else {
          setFaceDetected(false);
          setFaceConfidence(0);
        }
      } catch (error) {
        console.error('Detection error:', error);
      }

      // Continue detection loop
      if (isRecording) {
        animationFrameRef.current = requestAnimationFrame(detectFrame);
      }
    };

    detectFrame();
  };

  const handleChallengeComplete = () => {
    const newPassed = [...challengesPassed];
    newPassed[currentChallengeIndex] = true;
    setChallengesPassed(newPassed);

    if (currentChallengeIndex < challenges.length - 1) {
      setCurrentChallengeIndex(currentChallengeIndex + 1);
      // Reset validator state for next challenge
      validatorRef.current?.reset();
    } else {
      // All challenges completed
      stopRecording();
    }
  };

  const stopRecording = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }

    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const processRecording = async () => {
    setIsProcessing(true);

    try {
      const videoBlob = new Blob(chunksRef.current, { type: 'video/webm' });
      const videoId = uuidv4();

      const metadata = {
        faceDetected,
        faceConfidence,
        allChallengesPassed: challengesPassed.every(p => p),
        challengesCompleted: challengesPassed.filter(p => p).length,
        totalChallenges: challenges.length,
      };

      // Store video locally
      await livenessDB.saveVideo({
        id: videoId,
        blob: videoBlob,
        timestamp: Date.now(),
        challenges: challenges,
        metadata,
      });

      onSuccess(videoId, challenges, metadata);
    } catch (err) {
      const errorMessage = 'Failed to save verification video';
      setError(errorMessage);
      onError(errorMessage);
    } finally {
      setIsProcessing(false);
      chunksRef.current = [];
    }
  };

  const currentChallenge = challenges[currentChallengeIndex];

  return (
    <Card className="p-6">
      <div className="space-y-6">
        {/* Video Preview */}
        <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />

          {/* Face Detection Indicator */}
          {stream && !isInitializing && (
            <div className="absolute top-4 right-4">
              {faceDetected ? (
                <div className="flex items-center gap-2 bg-green-500 text-white px-3 py-1 rounded-full text-sm">
                  <CheckCircle className="w-4 h-4" />
                  Face: {Math.round(faceConfidence * 100)}%
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-yellow-500 text-white px-3 py-1 rounded-full text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Looking for face...
                </div>
              )}
            </div>
          )}

          {/* Challenge Instruction */}
          {isRecording && currentChallenge && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
              <div className="bg-white/90 backdrop-blur-sm rounded-lg px-6 py-4 shadow-lg">
                <div className="flex items-center gap-3">
                  {currentChallenge.icon}
                  <span className="text-lg font-semibold">
                    {currentChallenge.instruction}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Progress Indicator */}
          {isRecording && (
            <div className="absolute top-4 left-4">
              <div className="flex gap-2">
                {challenges.map((_, index) => (
                  <div
                    key={index}
                    className={`w-3 h-3 rounded-full ${
                      challengesPassed[index]
                        ? 'bg-green-500'
                        : index === currentChallengeIndex
                        ? 'bg-blue-500 animate-pulse'
                        : 'bg-gray-300'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Initializing Overlay */}
          {isInitializing && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
              <div className="text-white text-center">
                <Loader2 className="w-12 h-12 animate-spin mx-auto mb-3" />
                <p>Initializing face detection...</p>
              </div>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Controls */}
        <div className="flex gap-3">
          {!stream && !isProcessing && !isInitializing && (
            <Button
              onClick={startCapture}
              className="flex-1"
              size="lg"
            >
              <Camera className="w-5 h-5 mr-2" />
              Start Verification
            </Button>
          )}

          {isProcessing && (
            <Button disabled className="flex-1" size="lg">
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Processing...
            </Button>
          )}
        </div>

        {/* Instructions */}
        {!stream && !isInitializing && (
          <div className="text-sm text-gray-600 space-y-2">
            <p className="font-medium">Before you start:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Ensure good lighting on your face</li>
              <li>Look directly at the camera</li>
              <li>Follow the on-screen instructions</li>
              <li>Complete {challenges.length} simple challenges</li>
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}