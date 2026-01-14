import { DraftFormat, Team } from '../types';

export const calculateDraftOrder = (
  teams: Team[],
  round: number,
  format: DraftFormat,
  initialOrder: string[]
): string[] => {
  switch (format) {
    case 'straight':
      return initialOrder;

    case 'snake':
      // Odd rounds go forward, even rounds go backward
      return round % 2 === 1 ? initialOrder : [...initialOrder].reverse();

    case 'recalculated':
      // Sort teams by total roster score (ascending - worst team picks first)
      const sortedTeams = [...teams].sort((a, b) => a.totalScore - b.totalScore);
      return sortedTeams.map((team) => team.id);

    default:
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
