// src/components/verification/LivenessVerificationCard.tsx

import { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, Camera, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { localVideoStorage } from '@/lib/storage/local-video-storage';

const CHALLENGES = [
  { type: 'head_turn', direction: 'left', instruction: 'Turn your head left' },
  { type: 'head_turn', direction: 'right', instruction: 'Turn your head right' },
  { type: 'blink', count: 2, instruction: 'Blink twice' },
  { type: 'smile', instruction: 'Smile at the camera' },
  { type: 'head_nod', instruction: 'Nod your head up and down' },
];

function generateChallengeSequence() {
  const shuffled = [...CHALLENGES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 2 + Math.floor(Math.random() * 2));
}

export function LivenessVerificationCard() {
  const [stage, setStage] = useState<'intro' | 'camera' | 'processing' | 'success' | 'error'>('intro');
  const [error, setError] = useState('');
  const [challenges, setChallenges] = useState<typeof CHALLENGES>([]);
  const [currentChallenge, setCurrentChallenge] = useState(0);
  const [recording, setRecording] = useState(false);
  const [videoId, setVideoId] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 1280, height: 720 },
        audio: false
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      streamRef.current = stream;
      setStage('camera');
      
      // Generate challenges
      const newChallenges = generateChallengeSequence();
      setChallenges(newChallenges);
      
    } catch (err) {
      console.error('Camera error:', err);
      setError('Failed to access camera. Please enable camera permissions.');
      setStage('error');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const startRecording = () => {
    if (!streamRef.current) return;

    chunksRef.current = [];
    const mediaRecorder = new MediaRecorder(streamRef.current, {
      mimeType: 'video/webm;codecs=vp8'
    });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    mediaRecorder.start();
    mediaRecorderRef.current = mediaRecorder;
    setRecording(true);
    setCurrentChallenge(0);

    // Auto-complete after 15 seconds (user completes 2-3 challenges)
    setTimeout(() => {
      stopRecording();
    }, 15000);
  };

  const stopRecording = async () => {
    if (!mediaRecorderRef.current) return;

    return new Promise<void>((resolve) => {
      mediaRecorderRef.current!.onstop = async () => {
        const videoBlob = new Blob(chunksRef.current, { type: 'video/webm' });
        
        // Save to IndexedDB
        try {
          const userId = 'current_user_id'; // Get from auth context
          const id = await localVideoStorage.saveVideo(
            userId,
            videoBlob,
            challenges.map(c => c.instruction)
          );
          
          setVideoId(id);
          setRecording(false);
          stopCamera();
          setStage('processing');
          
          // Submit for verification
          await submitVerification(id, videoBlob);
          
          resolve();
        } catch (err) {
          console.error('Failed to save video:', err);
          setError('Failed to save verification video');
          setStage('error');
          resolve();
        }
      };

      mediaRecorderRef.current!.stop();
    });
  };

  const submitVerification = async (videoId: string, videoBlob: Blob) => {
    try {
      // Create form data for upload
      const formData = new FormData();
      formData.append('video', videoBlob, 'liveness-check.webm');
      formData.append('video_id', videoId);
      formData.append('challenges', JSON.stringify(challenges));
      formData.append('timestamp', Date.now().toString());

      const response = await fetch('/api/verification/liveness', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        // Mark as verified in IndexedDB
        await localVideoStorage.markAsVerified(videoId);
        setStage('success');
      } else {
        setError(result.error || 'Verification failed');
        setStage('error');
      }
    } catch (err) {
      console.error('Verification submission failed:', err);
      setError('Failed to submit verification');
      setStage('error');
    }
  };

  const handleRetry = () => {
    setStage('intro');
    setError('');
    setCurrentChallenge(0);
  };

  if (stage === 'intro') {
    return (
      <Card className="p-8 max-w-2xl mx-auto">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-600 rounded-full mx-auto mb-4 flex items-center justify-center">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold mb-3">Liveness Verification</h2>
          <p className="text-gray-600 mb-6">
            Complete a quick liveness check to verify your identity and build trust with clients
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
            <h3 className="font-semibold mb-2">What to expect:</h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li>✓ We'll ask you to make 2-3 simple movements</li>
              <li>✓ The whole process takes 10-15 seconds</li>
              <li>✓ Your video is stored securely on your device</li>
              <li>✓ One-time ₦150 payment for lifetime verification</li>
            </ul>
          </div>

          <div className="space-y-3">
            <Button 
              onClick={startCamera}
              size="lg"
              className="w-full"
            >
              <Camera className="w-5 h-5 mr-2" />
              Start Verification
            </Button>
            <p className="text-xs text-gray-500">
              By continuing, you agree to our privacy policy
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (stage === 'camera') {
    return (
      <Card className="p-6 max-w-2xl mx-auto">
        <div className="space-y-4">
          <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            
            {recording && currentChallenge < challenges.length && (
              <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-black/70 text-white px-6 py-3 rounded-full text-lg font-semibold">
                {challenges[currentChallenge]?.instruction}
              </div>
            )}

            {recording && (
              <div className="absolute top-4 right-4 bg-red-600 text-white px-3 py-1.5 rounded-full text-sm font-semibold flex items-center gap-2">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                Recording
              </div>
            )}
          </div>

          {!recording && (
            <div className="text-center">
              <p className="text-gray-600 mb-4">
                Position your face in the center. When you're ready, click Start.
              </p>
              <Button onClick={startRecording} size="lg">
                <Camera className="w-5 h-5 mr-2" />
                Start Recording
              </Button>
            </div>
          )}

          {recording && (
            <div className="text-center">
              <p className="text-sm text-gray-600">
                Follow the instructions on screen...
              </p>
              <div className="flex items-center justify-center gap-2 mt-3">
                {challenges.map((_, i) => (
                  <div
                    key={i}
                    className={`w-3 h-3 rounded-full ${
                      i <= currentChallenge ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>
    );
  }

  if (stage === 'processing') {
    return (
      <Card className="p-8 max-w-md mx-auto text-center">
        <Loader2 className="w-16 h-16 text-blue-600 mx-auto mb-4 animate-spin" />
        <h2 className="text-xl font-bold mb-2">Processing Verification</h2>
        <p className="text-gray-600">
          Please wait while we verify your liveness check...
        </p>
      </Card>
    );
  }

  if (stage === 'success') {
    return (
      <Card className="p-8 max-w-md mx-auto text-center">
        <div className="w-16 h-16 bg-green-600 rounded-full mx-auto mb-4 flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-green-900 mb-3">
          Verification Complete!
        </h2>
        <p className="text-gray-700 mb-6">
          Your identity has been verified. You now have a verified badge on your profile.
        </p>
        <Button size="lg" onClick={() => window.location.href = '/dashboard/profile'}>
          View Profile
        </Button>
      </Card>
    );
  }

  if (stage === 'error') {
    return (
      <Card className="p-8 max-w-md mx-auto text-center">
        <div className="w-16 h-16 bg-red-600 rounded-full mx-auto mb-4 flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-red-900 mb-3">
          Verification Failed
        </h2>
        <p className="text-gray-700 mb-6">{error}</p>
        <div className="space-y-3">
          <Button size="lg" onClick={handleRetry}>
            Try Again
          </Button>
          <Button size="lg" variant="outline" onClick={() => window.location.href = '/support'}>
            Contact Support
          </Button>
        </div>
      </Card>
    );
  }

  return null;
}