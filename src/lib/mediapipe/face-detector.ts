// src/lib/mediapipe/face-detector.ts
//
// CHANGES from original:
//  1. All inline constants replaced with imports from config.ts.
//  2. Added explicit CPU fallback in initialize():
//     MediaPipe documents automatic GPU→CPU fallback, but certain OEM builds
//     (TECNO / Transsion on Android WebView) throw instead of falling back
//     silently. We catch that specific path and retry with delegate: 'CPU'
//     so the liveness check doesn't break on budget devices.
//  3. detectFace() guards on video readyState before calling detectForVideo().
//     Calling the method while the video is still loading returns an empty
//     result rather than throwing, but the guard makes the contract explicit
//     and avoids the first few no-op frames in the detection loop.
//
// Public API is unchanged — FaceDetector.initialize(), detectFace(), destroy()
// behave identically from the caller's perspective.

import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
} from '@mediapipe/tasks-vision';

import {
  MEDIAPIPE_WASM_PATH,
  FACE_LANDMARKER_OPTIONS,
} from '@/lib/mediapipe/config';

export class FaceDetector {
  private faceLandmarker: FaceLandmarker | null = null;
  private initialized = false;

  // ── Initialization ─────────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_PATH);

    // Attempt GPU first. On standard browsers this succeeds via WebGL.
    // On OEM WebView builds that incorrectly throw instead of falling back,
    // we catch and retry with CPU so the liveness check isn't dead on arrival.
    try {
      this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        ...FACE_LANDMARKER_OPTIONS,
        baseOptions: {
          ...FACE_LANDMARKER_OPTIONS.baseOptions,
          delegate: 'GPU',
        },
      });
      console.log('✅ MediaPipe Face Detector initialised (GPU)');
    } catch (gpuError) {
      console.warn(
        '⚠️ GPU delegate unavailable — falling back to CPU:',
        gpuError
      );

      try {
        this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          ...FACE_LANDMARKER_OPTIONS,
          baseOptions: {
            ...FACE_LANDMARKER_OPTIONS.baseOptions,
            delegate: 'CPU',
          },
        });
        console.log('✅ MediaPipe Face Detector initialised (CPU fallback)');
      } catch (cpuError) {
        console.error('❌ MediaPipe initialisation failed on both GPU and CPU:', cpuError);
        throw new Error('Failed to initialize face detection');
      }
    }

    this.initialized = true;
  }

  // ── Per-frame detection ────────────────────────────────────────────────────

  async detectFace(videoElement: HTMLVideoElement): Promise<FaceLandmarkerResult | null> {
    if (!this.faceLandmarker || !this.initialized) {
      throw new Error('Face detector not initialized');
    }

    // Guard: video must be playing and have decoded at least one frame.
    // readyState 2 = HAVE_CURRENT_DATA, 3 = HAVE_FUTURE_DATA, 4 = HAVE_ENOUGH_DATA.
    // Calling detectForVideo on a video at readyState < 2 returns empty landmarks
    // rather than throwing, but this guard keeps the intent explicit and avoids
    // wasted calls during the startup frames before the stream is ready.
    if (videoElement.readyState < 2 || videoElement.paused) {
      return null;
    }

    try {
      // detectForVideo is synchronous in VIDEO mode — the async wrapper here
      // is for API consistency with the rest of the call chain. The await
      // resolves immediately with the synchronous return value.
      const result = this.faceLandmarker.detectForVideo(
        videoElement,
        performance.now()
      );
      return result;
    } catch (error) {
      console.error('Face detection error:', error);
      return null;
    }
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────

  destroy(): void {
    if (this.faceLandmarker) {
      this.faceLandmarker.close();
      this.faceLandmarker = null;
      this.initialized = false;
    }
  }
}