import { Player } from '../types';

export const calculatePlayerScore = (player: Omit<Player, 'totalScore' | 'rank' | 'projectedRound'>): number => {
  // Use 0 as fallback for any undefined/NaN values to prevent NaN totals
  const fielding = player.fieldingSubtotal || 0;
  const hitting = player.hittingSubtotal || 0;
  const pitching = player.pitchingSubtotal || 0;
  const catching = player.catchScore || 0;
  const running = player.runningScore || 0;
  const adjust = player.officialAdjust || 0;

  return fielding + hitting + pitching + catching + running + adjust;
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
