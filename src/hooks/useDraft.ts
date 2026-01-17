import { useState, useCallback, useEffect, useRef } from 'react';
import { Player, Team, DraftState, DraftFormat, DraftPick, AppPhase, Division, Trade } from '../types';
import { getNextPick, calculateDraftOrder } from '../utils/draftOrder';
import { getMandatoryPick } from '../utils/draftLogic';
import { api } from '../api/client';

// Feature flag to use API vs localStorage
const USE_API = import.meta.env.VITE_USE_API === 'true';

const STORAGE_KEY_PREFIX = 'little-league-draft-';

function getStorageKey(divisionId: string | undefined): string {
  return divisionId ? `${STORAGE_KEY_PREFIX}${divisionId}` : `${STORAGE_KEY_PREFIX}default`;
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

export const useDraft = (divisionId?: string) => {
  const [phase, setPhase] = useState<AppPhase>('upload');
  const [draftState, setDraftState] = useState<DraftState>(initialDraftState);
  const [pendingComplete, setPendingComplete] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentDivisionId = useRef<string | undefined>(divisionId);

  // Store draft state ID when using API (needed for draft operations)
  const draftStateId = useRef<string | null>(null);

  // Track if we've loaded initial state
  const hasLoaded = useRef(false);

  // Debounce ref for localStorage saves
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Load from localStorage on mount or when divisionId changes (localStorage mode only)
  useEffect(() => {
    if (USE_API) return; // Skip localStorage loading when using API

    if (!divisionId) {
      // No division selected - reset to initial state
      setPhase('upload');
      setDraftState(initialDraftState);
      hasLoaded.current = false;
      return;
    }

    // Only load if divisionId actually changed
    if (currentDivisionId.current !== divisionId) {
      currentDivisionId.current = divisionId;
      hasLoaded.current = false;
    }

    if (hasLoaded.current) return;

    const storageKey = getStorageKey(divisionId);
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setPhase(parsed.phase || 'upload');
        setDraftState(parsed.draftState || initialDraftState);
        hasLoaded.current = true;
      } catch (error) {
        console.error('Failed to load saved state:', error);
      }
    }
  }, [divisionId]);

  // Save to localStorage whenever state changes (localStorage mode only)
  useEffect(() => {
    if (USE_API) return; // Skip localStorage saving when using API
    if (!divisionId || !hasLoaded.current) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      const storageKey = getStorageKey(divisionId);
      localStorage.setItem(storageKey, JSON.stringify({ phase, draftState }));
    }, 300);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [phase, draftState, divisionId]);

  // Load state from a division object (called when selecting a division)
  const loadDivisionState = useCallback((division: Division) => {
    hasLoaded.current = true;
    currentDivisionId.current = division.id;

    // If division has a saved draft state, use it
    if (division.draftState) {
      setDraftState(division.draftState);
      // Store draft state ID for API mode
      if (USE_API && (division.draftState as DraftState & { id?: string }).id) {
        draftStateId.current = (division.draftState as DraftState & { id?: string }).id!;
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

    setPhase(division.phase);
  }, []);

  const resetDraft = useCallback(async (
    targetPhase?: AppPhase,
    preservedPlayers?: Player[],
    preservedTeams?: Team[]
  ) => {
    // If targetPhase and preserved data provided, reset to that phase with data intact
    if (targetPhase && preservedPlayers && preservedTeams) {
      if (USE_API && divisionId) {
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
    if (USE_API && divisionId) {
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
    } else if (divisionId) {
      localStorage.removeItem(getStorageKey(divisionId));
    }

    setPhase('upload');
    setDraftState(initialDraftState);
    hasLoaded.current = false;
  }, [divisionId]);

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

  const startDraft = useCallback(async (format?: DraftFormat, order?: string[], resolvedPlayers?: Player[]) => {
    if (USE_API && divisionId) {
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
        draftStateId.current = (result.draftState as DraftState & { id?: string }).id || null;

        setDraftState(result.draftState);
        setError(null);

        // Transition to draft phase
        setTimeout(() => {
          setPhase('draft');
        }, 0);
      } catch (err) {
        console.error('Failed to start draft:', err);
        setError('Failed to start draft');
      } finally {
        setIsLoading(false);
      }
    } else {
      // localStorage mode
      setDraftState((prev) => {
        const draftFormat = format ?? prev.draftFormat;
        const draftOrder = order ?? prev.draftOrder;
        const playersToUse = resolvedPlayers ?? prev.players;

        const firstRoundOrder = calculateDraftOrder(
          prev.teams,
          1,
          draftFormat,
          draftOrder
        );

        const firstTeamId = firstRoundOrder[0];
        const initialMandatory = getMandatoryPick(playersToUse, firstTeamId, 1);

        return {
          ...prev,
          players: playersToUse,
          draftFormat,
          draftOrder,
          currentRound: 1,
          currentPickInRound: 1,
          currentRoundOrder: firstRoundOrder,
          currentTeamId: firstTeamId,
          mandatoryPick: initialMandatory ? {
            playerId: initialMandatory.player.id,
            reason: initialMandatory.reason,
            siblingName: initialMandatory.siblingName,
          } : undefined,
        };
      });

      setTimeout(() => {
        setPhase('draft');
      }, 0);
    }
  }, [divisionId, draftState.draftFormat, draftState.draftOrder]);

  const checkMandatoryPicks = useCallback(
    (players: Player[], teams: Team[], teamId: string | null, round: number) => {
      if (!teamId) return;

      const team = teams.find((t) => t.id === teamId);
      if (!team) return;

      const result = getMandatoryPick(players, teamId, round);

      if (result) {
        setDraftState((prev) => ({
          ...prev,
          mandatoryPick: {
            playerId: result.player.id,
            reason: result.reason,
            siblingName: result.siblingName,
          },
        }));
      } else {
        setDraftState((prev) => ({
          ...prev,
          mandatoryPick: undefined,
        }));
      }
    },
    []
  );

  const draftPlayer = useCallback(
    async (playerId: string) => {
      if (USE_API && draftStateId.current) {
        const { currentTeamId, players, mandatoryPick } = draftState;

        if (!currentTeamId) return;

        // Validate mandatory pick
        if (mandatoryPick && mandatoryPick.playerId !== playerId) {
          alert(`You must draft ${players.find(p => p.id === mandatoryPick.playerId)?.name} (${mandatoryPick.reason === 'coach-kid' ? "coach's kid" : 'sibling requirement'})`);
          return;
        }

        try {
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
          setError('Failed to draft player');
        } finally {
          setIsLoading(false);
        }
      } else {
        // localStorage mode
        setDraftState((prev) => {
          const { currentRound, currentPickInRound, currentTeamId, players, teams, mandatoryPick } = prev;

          if (!currentTeamId) {
            return prev;
          }

          if (mandatoryPick && mandatoryPick.playerId !== playerId) {
            alert(`You must draft ${players.find(p => p.id === mandatoryPick.playerId)?.name} (${mandatoryPick.reason === 'coach-kid' ? "coach's kid" : 'sibling requirement'})`);
            return prev;
          }

          const player = players.find((p) => p.id === playerId);

          if (!player || player.isDrafted) {
            return prev;
          }

          const draftedPlayer = {
            ...player,
            isDrafted: true,
            draftedByTeamId: currentTeamId,
            draftedInRound: currentRound,
            draftedAtPick: (currentRound - 1) * teams.length + currentPickInRound,
          };

          const updatedPlayers = players.map((p) => {
            if (p.id === playerId) {
              return draftedPlayer;
            }
            if (p.siblingId === playerId && !p.isDrafted) {
              return {
                ...p,
                lockedToTeamId: currentTeamId,
              };
            }
            return p;
          });

          const updatedTeams = teams.map((t) => {
            if (t.id === currentTeamId) {
              const newRoster = [...t.roster, draftedPlayer];
              const age = draftedPlayer.littleLeagueAge;
              const newAgeBreakdown = {
                ...(t.ageBreakdown || {}),
                [age]: ((t.ageBreakdown || {})[age] || 0) + 1,
              };
              return {
                ...t,
                roster: newRoster,
                totalScore: newRoster.reduce((sum, p) => sum + p.totalScore, 0),
                ageBreakdown: newAgeBreakdown,
              };
            }
            return t;
          });

          const newPick: DraftPick = {
            round: currentRound,
            pick: (currentRound - 1) * teams.length + currentPickInRound,
            teamId: currentTeamId,
            playerId,
            timestamp: Date.now(),
          };

          const updatedPicks = [...prev.picks, newPick];

          const { round: nextRound, pickInRound: nextPickInRound } = getNextPick(
            currentRound,
            currentPickInRound,
            teams.length
          );

          const availablePlayers = updatedPlayers.filter((p) => !p.isDrafted);

          if (availablePlayers.length === 0) {
            setTimeout(() => setPendingComplete(true), 300);
            return {
              ...prev,
              players: updatedPlayers,
              teams: updatedTeams,
              picks: updatedPicks,
              isDraftComplete: true,
              mandatoryPick: undefined,
            };
          }

          let nextRoundOrder = prev.currentRoundOrder;

          if (nextRound !== currentRound) {
            nextRoundOrder = calculateDraftOrder(
              updatedTeams,
              nextRound,
              prev.draftFormat,
              prev.draftOrder
            );
          }

          const nextTeamId = nextRoundOrder[nextPickInRound - 1];

          setTimeout(() => {
            checkMandatoryPicks(updatedPlayers, updatedTeams, nextTeamId, nextRound);
          }, 0);

          return {
            ...prev,
            players: updatedPlayers,
            teams: updatedTeams,
            picks: updatedPicks,
            currentRound: nextRound,
            currentPickInRound: nextPickInRound,
            currentRoundOrder: nextRoundOrder,
            currentTeamId: nextTeamId,
            mandatoryPick: undefined,
          };
        });
      }
    },
    [checkMandatoryPicks, draftState]
  );

  const undoLastPick = useCallback(async () => {
    if (USE_API && draftStateId.current) {
      try {
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
        setError('Failed to undo pick');
      } finally {
        setIsLoading(false);
      }
    } else {
      // localStorage mode
      setDraftState((prev) => {
        if (prev.picks.length === 0) return prev;

        const lastPick = prev.picks[prev.picks.length - 1];
        if (!lastPick.playerId) return prev;

        const updatedPlayers = prev.players.map((p) => {
          if (p.id === lastPick.playerId) {
            return {
              ...p,
              isDrafted: false,
              draftedByTeamId: undefined,
              draftedInRound: undefined,
              draftedAtPick: undefined,
            };
          }
          if (p.siblingId === lastPick.playerId && p.lockedToTeamId === lastPick.teamId) {
            return {
              ...p,
              lockedToTeamId: undefined,
            };
          }
          return p;
        });

        const undraftedPlayer = prev.players.find(p => p.id === lastPick.playerId);
        const updatedTeams = prev.teams.map((t) => {
          if (t.id === lastPick.teamId) {
            const newRoster = t.roster.filter((p) => p.id !== lastPick.playerId);
            let newAgeBreakdown = { ...(t.ageBreakdown || {}) };
            if (undraftedPlayer) {
              const age = undraftedPlayer.littleLeagueAge;
              const currentCount = newAgeBreakdown[age] || 0;
              if (currentCount > 1) {
                newAgeBreakdown[age] = currentCount - 1;
              } else {
                delete newAgeBreakdown[age];
              }
            }
            return {
              ...t,
              roster: newRoster,
              totalScore: newRoster.reduce((sum, p) => sum + p.totalScore, 0),
              ageBreakdown: newAgeBreakdown,
            };
          }
          return t;
        });

        const updatedPicks = prev.picks.slice(0, -1);

        const newPickInRound = prev.currentPickInRound > 1 ? prev.currentPickInRound - 1 : prev.teams.length;
        const newRound = prev.currentPickInRound > 1 ? prev.currentRound : prev.currentRound - 1;

        let restoredRoundOrder = prev.currentRoundOrder;

        if (newRound !== prev.currentRound) {
          restoredRoundOrder = calculateDraftOrder(
            updatedTeams,
            newRound,
            prev.draftFormat,
            prev.draftOrder
          );
        }

        const currentTeamId = restoredRoundOrder[newPickInRound - 1];

        setTimeout(() => {
          checkMandatoryPicks(updatedPlayers, updatedTeams, currentTeamId, newRound);
        }, 0);

        return {
          ...prev,
          players: updatedPlayers,
          teams: updatedTeams,
          picks: updatedPicks,
          currentRound: newRound,
          currentPickInRound: newPickInRound,
          currentRoundOrder: restoredRoundOrder,
          currentTeamId,
          isDraftComplete: false,
          mandatoryPick: undefined,
        };
      });

      if (phase === 'complete') {
        setPhase('draft');
      }
    }
  }, [checkMandatoryPicks, phase]);

  // Skip the current pick (only allowed in final round)
  const skipPick = useCallback(() => {
    // Note: Skip pick is localStorage-only for now
    // Could be added to API later if needed
    setDraftState((prev) => {
      const { currentRound, currentPickInRound, currentTeamId, teams } = prev;

      if (!currentTeamId) return prev;

      const skipRecord: DraftPick = {
        round: currentRound,
        pick: (currentRound - 1) * teams.length + currentPickInRound,
        teamId: currentTeamId,
        playerId: undefined,
        timestamp: Date.now(),
        wasSkipped: true,
      };

      const updatedPicks = [...prev.picks, skipRecord];

      const { round: nextRound, pickInRound: nextPickInRound } = getNextPick(
        currentRound,
        currentPickInRound,
        teams.length
      );

      const availablePlayers = prev.players.filter((p) => !p.isDrafted);

      if (availablePlayers.length === 0) {
        setTimeout(() => setPendingComplete(true), 300);
        return {
          ...prev,
          picks: updatedPicks,
          isDraftComplete: true,
          mandatoryPick: undefined,
        };
      }

      let nextRoundOrder = prev.currentRoundOrder;

      if (nextRound !== currentRound) {
        nextRoundOrder = calculateDraftOrder(
          teams,
          nextRound,
          prev.draftFormat,
          prev.draftOrder
        );
      }

      const nextTeamId = nextRoundOrder[nextPickInRound - 1];

      setTimeout(() => {
        checkMandatoryPicks(prev.players, teams, nextTeamId, nextRound);
      }, 0);

      return {
        ...prev,
        picks: updatedPicks,
        currentRound: nextRound,
        currentPickInRound: nextPickInRound,
        currentRoundOrder: nextRoundOrder,
        currentTeamId: nextTeamId,
        mandatoryPick: undefined,
      };
    });
  }, [checkMandatoryPicks]);

  // Execute a trade between two teams
  const executeTrade = useCallback(async (
    team1Id: string,
    team2Id: string,
    player1Id: string,
    player2Id: string,
    reason: string
  ) => {
    if (USE_API && draftStateId.current) {
      try {
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
        setError('Failed to execute trade');
      } finally {
        setIsLoading(false);
      }
    } else {
      // localStorage mode
      setDraftState((prev) => {
        const team1 = prev.teams.find(t => t.id === team1Id);
        const team2 = prev.teams.find(t => t.id === team2Id);
        const player1 = prev.players.find(p => p.id === player1Id);
        const player2 = prev.players.find(p => p.id === player2Id);

        if (!team1 || !team2 || !player1 || !player2) {
          console.error('Trade failed: Invalid team or player IDs');
          return prev;
        }

        if (player1.draftedByTeamId !== team1Id || player2.draftedByTeamId !== team2Id) {
          console.error('Trade failed: Players not on expected teams');
          return prev;
        }

        const trade: Trade = {
          id: `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: Date.now(),
          team1Id,
          team2Id,
          player1Id,
          player2Id,
          reason,
        };

        const updatedPlayers = prev.players.map((p) => {
          if (p.id === player1Id) {
            return { ...p, draftedByTeamId: team2Id };
          }
          if (p.id === player2Id) {
            return { ...p, draftedByTeamId: team1Id };
          }
          return p;
        });

        const updatedTeams = prev.teams.map((t) => {
          if (t.id === team1Id) {
            const newRoster = t.roster.filter(p => p.id !== player1Id);
            const updatedPlayer2 = updatedPlayers.find(p => p.id === player2Id)!;
            newRoster.push(updatedPlayer2);

            const newAgeBreakdown = { ...(t.ageBreakdown || {}) };
            const age1 = player1.littleLeagueAge;
            const age2 = player2.littleLeagueAge;

            if (newAgeBreakdown[age1] > 1) {
              newAgeBreakdown[age1] = newAgeBreakdown[age1] - 1;
            } else {
              delete newAgeBreakdown[age1];
            }
            newAgeBreakdown[age2] = (newAgeBreakdown[age2] || 0) + 1;

            return {
              ...t,
              roster: newRoster,
              totalScore: newRoster.reduce((sum, p) => sum + p.totalScore, 0),
              ageBreakdown: newAgeBreakdown,
            };
          }
          if (t.id === team2Id) {
            const newRoster = t.roster.filter(p => p.id !== player2Id);
            const updatedPlayer1 = updatedPlayers.find(p => p.id === player1Id)!;
            newRoster.push(updatedPlayer1);

            const newAgeBreakdown = { ...(t.ageBreakdown || {}) };
            const age1 = player1.littleLeagueAge;
            const age2 = player2.littleLeagueAge;

            if (newAgeBreakdown[age2] > 1) {
              newAgeBreakdown[age2] = newAgeBreakdown[age2] - 1;
            } else {
              delete newAgeBreakdown[age2];
            }
            newAgeBreakdown[age1] = (newAgeBreakdown[age1] || 0) + 1;

            return {
              ...t,
              roster: newRoster,
              totalScore: newRoster.reduce((sum, p) => sum + p.totalScore, 0),
              ageBreakdown: newAgeBreakdown,
            };
          }
          return t;
        });

        return {
          ...prev,
          players: updatedPlayers,
          teams: updatedTeams,
          trades: [...prev.trades, trade],
        };
      });
    }
  }, [draftState]);

  // Finalize draft and navigate to complete phase
  const finalizeDraft = useCallback(() => {
    setPendingComplete(false);
    setPhase('complete');
  }, []);

  // Cancel pending complete (go back to review draft)
  const cancelPendingComplete = useCallback(() => {
    setPendingComplete(false);
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
  };
};
