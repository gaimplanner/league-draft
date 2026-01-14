import { Player, ScoringWeights } from '../types';

export interface CalculatedScores {
  fieldingSubtotal: number;
  hittingSubtotal: number;
  pitchingSubtotal: number;
  subjectiveTotal: number;
  objectiveTotal: number;
  totalScore: number;
}

/**
 * Calculate weighted player scores based on raw component scores and weights
 */
export function calculatePlayerScore(
  player: Pick<Player, 'fieldScore' | 'throwScore' | 'hitPower' | 'hitForm' | 'hitContact' | 'pitchingStrength' | 'pitchingForm' | 'catchScore' | 'runningScore' | 'officialAdjust'>,
  weights: ScoringWeights
): CalculatedScores {
  // Calculate weighted subtotals (weights are percentages, divide by 100)
  const fieldingSubtotal =
    (player.fieldScore * weights.fielding.field / 100) +
    (player.throwScore * weights.fielding.throw / 100);

  const hittingSubtotal =
    (player.hitPower * weights.hitting.power / 100) +
    (player.hitForm * weights.hitting.form / 100) +
    (player.hitContact * weights.hitting.contact / 100);

  const pitchingSubtotal =
    (player.pitchingStrength * weights.pitching.strength / 100) +
    (player.pitchingForm * weights.pitching.form / 100);

  // Subjective total (fielding + hitting + pitching)
  const subjectiveTotal = fieldingSubtotal + hittingSubtotal + pitchingSubtotal;

  // Objective scores (weighted)
  const weightedCatchScore = player.catchScore * weights.catching / 100;
  const weightedRunningScore = player.runningScore * weights.running / 100;
  const objectiveTotal = weightedCatchScore + weightedRunningScore;

  // Total score
  const totalScore = subjectiveTotal + objectiveTotal + player.officialAdjust;

  return {
    fieldingSubtotal,
    hittingSubtotal,
    pitchingSubtotal,
    subjectiveTotal,
    objectiveTotal,
    totalScore,
  };
}

/**
 * Validate that scoring weights sum to 100%
 */
export function validateWeights(weights: ScoringWeights): { isValid: boolean; total: number } {
  const total =
    weights.fielding.field +
    weights.fielding.throw +
    weights.hitting.power +
    weights.hitting.form +
    weights.hitting.contact +
    weights.pitching.strength +
    weights.pitching.form +
    weights.catching +
    weights.running;

  // Allow small floating point tolerance
  const isValid = Math.abs(total - 100) < 0.01;

  return { isValid, total };
}

/**
 * Recalculate all players' scores with new weights
 */
export function recalculateAllScores(
  players: Player[],
  weights: ScoringWeights
): Player[] {
  return players.map(player => {
    const calculated = calculatePlayerScore(player, weights);
    return {
      ...player,
      ...calculated,
    };
  });
}

/**
 * Get a breakdown of how a player's score was calculated
 */
export function getScoreBreakdown(player: Player, weights: ScoringWeights) {
  return {
    fielding: {
      field: {
        raw: player.fieldScore,
        weight: weights.fielding.field,
        contribution: player.fieldScore * weights.fielding.field / 100,
      },
      throw: {
        raw: player.throwScore,
        weight: weights.fielding.throw,
        contribution: player.throwScore * weights.fielding.throw / 100,
      },
      subtotal: player.fieldingSubtotal,
    },
    hitting: {
      power: {
        raw: player.hitPower,
        weight: weights.hitting.power,
        contribution: player.hitPower * weights.hitting.power / 100,
      },
      form: {
        raw: player.hitForm,
        weight: weights.hitting.form,
        contribution: player.hitForm * weights.hitting.form / 100,
      },
      contact: {
        raw: player.hitContact,
        weight: weights.hitting.contact,
        contribution: player.hitContact * weights.hitting.contact / 100,
      },
      subtotal: player.hittingSubtotal,
    },
    pitching: {
      strength: {
        raw: player.pitchingStrength,
        weight: weights.pitching.strength,
        contribution: player.pitchingStrength * weights.pitching.strength / 100,
      },
      form: {
        raw: player.pitchingForm,
        weight: weights.pitching.form,
        contribution: player.pitchingForm * weights.pitching.form / 100,
      },
      subtotal: player.pitchingSubtotal,
    },
    objective: {
      catching: {
        raw: player.catchScore,
        weight: weights.catching,
        contribution: player.catchScore * weights.catching / 100,
      },
      running: {
        raw: player.runningScore,
        weight: weights.running,
        contribution: player.runningScore * weights.running / 100,
      },
      subtotal: player.objectiveTotal,
    },
    adjustment: player.officialAdjust,
    total: player.totalScore,
  };
}
