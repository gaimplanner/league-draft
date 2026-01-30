import { useState, useCallback } from 'react';
import type {
  CompositeScoresResponse,
  CompositePlayerDetail,
  CompositeWeights,
  CompositeDataTier,
} from '../types';
import { api } from '../api/client';

export function useCompositeScores(seasonId: string | null) {
  const [scores, setScores] = useState<CompositeScoresResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previousRanks, setPreviousRanks] = useState<Map<string, number>>(new Map());

  const calculate = useCallback(async (weights: CompositeWeights) => {
    if (!seasonId) return;
    setLoading(true);
    setError(null);
    try {
      // Save current ranks before recalculating (for rank delta display)
      if (scores) {
        const rankMap = new Map<string, number>();
        scores.players.forEach((p, i) => rankMap.set(p.playerKey, i));
        setPreviousRanks(rankMap);
      }
      const result = await api.calculateCompositeScores(seasonId, weights);
      setScores(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to calculate composite scores');
    } finally {
      setLoading(false);
    }
  }, [seasonId, scores]);

  const getPlayerDetail = useCallback(async (
    playerKey: string,
    weights?: CompositeWeights
  ): Promise<CompositePlayerDetail | null> => {
    if (!seasonId) return null;
    try {
      return await api.getCompositePlayerDetail(seasonId, playerKey, weights);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load player detail');
      return null;
    }
  }, [seasonId]);

  const promotePlayer = useCallback(async (
    playerKey: string,
    targetTier: CompositeDataTier,
    currentWeights: CompositeWeights
  ) => {
    if (!seasonId) return;
    try {
      await api.promoteCompositePlayer(seasonId, playerKey, targetTier);
      // Recalculate to refresh rankings
      await calculate(currentWeights);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to promote player');
    }
  }, [seasonId, calculate]);

  return {
    scores,
    loading,
    error,
    previousRanks,
    calculate,
    getPlayerDetail,
    promotePlayer,
  };
}
