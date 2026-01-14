import { useState, useCallback, useEffect } from 'react';
import { ScoringWeights, DEFAULT_SCORING_WEIGHTS } from '../types';
import { validateWeights } from '../utils/scoreCalculation';

const WEIGHTS_STORAGE_KEY = 'little-league-scoring-weights';

export const useScoringWeights = () => {
  const [weights, setWeights] = useState<ScoringWeights>(() => {
    // Load from localStorage on mount
    const saved = localStorage.getItem(WEIGHTS_STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved) as ScoringWeights;
      } catch (error) {
        console.error('Failed to load saved weights:', error);
        return DEFAULT_SCORING_WEIGHTS;
      }
    }
    return DEFAULT_SCORING_WEIGHTS;
  });

  // Save to localStorage whenever weights change
  useEffect(() => {
    localStorage.setItem(WEIGHTS_STORAGE_KEY, JSON.stringify(weights));
  }, [weights]);

  const updateWeight = useCallback((
    category: keyof ScoringWeights,
    field: string,
    value: number
  ) => {
    setWeights((prev) => {
      if (category === 'fielding') {
        return { ...prev, fielding: { ...prev.fielding, [field]: value } };
      } else if (category === 'hitting') {
        return { ...prev, hitting: { ...prev.hitting, [field]: value } };
      } else if (category === 'pitching') {
        return { ...prev, pitching: { ...prev.pitching, [field]: value } };
      } else if (category === 'catching') {
        return { ...prev, catching: value };
      } else if (category === 'running') {
        return { ...prev, running: value };
      }
      return prev;
    });
  }, []);

  const resetToDefaults = useCallback(() => {
    setWeights(DEFAULT_SCORING_WEIGHTS);
  }, []);

  const validation = validateWeights(weights);

  return {
    weights,
    updateWeight,
    resetToDefaults,
    validation,
  };
};
