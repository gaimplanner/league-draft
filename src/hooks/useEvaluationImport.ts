import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  EvaluationImportState,
  EvaluationImportStep,
  ImportError,
  EvaluationPlayer,
  DEFAULT_FIELD_WEIGHTS,
  RegistrationRecord,
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
import {
  matchRegistrationToEval,
  PlayerMatch,
  RegistrationRow,
} from '../utils/teamBuilderParser';

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

// Types for registration matching
export interface RegistrationMatchResult {
  registrationIndex: number;
  firstName: string;
  lastName: string;
  fullName: string;
  match: PlayerMatch;
  resolution: 'matched' | 'dne' | 'unresolved';
  resolvedBib: string | null;
}

export interface EvaluatedNotRegistered {
  bib: string;
  firstName: string;
  lastName: string;
  fullName: string;
  totalScore: number;
  excluded: boolean;
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

export function useEvaluationImport(
  initialTeamCount: number = 8,
  initialTeamNames?: string[],
  initialAssistantCoaches?: string[]
) {
  const [state, setState] = useState<EvaluationImportState>(initialState);
  const [teamCount, setTeamCount] = useState(initialTeamCount);
  const [teamNames, setTeamNames] = useState<string[]>(() =>
    initialTeamNames && initialTeamNames.length === initialTeamCount
      ? initialTeamNames
      : Array.from({ length: initialTeamCount }, (_, i) => `Team ${i + 1}`)
  );
  const [assistantCoaches, setAssistantCoaches] = useState<string[]>(() =>
    initialAssistantCoaches && initialAssistantCoaches.length === initialTeamCount
      ? initialAssistantCoaches
      : Array.from({ length: initialTeamCount }, () => '')
  );

  // Sync teamNames when initialTeamNames prop changes (e.g., when coming back from Setup step)
  // We always prefer the parent's values since they represent the saved state
  useEffect(() => {
    if (initialTeamNames && initialTeamNames.length === teamCount) {
      setTeamNames(initialTeamNames);
    }
  }, [initialTeamNames, teamCount]);

  // Sync assistantCoaches when initialAssistantCoaches prop changes
  useEffect(() => {
    if (initialAssistantCoaches && initialAssistantCoaches.length === teamCount) {
      setAssistantCoaches(initialAssistantCoaches);
    }
  }, [initialAssistantCoaches, teamCount]);

  // Detection modal state
  const [showDetectionModal, setShowDetectionModal] = useState(false);
  const [coachKidMatches, setCoachKidMatches] = useState<CoachKidMatch[]>([]);
  const [siblingMatches, setSiblingMatches] = useState<SiblingMatch[]>([]);
  const [selectedCoachKids, setSelectedCoachKids] = useState<Set<string>>(new Set());
  const [selectedSiblings, setSelectedSiblings] = useState<Set<string>>(new Set());

  // Registration matching state
  const [registrationMatches, setRegistrationMatches] = useState<RegistrationMatchResult[]>([]);
  const [evaluatedNotRegistered, setEvaluatedNotRegistered] = useState<EvaluatedNotRegistered[]>([]);

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
    setRegistrationMatches([]);
    setEvaluatedNotRegistered([]);
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

    // Pre-select all matches (including already marked/linked - user can uncheck to remove)
    const selectedKids = new Set(matches.map(m => m.bib));
    const selectedSibs = new Set(siblings.map(s => `${s.bib1}-${s.bib2}`));

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

      // Track all bibs that were in the detection modal (for clearing unselected ones)
      // Include alreadyLinked/alreadyMarked items so users can uncheck to remove them
      const allDetectedSiblingBibs = new Set<string>();
      for (const match of siblingMatches) {
        allDetectedSiblingBibs.add(match.bib1);
        allDetectedSiblingBibs.add(match.bib2);
      }

      const allDetectedCoachKidBibs = new Set<string>();
      for (const match of coachKidMatches) {
        allDetectedCoachKidBibs.add(match.bib);
      }

      // Update players
      const updatedPlayers = prev.players.map((player) => {
        const updates: Partial<EvaluationPlayer> = {};

        // Apply or clear coach kid assignment
        if (coachKidAssignments.has(player.bib)) {
          updates.isCoachKid = true;
          updates.coachTeamIndex = coachKidAssignments.get(player.bib)!;
        } else if (allDetectedCoachKidBibs.has(player.bib)) {
          // Player was in detection list but not selected - clear their coach kid status
          updates.isCoachKid = false;
          updates.coachTeamIndex = undefined;
        }

        // Apply or clear sibling group
        if (siblingGroups.has(player.bib)) {
          updates.siblingGroupId = siblingGroups.get(player.bib)!;
        } else if (allDetectedSiblingBibs.has(player.bib)) {
          // Player was in detection list but not selected - clear their sibling group
          updates.siblingGroupId = null;
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
  }, [coachKidMatches, siblingMatches, selectedCoachKids, selectedSiblings]);

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

  // -------------------------------------------------------------------------
  // Registration Matching Functions
  // -------------------------------------------------------------------------

  /**
   * Convert RegistrationRecord to RegistrationRow for matching
   */
  const convertToRegistrationRow = useCallback((record: RegistrationRecord): RegistrationRow => {
    return {
      firstName: record.firstName,
      lastName: record.lastName,
      fullName: `${record.firstName} ${record.lastName}`,
      coachRequest: record.coachRequest || '',
      teammateRequests: record.teammateRequests || [],
      school: record.school || '',
      grade: record.grade ?? null,
      address: record.address || '',
      littleLeagueAge: record.littleLeagueAge ?? null,
      rawTeammateRequestsString: record.teammateRequests?.join(', ') || '',
    };
  }, []);

  /**
   * Run registration matching when entering the registration step.
   * Compares registration data to evaluation players.
   */
  const runRegistrationMatching = useCallback(() => {
    const regData = state.workbook?.registrationData;
    if (!regData || regData.length === 0) {
      // No registration data - skip to summary
      goToStep('summary');
      return;
    }

    const evalPlayers = state.players.map(p => ({
      bib: p.bib,
      firstName: p.firstName,
      lastName: p.lastName,
    }));

    // Match each registration record to eval players
    const matches: RegistrationMatchResult[] = regData.map((record, index) => {
      const regRow = convertToRegistrationRow(record);
      const match = matchRegistrationToEval(regRow, evalPlayers);
      match.registrationIndex = index;

      // Auto-resolve exact matches
      const resolution: 'matched' | 'dne' | 'unresolved' =
        match.matchType === 'exact' ? 'matched' : 'unresolved';

      return {
        registrationIndex: index,
        firstName: record.firstName,
        lastName: record.lastName,
        fullName: `${record.firstName} ${record.lastName}`,
        match,
        resolution,
        resolvedBib: match.matchType === 'exact' ? match.evalBib : null,
      };
    });

    // Find evaluated players not in registration
    const matchedBibs = new Set(
      matches
        .filter(m => m.resolvedBib)
        .map(m => m.resolvedBib!)
    );

    const notRegistered: EvaluatedNotRegistered[] = state.players
      .filter(p => !matchedBibs.has(p.bib))
      .map(p => ({
        bib: p.bib,
        firstName: p.firstName,
        lastName: p.lastName,
        fullName: `${p.firstName} ${p.lastName}`,
        totalScore: p.weightedTotal,
        excluded: true, // Default to excluded
      }));

    setRegistrationMatches(matches);
    setEvaluatedNotRegistered(notRegistered);
    goToStep('registration');
  }, [state.workbook?.registrationData, state.players, convertToRegistrationRow, goToStep]);

  /**
   * Resolve a registration match (manual selection or DNE)
   */
  const resolveRegistrationMatch = useCallback((registrationIndex: number, evalBib: string | null) => {
    setRegistrationMatches(prev =>
      prev.map(m => {
        if (m.registrationIndex !== registrationIndex) return m;
        return {
          ...m,
          resolution: evalBib ? 'matched' : 'dne',
          resolvedBib: evalBib,
        };
      })
    );

    // If matched to a bib, remove it from evaluatedNotRegistered exclusion tracking
    if (evalBib) {
      setEvaluatedNotRegistered(prev =>
        prev.filter(p => p.bib !== evalBib)
      );
    }
  }, []);

  /**
   * Mark a registration player as DNE (Did Not Evaluate)
   */
  const markRegistrationAsDNE = useCallback((registrationIndex: number) => {
    setRegistrationMatches(prev =>
      prev.map(m => {
        if (m.registrationIndex !== registrationIndex) return m;
        return {
          ...m,
          resolution: 'dne',
          resolvedBib: null,
        };
      })
    );
  }, []);

  /**
   * Toggle exclusion of an evaluated-but-not-registered player
   */
  const toggleExcludeNotRegistered = useCallback((bib: string) => {
    setEvaluatedNotRegistered(prev =>
      prev.map(p => p.bib === bib ? { ...p, excluded: !p.excluded } : p)
    );
  }, []);

  /**
   * Apply registration resolutions and proceed.
   * - Removes excluded eval players
   * - Creates DNE players from registration data
   * - Updates player list
   */
  const applyRegistrationResolutions = useCallback(() => {
    const regData = state.workbook?.registrationData;
    if (!regData) {
      goToStep('summary');
      return;
    }

    // Get list of excluded bibs
    const excludedBibs = new Set(
      evaluatedNotRegistered.filter(p => p.excluded).map(p => p.bib)
    );

    // Filter out excluded players
    let updatedPlayers = state.players.filter(p => !excludedBibs.has(p.bib));

    // Create DNE players from registration records marked as DNE
    const dneMatches = registrationMatches.filter(m => m.resolution === 'dne');
    const nextBib = Math.max(...updatedPlayers.map(p => parseInt(p.bib) || 0), 0) + 1;

    dneMatches.forEach((match, index) => {
      const regRecord = regData[match.registrationIndex];
      const dneBib = String(nextBib + index);

      // Create empty score structures for DNE players
      const emptyRawScores = {
        fielding: {},
        pitching: {},
        hitting: {},
        flyBalls: {},
        baserunning: {},
      };
      const emptyNormalizedScores = {
        fielding: {},
        pitching: {},
        hitting: {},
        flyBalls: {},
        baserunning: {},
      };
      const emptyCategoryScores = {
        fielding: null,
        pitching: null,
        hitting: null,
        flyBalls: null,
        baserunning: null,
      };

      const dnePlayer: EvaluationPlayer = {
        bib: dneBib,
        firstName: regRecord.firstName,
        lastName: regRecord.lastName,
        fullName: `${regRecord.firstName} ${regRecord.lastName}`,
        age: regRecord.littleLeagueAge || 0,
        littleLeagueAge: regRecord.littleLeagueAge ?? undefined,
        level: '',
        rawScores: emptyRawScores,
        normalizedScores: emptyNormalizedScores,
        categoryScores: emptyCategoryScores,
        manualAdjust: 0,
        weightedTotal: 0,
        rank: updatedPlayers.length + index + 1,
        projectedRound: Math.ceil((updatedPlayers.length + index + 1) / teamCount),
        isCoachKid: false,
        coachTeamIndex: null,
        siblingGroupId: null,
        isAllStar: false,
        missingCategories: ['fielding', 'pitching', 'hitting', 'flyBalls', 'baserunning'],
        tabsFound: [],
        isPartial: false,
        isDNE: true,
      };

      updatedPlayers.push(dnePlayer);
    });

    // Re-rank players (DNE players go to bottom)
    const scoredPlayers = updatedPlayers.filter(p => !p.isDNE);
    const dnePlayers = updatedPlayers.filter(p => p.isDNE);

    scoredPlayers.sort((a, b) => b.weightedTotal - a.weightedTotal);
    scoredPlayers.forEach((p, i) => {
      p.rank = i + 1;
      p.projectedRound = Math.ceil((i + 1) / teamCount);
    });

    dnePlayers.forEach((p, i) => {
      p.rank = scoredPlayers.length + i + 1;
      p.projectedRound = Math.ceil((scoredPlayers.length + i + 1) / teamCount);
    });

    updatedPlayers = [...scoredPlayers, ...dnePlayers];

    setState(prev => ({
      ...prev,
      players: updatedPlayers,
    }));

    goToStep('summary');
  }, [state.workbook?.registrationData, state.players, evaluatedNotRegistered, registrationMatches, teamCount, goToStep]);

  /**
   * Skip registration step (when no registration data or user skips)
   */
  const skipRegistrationStep = useCallback(() => {
    goToStep('summary');
  }, [goToStep]);

  /**
   * Computed: unresolved registration matches (need user action)
   */
  const unresolvedMatches = useMemo(() =>
    registrationMatches.filter(m => m.resolution === 'unresolved'),
    [registrationMatches]
  );

  /**
   * Computed: registration matching stats
   */
  const registrationStats = useMemo(() => {
    const total = registrationMatches.length;
    const matched = registrationMatches.filter(m => m.resolution === 'matched').length;
    const dne = registrationMatches.filter(m => m.resolution === 'dne').length;
    const unresolved = registrationMatches.filter(m => m.resolution === 'unresolved').length;
    const excludedCount = evaluatedNotRegistered.filter(p => p.excluded).length;

    return { total, matched, dne, unresolved, excludedCount };
  }, [registrationMatches, evaluatedNotRegistered]);

  // -------------------------------------------------------------------------
  // Computed Values
  // -------------------------------------------------------------------------

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

  // Get registration data from parsed workbook
  const registrationData = state.workbook?.registrationData || null;

  // Check if registration data exists
  const hasRegistrationData = registrationData && registrationData.length > 0;

  return {
    // State
    state,
    weightsValid,
    totalWeight,
    teamCount,
    teamNames,
    assistantCoaches,
    registrationData,
    hasRegistrationData,

    // Detection modal state
    showDetectionModal,
    coachKidMatches,
    siblingMatches,
    selectedCoachKids,
    selectedSiblings,

    // Registration matching state
    registrationMatches,
    evaluatedNotRegistered,
    unresolvedMatches,
    registrationStats,

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

    // Registration matching actions
    runRegistrationMatching,
    resolveRegistrationMatch,
    markRegistrationAsDNE,
    toggleExcludeNotRegistered,
    applyRegistrationResolutions,
    skipRegistrationStep,
  };
}
