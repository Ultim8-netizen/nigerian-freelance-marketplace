// src/lib/mediapipe/face-detector.ts
import { FaceLandmarker, FilesetResolver, FaceLandmarkerResult } from '@mediapipe/tasks-vision';

export class FaceDetector {
  private faceLandmarker: FaceLandmarker | null = null;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );

      this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'GPU'
        },
        numFaces: 1,
        runningMode: 'VIDEO',
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      this.initialized = true;
      console.log('✅ MediaPipe Face Detector initialized');
    } catch (error) {
      console.error('❌ MediaPipe initialization failed:', error);
      throw new Error('Failed to initialize face detection');
    }
  }

  async detectFace(videoElement: HTMLVideoElement): Promise<FaceLandmarkerResult | null> {
    if (!this.faceLandmarker || !this.initialized) {
      throw new Error('Face detector not initialized');
    }

    try {
      const result = await this.faceLandmarker.detectForVideo(
        videoElement,
        performance.now()
      );
      return result;
    } catch (error) {
      console.error('Face detection error:', error);
      return null;
    }
  }

  destroy(): void {
    if (this.faceLandmarker) {
      this.faceLandmarker.close();
      this.faceLandmarker = null;
      this.initialized = false;
    }
  }
}