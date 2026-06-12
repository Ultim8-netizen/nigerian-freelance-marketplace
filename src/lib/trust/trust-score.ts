// src/lib/trust/trust-score.ts

// ─── Event catalogue ──────────────────────────────────────────────────────────
// Only events that are actively triggered belong here.
// Removed: DELIVERY_STREAK_5, DELIVERY_STREAK_10 (no streak counter),
//          ACCOUNT_AGE_MONTH (no cron entry), FAST_RESPONSE and
//          HIGH_ACCEPTANCE_RATE (no tracking logic).
export const TRUST_SCORE_EVENTS = {
  // Verification
  LIVENESS_VERIFIED:           { points:  25, description: 'Liveness verification completed' },
  PHONE_VERIFIED:              { points:  10, description: 'Phone number verified' },
  EMAIL_VERIFIED:              { points:   5, description: 'Email verified' },

  // Positive behaviour — triggered by DB triggers on orders / reviews
  ORDER_COMPLETED:             { points:   2, description: 'Order completed successfully' },
  POSITIVE_REVIEW_4:           { points:   3, description: 'Received 4-star review' },
  POSITIVE_REVIEW_5:           { points:   4, description: 'Received 5-star review' },
  DISPUTE_RESOLVED_PEACEFULLY: { points:   4, description: 'Dispute resolved peacefully' },
  ON_TIME_DELIVERY:            { points:   1, description: 'Delivered on time' },

  // Negative behaviour — triggered by DB triggers on orders / reviews / admin
  NEGATIVE_REVIEW_1:           { points:  -5, description: 'Received 1-star review' },
  NEGATIVE_REVIEW_2:           { points:  -5, description: 'Received 2-star review' },
  DISPUTE_LOST:                { points: -10, description: 'Dispute resolved against user' },
  LATE_DELIVERY:               { points:  -3, description: 'Late delivery' },
  ORDER_CANCELLATION:          { points:  -5, description: 'Cancelled order' },
  FAKE_REVIEW_DETECTED:        { points: -15, description: 'Fake review detected' },
  SUSPICIOUS_ACTIVITY:         { points: -20, description: 'Suspicious activity flagged' },
} as const;

export type TrustScoreEventType = keyof typeof TRUST_SCORE_EVENTS;

// ─── Tier definitions ─────────────────────────────────────────────────────────
// These are the canonical thresholds for the entire platform.
// DB trigger update_profile_trust_level() and feature-gates.ts both derive from
// this object — do not duplicate the numeric values anywhere else.
export const TRUST_LEVELS = {
  NEW: {
    level:    'new',
    label:    'New User',
    minScore: 0,
    maxScore: 24,
    badge:    'New',
    color:    'gray',
    benefits: ['Basic platform access'],
  },
  VERIFIED: {
    level:    'verified',
    label:    'Verified Human',
    minScore: 25,
    maxScore: 39,
    badge:    'Verified Human',
    color:    'blue',
    benefits: ['Liveness verified', 'Medium visibility', 'Client trust boost'],
  },
  TRUSTED: {
    level:    'trusted',
    label:    'Trusted Provider',
    minScore: 40,
    maxScore: 69,
    badge:    'Trusted',
    color:    'green',
    benefits: ['5+ successful jobs', '4.0+ average rating', 'High search ranking', 'Featured in results'],
  },
  TOP_RATED: {
    level:    'top_rated',
    label:    'Top Rated',
    minScore: 70,
    maxScore: 89,
    badge:    'Top Rated',
    color:    'purple',
    benefits: ['20+ successful jobs', '4.5+ average rating', 'Priority ranking', 'Premium badge', 'Featured listings'],
  },
  ELITE: {
    level:    'elite',
    label:    'Elite Provider',
    minScore: 90,
    maxScore: Infinity,
    badge:    'Elite',
    color:    'gold',
    benefits: ['Exceptional reliability', 'Minimal disputes', 'Spotlight listing', 'Exclusive branding', 'Priority support'],
  },
} as const;

export type TrustLevel = keyof typeof TRUST_LEVELS;

// ─── Utilities ────────────────────────────────────────────────────────────────

export function getTrustLevelByScore(score: number): typeof TRUST_LEVELS[TrustLevel] {
  if (score >= 90) return TRUST_LEVELS.ELITE;
  if (score >= 70) return TRUST_LEVELS.TOP_RATED;
  if (score >= 40) return TRUST_LEVELS.TRUSTED;
  if (score >= 25) return TRUST_LEVELS.VERIFIED;
  return TRUST_LEVELS.NEW;
}

// deliveryStreak context removed — DELIVERY_STREAK_* events are no longer defined.
export function calculateScoreChange(
  eventType: TrustScoreEventType,
  context?:  { reviewRating?: number }
): number {
  const basePoints = TRUST_SCORE_EVENTS[eventType].points;

  if (context?.reviewRating === 5 && eventType === 'POSITIVE_REVIEW_5') {
    return basePoints + 1; // Extra point for a perfect review
  }

  return basePoints;
}

// ─── Client-side helpers ──────────────────────────────────────────────────────
// Both functions below call relative fetch() URLs and are BROWSER-ONLY.
// Do not import them from server components, server actions, or middleware.
// For server-side trust mutations call createServiceClient().rpc('add_trust_score_event', ...)

/**
 * Records a trust event for the currently authenticated user via the API route.
 * @client-only
 */
export async function updateTrustScore(
  userId:    string,
  eventType: TrustScoreEventType,
  context?:  {
    relatedEntityType?: string;
    relatedEntityId?:   string;
    notes?:             string;
    reviewRating?:      number;
  }
): Promise<{ success: boolean; newScore?: number; newLevel?: string; error?: string }> {
  try {
    const scoreChange = calculateScoreChange(eventType, context);

    const response = await fetch('/api/trust/update-score', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        user_id:             userId,
        event_type:          eventType,
        score_change:        scoreChange,
        related_entity_type: context?.relatedEntityType,
        related_entity_id:   context?.relatedEntityId,
        notes:               context?.notes ?? TRUST_SCORE_EVENTS[eventType].description,
      }),
    });

    return await response.json();
  } catch (error) {
    console.error('Trust score update failed:', error);
    return { success: false, error: 'Failed to update trust score' };
  }
}

/**
 * Fetches trust score history for the authenticated user.
 * @client-only
 */
export async function getTrustScoreHistory(
  userId: string,
  limit:  number = 50
): Promise<TrustScoreEvent[]> {
  try {
    const response = await fetch(`/api/trust/history?user_id=${userId}&limit=${limit}`);
    const result   = await response.json();
    return result.data || [];
  } catch (error) {
    console.error('Failed to fetch trust score history:', error);
    return [];
  }
}

export interface TrustScoreEvent {
  id:             string;
  event_type:     string;
  score_change:   number;
  previous_score: number;
  new_score:      number;
  notes:          string;
  created_at:     string;
}