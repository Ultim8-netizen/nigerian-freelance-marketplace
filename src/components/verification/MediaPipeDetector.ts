// src/components/verification/MediaPipeDetector.ts
//
// FIX: was an empty file — a dead orphan sitting in the verification folder
// with a misleading name that implied it was the MediaPipe integration layer.
//
// This shim re-exports the canonical face detector so that any code that
// imports from this path receives the real implementation. LivenessCapture
// imports directly from @/lib/mediapipe/face-detector (the preferred path),
// so nothing currently depends on this file — the re-export future-proofs
// it and makes the file's purpose explicit.

export { FaceDetector } from '@/lib/mediapipe/face-detector';