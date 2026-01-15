import { useState, useEffect, useCallback } from 'react';
import {
  Division,
  DivisionSummary,
  DivisionPreset,
  DivisionAgeRange,
  createInitialDivision,
} from '../types';

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

  // Load divisions index on mount
  useEffect(() => {
    const ids = loadDivisionsIndex();
    setDivisionIds(ids);

    // Load summaries for all divisions
    const loadedSummaries: DivisionSummary[] = [];
    for (const id of ids) {
      const division = loadDivision(id);
      if (division) {
        loadedSummaries.push(divisionToSummary(division));
      }
    }
    setSummaries(loadedSummaries);
  }, []);

  // Create a new division (in-memory only until players are imported)
  const createDivision = useCallback((config: {
    name: string;
    preset: DivisionPreset;
    teamCount: number;
    ageRange: DivisionAgeRange;
    enforceAgeLimit: boolean;
    maxPerAge: number;
  }): Division => {
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

    // DON'T save to localStorage yet - wait until players are imported
    // This prevents incomplete divisions from being saved

    // Set as active (in-memory only)
    setActiveDivision(division);

    return division;
  }, []);

  // Select an existing division
  const selectDivision = useCallback((divisionId: string): Division | null => {
    const division = loadDivision(divisionId);
    if (division) {
      setActiveDivision(division);
    }
    return division;
  }, []);

  // Update the active division
  const updateActiveDivision = useCallback((updates: Partial<Division>): void => {
    if (!activeDivision) return;

    const updated: Division = { ...activeDivision, ...updates };
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
  }, [activeDivision, divisionIds]);

  // Delete a division
  const deleteDivision = useCallback((divisionId: string): void => {
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
  }, [divisionIds, activeDivision]);

  // Clear active division (return to selector)
  const clearActiveDivision = useCallback((): void => {
    setActiveDivision(null);
  }, []);

  // Refresh summaries from storage
  const refreshSummaries = useCallback((): void => {
    const ids = loadDivisionsIndex();
    const loadedSummaries: DivisionSummary[] = [];
    for (const id of ids) {
      const division = loadDivision(id);
      if (division) {
        loadedSummaries.push(divisionToSummary(division));
      }
    }
    setSummaries(loadedSummaries);
  }, []);

  // Refresh active division from storage (for public view sync)
  const refreshActiveDivision = useCallback((): void => {
    if (!activeDivision) return;
    const division = loadDivision(activeDivision.id);
    if (division) {
      setActiveDivision(division);
    }
  }, [activeDivision]);

  // Full refresh - both summaries and active division
  const refreshDivisions = useCallback((): void => {
    refreshSummaries();
    if (activeDivision) {
      const division = loadDivision(activeDivision.id);
      if (division) {
        setActiveDivision(division);
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
  };
}
