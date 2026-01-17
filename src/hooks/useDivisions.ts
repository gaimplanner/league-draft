import { useState, useEffect, useCallback } from 'react';
import {
  Division,
  DivisionSummary,
  DivisionPreset,
  DivisionAgeRange,
  createInitialDivision,
} from '../types';
import { api, ApiError } from '../api/client';

// Feature flag to use API vs localStorage
const USE_API = import.meta.env.VITE_USE_API === 'true';

const DIVISIONS_INDEX_KEY = 'little-league-divisions-index';
const DIVISION_PREFIX = 'little-league-division-';

// Validation: A division is complete enough to persist when it has players
export function isDivisionValid(division: Division | null): boolean {
  if (!division) return false;
  return (
    division.name?.trim().length > 0 &&
    division.teamCount > 0 &&
    division.players?.length > 0
  );
}

// Check if division has minimum setup (name and teams) but no players yet
export function isDivisionPartiallySetup(division: Division | null): boolean {
  if (!division) return false;
  return (
    division.name?.trim().length > 0 &&
    division.teamCount > 0 &&
    (!division.players || division.players.length === 0)
  );
}

function generateDivisionId(): string {
  return `div-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function getDivisionStorageKey(divisionId: string): string {
  return `${DIVISION_PREFIX}${divisionId}`;
}

function loadDivisionsIndex(): string[] {
  try {
    const stored = localStorage.getItem(DIVISIONS_INDEX_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveDivisionsIndex(divisionIds: string[]): void {
  localStorage.setItem(DIVISIONS_INDEX_KEY, JSON.stringify(divisionIds));
}

function loadDivision(divisionId: string): Division | null {
  try {
    const stored = localStorage.getItem(getDivisionStorageKey(divisionId));
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function saveDivision(division: Division): void {
  localStorage.setItem(getDivisionStorageKey(division.id), JSON.stringify(division));
}

function deleteDivisionStorage(divisionId: string): void {
  localStorage.removeItem(getDivisionStorageKey(divisionId));
}

function divisionToSummary(division: Division): DivisionSummary {
  return {
    id: division.id,
    name: division.name,
    preset: division.preset,
    teamCount: division.teamCount,
    playerCount: division.players.length,
    phase: division.phase,
    createdAt: division.createdAt,
    completedAt: division.completedAt,
  };
}

export function useDivisions() {
  const [divisionIds, setDivisionIds] = useState<string[]>([]);
  const [summaries, setSummaries] = useState<DivisionSummary[]>([]);
  const [activeDivision, setActiveDivision] = useState<Division | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load divisions on mount
  useEffect(() => {
    if (USE_API) {
      // Load from API
      setIsLoading(true);
      api.listDivisions()
        .then((data) => {
          setSummaries(data);
          setDivisionIds(data.map(d => d.id));
          setError(null);
        })
        .catch((err: ApiError) => {
          console.error('Failed to load divisions from API:', err);
          setError('Failed to load divisions');
        })
        .finally(() => setIsLoading(false));
    } else {
      // Load from localStorage
      const ids = loadDivisionsIndex();
      setDivisionIds(ids);

      const loadedSummaries: DivisionSummary[] = [];
      for (const id of ids) {
        const division = loadDivision(id);
        if (division) {
          loadedSummaries.push(divisionToSummary(division));
        }
      }
      setSummaries(loadedSummaries);
    }
  }, []);

  // Check if a division name already exists (case-insensitive)
  const divisionNameExists = useCallback((name: string): boolean => {
    const normalizedName = name.trim().toLowerCase();
    return summaries.some(s => s.name.trim().toLowerCase() === normalizedName);
  }, [summaries]);

  // Create a new division
  const createDivision = useCallback(async (config: {
    name: string;
    preset: DivisionPreset;
    teamCount: number;
    ageRange: DivisionAgeRange;
    enforceAgeLimit: boolean;
    maxPerAge: number;
  }): Promise<Division | null> => {
    // Check for duplicate name
    if (divisionNameExists(config.name)) {
      return null;
    }

    if (USE_API) {
      try {
        setIsLoading(true);
        const division = await api.createDivision({
          name: config.name,
          preset: config.preset,
          ageRange: config.ageRange,
          teamCount: config.teamCount,
          enforceAgeLimit: config.enforceAgeLimit,
          maxPerAge: config.maxPerAge,
        });

        // Add to summaries
        setSummaries(prev => [...prev, {
          id: division.id,
          name: division.name,
          preset: division.preset,
          teamCount: division.teamCount,
          playerCount: division.players.length,
          phase: division.phase,
          createdAt: division.createdAt,
          completedAt: division.completedAt,
        }]);
        setDivisionIds(prev => [...prev, division.id]);
        setActiveDivision(division);
        setError(null);
        return division;
      } catch (err) {
        console.error('Failed to create division:', err);
        setError('Failed to create division');
        return null;
      } finally {
        setIsLoading(false);
      }
    } else {
      // localStorage path
      const id = generateDivisionId();
      const division = createInitialDivision(
        id,
        config.name,
        config.preset,
        config.teamCount,
        config.ageRange,
        config.enforceAgeLimit,
        config.maxPerAge
      );

      // Set as active (in-memory only - don't save until players imported)
      setActiveDivision(division);
      return division;
    }
  }, [divisionNameExists]);

  // Select an existing division
  const selectDivision = useCallback(async (divisionId: string): Promise<Division | null> => {
    if (USE_API) {
      try {
        setIsLoading(true);
        const division = await api.getDivision(divisionId);
        setActiveDivision(division);
        setError(null);
        return division;
      } catch (err) {
        console.error('Failed to load division:', err);
        setError('Failed to load division');
        return null;
      } finally {
        setIsLoading(false);
      }
    } else {
      const division = loadDivision(divisionId);
      if (division) {
        setActiveDivision(division);
      }
      return division;
    }
  }, []);

  // Update the active division
  const updateActiveDivision = useCallback(async (updates: Partial<Division>): Promise<void> => {
    if (!activeDivision) return;

    const updated: Division = { ...activeDivision, ...updates };

    if (USE_API) {
      try {
        // Only send API-supported fields
        const apiUpdates: Parameters<typeof api.updateDivision>[1] = {};
        if (updates.name !== undefined) apiUpdates.name = updates.name;
        if (updates.preset !== undefined) apiUpdates.preset = updates.preset;
        if (updates.ageRange !== undefined) apiUpdates.ageRange = updates.ageRange;
        if (updates.enforceAgeLimit !== undefined) apiUpdates.enforceAgeLimit = updates.enforceAgeLimit;
        if (updates.maxPerAge !== undefined) apiUpdates.maxPerAge = updates.maxPerAge;
        if (updates.teamCount !== undefined) apiUpdates.teamCount = updates.teamCount;
        if (updates.rosterSize !== undefined) apiUpdates.rosterSize = updates.rosterSize;
        if (updates.scoringWeights !== undefined) apiUpdates.scoringWeights = updates.scoringWeights;
        if (updates.scoringMode !== undefined) apiUpdates.scoringMode = updates.scoringMode;
        if (updates.phase !== undefined) apiUpdates.phase = updates.phase;

        // Only call API if there are API-supported updates
        if (Object.keys(apiUpdates).length > 0) {
          const division = await api.updateDivision(activeDivision.id, apiUpdates);
          setActiveDivision(division);

          // Update summary
          setSummaries(prev => prev.map(s =>
            s.id === division.id ? {
              id: division.id,
              name: division.name,
              preset: division.preset,
              teamCount: division.teamCount,
              playerCount: division.players.length,
              phase: division.phase,
              createdAt: division.createdAt,
              completedAt: division.completedAt,
            } : s
          ));
        } else {
          // For non-API updates (like teams, players), just update local state
          setActiveDivision(updated);
        }
        setError(null);
      } catch (err) {
        console.error('Failed to update division:', err);
        setError('Failed to update division');
      }
    } else {
      const wasValid = isDivisionValid(activeDivision);
      const isNowValid = isDivisionValid(updated);

      // Only persist to localStorage if division is valid (has players)
      if (isNowValid) {
        // First time becoming valid - add to index
        if (!wasValid && !divisionIds.includes(updated.id)) {
          const newIds = [...divisionIds, updated.id];
          saveDivisionsIndex(newIds);
          setDivisionIds(newIds);
          setSummaries(prev => [...prev, divisionToSummary(updated)]);
        } else {
          // Already in index - just update summary
          setSummaries(prev => prev.map(s =>
            s.id === updated.id ? divisionToSummary(updated) : s
          ));
        }
        saveDivision(updated);
      }

      setActiveDivision(updated);
    }
  }, [activeDivision, divisionIds]);

  // Delete a division
  const deleteDivision = useCallback(async (divisionId: string): Promise<void> => {
    if (USE_API) {
      try {
        setIsLoading(true);
        await api.deleteDivision(divisionId);
        setDivisionIds(prev => prev.filter(id => id !== divisionId));
        setSummaries(prev => prev.filter(s => s.id !== divisionId));
        if (activeDivision?.id === divisionId) {
          setActiveDivision(null);
        }
        setError(null);
      } catch (err) {
        console.error('Failed to delete division:', err);
        setError('Failed to delete division');
      } finally {
        setIsLoading(false);
      }
    } else {
      // Remove from localStorage
      deleteDivisionStorage(divisionId);

      // Update index
      const newIds = divisionIds.filter(id => id !== divisionId);
      saveDivisionsIndex(newIds);
      setDivisionIds(newIds);

      // Update summaries
      setSummaries(prev => prev.filter(s => s.id !== divisionId));

      // Clear active if it was the deleted one
      if (activeDivision?.id === divisionId) {
        setActiveDivision(null);
      }
    }
  }, [divisionIds, activeDivision]);

  // Clear active division (return to selector)
  const clearActiveDivision = useCallback((): void => {
    setActiveDivision(null);
  }, []);

  // Refresh summaries from storage/API
  const refreshSummaries = useCallback(async (): Promise<void> => {
    if (USE_API) {
      try {
        setIsLoading(true);
        const data = await api.listDivisions();
        setSummaries(data);
        setDivisionIds(data.map(d => d.id));
        setError(null);
      } catch (err) {
        console.error('Failed to refresh divisions:', err);
        setError('Failed to refresh divisions');
      } finally {
        setIsLoading(false);
      }
    } else {
      const ids = loadDivisionsIndex();
      const loadedSummaries: DivisionSummary[] = [];
      for (const id of ids) {
        const division = loadDivision(id);
        if (division) {
          loadedSummaries.push(divisionToSummary(division));
        }
      }
      setSummaries(loadedSummaries);
    }
  }, []);

  // Refresh active division from storage/API
  const refreshActiveDivision = useCallback(async (): Promise<void> => {
    if (!activeDivision) return;

    if (USE_API) {
      try {
        const division = await api.getDivision(activeDivision.id);
        setActiveDivision(division);
        setError(null);
      } catch (err) {
        console.error('Failed to refresh active division:', err);
        setError('Failed to refresh division');
      }
    } else {
      const division = loadDivision(activeDivision.id);
      if (division) {
        setActiveDivision(division);
      }
    }
  }, [activeDivision]);

  // Full refresh - both summaries and active division
  const refreshDivisions = useCallback(async (): Promise<void> => {
    await refreshSummaries();
    if (activeDivision) {
      if (USE_API) {
        try {
          const division = await api.getDivision(activeDivision.id);
          setActiveDivision(division);
        } catch (err) {
          console.error('Failed to refresh active division:', err);
        }
      } else {
        const division = loadDivision(activeDivision.id);
        if (division) {
          setActiveDivision(division);
        }
      }
    }
  }, [activeDivision, refreshSummaries]);

  return {
    summaries,
    activeDivision,
    createDivision,
    selectDivision,
    updateActiveDivision,
    deleteDivision,
    clearActiveDivision,
    refreshSummaries,
    refreshActiveDivision,
    refreshDivisions,
    divisionNameExists,
    isLoading,
    error,
  };
}
