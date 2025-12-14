// src/lib/trust/trust-score.ts
// Dynamic trust scoring system

export const TRUST_SCORE_EVENTS = {
  // Verification Events
  LIVENESS_VERIFIED: { points: 25, description: 'Liveness verification completed' },
  PHONE_VERIFIED: { points: 10, description: 'Phone number verified' },
  EMAIL_VERIFIED: { points: 5, description: 'Email verified' },
  
  // Positive Behavior
  ORDER_COMPLETED: { points: 2, description: 'Order completed successfully' },
  POSITIVE_REVIEW_4: { points: 3, description: 'Received 4-star review' },
  POSITIVE_REVIEW_5: { points: 4, description: 'Received 5-star review' },
  DISPUTE_RESOLVED_PEACEFULLY: { points: 4, description: 'Dispute resolved peacefully' },
  ON_TIME_DELIVERY: { points: 1, description: 'Delivered on time' },
  DELIVERY_STREAK_5: { points: 5, description: '5 consecutive on-time deliveries' },
  DELIVERY_STREAK_10: { points: 10, description: '10 consecutive on-time deliveries' },
  FAST_RESPONSE: { points: 3, description: 'Consistently fast response rate' },
  HIGH_ACCEPTANCE_RATE: { points: 3, description: '90%+ order acceptance rate' },
  ACCOUNT_AGE_MONTH: { points: 2, description: 'Active for one month' },
  
  // Negative Behavior
  NEGATIVE_REVIEW_1: { points: -5, description: 'Received 1-star review' },
  NEGATIVE_REVIEW_2: { points: -5, description: 'Received 2-star review' },
  DISPUTE_LOST: { points: -10, description: 'Dispute resolved against user' },
  LATE_DELIVERY: { points: -3, description: 'Late delivery' },
  ORDER_CANCELLATION: { points: -5, description: 'Cancelled order' },
  FAKE_REVIEW_DETECTED: { points: -15, description: 'Fake review detected' },
  SUSPICIOUS_ACTIVITY: { points: -20, description: 'Suspicious activity flagged' },
} as const;

export type TrustScoreEventType = keyof typeof TRUST_SCORE_EVENTS;

export const TRUST_LEVELS = {
  NEW: {
    level: 'new',
    label: 'New User',
    minScore: 0,
    maxScore: 24,
    badge: 'New',
    color: 'gray',
    benefits: ['Basic platform access'],
  },
  VERIFIED: {
    level: 'verified',
    label: 'Verified Human',
    minScore: 25,
    maxScore: 39,
    badge: 'Verified Human',
    color: 'blue',
    benefits: [
      'Liveness verified',
      'Medium visibility',
      'Client trust boost',
    ],
  },
  TRUSTED: {
    level: 'trusted',
    label: 'Trusted Provider',
    minScore: 40,
    maxScore: 69,
    badge: 'Trusted',
    color: 'green',
    benefits: [
      '5+ successful jobs',
      '4.0+ average rating',
      'High search ranking',
      'Featured in results',
    ],
  },
  TOP_RATED: {
    level: 'top_rated',
    label: 'Top Rated',
    minScore: 70,
    maxScore: 89,
    badge: 'Top Rated',
    color: 'purple',
    benefits: [
      '20+ successful jobs',
      '4.5+ average rating',
      'Priority ranking',
      'Premium badge',
      'Featured listings',
    ],
  },
  ELITE: {
    level: 'elite',
    label: 'Elite Provider',
    minScore: 90,
    maxScore: Infinity,
    badge: 'Elite',
    color: 'gold',
    benefits: [
      'Exceptional reliability',
      'Minimal disputes',
      'Spotlight listing',
      'Exclusive branding',
      'Priority support',
    ],
  },
} as const;

export type TrustLevel = keyof typeof TRUST_LEVELS;

export function getTrustLevelByScore(score: number): typeof TRUST_LEVELS[TrustLevel] {
  if (score >= 90) return TRUST_LEVELS.ELITE;
  if (score >= 70) return TRUST_LEVELS.TOP_RATED;
  if (score >= 40) return TRUST_LEVELS.TRUSTED;
  if (score >= 25) return TRUST_LEVELS.VERIFIED;
  return TRUST_LEVELS.NEW;
}

export function calculateScoreChange(
  eventType: TrustScoreEventType,
  context?: {
    deliveryStreak?: number;
    reviewRating?: number;
  }
): number {
  const basePoints = TRUST_SCORE_EVENTS[eventType].points;
  
  // Apply modifiers based on context
  if (context?.deliveryStreak && context.deliveryStreak >= 10) {
    return basePoints + 5; // Bonus for long streaks
  }
  
  if (context?.reviewRating === 5 && eventType === 'POSITIVE_REVIEW_5') {
    return basePoints + 1; // Extra bonus for perfect reviews
  }
  
  return basePoints;
}

// API call to update trust score
export async function updateTrustScore(
  userId: string,
  eventType: TrustScoreEventType,
  context?: {
    relatedEntityType?: string;
    relatedEntityId?: string;
    notes?: string;
    deliveryStreak?: number;
    reviewRating?: number;
  }
): Promise<{ success: boolean; newScore?: number; newLevel?: string; error?: string }> {
  try {
    const scoreChange = calculateScoreChange(eventType, context);
    
    const response = await fetch('/api/trust/update-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        event_type: eventType,
        score_change: scoreChange,
        related_entity_type: context?.relatedEntityType,
        related_entity_id: context?.relatedEntityId,
        notes: context?.notes || TRUST_SCORE_EVENTS[eventType].description,
      }),
    });
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Trust score update failed:', error);
    return { success: false, error: 'Failed to update trust score' };
  }
}

// Get trust score history
export async function getTrustScoreHistory(
  userId: string,
  limit: number = 50
): Promise<TrustScoreEvent[]> {
  try {
    const response = await fetch(`/api/trust/history?user_id=${userId}&limit=${limit}`);
    const result = await response.json();
    return result.data || [];
  } catch (error) {
    console.error('Failed to fetch trust score history:', error);
    return [];
  }
}

// FIX: Added 'export' keyword to make the interface available for import
export interface TrustScoreEvent {
  id: string;
  event_type: string;
  score_change: number;
  previous_score: number;
  new_score: number;
  notes: string;
  created_at: string;
}