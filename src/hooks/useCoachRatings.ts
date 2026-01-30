import { useState, useCallback } from 'react';
import type { CoachRating, CoachRatingProgress, CreateCoachRatingData, UpdateCoachRatingData } from '../types';
import { api } from '../api/client';

export function useCoachRatings() {
  const [ratings, setRatings] = useState<CoachRating[]>([]);
  const [progress, setProgress] = useState<CoachRatingProgress[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRatings = useCallback(async (seasonId: string): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await api.listCoachRatings(seasonId);
      setRatings(data);
    } catch (err) {
      console.error('Failed to load coach ratings:', err);
      setError('Failed to load coach ratings');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createRating = useCallback(async (
    seasonId: string,
    data: CreateCoachRatingData
  ): Promise<CoachRating | null> => {
    try {
      setIsLoading(true);
      setError(null);
      const created = await api.createCoachRating(seasonId, data);
      setRatings(prev => [...prev, created]);
      return created;
    } catch (err) {
      console.error('Failed to create coach rating:', err);
      setError('Failed to create coach rating');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateRating = useCallback(async (
    ratingId: string,
    updates: UpdateCoachRatingData
  ): Promise<CoachRating | null> => {
    try {
      setIsLoading(true);
      setError(null);
      const updated = await api.updateCoachRating(ratingId, updates);
      setRatings(prev => prev.map(r => r.id === updated.id ? updated : r));
      return updated;
    } catch (err) {
      console.error('Failed to update coach rating:', err);
      setError('Failed to update coach rating');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteRating = useCallback(async (ratingId: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);
      await api.deleteCoachRating(ratingId);
      setRatings(prev => prev.filter(r => r.id !== ratingId));
      return true;
    } catch (err) {
      console.error('Failed to delete coach rating:', err);
      setError('Failed to delete coach rating');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const submitRating = useCallback(async (ratingId: string): Promise<CoachRating | null> => {
    try {
      setIsLoading(true);
      setError(null);
      const submitted = await api.submitCoachRating(ratingId);
      setRatings(prev => prev.map(r => r.id === submitted.id ? submitted : r));
      return submitted;
    } catch (err) {
      console.error('Failed to submit coach rating:', err);
      const message = err instanceof Error ? err.message : 'Failed to submit rating';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchProgress = useCallback(async (seasonId: string): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await api.getCoachRatingsProgress(seasonId);
      setProgress(data);
    } catch (err) {
      console.error('Failed to load rating progress:', err);
      setError('Failed to load rating progress');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    ratings,
    progress,
    isLoading,
    error,
    fetchRatings,
    createRating,
    updateRating,
    deleteRating,
    submitRating,
    fetchProgress,
  };
}
