import { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, Camera, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

// Challenge types for liveness verification
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

// Mock local storage for demo
const mockLocalStorage = {
  saveVideo: async (userId: string, blob: Blob, challenges: string[]) => {
    const videoId = `video_${Date.now()}`;
    console.log('Saving video:', videoId, { userId, size: blob.size, challenges });
    return videoId;
  },
  markAsVerified: async (videoId: string) => {
    console.log('Marked as verified:', videoId);
  }
};

export default function LivenessVerificationCard() {
  const [stage, setStage] = useState<'intro' | 'camera' | 'processing' | 'success' | 'error'>('intro');
  const [error, setError] = useState('');
  const [challenges, setChallenges] = useState<typeof CHALLENGES>([]);
  const [currentChallenge, setCurrentChallenge] = useState(0);
  const [recording, setRecording] = useState(false);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const challengeTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      stopCamera();
      if (challengeTimerRef.current) {
        clearInterval(challengeTimerRef.current);
      }
    };
  }, []);

  // Auto-advance challenges during recording
  useEffect(() => {
    if (recording && currentChallenge < challenges.length) {
      const timer = setTimeout(() => {
        setCurrentChallenge(prev => prev + 1);
      }, 5000); // 5 seconds per challenge
      
      return () => clearTimeout(timer);
    }
  }, [recording, currentChallenge, challenges.length]);

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
      
      // Generate challenges
      const newChallenges = generateChallengeSequence();
      setChallenges(newChallenges);
      setStage('camera');
      
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

  const startCountdown = () => {
    setCountdown(3);
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          startRecording();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
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

    // Auto-complete after challenges finish
    const totalTime = challenges.length * 5000 + 1000;
    setTimeout(() => {
      stopRecording();
    }, totalTime);
  };

  const stopRecording = async () => {
    if (!mediaRecorderRef.current) return;

    return new Promise<void>((resolve) => {
      mediaRecorderRef.current!.onstop = async () => {
        const videoBlob = new Blob(chunksRef.current, { type: 'video/webm' });
        
        try {
          const userId = 'current_user_id'; // Get from auth context
          const id = await mockLocalStorage.saveVideo(
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
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Simulate successful verification
      const result = { success: true };

      if (result.success) {
        await mockLocalStorage.markAsVerified(videoId);
        setStage('success');
      } else {
        setError('Verification failed');
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
    setVideoId(null);
  };

  // Intro Screen
  if (stage === 'intro') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 flex items-center justify-center">
        <Card className="p-8 max-w-2xl w-full shadow-xl">
          <div className="text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full mx-auto mb-6 flex items-center justify-center shadow-lg">
              <Shield className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-3xl font-bold mb-3 text-gray-900">Liveness Verification</h2>
            <p className="text-gray-600 mb-8 text-lg">
              Complete a quick liveness check to verify your identity and build trust with clients
            </p>

            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 mb-8 text-left">
              <h3 className="font-semibold mb-4 text-lg text-gray-900">What to expect:</h3>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start">
                  <span className="text-blue-600 mr-3 text-xl">✓</span>
                  <span>We'll ask you to make 2-3 simple movements</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-3 text-xl">✓</span>
                  <span>The whole process takes 10-15 seconds</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-3 text-xl">✓</span>
                  <span>Your video is stored securely on your device</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-3 text-xl">✓</span>
                  <span>Get your verified badge instantly</span>
                </li>
              </ul>
            </div>

            <div className="space-y-4">
              <Button 
                onClick={startCamera}
                size="lg"
                className="w-full h-14 text-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                <Camera className="w-6 h-6 mr-2" />
                Start Verification
              </Button>
              <p className="text-xs text-gray-500">
                By continuing, you agree to our privacy policy and terms of service
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Camera/Recording Screen
  if (stage === 'camera') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 flex items-center justify-center">
        <Card className="p-6 max-w-3xl w-full shadow-xl">
          <div className="space-y-6">
            <div className="relative bg-black rounded-xl overflow-hidden aspect-video shadow-2xl">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              
              {/* Countdown overlay */}
              {countdown !== null && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <div className="text-white text-8xl font-bold animate-pulse">
                    {countdown}
                  </div>
                </div>
              )}
              
              {/* Challenge instruction */}
              {recording && currentChallenge < challenges.length && (
                <div className="absolute top-6 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-4 rounded-full text-xl font-semibold shadow-lg">
                  {challenges[currentChallenge]?.instruction}
                </div>
              )}

              {/* Recording indicator */}
              {recording && (
                <div className="absolute top-6 right-6 bg-red-600 text-white px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2 shadow-lg">
                  <span className="w-2.5 h-2.5 bg-white rounded-full animate-pulse"></span>
                  Recording
                </div>
              )}

              {/* Challenge progress */}
              {recording && (
                <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center gap-3">
                  {challenges.map((_, i) => (
                    <div
                      key={i}
                      className={`w-4 h-4 rounded-full transition-all duration-300 ${
                        i < currentChallenge ? 'bg-green-500 shadow-lg' : 
                        i === currentChallenge ? 'bg-blue-500 shadow-lg scale-125' : 
                        'bg-gray-400'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>

            {!recording && countdown === null && (
              <div className="text-center">
                <p className="text-gray-700 mb-6 text-lg">
                  Position your face in the center of the frame. When you're ready, click Start.
                </p>
                <Button 
                  onClick={startCountdown} 
                  size="lg"
                  className="px-8 h-14 text-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                >
                  <Camera className="w-6 h-6 mr-2" />
                  Start Recording
                </Button>
              </div>
            )}

            {recording && (
              <div className="text-center">
                <p className="text-gray-700 text-lg font-medium">
                  Follow the instructions on screen...
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Challenge {currentChallenge + 1} of {challenges.length}
                </p>
              </div>
            )}
          </div>
        </Card>
      </div>
    );
  }

  // Processing Screen
  if (stage === 'processing') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 flex items-center justify-center">
        <Card className="p-12 max-w-md w-full text-center shadow-xl">
          <Loader2 className="w-20 h-20 text-blue-600 mx-auto mb-6 animate-spin" />
          <h2 className="text-2xl font-bold mb-3">Processing Verification</h2>
          <p className="text-gray-600 text-lg">
            Please wait while we verify your liveness check...
          </p>
          <div className="mt-6 w-full bg-gray-200 rounded-full h-2">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
          </div>
        </Card>
      </div>
    );
  }

  // Success Screen
  if (stage === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 p-4 flex items-center justify-center">
        <Card className="p-12 max-w-md w-full text-center shadow-xl">
          <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full mx-auto mb-6 flex items-center justify-center shadow-lg animate-bounce">
            <CheckCircle className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-green-900 mb-4">
            Verification Complete!
          </h2>
          <p className="text-gray-700 mb-8 text-lg">
            Your identity has been verified. You now have a verified badge on your profile.
          </p>
          <Button 
            size="lg" 
            className="w-full h-14 text-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
            onClick={() => alert('Redirecting to profile...')}
          >
            View Profile
          </Button>
        </Card>
      </div>
    );
  }

  // Error Screen
  if (stage === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-rose-100 p-4 flex items-center justify-center">
        <Card className="p-12 max-w-md w-full text-center shadow-xl">
          <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-rose-600 rounded-full mx-auto mb-6 flex items-center justify-center shadow-lg">
            <AlertCircle className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-red-900 mb-4">
            Verification Failed
          </h2>
          <p className="text-gray-700 mb-8 text-lg">{error}</p>
          <div className="space-y-3">
            <Button 
              size="lg" 
              onClick={handleRetry}
              className="w-full h-14 text-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            >
              Try Again
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              onClick={() => alert('Redirecting to support...')}
              className="w-full h-14 text-lg"
            >
              Contact Support
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return null;
}