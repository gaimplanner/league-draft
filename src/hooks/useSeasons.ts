import { useState, useCallback } from 'react';
import type { Season, CreateSeasonData } from '../types';
import { api } from '../api/client';

export function useSeasons() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSeasons = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await api.listSeasons();
      setSeasons(data);
    } catch (err) {
      console.error('Failed to load seasons:', err);
      setError('Failed to load seasons');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createSeason = useCallback(async (data: CreateSeasonData): Promise<Season | null> => {
    try {
      setIsLoading(true);
      setError(null);
      const created = await api.createSeason(data);
      setSeasons(prev => [created, ...prev]);
      return created;
    } catch (err) {
      console.error('Failed to create season:', err);
      setError('Failed to create season');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateSeason = useCallback(async (
    id: string,
    data: Partial<CreateSeasonData>
  ): Promise<Season | null> => {
    try {
      setIsLoading(true);
      setError(null);
      const updated = await api.updateSeason(id, data);
      setSeasons(prev => prev.map(s => s.id === id ? updated : s));
      return updated;
    } catch (err) {
      console.error('Failed to update season:', err);
      setError('Failed to update season');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteSeason = useCallback(async (id: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);
      await api.deleteSeason(id);
      setSeasons(prev => prev.filter(s => s.id !== id));
      return true;
    } catch (err) {
      console.error('Failed to delete season:', err);
      setError('Failed to delete season');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    seasons,
    isLoading,
    error,
    fetchSeasons,
    createSeason,
    updateSeason,
    deleteSeason,
  };
}
