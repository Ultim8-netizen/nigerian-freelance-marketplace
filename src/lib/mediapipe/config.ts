// src/lib/mediapipe/config.ts
//
// Centralised configuration for the MediaPipe FaceLandmarker pipeline.
// All runtime constants that were previously scattered as inline literals
// inside face-detector.ts now live here so they can be adjusted in one
// place without touching class implementation files.

// ── CDN endpoints ─────────────────────────────────────────────────────────────
//
// Both paths point to versioned, publicly cached CDN assets.
// If these need to be served from your own storage (e.g. for offline use or
// to avoid CDN latency on low-bandwidth Nigerian connections), swap the URLs
// here and nowhere else.

export const MEDIAPIPE_WASM_PATH =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';

export const FACE_LANDMARKER_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

// ── FaceLandmarker options ────────────────────────────────────────────────────
//
// numFaces: 1           — we only need one face; detecting more wastes GPU budget.
// runningMode: 'VIDEO'  — required for per-frame detection from a live stream.
//                         'IMAGE' mode does NOT accept timestamps and will throw.
// confidence thresholds — 0.5 is the MediaPipe default. Lower values accept
//                         more detections but increase false positives.
// outputFaceBlendshapes — not needed; landmark coverage is sufficient for
//                         all four challenge types in ChallengeValidator.
// outputFacialTransformationMatrixes — not needed; head-turn is derived from
//                         relative landmark positions, not the matrix.

export const FACE_LANDMARKER_OPTIONS = {
  baseOptions: {
    modelAssetPath: FACE_LANDMARKER_MODEL_URL,
    // GPU is preferred for performance. face-detector.ts retries on CPU
    // if GPU initialisation throws — relevant on budget OEM Android builds.
    delegate: 'GPU' as const,
  },
  numFaces:                          1,
  runningMode:                       'VIDEO' as const,
  minFaceDetectionConfidence:        0.5,
  minFacePresenceConfidence:         0.5,
  minTrackingConfidence:             0.5,
  outputFaceBlendshapes:             false,
  outputFacialTransformationMatrixes: false,
} as const;

// ── Landmark constants ────────────────────────────────────────────────────────
//
// The face_landmarker.task model (float16/1) returns exactly 478 landmarks per
// detected face in VIDEO mode. This value is used by LivenessCapture to derive
// a continuous confidence score from landmark coverage:
//   confidence = min((count / FACE_LANDMARKS_TOTAL) * 0.95 + 0.05, 1.0)
// giving ~1.0 for a fully detected face and scaling down for partial detections.
// The submit route's gate is faceConfidence >= 0.7, which requires ~280+ landmarks.

export const FACE_LANDMARKS_TOTAL = 478;

// ── Initialisation timeouts ───────────────────────────────────────────────────
//
// How long to wait for the WASM + model download before declaring a failure.
// 20 s is generous enough for a first load on a 3G connection while still
// giving users a clear timeout error rather than an indefinite spinner.

export const MEDIAPIPE_INIT_TIMEOUT_MS = 20_000;