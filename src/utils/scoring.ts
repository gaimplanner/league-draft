import { Player } from '../types';

export const calculatePlayerScore = (player: Omit<Player, 'totalScore' | 'rank' | 'projectedRound'>): number => {
  return (
    player.fieldingSubtotal +
    player.hittingSubtotal +
    player.pitchingSubtotal +
    player.catchScore +
    player.runningScore +
    player.officialAdjust
  );
};

export const recalculateRankings = (players: Player[], teamCount: number = 8): Player[] => {
  // Sort by total score (descending)
  const sortedPlayers = [...players].sort((a, b) => b.totalScore - a.totalScore);

  // Assign ranks and projected rounds
  return sortedPlayers.map((player, index) => ({
    ...player,
    rank: index + 1,
    projectedRound: Math.ceil((index + 1) / teamCount),
  }));
};

export const updatePlayerScore = (
  player: Player,
  field: keyof Pick<Player, 'fieldingSubtotal' | 'hittingSubtotal' | 'pitchingSubtotal' | 'catchScore' | 'runningScore' | 'officialAdjust'>,
  value: number
): Player => {
  const updatedPlayer = { ...player, [field]: value };
  updatedPlayer.totalScore = calculatePlayerScore(updatedPlayer);
  return updatedPlayer;
};
