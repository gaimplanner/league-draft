import { useState, useCallback, useRef, useEffect } from 'react';
import { Player } from '../types';
import { updatePlayerScore, recalculateRankings } from '../utils/scoring';

export const usePlayerScoring = (initialPlayers: Player[], teamCount: number = 8) => {
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const teamCountRef = useRef(teamCount);
  teamCountRef.current = teamCount;

  // Sync players when initialPlayers changes (e.g., when division is loaded from API)
  useEffect(() => {
    if (initialPlayers.length > 0) {
      setPlayers(initialPlayers);
    }
  }, [initialPlayers]);

  const updatePlayer = useCallback((playerId: string, field: keyof Pick<Player, 'fieldingSubtotal' | 'hittingSubtotal' | 'pitchingSubtotal' | 'catchScore' | 'runningScore' | 'officialAdjust'>, value: number) => {
    setPlayers((currentPlayers) => {
      const updatedPlayers = currentPlayers.map((player) => {
        if (player.id === playerId) {
          return updatePlayerScore(player, field, value);
        }
        return player;
      });

      // Recalculate rankings for all players
      return recalculateRankings(updatedPlayers, teamCountRef.current);
    });
  }, []);

  const updatePlayerField = useCallback((playerId: string, updates: Partial<Player>) => {
    setPlayers((currentPlayers) => {
      const updatedPlayers = currentPlayers.map((player) => {
        if (player.id === playerId) {
          const updated = { ...player, ...updates };

          // If score fields changed, recalculate totalScore
          if ('fieldingSubtotal' in updates || 'hittingSubtotal' in updates ||
              'pitchingSubtotal' in updates || 'catchScore' in updates ||
              'runningScore' in updates || 'officialAdjust' in updates) {
            updated.totalScore =
              updated.fieldingSubtotal +
              updated.hittingSubtotal +
              updated.pitchingSubtotal +
              updated.catchScore +
              updated.runningScore +
              updated.officialAdjust;
          }

          return updated;
        }
        return player;
      });

      // Recalculate rankings if scores changed
      const hasScoreChanges = 'fieldingSubtotal' in updates || 'hittingSubtotal' in updates ||
                             'pitchingSubtotal' in updates || 'catchScore' in updates ||
                             'runningScore' in updates || 'officialAdjust' in updates;

      return hasScoreChanges ? recalculateRankings(updatedPlayers, teamCountRef.current) : updatedPlayers;
    });
  }, []);

  const linkSiblings = useCallback((playerId1: string, playerId2: string) => {
    setPlayers((currentPlayers) => {
      const player1 = currentPlayers.find(p => p.id === playerId1);
      const player2 = currentPlayers.find(p => p.id === playerId2);

      if (!player1 || !player2) return currentPlayers;

      return currentPlayers.map((player) => {
        if (player.id === playerId1) {
          return {
            ...player,
            siblingId: playerId2,
            sibling: player2.name,
          };
        }
        if (player.id === playerId2) {
          return {
            ...player,
            siblingId: playerId1,
            sibling: player1.name,
          };
        }
        return player;
      });
    });
  }, []);

  const unlinkSibling = useCallback((playerId: string) => {
    setPlayers((currentPlayers) => {
      const player = currentPlayers.find(p => p.id === playerId);
      if (!player || !player.siblingId) return currentPlayers;

      const siblingId = player.siblingId;

      return currentPlayers.map((p) => {
        if (p.id === playerId || p.id === siblingId) {
          return {
            ...p,
            siblingId: undefined,
            sibling: undefined,
          };
        }
        return p;
      });
    });
  }, []);

  const setAllPlayers = useCallback((newPlayers: Player[]) => {
    setPlayers(recalculateRankings(newPlayers, teamCountRef.current));
  }, []);

  return {
    players,
    updatePlayer,
    updatePlayerField,
    linkSiblings,
    unlinkSibling,
    setAllPlayers,
  };
};
