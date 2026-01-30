import { useState, useCallback } from 'react';
import type {
  TryoutGroup,
  StationScore,
  CreateStationScoreData,
  GenerateGroupsData,
  AddGroupPlayerData,
} from '../types';
import { api } from '../api/client';

export function useTryoutScoring() {
  const [groups, setGroups] = useState<TryoutGroup[]>([]);
  const [activeGroup, setActiveGroupState] = useState<TryoutGroup | null>(null);
  const [activeStationId, setActiveStationIdState] = useState<string | null>(null);
  const [stationScores, setStationScores] = useState<StationScore[]>([]);
  const [activePlayerIndex, setActivePlayerIndexState] = useState<number>(0);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGroups = useCallback(async (seasonId: string): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await api.listTryoutGroups(seasonId);
      setGroups(data);
    } catch (err) {
      console.error('Failed to load tryout groups:', err);
      setError('Failed to load tryout groups');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const setActiveGroup = useCallback((group: TryoutGroup) => {
    setActiveGroupState(group);
    setActivePlayerIndexState(0);
  }, []);

  const setActiveStation = useCallback((stationId: string) => {
    setActiveStationIdState(stationId);
  }, []);

  const fetchScoresForGroupStation = useCallback(
    async (seasonId: string, groupId: string, stationId: string): Promise<void> => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await api.listStationScores(seasonId, { groupId, stationId });
        setStationScores(data);
      } catch (err) {
        console.error('Failed to load station scores:', err);
        setError('Failed to load station scores');
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const submitScore = useCallback(
    async (seasonId: string, data: CreateStationScoreData): Promise<void> => {
      try {
        setIsLoading(true);
        setError(null);
        const created = await api.createStationScore(seasonId, data);
        setStationScores((prev) => [...prev.filter((s) => s.id !== created.id), created]);

        // Show confirmation briefly
        setShowConfirmation(true);

        // Auto-advance after 800ms
        setTimeout(() => {
          setShowConfirmation(false);

          // Find next unscored player
          if (activeGroup && activeStationId) {
            const nextIndex = activeGroup.players.findIndex((p, index) => {
              if (index <= activePlayerIndex) return false;
              return !stationScores.some((s) => s.playerId === p.id && s.stationId === activeStationId);
            });

            if (nextIndex !== -1) {
              setActivePlayerIndexState(nextIndex);
            }
            // If all players scored, stay on current player (station complete)
          }
        }, 800);
      } catch (err) {
        console.error('Failed to submit score:', err);
        setError('Failed to submit score');
      } finally {
        setIsLoading(false);
      }
    },
    [activeGroup, activeStationId, activePlayerIndex, stationScores]
  );

  const advanceToPlayer = useCallback((index: number) => {
    setActivePlayerIndexState(index);
  }, []);

  const lookupByBib = useCallback(
    (bibNumber: number): boolean => {
      if (!activeGroup) return false;

      const playerIndex = activeGroup.players.findIndex((p) => p.bibNumber === bibNumber);
      if (playerIndex !== -1) {
        setActivePlayerIndexState(playerIndex);
        return true;
      }
      return false;
    },
    [activeGroup]
  );

  const getPlayerScoreStatus = useCallback(
    (playerId: string): boolean => {
      if (!activeStationId) return false;
      return stationScores.some((s) => s.playerId === playerId && s.stationId === activeStationId);
    },
    [activeStationId, stationScores]
  );

  const generateGroups = useCallback(
    async (seasonId: string, data: GenerateGroupsData): Promise<void> => {
      try {
        setIsLoading(true);
        setError(null);
        const generated = await api.generateTryoutGroups(seasonId, data);
        setGroups(generated);
      } catch (err) {
        console.error('Failed to generate groups:', err);
        setError('Failed to generate groups');
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const addPlayer = useCallback(
    async (groupId: string, data: AddGroupPlayerData): Promise<void> => {
      try {
        setIsLoading(true);
        setError(null);
        await api.addGroupPlayer(groupId, data);
        // Refresh active group
        const refreshed = await api.getTryoutGroup(groupId);
        if (activeGroup?.id === groupId) {
          setActiveGroupState(refreshed);
        }
        // Refresh groups list
        setGroups((prev) => prev.map((g) => (g.id === groupId ? refreshed : g)));
      } catch (err) {
        console.error('Failed to add player:', err);
        setError('Failed to add player');
      } finally {
        setIsLoading(false);
      }
    },
    [activeGroup]
  );

  const deleteGroup = useCallback(async (groupId: string): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      await api.deleteTryoutGroup(groupId);
      setGroups((prev) => prev.filter((g) => g.id !== groupId));
      if (activeGroup?.id === groupId) {
        setActiveGroupState(null);
      }
    } catch (err) {
      console.error('Failed to delete group:', err);
      setError('Failed to delete group');
    } finally {
      setIsLoading(false);
    }
  }, [activeGroup]);

  return {
    groups,
    activeGroup,
    activeStationId,
    stationScores,
    activePlayerIndex,
    showConfirmation,
    isLoading,
    error,
    fetchGroups,
    setActiveGroup,
    setActiveStation,
    fetchScoresForGroupStation,
    submitScore,
    advanceToPlayer,
    lookupByBib,
    getPlayerScoreStatus,
    generateGroups,
    addPlayer,
    deleteGroup,
  };
}
