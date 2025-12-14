// src/lib/mediapipe/challenge-validator.ts
import { NormalizedLandmark } from '@mediapipe/tasks-vision';

export type ChallengeType = 'head_turn' | 'blink' | 'smile' | 'head_nod';

interface ChallengeValidationResult {
  passed: boolean;
  confidence: number;
}

export class ChallengeValidator {
  // Blink detection state
  private blinkState = {
    count: 0,
    wasOpen: true,
  };

  // Head nod state
  private nodState: {
    initialY: number;
    movedDown: boolean;
    movedUp: boolean;
  } | null = null;

  /**
   * Validate head turn (left or right)
   */
  validateHeadTurn(
    landmarks: NormalizedLandmark[],
    direction: 'left' | 'right'
  ): ChallengeValidationResult {
    // Landmark indices
    const noseTip = landmarks[1];
    const leftEye = landmarks[33];
    const rightEye = landmarks[263];

    // Calculate eye center
    const eyeCenter = {
      x: (leftEye.x + rightEye.x) / 2,
      y: (leftEye.y + rightEye.y) / 2,
    };

    // Calculate horizontal offset of nose from eye center
    const horizontalOffset = noseTip.x - eyeCenter.x;

    // Threshold for "turned" (adjust based on testing)
    const TURN_THRESHOLD = 0.08;

    let passed = false;
    if (direction === 'left' && horizontalOffset < -TURN_THRESHOLD) {
      passed = true;
    } else if (direction === 'right' && horizontalOffset > TURN_THRESHOLD) {
      passed = true;
    }

    return {
      passed,
      confidence: Math.abs(horizontalOffset) / TURN_THRESHOLD,
    };
  }

  /**
   * Validate blink
   */
  validateBlink(
    landmarks: NormalizedLandmark[],
    requiredCount: number
  ): ChallengeValidationResult {
    // Eye landmarks
    const leftEye = {
      top: landmarks[159],
      bottom: landmarks[145],
      left: landmarks[33],
      right: landmarks[133],
    };

    const rightEye = {
      top: landmarks[386],
      bottom: landmarks[374],
      left: landmarks[263],
      right: landmarks[362],
    };

    // Calculate Eye Aspect Ratio (EAR)
    const leftEAR = this.calculateEAR(
      leftEye.top,
      leftEye.bottom,
      leftEye.left,
      leftEye.right
    );

    const rightEAR = this.calculateEAR(
      rightEye.top,
      rightEye.bottom,
      rightEye.left,
      rightEye.right
    );

    const avgEAR = (leftEAR + rightEAR) / 2;
    const EAR_THRESHOLD = 0.2;

    // Detect blink
    if (avgEAR < EAR_THRESHOLD && this.blinkState.wasOpen) {
      // Eye closed
      this.blinkState.wasOpen = false;
    } else if (avgEAR > EAR_THRESHOLD && !this.blinkState.wasOpen) {
      // Eye opened again - count as blink
      this.blinkState.count++;
      this.blinkState.wasOpen = true;
    }

    const passed = this.blinkState.count >= requiredCount;

    if (passed) {
      // Reset for next challenge
      this.blinkState = { count: 0, wasOpen: true };
    }

    return {
      passed,
      confidence: this.blinkState.count / requiredCount,
    };
  }

  /**
   * Validate smile
   */
  validateSmile(landmarks: NormalizedLandmark[]): ChallengeValidationResult {
    // Mouth corners and center
    const leftMouth = landmarks[61];
    const rightMouth = landmarks[291];
    const topMouth = landmarks[13];
    const bottomMouth = landmarks[14];

    // Calculate mouth aspect ratio
    const mouthWidth = this.calculateDistance(leftMouth, rightMouth);
    const mouthHeight = this.calculateDistance(topMouth, bottomMouth);

    const ratio = mouthWidth / mouthHeight;

    // Smile threshold (adjust based on testing)
    const SMILE_THRESHOLD = 3.0;
    const passed = ratio > SMILE_THRESHOLD;

    return {
      passed,
      confidence: ratio / SMILE_THRESHOLD,
    };
  }

  /**
   * Validate head nod (up and down)
   */
  validateHeadNod(landmarks: NormalizedLandmark[]): ChallengeValidationResult {
    const noseTip = landmarks[1];

    if (!this.nodState) {
      // Initialize
      this.nodState = {
        initialY: noseTip.y,
        movedDown: false,
        movedUp: false,
      };
    }

    const VERTICAL_THRESHOLD = 0.05;

    // Check if moved down
    if (noseTip.y > this.nodState.initialY + VERTICAL_THRESHOLD) {
      this.nodState.movedDown = true;
    }

    // Check if moved back up
    if (
      this.nodState.movedDown &&
      noseTip.y < this.nodState.initialY - VERTICAL_THRESHOLD
    ) {
      this.nodState.movedUp = true;
    }

    const passed = this.nodState.movedDown && this.nodState.movedUp;

    if (passed) {
      // Reset for next challenge
      this.nodState = null;
    }

    // Calculate confidence, ensuring nodState is not null
    const confidence = this.nodState 
      ? (this.nodState.movedDown ? 0.5 : 0) + (this.nodState.movedUp ? 0.5 : 0)
      : 1.0; // If nodState is null (validation passed), confidence is 100%

    return {
      passed,
      confidence,
    };
  }

  /**
   * Calculate Eye Aspect Ratio
   */
  private calculateEAR(
    p1: NormalizedLandmark,
    p2: NormalizedLandmark,
    p3: NormalizedLandmark,
    p4: NormalizedLandmark
  ): number {
    const vertical = this.calculateDistance(p1, p2);
    const horizontal = this.calculateDistance(p3, p4);
    return vertical / horizontal;
  }

  /**
   * Calculate Euclidean distance between two landmarks
   */
  private calculateDistance(
    p1: NormalizedLandmark,
    p2: NormalizedLandmark
  ): number {
    return Math.sqrt(
      Math.pow(p1.x - p2.x, 2) +
      Math.pow(p1.y - p2.y, 2) +
      Math.pow(p1.z - p2.z, 2)
    );
  }

  /**
   * Reset all state (for new verification attempt)
   */
  reset(): void {
    this.blinkState = { count: 0, wasOpen: true };
    this.nodState = null;
  }
}