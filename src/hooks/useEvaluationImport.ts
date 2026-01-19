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

// Types for detection results
export interface CoachKidMatch {
  bib: string;
  playerName: string;
  teamIndex: number;
  teamName: string;
  reason: string;
  alreadyMarked: boolean;
}

export interface SiblingMatch {
  bib1: string;
  bib2: string;
  player1Name: string;
  player2Name: string;
  sharedLastName: string;
  alreadyLinked: boolean;
}

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
  const [assistantCoaches, setAssistantCoaches] = useState<string[]>(() =>
    Array.from({ length: initialTeamCount }, () => '')
  );

  // Detection modal state
  const [showDetectionModal, setShowDetectionModal] = useState(false);
  const [coachKidMatches, setCoachKidMatches] = useState<CoachKidMatch[]>([]);
  const [siblingMatches, setSiblingMatches] = useState<SiblingMatch[]>([]);
  const [selectedCoachKids, setSelectedCoachKids] = useState<Set<string>>(new Set());
  const [selectedSiblings, setSelectedSiblings] = useState<Set<string>>(new Set());

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
    setAssistantCoaches(Array.from({ length: initialTeamCount }, () => ''));
    setShowDetectionModal(false);
    setCoachKidMatches([]);
    setSiblingMatches([]);
    setSelectedCoachKids(new Set());
    setSelectedSiblings(new Set());
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

    // Adjust assistant coaches array
    setAssistantCoaches(prev => {
      if (newCount > prev.length) {
        return [...prev, ...Array.from({ length: newCount - prev.length }, () => '')];
      } else if (newCount < prev.length) {
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
   * Update a team name (head coach last name)
   */
  const updateTeamName = useCallback((index: number, name: string) => {
    setTeamNames(prev => {
      const updated = [...prev];
      updated[index] = name;
      return updated;
    });
  }, []);

  /**
   * Update assistant coach for a team (single value)
   */
  const updateAssistantCoaches = useCallback((index: number, coachName: string) => {
    setAssistantCoaches(prev => {
      const updated = [...prev];
      updated[index] = coachName.trim();
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
   * Run auto-detection and show confirmation modal
   */
  const runAutoDetection = useCallback(() => {
    const players = state.players;
    const matches: CoachKidMatch[] = [];
    const siblings: SiblingMatch[] = [];

    // Detect coach's kids by matching last names to team names and assistant coaches
    for (let teamIndex = 0; teamIndex < teamNames.length; teamIndex++) {
      const headCoach = teamNames[teamIndex].trim().toLowerCase();
      const assistant = (assistantCoaches[teamIndex] || '').trim().toLowerCase();

      // Skip default team names like "Team 1"
      if (headCoach.startsWith('team ')) continue;

      for (const player of players) {
        const lastName = player.lastName.trim().toLowerCase();
        if (!lastName) continue;

        // Check if already marked for this team
        const alreadyMarked = player.isCoachKid && player.coachTeamIndex === teamIndex;

        // Check head coach match
        if (headCoach === lastName) {
          matches.push({
            bib: player.bib,
            playerName: `${player.firstName} ${player.lastName}`,
            teamIndex,
            teamName: teamNames[teamIndex],
            reason: `Last name "${player.lastName}" matches head coach "${teamNames[teamIndex]}"`,
            alreadyMarked,
          });
          continue;
        }

        // Check assistant coach match
        if (assistant && assistant === lastName) {
          matches.push({
            bib: player.bib,
            playerName: `${player.firstName} ${player.lastName}`,
            teamIndex,
            teamName: teamNames[teamIndex],
            reason: `Last name "${player.lastName}" matches assistant coach "${assistantCoaches[teamIndex]}"`,
            alreadyMarked,
          });
        }
      }
    }

    // Detect siblings by matching last names
    const lastNameGroups = new Map<string, EvaluationPlayer[]>();
    for (const player of players) {
      const lastName = player.lastName.trim().toLowerCase();
      if (!lastName) continue;
      if (!lastNameGroups.has(lastName)) {
        lastNameGroups.set(lastName, []);
      }
      lastNameGroups.get(lastName)!.push(player);
    }

    const processed = new Set<string>();
    for (const [, playersWithName] of lastNameGroups) {
      if (playersWithName.length < 2) continue;

      // Create pairs for all siblings in this group
      for (let i = 0; i < playersWithName.length; i++) {
        for (let j = i + 1; j < playersWithName.length; j++) {
          const p1 = playersWithName[i];
          const p2 = playersWithName[j];
          const pairKey = [p1.bib, p2.bib].sort().join('-');

          if (processed.has(pairKey)) continue;
          processed.add(pairKey);

          // Check if already linked
          const alreadyLinked = p1.siblingGroupId !== null &&
            p1.siblingGroupId === p2.siblingGroupId;

          siblings.push({
            bib1: p1.bib,
            bib2: p2.bib,
            player1Name: `${p1.firstName} ${p1.lastName}`,
            player2Name: `${p2.firstName} ${p2.lastName}`,
            sharedLastName: p1.lastName,
            alreadyLinked,
          });
        }
      }
    }

    // Pre-select only new matches (not already marked/linked)
    const selectedKids = new Set(matches.filter(m => !m.alreadyMarked).map(m => m.bib));
    const selectedSibs = new Set(siblings.filter(s => !s.alreadyLinked).map(s => `${s.bib1}-${s.bib2}`));

    setCoachKidMatches(matches);
    setSiblingMatches(siblings);
    setSelectedCoachKids(selectedKids);
    setSelectedSiblings(selectedSibs);

    if (matches.length > 0 || siblings.length > 0) {
      setShowDetectionModal(true);
    }
  }, [state.players, teamNames, assistantCoaches]);

  /**
   * Toggle selection of a coach kid match
   */
  const toggleCoachKidSelection = useCallback((bib: string) => {
    setSelectedCoachKids(prev => {
      const newSet = new Set(prev);
      if (newSet.has(bib)) {
        newSet.delete(bib);
      } else {
        newSet.add(bib);
      }
      return newSet;
    });
  }, []);

  /**
   * Toggle selection of a sibling pair
   */
  const toggleSiblingSelection = useCallback((pairKey: string) => {
    setSelectedSiblings(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pairKey)) {
        newSet.delete(pairKey);
      } else {
        newSet.add(pairKey);
      }
      return newSet;
    });
  }, []);

  /**
   * Apply selected detections from the modal
   */
  const applyDetections = useCallback(() => {
    setState((prev) => {
      // Build sibling group assignments
      const siblingGroups = new Map<string, string>();
      let groupIndex = 0;
      const groupLabels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

      // Group selected siblings
      const siblingPairs: Array<[string, string]> = [];
      for (const pairKey of selectedSiblings) {
        const [bib1, bib2] = pairKey.split('-');
        siblingPairs.push([bib1, bib2]);
      }

      // Assign group IDs using union-find-like logic
      for (const [bib1, bib2] of siblingPairs) {
        const existing1 = siblingGroups.get(bib1);
        const existing2 = siblingGroups.get(bib2);

        if (existing1 && existing2) {
          // Merge groups - assign all of group2 to group1
          const targetGroup = existing1;
          for (const [bib, group] of siblingGroups.entries()) {
            if (group === existing2) {
              siblingGroups.set(bib, targetGroup);
            }
          }
        } else if (existing1) {
          siblingGroups.set(bib2, existing1);
        } else if (existing2) {
          siblingGroups.set(bib1, existing2);
        } else {
          const newGroup = groupLabels[groupIndex % 26];
          siblingGroups.set(bib1, newGroup);
          siblingGroups.set(bib2, newGroup);
          groupIndex++;
        }
      }

      // Build coach kid assignments
      const coachKidAssignments = new Map<string, number>();
      for (const match of coachKidMatches) {
        if (selectedCoachKids.has(match.bib)) {
          coachKidAssignments.set(match.bib, match.teamIndex);
        }
      }

      // Update players
      const updatedPlayers = prev.players.map((player) => {
        const updates: Partial<EvaluationPlayer> = {};

        // Apply coach kid assignment
        if (coachKidAssignments.has(player.bib)) {
          updates.isCoachKid = true;
          updates.coachTeamIndex = coachKidAssignments.get(player.bib)!;
        }

        // Apply sibling group
        if (siblingGroups.has(player.bib)) {
          updates.siblingGroupId = siblingGroups.get(player.bib)!;
        }

        if (Object.keys(updates).length > 0) {
          return { ...player, ...updates };
        }
        return player;
      });

      return {
        ...prev,
        players: updatedPlayers,
      };
    });

    // Close modal and clear state
    setShowDetectionModal(false);
    setCoachKidMatches([]);
    setSiblingMatches([]);
    setSelectedCoachKids(new Set());
    setSelectedSiblings(new Set());
  }, [coachKidMatches, selectedCoachKids, selectedSiblings]);

  /**
   * Cancel detection modal
   */
  const cancelDetection = useCallback(() => {
    setShowDetectionModal(false);
    setCoachKidMatches([]);
    setSiblingMatches([]);
    setSelectedCoachKids(new Set());
    setSelectedSiblings(new Set());
  }, []);

  /**
   * Select all detections
   */
  const selectAllDetections = useCallback(() => {
    setSelectedCoachKids(new Set(coachKidMatches.map(m => m.bib)));
    setSelectedSiblings(new Set(siblingMatches.map(s => `${s.bib1}-${s.bib2}`)));
  }, [coachKidMatches, siblingMatches]);

  /**
   * Deselect all detections
   */
  const deselectAllDetections = useCallback(() => {
    setSelectedCoachKids(new Set());
    setSelectedSiblings(new Set());
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
   * Toggle all-star status for a player
   */
  const toggleAllStar = useCallback((bib: string) => {
    setState((prev) => ({
      ...prev,
      players: prev.players.map((p) =>
        p.bib === bib ? { ...p, isAllStar: !p.isAllStar } : p
      ),
    }));
  }, []);

  /**
   * Get players converted to draft-ready format
   */
  const getPlayers = useCallback((): Player[] => {
    // Generate team IDs based on team names
    const teamIds = teamNames.map((_, i) => `team-${i}`);
    return convertToPlayers(state.players, teamCount, teamIds);
  }, [state.players, teamCount, teamNames]);

  /**
   * Export current players to CSV with weighted contribution values
   */
  const exportCSV = useCallback(() => {
    const csv = generateEvaluationCSV(state.players, teamNames, state.fieldWeights);
    const filename = state.workbook
      ? `${state.workbook.filename.replace(/\.xlsx?$/i, '')}_processed.csv`
      : 'evaluation_processed.csv';
    downloadEvaluationCSV(csv, filename);
  }, [state.players, state.workbook, teamNames, state.fieldWeights]);

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
    assistantCoaches,

    // Detection modal state
    showDetectionModal,
    coachKidMatches,
    siblingMatches,
    selectedCoachKids,
    selectedSiblings,

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
    updateAssistantCoaches,
    toggleCoachKid,
    setCoachKidTeam,
    runAutoDetection,
    toggleCoachKidSelection,
    toggleSiblingSelection,
    applyDetections,
    cancelDetection,
    selectAllDetections,
    deselectAllDetections,
    toggleSiblingGroup,
    clearCoachKids,
    clearSiblings,
    toggleAllStar,
    getPlayers,
    exportCSV,
  };
}
