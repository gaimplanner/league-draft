import { useState, useCallback, useRef } from 'react';
import { Player, Team, DraftState, DraftFormat, AppPhase, Division } from '../types';
import { api, ApiError } from '../api/client';

/**
 * Check if an error is a session expiry error (401 Unauthorized)
 */
function isSessionExpiredError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 401;
}

/**
 * Get a user-friendly error message from an API error
 */
function getErrorMessage(err: unknown, defaultMessage: string): string {
  if (isSessionExpiredError(err)) {
    return 'Your session has expired. Please log in again to continue.';
  }
  if (err instanceof ApiError) {
    // Check for specific error details from the API
    if (err.details?.error && typeof err.details.error === 'string') {
      return err.details.error;
    }
    if (err.details?.detail && typeof err.details.detail === 'string') {
      return err.details.detail;
    }
  }
  return defaultMessage;
}

const initialDraftState: DraftState = {
  players: [],
  teams: [],
  draftFormat: 'snake',
  draftOrder: [],
  currentRoundOrder: [],
  picks: [],
  currentRound: 1,
  currentPickInRound: 1,
  currentTeamId: null,
  isDraftComplete: false,
  mandatoryPick: undefined,
  trades: [],
};

export const useDraft = (_divisionId?: string) => {
  const [phase, setPhase] = useState<AppPhase>('upload');
  const [draftState, setDraftState] = useState<DraftState>(initialDraftState);
  const [pendingComplete, setPendingComplete] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mandatoryPickError, setMandatoryPickError] = useState<string | null>(null);

  // Store draft state ID (needed for API draft operations)
  const draftStateId = useRef<string | null>(null);

  // Track the current division ID
  const currentDivisionId = useRef<string | undefined>(_divisionId);

  // Synchronous lock to prevent concurrent operations (prevents race conditions from rapid clicks)
  const operationInProgress = useRef(false);

  // Flag to override auto-complete detection (when user explicitly goes back to draft)
  const overrideCompleteDetection = useRef(false);

  // Load state from a division object (called when selecting a division)
  const loadDivisionState = useCallback((division: Division) => {
    currentDivisionId.current = division.id;

    // If division has a saved draft state, use it
    if (division.draftState) {
      setDraftState(division.draftState);
      // Store draft state ID for API operations
      if (division.draftState.id) {
        draftStateId.current = division.draftState.id;
      }
    } else {
      // Otherwise, initialize from division's players and teams
      setDraftState({
        ...initialDraftState,
        players: division.players,
        teams: division.teams,
      });
      draftStateId.current = null;
    }

    // If draft is complete, ensure we go to complete phase even if division.phase
    // hasn't been updated yet (race condition fix)
    // BUT: skip this if user explicitly requested to go back to draft board
    if (division.draftState?.isDraftComplete && !overrideCompleteDetection.current) {
      setPhase('complete');
    } else {
      setPhase(division.phase);
    }
    // Reset the override flag after use
    overrideCompleteDetection.current = false;
  }, []);

  const resetDraft = useCallback(async (
    targetPhase?: AppPhase,
    preservedPlayers?: Player[],
    preservedTeams?: Team[]
  ) => {
    const divisionId = currentDivisionId.current;

    // If targetPhase and preserved data provided, reset to that phase with data intact
    if (targetPhase && preservedPlayers && preservedTeams) {
      if (divisionId) {
        try {
          setIsLoading(true);
          const division = await api.resetDraft(divisionId);
          setDraftState({
            ...initialDraftState,
            players: division.players,
            teams: division.teams,
          });
          draftStateId.current = null;
          setError(null);
        } catch (err) {
          console.error('Failed to reset draft:', err);
          setError(getErrorMessage(err, 'Failed to reset draft on server, but local state has been reset.'));
          // Still reset local state even if API fails
          setDraftState({
            ...initialDraftState,
            players: preservedPlayers,
            teams: preservedTeams,
          });
          draftStateId.current = null;
        } finally {
          setIsLoading(false);
        }
      } else {
        setDraftState({
          ...initialDraftState,
          players: preservedPlayers,
          teams: preservedTeams,
        });
      }
      // Always set phase regardless of API success/failure
      setPhase(targetPhase);
      return;
    }

    // Full reset - clear everything
    if (divisionId) {
      try {
        setIsLoading(true);
        await api.resetDraft(divisionId);
        draftStateId.current = null;
        setError(null);
      } catch (err) {
        console.error('Failed to reset draft:', err);
        setError('Failed to reset draft');
      } finally {
        setIsLoading(false);
      }
    }

    setPhase('upload');
    setDraftState(initialDraftState);
  }, []);

  const setPlayers = useCallback((players: Player[]) => {
    setDraftState((prev) => ({ ...prev, players }));
  }, []);

  const setTeams = useCallback((teams: Team[]) => {
    setDraftState((prev) => ({ ...prev, teams }));
  }, []);

  const setDraftFormat = useCallback((format: DraftFormat) => {
    setDraftState((prev) => ({ ...prev, draftFormat: format }));
  }, []);

  const setDraftOrder = useCallback((order: string[]) => {
    setDraftState((prev) => ({ ...prev, draftOrder: order }));
  }, []);

  const startDraft = useCallback(async (format?: DraftFormat, order?: string[], _resolvedPlayers?: Player[]) => {
    // Guard against concurrent operations (Issue #1, #25)
    if (isLoading) {
      return;
    }

    const divisionId = currentDivisionId.current;
    if (!divisionId) {
      setError('No division selected');
      return;
    }

    try {
      setIsLoading(true);
      const draftFormat = format ?? draftState.draftFormat;
      const draftOrder = order ?? draftState.draftOrder;

      const result = await api.startDraft({
        divisionId,
        draftFormat,
        draftOrder,
      });

      // Store the draft state ID for future operations
      draftStateId.current = result.draftState.id || null;

      setDraftState(result.draftState);
      setError(null);

      // Transition to draft phase
      setTimeout(() => {
        setPhase('draft');
      }, 0);
    } catch (err) {
      console.error('Failed to start draft:', err);
      setError(getErrorMessage(err, 'Failed to start draft. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  }, [draftState.draftFormat, draftState.draftOrder, isLoading]);

  const draftPlayer = useCallback(
    async (playerId: string) => {
      // Synchronous lock check to prevent race conditions from rapid clicks
      if (operationInProgress.current) {
        return;
      }

      // Guard against double-submit during API call (Issue #1)
      if (isLoading) {
        return;
      }

      if (!draftStateId.current) {
        setError('Draft not started');
        return;
      }

      const { currentTeamId, players, mandatoryPick } = draftState;

      if (!currentTeamId) return;

      // Validate mandatory pick
      if (mandatoryPick && mandatoryPick.playerId !== playerId) {
        const playerName = players.find(p => p.id === mandatoryPick.playerId)?.name;
        const reason = mandatoryPick.reason === 'coach-kid' ? "coach's kid" : 'sibling requirement';
        setMandatoryPickError(`You must draft ${playerName} (${reason})`);
        return;
      }

      try {
        operationInProgress.current = true;
        setIsLoading(true);
        const result = await api.draftPlayer({
          draftStateId: draftStateId.current,
          playerId,
          teamId: currentTeamId,
        });

        setDraftState(result.draftState);
        setError(null);

        // Check if draft is complete
        const availablePlayers = result.players.filter(p => !p.isDrafted);
        if (availablePlayers.length === 0 || result.draftState.isDraftComplete) {
          setTimeout(() => setPendingComplete(true), 300);
        }
      } catch (err) {
        console.error('Failed to draft player:', err);
        setError(getErrorMessage(err, 'Failed to draft player. Please try again.'));
      } finally {
        operationInProgress.current = false;
        setIsLoading(false);
      }
    },
    [draftState, isLoading]
  );

  const undoLastPick = useCallback(async () => {
    // Synchronous lock check to prevent race conditions from rapid clicks
    if (operationInProgress.current) {
      return;
    }

    // Guard against concurrent operations (Issue #1)
    if (isLoading) {
      return;
    }

    if (!draftStateId.current) {
      setError('Draft not started');
      return;
    }

    try {
      operationInProgress.current = true;
      setIsLoading(true);
      const result = await api.undoLastPick(draftStateId.current);
      setDraftState(result.draftState);
      setError(null);

      // If we're on complete screen, go back to draft
      if (phase === 'complete') {
        setPhase('draft');
      }
    } catch (err) {
      console.error('Failed to undo pick:', err);
      setError(getErrorMessage(err, 'Failed to undo pick. Please try again.'));
    } finally {
      operationInProgress.current = false;
      setIsLoading(false);
    }
  }, [phase, isLoading]);

  // Skip the current pick (team gets one fewer player)
  const skipPick = useCallback(async () => {
    // Synchronous lock check to prevent race conditions from rapid clicks
    if (operationInProgress.current) {
      return;
    }

    // Guard against concurrent operations (Issue #1)
    if (isLoading) {
      return;
    }

    if (!draftStateId.current) {
      setError('Draft not started');
      return;
    }

    if (!draftState?.currentTeamId) {
      setError('No current team to skip');
      return;
    }

    try {
      operationInProgress.current = true;
      setIsLoading(true);
      const result = await api.skipPick({
        draftStateId: draftStateId.current,
        teamId: draftState.currentTeamId,
      });
      setDraftState(result.draftState);
      setError(null);
    } catch (err) {
      console.error('Failed to skip pick:', err);
      setError(getErrorMessage(err, 'Failed to skip pick. Please try again.'));
    } finally {
      operationInProgress.current = false;
      setIsLoading(false);
    }
  }, [draftState?.currentTeamId, isLoading]);

  // Execute a trade between two teams
  const executeTrade = useCallback(async (
    team1Id: string,
    team2Id: string,
    player1Id: string,
    player2Id: string,
    reason: string
  ) => {
    // Synchronous lock check to prevent race conditions from rapid clicks
    if (operationInProgress.current) {
      return;
    }

    // Guard against concurrent operations (Issue #1)
    if (isLoading) {
      return;
    }

    if (!draftStateId.current) {
      setError('Draft not started');
      return;
    }

    try {
      operationInProgress.current = true;
      setIsLoading(true);
      const result = await api.createTrade({
        draftStateId: draftStateId.current,
        team1Id,
        team2Id,
        player1Id,
        player2Id,
        reason,
      });
      setDraftState(result.draftState);
      setError(null);
    } catch (err) {
      console.error('Failed to execute trade:', err);
      setError(getErrorMessage(err, 'Failed to execute trade. Please try again.'));
      // Re-throw so TradeModal can handle it (e.g., re-enable submit button)
      throw err;
    } finally {
      operationInProgress.current = false;
      setIsLoading(false);
    }
  }, [isLoading]);

  // Finalize draft and navigate to complete phase
  const finalizeDraft = useCallback(() => {
    setPendingComplete(false);
    setPhase('complete');
  }, []);

  // Cancel pending complete (go back to review draft)
  const cancelPendingComplete = useCallback(() => {
    setPendingComplete(false);
  }, []);

  // Clear mandatory pick error
  const clearMandatoryPickError = useCallback(() => {
    setMandatoryPickError(null);
  }, []);

  // Go back to draft board from complete phase (bypasses auto-complete detection)
  const returnToDraftBoard = useCallback(() => {
    overrideCompleteDetection.current = true;
    setPendingComplete(false);
    setPhase('draft');
  }, []);

  return {
    phase,
    setPhase,
    draftState,
    pendingComplete,
    setPlayers,
    setTeams,
    setDraftFormat,
    setDraftOrder,
    startDraft,
    draftPlayer,
    skipPick,
    undoLastPick,
    resetDraft,
    loadDivisionState,
    executeTrade,
    finalizeDraft,
    cancelPendingComplete,
    isLoading,
    error,
    mandatoryPickError,
    clearMandatoryPickError,
    returnToDraftBoard,
  };
};
