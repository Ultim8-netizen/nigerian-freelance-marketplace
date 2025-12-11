// src/hooks/useTrustScore.ts
import { useState, useEffect } from 'react';
import { getTrustLevelByScore, updateTrustScore, getTrustScoreHistory, type TrustScoreEventType } from '@/lib/trust/trust-score';

export function useTrustScore(userId: string | null) {
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState<string>('new');
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      fetchTrustScore();
    }
  }, [userId]);

  const fetchTrustScore = async () => {
    if (!userId) return;

    try {
      const response = await fetch(`/api/trust/score?user_id=${userId}`);
      const result = await response.json();

      if (result.success) {
        setScore(result.data.trust_score);
        setLevel(result.data.trust_level);
      }
    } catch (error) {
      console.error('Failed to fetch trust score:', error);
    } finally {
      setLoading(false);
    }
  };

  const addTrustEvent = async (
    eventType: TrustScoreEventType,
    context?: any
  ) => {
    if (!userId) return;

    const result = await updateTrustScore(userId, eventType, context);
    
    if (result.success) {
      setScore(result.newScore!);
      setLevel(result.newLevel!);
      await fetchHistory();
    }
    
    return result;
  };

  const fetchHistory = async () => {
    if (!userId) return;
    const events = await getTrustScoreHistory(userId);
    setHistory(events);
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