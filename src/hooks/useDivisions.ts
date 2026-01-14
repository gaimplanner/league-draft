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

  // Create a new division
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

    // Save to localStorage
    saveDivision(division);

    // Update index
    const newIds = [...divisionIds, id];
    saveDivisionsIndex(newIds);
    setDivisionIds(newIds);

    // Update summaries
    setSummaries(prev => [...prev, divisionToSummary(division)]);

    // Set as active
    setActiveDivision(division);

    return division;
  }, [divisionIds]);

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
    saveDivision(updated);
    setActiveDivision(updated);

    // Update summary if relevant fields changed
    setSummaries(prev => prev.map(s =>
      s.id === updated.id ? divisionToSummary(updated) : s
    ));
  }, [activeDivision]);

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

  return {
    summaries,
    activeDivision,
    createDivision,
    selectDivision,
    updateActiveDivision,
    deleteDivision,
    clearActiveDivision,
    refreshSummaries,
  };
}
