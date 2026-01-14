import { useState, useCallback, useEffect, useRef } from 'react';
import { Player, Team, DraftState, DraftFormat, DraftPick, AppPhase, Division } from '../types';
import { getNextPick, calculateDraftOrder } from '../utils/draftOrder';

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
};

export const useDraft = (divisionId?: string) => {
  const [phase, setPhase] = useState<AppPhase>('upload');
  const [draftState, setDraftState] = useState<DraftState>(initialDraftState);
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

  const startDraft = useCallback((format?: DraftFormat, order?: string[]) => {
    console.log('🚀 startDraft called');
    console.log('🚀 Passed format:', format);
    console.log('🚀 Passed order:', order);

    setDraftState((prev) => {
      // Use passed values if provided, otherwise fall back to state
      const draftFormat = format ?? prev.draftFormat;
      const draftOrder = order ?? prev.draftOrder;

      console.log('🚀 prev.teams:', prev.teams);
      console.log('🚀 Using draftFormat:', draftFormat);
      console.log('🚀 Using draftOrder:', draftOrder);

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

      // Check for coach's kids that must be drafted this round
      // Use lockedToRound if set (for same-round conflicts), otherwise use projectedRound
      const coachKidToDraft = players.find(
        (p) =>
          !p.isDrafted &&
          p.isCoachKid &&
          p.coachTeamId === teamId &&
          (p.lockedToRound ?? p.projectedRound) === round
      );

      if (coachKidToDraft) {
        setDraftState((prev) => ({
          ...prev,
          mandatoryPick: {
            playerId: coachKidToDraft.id,
            reason: 'coach-kid',
          },
        }));
        return;
      }

      // Check for sibling requirements
      // A sibling must be drafted when:
      // 1. They are locked to this team (lockedToTeamId === teamId), OR
      // 2. Their sibling was drafted by this team and it's their projected round
      const siblingToDraft = players.find((p) => {
        if (p.isDrafted || !p.siblingId) return false;

        // If locked to this team, must draft in their lockedToRound or projectedRound
        if (p.lockedToTeamId === teamId) {
          const requiredRound = p.lockedToRound ?? p.projectedRound;
          return requiredRound === round;
        }

        // Legacy check: sibling by name match in projected round
        if (p.sibling && p.projectedRound === round) {
          const sibling = players.find(
            (other) =>
              other.name.toLowerCase() === p.sibling!.toLowerCase() &&
              other.draftedByTeamId === teamId
          );
          return !!sibling;
        }

        return false;
      });

      if (siblingToDraft) {
        const siblingPlayer = players.find(p => p.id === siblingToDraft.siblingId);
        setDraftState((prev) => ({
          ...prev,
          mandatoryPick: {
            playerId: siblingToDraft.id,
            reason: 'sibling',
            siblingName: siblingPlayer?.name || siblingToDraft.sibling,
          },
        }));
        return;
      }

      // No mandatory pick
      setDraftState((prev) => ({
        ...prev,
        mandatoryPick: undefined,
      }));
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
            return {
              ...t,
              roster: newRoster,
              totalScore: newRoster.reduce((sum, p) => sum + p.totalScore, 0),
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
          setTimeout(() => setPhase('complete'), 500);
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
      const updatedTeams = prev.teams.map((t) => {
        if (t.id === lastPick.teamId) {
          const newRoster = t.roster.filter((p) => p.id !== lastPick.playerId);
          return {
            ...t,
            roster: newRoster,
            totalScore: newRoster.reduce((sum, p) => sum + p.totalScore, 0),
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

  return {
    phase,
    setPhase,
    draftState,
    setPlayers,
    setTeams,
    setDraftFormat,
    setDraftOrder,
    startDraft,
    draftPlayer,
    undoLastPick,
    resetDraft,
    loadDivisionState,
  };
};
