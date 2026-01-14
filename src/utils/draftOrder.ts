import { DraftFormat, Team } from '../types';

export const calculateDraftOrder = (
  teams: Team[],
  round: number,
  format: DraftFormat,
  initialOrder: string[]
): string[] => {
  console.log('📊 calculateDraftOrder called');
  console.log('📊 round:', round, 'format:', format);
  console.log('📊 initialOrder:', initialOrder);
  console.log('📊 teams:', teams.map(t => ({ id: t.id, name: t.name, score: t.totalScore })));

  switch (format) {
    case 'straight':
      console.log('📊 Using straight format - returning initialOrder');
      return initialOrder;

    case 'snake':
      // Odd rounds go forward, even rounds go backward
      const snakeOrder = round % 2 === 1 ? initialOrder : [...initialOrder].reverse();
      console.log('📊 Using snake format - round', round, '- returning:', snakeOrder);
      return snakeOrder;

    case 'recalculated':
      // For round 1, use the initial order since all teams have 0 points
      // For subsequent rounds, sort by total roster score (ascending - worst team picks first)
      if (round === 1) {
        console.log('📊 Using recalculated format - round 1 - using initialOrder');
        return initialOrder;
      }
      // Sort teams by total roster score, but use initialOrder as tiebreaker
      const sortedTeams = [...teams].sort((a, b) => {
        const scoreDiff = a.totalScore - b.totalScore;
        if (Math.abs(scoreDiff) < 0.01) {
          // Same score - use initial order as tiebreaker
          const aIndex = initialOrder.indexOf(a.id);
          const bIndex = initialOrder.indexOf(b.id);
          return aIndex - bIndex;
        }
        return scoreDiff;
      });
      const recalcOrder = sortedTeams.map((team) => team.id);
      console.log('📊 Using recalculated format - round', round, '- sorted by score:', recalcOrder);
      return recalcOrder;

    default:
      console.log('📊 Using default - returning initialOrder');
      return initialOrder;
  }
};

export const getCurrentPickingTeam = (
  teams: Team[],
  round: number,
  pickInRound: number,
  format: DraftFormat,
  initialOrder: string[],
  cachedRoundOrder?: string[]
): string | null => {
  // Use cached order if provided, otherwise calculate
  const currentRoundOrder = cachedRoundOrder || calculateDraftOrder(teams, round, format, initialOrder);

  // pickInRound is 1-indexed (1-8)
  if (pickInRound < 1 || pickInRound > currentRoundOrder.length) {
    return null;
  }

  return currentRoundOrder[pickInRound - 1];
};

export const getNextPick = (
  currentRound: number,
  currentPickInRound: number,
  totalTeams: number
): { round: number; pickInRound: number } => {
  if (currentPickInRound < totalTeams) {
    return {
      round: currentRound,
      pickInRound: currentPickInRound + 1,
    };
  } else {
    return {
      round: currentRound + 1,
      pickInRound: 1,
    };
  }
};
