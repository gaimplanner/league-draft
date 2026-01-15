import { useState, useCallback } from 'react';
import {
  EvaluationImportState,
  EvaluationImportStep,
  ImportError,
  EvaluationPlayer,
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

export function useEvaluationImport(initialTeamCount: number = 8) {
  const [state, setState] = useState<EvaluationImportState>(initialState);
  const [teamCount, setTeamCount] = useState(initialTeamCount);
  const [teamNames, setTeamNames] = useState<string[]>(() =>
    Array.from({ length: initialTeamCount }, (_, i) => `Team ${i + 1}`)
  );

  /**
   * Update projected rounds for all players based on current team count
   */
  const updateProjectedRounds = useCallback((players: EvaluationPlayer[], teams: number): EvaluationPlayer[] => {
    return players.map(p => ({
      ...p,
      projectedRound: Math.ceil(p.rank / teams),
    }));
  }, []);

  /**
   * Reset to initial state
   */
  const reset = useCallback(() => {
    setState(initialState);
    setTeamCount(initialTeamCount);
    setTeamNames(Array.from({ length: initialTeamCount }, (_, i) => `Team ${i + 1}`));
  }, [initialTeamCount]);

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

      // Update projected rounds
      const playersWithRounds = updateProjectedRounds(players, teamCount);

      setState((prev) => ({
        ...prev,
        workbook,
        players: playersWithRounds,
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
  }, [teamCount, updateProjectedRounds]);

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
        let updatedPlayers = recalculateWithWeights(prev.players, newWeights);
        // Update projected rounds after re-ranking
        updatedPlayers = updateProjectedRounds(updatedPlayers, teamCount);

        return {
          ...prev,
          fieldWeights: newWeights,
          players: updatedPlayers,
        };
      });
    },
    [teamCount, updateProjectedRounds]
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
      let updatedPlayers = recalculateWithWeights(prev.players, newWeights);
      // Update projected rounds after re-ranking
      updatedPlayers = updateProjectedRounds(updatedPlayers, teamCount);

      return {
        ...prev,
        fieldWeights: newWeights,
        players: updatedPlayers,
      };
    });
  }, [teamCount, updateProjectedRounds]);

  /**
   * Reset weights to defaults
   */
  const resetWeights = useCallback(() => {
    setState((prev) => {
      const newWeights = [...DEFAULT_FIELD_WEIGHTS];
      let updatedPlayers = recalculateWithWeights(prev.players, newWeights);
      updatedPlayers = updateProjectedRounds(updatedPlayers, teamCount);

      return {
        ...prev,
        fieldWeights: newWeights,
        players: updatedPlayers,
      };
    });
  }, [teamCount, updateProjectedRounds]);

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
          player.projectedRound = Math.ceil((index + 1) / teamCount);
        });

        return {
          ...prev,
          players: updatedPlayers,
        };
      });
    },
    [teamCount]
  );

  /**
   * Update team count and recalculate projected rounds
   */
  const updateTeamCount = useCallback((count: number) => {
    const newCount = Math.max(1, Math.min(20, count));
    setTeamCount(newCount);

    // Adjust team names array
    setTeamNames(prev => {
      if (newCount > prev.length) {
        // Add new teams
        return [...prev, ...Array.from({ length: newCount - prev.length }, (_, i) => `Team ${prev.length + i + 1}`)];
      } else if (newCount < prev.length) {
        // Remove teams
        return prev.slice(0, newCount);
      }
      return prev;
    });

    // Update projected rounds for all players
    setState((prev) => ({
      ...prev,
      players: updateProjectedRounds(prev.players, newCount),
    }));
  }, [updateProjectedRounds]);

  /**
   * Update a team name
   */
  const updateTeamName = useCallback((index: number, name: string) => {
    setTeamNames(prev => {
      const updated = [...prev];
      updated[index] = name;
      return updated;
    });
  }, []);

  /**
   * Toggle coach's kid status for a player
   */
  const toggleCoachKid = useCallback((bib: string, isCoachKid: boolean, teamIndex: number | null = null) => {
    setState((prev) => ({
      ...prev,
      players: prev.players.map((p) =>
        p.bib === bib
          ? { ...p, isCoachKid, coachTeamIndex: isCoachKid ? teamIndex : null }
          : p
      ),
    }));
  }, []);

  /**
   * Set coach's kid team assignment
   */
  const setCoachKidTeam = useCallback((bib: string, teamIndex: number | null) => {
    setState((prev) => ({
      ...prev,
      players: prev.players.map((p) =>
        p.bib === bib ? { ...p, coachTeamIndex: teamIndex } : p
      ),
    }));
  }, []);

  /**
   * Auto-detect coach's kids by matching last names to team names
   */
  const autoDetectCoachKids = useCallback(() => {
    setState((prev) => {
      const updatedPlayers = prev.players.map((player) => {
        const lastName = player.lastName.trim().toLowerCase();
        if (!lastName) return player;

        // Find matching team
        const teamIndex = teamNames.findIndex((name) => {
          const teamName = name.trim().toLowerCase();
          // Skip default team names like "Team 1"
          if (teamName.startsWith('team ')) return false;
          return teamName === lastName;
        });

        if (teamIndex !== -1) {
          return {
            ...player,
            isCoachKid: true,
            coachTeamIndex: teamIndex,
          };
        }
        return player;
      });

      return {
        ...prev,
        players: updatedPlayers,
      };
    });
  }, [teamNames]);

  /**
   * Auto-detect siblings by matching last names
   */
  const autoDetectSiblings = useCallback(() => {
    setState((prev) => {
      // Group players by last name
      const lastNameGroups = new Map<string, EvaluationPlayer[]>();

      for (const player of prev.players) {
        const lastName = player.lastName.trim().toLowerCase();
        if (!lastName) continue;

        if (!lastNameGroups.has(lastName)) {
          lastNameGroups.set(lastName, []);
        }
        lastNameGroups.get(lastName)!.push(player);
      }

      // Create sibling groups (A, B, C, etc.)
      const siblingBibToGroup = new Map<string, string>();
      let groupIndex = 0;
      const groupLabels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

      for (const [, players] of lastNameGroups) {
        if (players.length >= 2) {
          const groupId = groupLabels[groupIndex % 26];
          for (const player of players) {
            siblingBibToGroup.set(player.bib, groupId);
          }
          groupIndex++;
        }
      }

      // Update players with sibling groups
      const updatedPlayers = prev.players.map((player) => ({
        ...player,
        siblingGroupId: siblingBibToGroup.get(player.bib) || null,
      }));

      return {
        ...prev,
        players: updatedPlayers,
      };
    });
  }, []);

  /**
   * Toggle sibling group for a player
   */
  const toggleSiblingGroup = useCallback((bib: string, groupId: string | null) => {
    setState((prev) => ({
      ...prev,
      players: prev.players.map((p) =>
        p.bib === bib ? { ...p, siblingGroupId: groupId } : p
      ),
    }));
  }, []);

  /**
   * Clear all coach's kid markings
   */
  const clearCoachKids = useCallback(() => {
    setState((prev) => ({
      ...prev,
      players: prev.players.map((p) => ({
        ...p,
        isCoachKid: false,
        coachTeamIndex: null,
      })),
    }));
  }, []);

  /**
   * Clear all sibling markings
   */
  const clearSiblings = useCallback(() => {
    setState((prev) => ({
      ...prev,
      players: prev.players.map((p) => ({
        ...p,
        siblingGroupId: null,
      })),
    }));
  }, []);

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
    const csv = generateEvaluationCSV(state.players, teamNames);
    const filename = state.workbook
      ? `${state.workbook.filename.replace(/\.xlsx?$/i, '')}_processed.csv`
      : 'evaluation_processed.csv';
    downloadEvaluationCSV(csv, filename);
  }, [state.players, state.workbook, teamNames]);

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
    teamCount,
    teamNames,

    // Actions
    reset,
    goToStep,
    uploadWorkbook,
    updateFieldWeight,
    toggleField,
    resetWeights,
    updatePlayerAdjustment,
    updateTeamCount,
    updateTeamName,
    toggleCoachKid,
    setCoachKidTeam,
    autoDetectCoachKids,
    autoDetectSiblings,
    toggleSiblingGroup,
    clearCoachKids,
    clearSiblings,
    getPlayers,
    exportCSV,
  };
}
