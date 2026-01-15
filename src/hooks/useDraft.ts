import { useState, useCallback, useEffect, useRef } from 'react';
import { Player, Team, DraftState, DraftFormat, DraftPick, AppPhase, Division, Trade } from '../types';
import { getNextPick, calculateDraftOrder } from '../utils/draftOrder';
import { getMandatoryPick } from '../utils/draftLogic';

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
  const currentDivisionId = useRef<string | undefined>(divisionId);

  // Track if we've loaded initial state
  const hasLoaded = useRef(false);

  // Load from localStorage on mount or when divisionId changes
  useEffect(() => {
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

  // Save to localStorage whenever state changes (if we have a divisionId)
  useEffect(() => {
    if (!divisionId || !hasLoaded.current) return;

    const storageKey = getStorageKey(divisionId);
    localStorage.setItem(storageKey, JSON.stringify({ phase, draftState }));
  }, [phase, draftState, divisionId]);

  // Load state from a division object (called when selecting a division)
  const loadDivisionState = useCallback((division: Division) => {
    hasLoaded.current = true;
    currentDivisionId.current = division.id;

    // If division has a saved draft state, use it
    if (division.draftState) {
      setDraftState(division.draftState);
    } else {
      // Otherwise, initialize from division's players and teams
      setDraftState({
        ...initialDraftState,
        players: division.players,
        teams: division.teams,
      });
    }

    setPhase(division.phase);
  }, []);

  const resetDraft = useCallback(() => {
    // Don't show confirmation - App.tsx handles that
    if (divisionId) {
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

  const startDraft = useCallback((format?: DraftFormat, order?: string[], resolvedPlayers?: Player[]) => {
    console.log('🚀 startDraft called');
    console.log('🚀 Passed format:', format);
    console.log('🚀 Passed order:', order);
    if (resolvedPlayers) {
      console.log('🚀 Passed resolvedPlayers coach kids:', resolvedPlayers.filter(p => p.isCoachKid).map(p => ({
        name: `${p.firstName} ${p.lastName}`,
        projected: p.projectedRound,
        locked: p.lockedToRound
      })));
    }

    setDraftState((prev) => {
      // Use passed values if provided, otherwise fall back to state
      const draftFormat = format ?? prev.draftFormat;
      const draftOrder = order ?? prev.draftOrder;
      // Use resolved players if provided (with lockedToRound set)
      const playersToUse = resolvedPlayers ?? prev.players;

      console.log('🚀 prev.teams:', prev.teams);
      console.log('🚀 Using draftFormat:', draftFormat);
      console.log('🚀 Using draftOrder:', draftOrder);
      console.log('🚀 Using players with lockedToRound:', playersToUse.filter(p => p.isCoachKid).map(p => ({
        name: `${p.firstName} ${p.lastName}`,
        projected: p.projectedRound,
        locked: p.lockedToRound
      })));

      // Calculate the draft order for round 1
      const firstRoundOrder = calculateDraftOrder(
        prev.teams,
        1,
        draftFormat,
        draftOrder
      );

      console.log('🚀 firstRoundOrder:', firstRoundOrder);

      const firstTeamId = firstRoundOrder[0];
      console.log('🚀 firstTeamId:', firstTeamId);
      console.log('🚀 Setting draft state with currentTeamId:', firstTeamId);

      return {
        ...prev,
        players: playersToUse,  // Use resolved players with lockedToRound
        draftFormat,
        draftOrder,
        currentRound: 1,
        currentPickInRound: 1,
        currentRoundOrder: firstRoundOrder,
        currentTeamId: firstTeamId,
      };
    });

    // Use setTimeout to ensure state update has completed
    setTimeout(() => {
      console.log('🚀 Setting phase to draft');
      setPhase('draft');
    }, 0);
  }, []);

  const checkMandatoryPicks = useCallback(
    (players: Player[], teams: Team[], teamId: string | null, round: number) => {
      if (!teamId) return;

      const team = teams.find((t) => t.id === teamId);
      if (!team) return;

      // Use shared getMandatoryPick function (single source of truth)
      console.log(`=== checkMandatoryPicks for team ${team.name || teamId} round ${round} ===`);

      const result = getMandatoryPick(players, teamId, round);

      if (result) {
        console.log(`Mandatory ${result.reason}: ${result.player.firstName} ${result.player.lastName}`);
        setDraftState((prev) => ({
          ...prev,
          mandatoryPick: {
            playerId: result.player.id,
            reason: result.reason,
            siblingName: result.siblingName,
          },
        }));
      } else {
        console.log('No mandatory pick');
        setDraftState((prev) => ({
          ...prev,
          mandatoryPick: undefined,
        }));
      }
    },
    []
  );

  const draftPlayer = useCallback(
    (playerId: string) => {
      console.log('🎯 useDraft.draftPlayer called with playerId:', playerId);

      setDraftState((prev) => {
        console.log('🎯 Inside setDraftState callback');
        const { currentRound, currentPickInRound, currentTeamId, players, teams, mandatoryPick } = prev;

        console.log('🎯 currentTeamId:', currentTeamId);
        console.log('🎯 currentRound:', currentRound);
        console.log('🎯 currentPickInRound:', currentPickInRound);

        if (!currentTeamId) {
          console.log('🔴 No currentTeamId - returning prev');
          return prev;
        }

        // Validate mandatory pick
        if (mandatoryPick && mandatoryPick.playerId !== playerId) {
          console.log('🔴 Mandatory pick validation failed');
          alert(`You must draft ${players.find(p => p.id === mandatoryPick.playerId)?.name} (${mandatoryPick.reason === 'coach-kid' ? "coach's kid" : 'sibling requirement'})`);
          return prev;
        }

        const player = players.find((p) => p.id === playerId);
        console.log('🎯 Found player:', player);

        if (!player || player.isDrafted) {
          console.log('🔴 Player not found or already drafted - returning prev');
          return prev;
        }

        // Create updated player with draft info
        const draftedPlayer = {
          ...player,
          isDrafted: true,
          draftedByTeamId: currentTeamId,
          draftedInRound: currentRound,
          draftedAtPick: (currentRound - 1) * teams.length + currentPickInRound,
        };

        // Update players array - also lock siblings to this team
        const updatedPlayers = players.map((p) => {
          if (p.id === playerId) {
            return draftedPlayer;
          }
          // If this player is a sibling of the drafted player, lock them to this team
          if (p.siblingId === playerId && !p.isDrafted) {
            console.log('🔗 Locking sibling', p.name, 'to team', currentTeamId);
            return {
              ...p,
              lockedToTeamId: currentTeamId,
            };
          }
          return p;
        });

        // Update team with the drafted player
        const updatedTeams = teams.map((t) => {
          if (t.id === currentTeamId) {
            const newRoster = [...t.roster, draftedPlayer];
            // Update age breakdown
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

        // Record pick
        const newPick: DraftPick = {
          round: currentRound,
          pick: (currentRound - 1) * teams.length + currentPickInRound,
          teamId: currentTeamId,
          playerId,
          timestamp: Date.now(),
        };

        const updatedPicks = [...prev.picks, newPick];

        // Calculate next pick
        const { round: nextRound, pickInRound: nextPickInRound } = getNextPick(
          currentRound,
          currentPickInRound,
          teams.length
        );

        const availablePlayers = updatedPlayers.filter((p) => !p.isDrafted);

        // Check if draft is complete
        if (availablePlayers.length === 0) {
          // Don't auto-navigate - show confirmation modal first
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

        // If we're advancing to a new round, recalculate the draft order
        let nextRoundOrder = prev.currentRoundOrder;

        if (nextRound !== currentRound) {
          // New round - recalculate order based on current team scores
          console.log('🔄 New round! Recalculating draft order...');
          console.log('🔄 Teams before recalc:', updatedTeams.map(t => ({ id: t.id, name: t.name, score: t.totalScore })));
          nextRoundOrder = calculateDraftOrder(
            updatedTeams,
            nextRound,
            prev.draftFormat,
            prev.draftOrder
          );
          console.log('🔄 New draft order for round', nextRound, ':', nextRoundOrder);
        }

        // Use the cached (or newly calculated) round order
        const nextTeamId = nextRoundOrder[nextPickInRound - 1];

        // Check for mandatory picks for next team
        setTimeout(() => {
          checkMandatoryPicks(updatedPlayers, updatedTeams, nextTeamId, nextRound);
        }, 0);

        console.log('✅ Draft successful! Returning new state');
        console.log('✅ Updated teams:', updatedTeams);
        console.log('✅ Next team:', nextTeamId);
        console.log('✅ Using round order:', nextRoundOrder);

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
    },
    [checkMandatoryPicks, setPhase]
  );

  const undoLastPick = useCallback(() => {
    setDraftState((prev) => {
      if (prev.picks.length === 0) return prev;

      const lastPick = prev.picks[prev.picks.length - 1];
      if (!lastPick.playerId) return prev;

      // Revert player and unlock any siblings that were locked to that team
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
        // If this player was locked to a team because their sibling was drafted,
        // unlock them when the sibling is undrafted
        if (p.siblingId === lastPick.playerId && p.lockedToTeamId === lastPick.teamId) {
          console.log('🔓 Unlocking sibling', p.name, 'from team', lastPick.teamId);
          return {
            ...p,
            lockedToTeamId: undefined,
          };
        }
        return p;
      });

      // Revert team
      const undraftedPlayer = prev.players.find(p => p.id === lastPick.playerId);
      const updatedTeams = prev.teams.map((t) => {
        if (t.id === lastPick.teamId) {
          const newRoster = t.roster.filter((p) => p.id !== lastPick.playerId);
          // Update age breakdown - decrement count for undrafted player's age
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

      // Calculate the new current round and pick
      const newPickInRound = prev.currentPickInRound > 1 ? prev.currentPickInRound - 1 : prev.teams.length;
      const newRound = prev.currentPickInRound > 1 ? prev.currentRound : prev.currentRound - 1;

      // Recalculate round order if we went back to a different round
      let restoredRoundOrder = prev.currentRoundOrder;

      if (newRound !== prev.currentRound) {
        // Went back to previous round - recalculate order with reverted team scores
        restoredRoundOrder = calculateDraftOrder(
          updatedTeams,
          newRound,
          prev.draftFormat,
          prev.draftOrder
        );
      }

      // Get current team from restored round order
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

    // If we're on complete screen, go back to draft
    if (phase === 'complete') {
      setPhase('draft');
    }
  }, [checkMandatoryPicks, phase]);

  // Skip the current pick (only allowed in final round)
  const skipPick = useCallback(() => {
    setDraftState((prev) => {
      const { currentRound, currentPickInRound, currentTeamId, teams } = prev;

      if (!currentTeamId) return prev;

      // Record the skip
      const skipRecord: DraftPick = {
        round: currentRound,
        pick: (currentRound - 1) * teams.length + currentPickInRound,
        teamId: currentTeamId,
        playerId: undefined,
        timestamp: Date.now(),
        wasSkipped: true,
      };

      const updatedPicks = [...prev.picks, skipRecord];

      // Calculate next pick
      const { round: nextRound, pickInRound: nextPickInRound } = getNextPick(
        currentRound,
        currentPickInRound,
        teams.length
      );

      const availablePlayers = prev.players.filter((p) => !p.isDrafted);

      // Check if draft is complete (no more available players)
      if (availablePlayers.length === 0) {
        // Don't auto-navigate - show confirmation modal first
        setTimeout(() => setPendingComplete(true), 300);
        return {
          ...prev,
          picks: updatedPicks,
          isDraftComplete: true,
          mandatoryPick: undefined,
        };
      }

      // If we're advancing to a new round, recalculate the draft order
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

      // Check for mandatory picks for next team
      setTimeout(() => {
        checkMandatoryPicks(prev.players, teams, nextTeamId, nextRound);
      }, 0);

      console.log('⏭️ Pick skipped for team', currentTeamId);

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
  }, [checkMandatoryPicks, setPhase]);

  // Execute a trade between two teams
  const executeTrade = useCallback((
    team1Id: string,
    team2Id: string,
    player1Id: string, // moving FROM team1 TO team2
    player2Id: string, // moving FROM team2 TO team1
    reason: string
  ) => {
    setDraftState((prev) => {
      const team1 = prev.teams.find(t => t.id === team1Id);
      const team2 = prev.teams.find(t => t.id === team2Id);
      const player1 = prev.players.find(p => p.id === player1Id);
      const player2 = prev.players.find(p => p.id === player2Id);

      if (!team1 || !team2 || !player1 || !player2) {
        console.error('Trade failed: Invalid team or player IDs');
        return prev;
      }

      // Validate players are on the correct teams
      if (player1.draftedByTeamId !== team1Id || player2.draftedByTeamId !== team2Id) {
        console.error('Trade failed: Players not on expected teams');
        return prev;
      }

      // Create the trade record
      const trade: Trade = {
        id: `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        team1Id,
        team2Id,
        player1Id,
        player2Id,
        reason,
      };

      // Update players with new team assignments
      const updatedPlayers = prev.players.map((p) => {
        if (p.id === player1Id) {
          return { ...p, draftedByTeamId: team2Id };
        }
        if (p.id === player2Id) {
          return { ...p, draftedByTeamId: team1Id };
        }
        return p;
      });

      // Update teams - swap players between rosters
      const updatedTeams = prev.teams.map((t) => {
        if (t.id === team1Id) {
          // Remove player1, add player2
          const newRoster = t.roster.filter(p => p.id !== player1Id);
          const updatedPlayer2 = updatedPlayers.find(p => p.id === player2Id)!;
          newRoster.push(updatedPlayer2);

          // Update age breakdown: remove player1's age, add player2's age
          const newAgeBreakdown = { ...(t.ageBreakdown || {}) };
          const age1 = player1.littleLeagueAge;
          const age2 = player2.littleLeagueAge;

          // Decrement player1's age
          if (newAgeBreakdown[age1] > 1) {
            newAgeBreakdown[age1] = newAgeBreakdown[age1] - 1;
          } else {
            delete newAgeBreakdown[age1];
          }
          // Increment player2's age
          newAgeBreakdown[age2] = (newAgeBreakdown[age2] || 0) + 1;

          return {
            ...t,
            roster: newRoster,
            totalScore: newRoster.reduce((sum, p) => sum + p.totalScore, 0),
            ageBreakdown: newAgeBreakdown,
          };
        }
        if (t.id === team2Id) {
          // Remove player2, add player1
          const newRoster = t.roster.filter(p => p.id !== player2Id);
          const updatedPlayer1 = updatedPlayers.find(p => p.id === player1Id)!;
          newRoster.push(updatedPlayer1);

          // Update age breakdown: remove player2's age, add player1's age
          const newAgeBreakdown = { ...(t.ageBreakdown || {}) };
          const age1 = player1.littleLeagueAge;
          const age2 = player2.littleLeagueAge;

          // Decrement player2's age
          if (newAgeBreakdown[age2] > 1) {
            newAgeBreakdown[age2] = newAgeBreakdown[age2] - 1;
          } else {
            delete newAgeBreakdown[age2];
          }
          // Increment player1's age
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

      console.log('✅ Trade executed:', {
        trade,
        player1: `${player1.firstName} ${player1.lastName}`,
        player2: `${player2.firstName} ${player2.lastName}`,
        team1: team1.name,
        team2: team2.name,
      });

      return {
        ...prev,
        players: updatedPlayers,
        teams: updatedTeams,
        trades: [...prev.trades, trade],
      };
    });
  }, []);

  // Finalize draft and navigate to complete phase
  const finalizeDraft = useCallback(() => {
    setPendingComplete(false);
    setPhase('complete');
  }, [setPhase]);

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
  };
};
