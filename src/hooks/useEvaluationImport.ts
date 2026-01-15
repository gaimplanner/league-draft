import { useState, useCallback } from 'react';
import {
  EvaluationImportState,
  EvaluationImportStep,
  ImportError,
  DEFAULT_FIELD_WEIGHTS,
} from '../types/evaluation';
import { Player } from '../types';
import { parseExcelFile, validateWorkbook } from '../utils/excelParser';
import {
  processWorkbook,
  recalculateWithWeights,
  convertToPlayers,
  generateEvaluationCSV,
  downloadEvaluationCSV,
} from '../utils/evaluationProcessor';

const initialState: EvaluationImportState = {
  step: 'upload',
  workbook: null,
  fieldWeights: [...DEFAULT_FIELD_WEIGHTS],
  players: [],
  errors: [],
  warnings: [],
  isProcessing: false,
};

export function useEvaluationImport(teamCount: number = 8) {
  const [state, setState] = useState<EvaluationImportState>(initialState);

  /**
   * Reset to initial state
   */
  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  /**
   * Go to a specific step
   */
  const goToStep = useCallback((step: EvaluationImportStep) => {
    setState((prev) => ({ ...prev, step }));
  }, []);

  /**
   * Upload and parse an Excel workbook
   */
  const uploadWorkbook = useCallback(async (file: File) => {
    setState((prev) => ({
      ...prev,
      isProcessing: true,
      errors: [],
      warnings: [],
    }));

    try {
      const workbook = await parseExcelFile(file);

      // Validate workbook structure
      const validation = validateWorkbook(workbook);
      const errors: ImportError[] = [];

      if (validation.missingTabs.length > 0) {
        errors.push({
          type: 'missing_tab',
          message: `Missing expected tabs: ${validation.missingTabs.join(', ')}`,
        });
      }

      // Process the workbook to get players
      const { players, warnings } = processWorkbook(workbook);

      setState((prev) => ({
        ...prev,
        workbook,
        players,
        errors,
        warnings,
        isProcessing: false,
        step: 'overview',
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isProcessing: false,
        errors: [
          {
            type: 'file_error',
            message: error instanceof Error ? error.message : 'Failed to parse file',
          },
        ],
      }));
    }
  }, []);

  /**
   * Update a field weight
   */
  const updateFieldWeight = useCallback(
    (fieldId: string, weight: number) => {
      setState((prev) => {
        const newWeights = prev.fieldWeights.map((fw) =>
          fw.fieldId === fieldId ? { ...fw, weight } : fw
        );

        // Recalculate player scores with new weights
        const updatedPlayers = recalculateWithWeights(prev.players, newWeights);

        return {
          ...prev,
          fieldWeights: newWeights,
          players: updatedPlayers,
        };
      });
    },
    []
  );

  /**
   * Toggle a field enabled/disabled
   */
  const toggleField = useCallback((fieldId: string, enabled: boolean) => {
    setState((prev) => {
      const newWeights = prev.fieldWeights.map((fw) =>
        fw.fieldId === fieldId ? { ...fw, enabled } : fw
      );

      // Recalculate player scores with new weights
      const updatedPlayers = recalculateWithWeights(prev.players, newWeights);

      return {
        ...prev,
        fieldWeights: newWeights,
        players: updatedPlayers,
      };
    });
  }, []);

  /**
   * Reset weights to defaults
   */
  const resetWeights = useCallback(() => {
    setState((prev) => {
      const newWeights = [...DEFAULT_FIELD_WEIGHTS];
      const updatedPlayers = recalculateWithWeights(prev.players, newWeights);

      return {
        ...prev,
        fieldWeights: newWeights,
        players: updatedPlayers,
      };
    });
  }, []);

  /**
   * Update manual adjustment for a player
   */
  const updatePlayerAdjustment = useCallback(
    (bib: string, adjustment: number) => {
      setState((prev) => {
        const updatedPlayers = prev.players.map((p) => {
          if (p.bib === bib) {
            const newTotal = p.weightedTotal - p.manualAdjust + adjustment;
            return {
              ...p,
              manualAdjust: adjustment,
              weightedTotal: Math.round(newTotal * 10) / 10,
            };
          }
          return p;
        });

        // Re-sort and re-rank
        updatedPlayers.sort((a, b) => b.weightedTotal - a.weightedTotal);
        updatedPlayers.forEach((player, index) => {
          player.rank = index + 1;
        });

        return {
          ...prev,
          players: updatedPlayers,
        };
      });
    },
    []
  );

  /**
   * Get players converted to draft-ready format
   */
  const getPlayers = useCallback((): Player[] => {
    return convertToPlayers(state.players, teamCount);
  }, [state.players, teamCount]);

  /**
   * Export current players to CSV
   */
  const exportCSV = useCallback(() => {
    const csv = generateEvaluationCSV(state.players);
    const filename = state.workbook
      ? `${state.workbook.filename.replace(/\.xlsx?$/i, '')}_processed.csv`
      : 'evaluation_processed.csv';
    downloadEvaluationCSV(csv, filename);
  }, [state.players, state.workbook]);

  /**
   * Check if weights sum to 100%
   */
  const weightsValid = state.fieldWeights
    .filter((fw) => fw.enabled)
    .reduce((sum, fw) => sum + fw.weight, 0) === 100;

  /**
   * Get total weight of enabled fields
   */
  const totalWeight = state.fieldWeights
    .filter((fw) => fw.enabled)
    .reduce((sum, fw) => sum + fw.weight, 0);

  return {
    // State
    state,
    weightsValid,
    totalWeight,

    // Actions
    reset,
    goToStep,
    uploadWorkbook,
    updateFieldWeight,
    toggleField,
    resetWeights,
    updatePlayerAdjustment,
    getPlayers,
    exportCSV,
  };
}
