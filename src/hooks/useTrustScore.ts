// src/hooks/useTrustScore.ts
// Trust Score management hook

import { useState, useEffect, useCallback } from 'react';
import { getTrustLevelByScore, updateTrustScore, getTrustScoreHistory, type TrustScoreEventType, type TrustScoreEvent } from '@/lib/trust/trust-score';

// Defined TrustEventContext based on the signature in src/lib/trust/trust-score.ts
interface TrustEventContext {
  relatedEntityType?: string;
  relatedEntityId?: string;
  notes?: string;
  deliveryStreak?: number;
  reviewRating?: number;
}

export function useTrustScore(userId: string | null) {
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState<string>('new');
  // Using the imported type TrustScoreEvent[] for history state
  const [history, setHistory] = useState<TrustScoreEvent[]>([]); 
  const [loading, setLoading] = useState(true);

  // Function to fetch history, wrapped in useCallback to be a stable dependency
  const fetchHistory = useCallback(async () => {
    if (!userId) return;
    try {
      const events = await getTrustScoreHistory(userId); 
      setHistory(events);
    } catch (error) {
      console.error('Failed to fetch trust score history:', error);
    }
  }, [userId]); // Dependency: userId

  // Function to fetch the current score, wrapped in useCallback
  const fetchTrustScore = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/trust/score?user_id=${userId}`);
      const result = await response.json();

      if (result.success) {
        setScore(result.data.trust_score);
        setLevel(result.data.trust_level);
        // Fetch history immediately after fetching the score
        await fetchHistory(); 
      } else {
        throw new Error(result.error || 'API failed to return success status.');
      }
    } catch (error) {
      console.error('Failed to fetch trust score:', error);
      setScore(0);
      setLevel('error');
    } finally {
      setLoading(false);
    }
  }, [userId, fetchHistory]); // Dependencies: userId, fetchHistory

  useEffect(() => {
    // Added fetchTrustScore to dependency array
    if (userId) {
      fetchTrustScore();
    }
  }, [userId, fetchTrustScore]);

  const addTrustEvent = async (
    eventType: TrustScoreEventType,
    context?: TrustEventContext // Now using the structurally accurate interface
  ) => {
    if (!userId) return { success: false, error: 'User ID not provided.' };

    const result = await updateTrustScore(userId, eventType, context);
    
    if (result.success) {
      setScore(result.newScore!);
      setLevel(result.newLevel!);
      await fetchHistory();
    }
    
    return result;
  };

  const trustLevelInfo = getTrustLevelByScore(score);

  return {
    score,
    level,
    trustLevelInfo,
    history,
    loading,
    addTrustEvent,
    refresh: fetchTrustScore,
  };
}