import {
  ImportedWorkbook,
  EvaluationPlayer,
  EvaluationCategory,
  FieldWeight,
  ImportWarning,
  EVALUATION_TAB_CONFIGS,
  DEFAULT_FIELD_WEIGHTS,
} from '../types/evaluation';
import { Player } from '../types';
import {
  normalizeScore,
  getBestTime,
  weightedAverage,
  roundScore,
  calculateTimeRange,
} from './scoreNormalization';

/**
 * Process an imported workbook into EvaluationPlayer array
 */
export function processWorkbook(
  workbook: ImportedWorkbook,
  fieldWeights: FieldWeight[] = DEFAULT_FIELD_WEIGHTS
): { players: EvaluationPlayer[]; warnings: ImportWarning[] } {
  const warnings: ImportWarning[] = [];

  // First, collect all times to calculate dynamic range
  const allTimes: number[] = [];
  for (const tab of workbook.tabs) {
    if (tab.matchedConfig?.category === 'baserunning') {
      for (const row of tab.rows) {
        if (row.scores.time1) allTimes.push(row.scores.time1);
        if (row.scores.time2) allTimes.push(row.scores.time2);
      }
    }
  }
  const timeRange = calculateTimeRange(allTimes);

  // Build player map keyed by BIB
  const playerMap = new Map<string, EvaluationPlayer>();

  // Initialize all players from the union of BIBs
  for (const bib of workbook.allBibs) {
    playerMap.set(bib, createEmptyPlayer(bib));
  }

  // Process each tab and merge data into players
  for (const tab of workbook.tabs) {
    if (!tab.matchedConfig) {
      warnings.push({
        type: 'partial_data',
        message: `Tab "${tab.name}" not recognized as an evaluation category`,
        tab: tab.name,
      });
      continue;
    }

    const category = tab.matchedConfig.category;

    for (const row of tab.rows) {
      const player = playerMap.get(row.bib);
      if (!player) continue;

      // Update player info if available
      if (row.firstName && !player.firstName) {
        player.firstName = row.firstName;
      }
      if (row.lastName && !player.lastName) {
        player.lastName = row.lastName;
      }
      if (row.age && !player.age) {
        player.age = row.age;
      }
      if (row.level && !player.level) {
        player.level = row.level;
      }

      // Track which tabs we found this player in
      if (!player.tabsFound.includes(tab.name)) {
        player.tabsFound.push(tab.name);
      }

      // Store raw scores
      player.rawScores[category] = { ...row.scores };

      // Normalize scores based on field config
      const config = tab.matchedConfig;
      const normalizedScores: Record<string, number> = {};

      for (const field of config.fields) {
        const rawValue = row.scores[field.name];

        // Special handling for baserunning times - use best time
        if (category === 'baserunning' && (field.name === 'time1' || field.name === 'time2')) {
          // Skip individual times - we'll handle bestTime separately
          continue;
        }

        const normalized = normalizeScore(
          rawValue,
          field.inputMin,
          field.inputMax,
          field.lowerIsBetter
        );

        if (normalized !== null) {
          normalizedScores[field.name] = normalized;
        } else if (rawValue !== null && rawValue !== undefined) {
          warnings.push({
            type: 'invalid_score',
            message: `Invalid ${field.name} score for BIB ${row.bib}: ${rawValue}`,
            bib: row.bib,
            tab: tab.name,
          });
        }
      }

      // Handle baserunning best time
      if (category === 'baserunning') {
        const bestTime = getBestTime(row.scores.time1, row.scores.time2);
        if (bestTime !== null) {
          // Use dynamic time range for normalization
          const normalized = normalizeScore(bestTime, timeRange.min, timeRange.max, true);
          if (normalized !== null) {
            normalizedScores['bestTime'] = normalized;
          }
        }
      }

      player.normalizedScores[category] = normalizedScores;
    }
  }

  // Calculate category scores and weighted totals
  const players = Array.from(playerMap.values());

  for (const player of players) {
    // Update full name
    player.fullName =
      player.firstName && player.lastName
        ? `${player.firstName} ${player.lastName}`.trim()
        : player.bib;

    // Calculate category scores and weighted total
    calculatePlayerScores(player, fieldWeights);

    // Track missing categories
    for (const category of Object.keys(player.categoryScores) as EvaluationCategory[]) {
      if (player.categoryScores[category] === null) {
        player.missingCategories.push(category);
      }
    }

    // Mark as partial if missing data
    player.isPartial = player.missingCategories.length > 0;

    if (player.isPartial && player.tabsFound.length > 0) {
      warnings.push({
        type: 'partial_data',
        message: `Player ${player.fullName} (BIB ${player.bib}) missing categories: ${player.missingCategories.join(', ')}`,
        bib: player.bib,
      });
    }
  }

  // Sort by weighted total (descending) and assign ranks
  players.sort((a, b) => b.weightedTotal - a.weightedTotal);
  players.forEach((player, index) => {
    player.rank = index + 1;
  });

  return { players, warnings };
}

/**
 * Create an empty player structure
 */
function createEmptyPlayer(bib: string): EvaluationPlayer {
  return {
    bib,
    firstName: '',
    lastName: '',
    fullName: '',
    age: 0,
    level: '',
    rawScores: {
      fielding: {},
      pitching: {},
      hitting: {},
      flyBalls: {},
      baserunning: {},
    },
    normalizedScores: {
      fielding: {},
      pitching: {},
      hitting: {},
      flyBalls: {},
      baserunning: {},
    },
    categoryScores: {
      fielding: null,
      pitching: null,
      hitting: null,
      flyBalls: null,
      baserunning: null,
    },
    manualAdjust: 0,
    weightedTotal: 0,
    rank: 0,
    projectedRound: 0,
    isCoachKid: false,
    coachTeamIndex: null,
    siblingGroupId: null,
    missingCategories: [],
    tabsFound: [],
    isPartial: false,
  };
}

/**
 * Field mapping from fieldId to normalized score location
 */
export const FIELD_MAPPING: Record<string, { category: EvaluationCategory; field: string }> = {
  'pitchingForm': { category: 'pitching', field: 'form' },
  'armStrength': { category: 'pitching', field: 'armStrength' },
  'hittingForm': { category: 'hitting', field: 'form' },
  'contactPower': { category: 'hitting', field: 'contactPower' },
  'hits': { category: 'hitting', field: 'hits' },
  'field': { category: 'fielding', field: 'field' },
  'throw': { category: 'fielding', field: 'throw' },
  'catches': { category: 'flyBalls', field: 'catches' },
  'flyBallForm': { category: 'flyBalls', field: 'form' },
  'bestTime': { category: 'baserunning', field: 'bestTime' },
  'baserunningForm': { category: 'baserunning', field: 'form' },
};

/**
 * Map fieldId to the actual score location in normalizedScores
 */
export function getFieldScore(player: EvaluationPlayer, fieldId: string): number | null {
  const mapping = FIELD_MAPPING[fieldId];
  if (!mapping) return null;

  return player.normalizedScores[mapping.category]?.[mapping.field] ?? null;
}

/**
 * Calculate player scores using field-level weights
 */
function calculatePlayerScores(player: EvaluationPlayer, fieldWeights: FieldWeight[]): void {
  let weightedSum = 0;
  let totalWeight = 0;

  // Calculate weighted total directly from field weights
  for (const fw of fieldWeights) {
    if (!fw.enabled) continue;

    const score = getFieldScore(player, fw.fieldId);

    if (score !== null) {
      weightedSum += score * (fw.weight / 100);
      totalWeight += fw.weight;
    }
  }

  // Redistribute weights if some fields are missing data
  if (totalWeight > 0 && totalWeight < 100) {
    player.weightedTotal = roundScore((weightedSum / totalWeight) * 100, 1) ?? 0;
  } else {
    player.weightedTotal = roundScore(weightedSum, 1) ?? 0;
  }

  // Apply manual adjustment
  player.weightedTotal = roundScore(player.weightedTotal + player.manualAdjust, 1) ?? 0;

  // Also calculate category scores for display purposes
  calculateCategoryScoresForDisplay(player);
}

/**
 * Calculate category scores for display (average of normalized scores within each category)
 */
function calculateCategoryScoresForDisplay(player: EvaluationPlayer): void {
  for (const config of EVALUATION_TAB_CONFIGS) {
    const category = config.category;
    const normalized = player.normalizedScores[category];

    if (!normalized || Object.keys(normalized).length === 0) {
      player.categoryScores[category] = null;
      continue;
    }

    // Calculate simple average within category for display
    const fieldScores: { value: number | null; weight: number }[] = [];

    for (const field of config.fields) {
      // Special handling for baserunning - use bestTime instead of time1/time2
      if (category === 'baserunning' && (field.name === 'time1' || field.name === 'time2')) {
        continue;
      }

      const fieldName = category === 'baserunning' && field.name.includes('time') ? 'bestTime' : field.name;
      const value = normalized[fieldName] ?? null;

      fieldScores.push({ value, weight: field.weight });
    }

    // Add bestTime for baserunning with combined time weight
    if (category === 'baserunning' && normalized['bestTime'] !== undefined) {
      const timeWeight = config.fields
        .filter((f) => f.name === 'time1' || f.name === 'time2')
        .reduce((sum, f) => sum + f.weight, 0);
      fieldScores.push({ value: normalized['bestTime'], weight: timeWeight });
    }

    const categoryScore = weightedAverage(fieldScores);
    player.categoryScores[category] = categoryScore !== null ? roundScore(categoryScore, 1) : null;
  }
}

/**
 * Recalculate all player scores with new weights
 */
export function recalculateWithWeights(
  players: EvaluationPlayer[],
  fieldWeights: FieldWeight[]
): EvaluationPlayer[] {
  const updatedPlayers = players.map((player) => {
    const updated = { ...player };
    calculatePlayerScores(updated, fieldWeights);
    return updated;
  });

  // Re-sort and re-rank
  updatedPlayers.sort((a, b) => b.weightedTotal - a.weightedTotal);
  updatedPlayers.forEach((player, index) => {
    player.rank = index + 1;
  });

  return updatedPlayers;
}

/**
 * Convert EvaluationPlayer array to Player array for draft system
 */
export function convertToPlayers(
  evalPlayers: EvaluationPlayer[],
  teamCount: number
): Player[] {
  return evalPlayers.map((ep) => {
    const player: Player = {
      id: `player-${ep.bib}-${Date.now()}`,
      bib: ep.bib,
      firstName: ep.firstName || '',
      lastName: ep.lastName || '',
      name: ep.fullName || ep.bib,

      // Raw scores - set to 0 since we have normalized scores
      fieldScore: 0,
      throwScore: 0,
      hitPower: 0,
      hitForm: 0,
      hitContact: 0,
      pitchingStrength: 0,
      pitchingForm: 0,
      catchScore: 0,
      runningScore: 0,

      // Map category scores to subtotals
      fieldingSubtotal: ep.categoryScores.fielding ?? 0,
      hittingSubtotal: ep.categoryScores.hitting ?? 0,
      pitchingSubtotal: ep.categoryScores.pitching ?? 0,

      // Use fly balls and baserunning for catch and running scores
      subjectiveTotal:
        (ep.categoryScores.fielding ?? 0) +
        (ep.categoryScores.hitting ?? 0) +
        (ep.categoryScores.pitching ?? 0),
      objectiveTotal:
        (ep.categoryScores.flyBalls ?? 0) + (ep.categoryScores.baserunning ?? 0),
      officialAdjust: ep.manualAdjust,

      totalScore: ep.weightedTotal,
      rank: ep.rank,
      projectedRound: Math.ceil(ep.rank / teamCount),

      // Player info
      littleLeagueAge: ep.age || 0,
      birthday: '',
      isAllStar: false,
      isDNE: ep.isPartial,

      // Draft rules - to be set later
      isCoachKid: false,

      // Draft status
      isDrafted: false,
    };

    return player;
  });
}

/**
 * Generate summary CSV from processed players with all field scores
 */
export function generateEvaluationCSV(players: EvaluationPlayer[], teamNames: string[] = []): string {
  const headers = [
    'Rank',
    'Proj Round',
    'BIB',
    'First Name',
    'Last Name',
    'Age',
    'Coach Kid',
    'Team',
    'Sibling Group',
    // Pitching fields
    'P.Form',
    'P.Arm',
    // Hitting fields
    'H.Form',
    'H.Power',
    'H.Hits',
    // Fielding fields
    'Field',
    'Throw',
    // Fly Balls fields
    'F.Catches',
    'F.Form',
    // Baserunning fields
    'R.Time',
    'R.Form',
    // Totals
    'Adjust',
    'Total',
  ];

  const rows = players.map((p) => [
    p.rank.toString(),
    p.projectedRound.toString(),
    p.bib,
    p.firstName,
    p.lastName,
    p.age?.toString() || '',
    p.isCoachKid ? 'Yes' : '',
    p.coachTeamIndex !== null && teamNames[p.coachTeamIndex] ? teamNames[p.coachTeamIndex] : '',
    p.siblingGroupId || '',
    // Pitching
    getFieldScore(p, 'pitchingForm')?.toFixed(0) || '',
    getFieldScore(p, 'armStrength')?.toFixed(0) || '',
    // Hitting
    getFieldScore(p, 'hittingForm')?.toFixed(0) || '',
    getFieldScore(p, 'contactPower')?.toFixed(0) || '',
    getFieldScore(p, 'hits')?.toFixed(0) || '',
    // Fielding
    getFieldScore(p, 'field')?.toFixed(0) || '',
    getFieldScore(p, 'throw')?.toFixed(0) || '',
    // Fly Balls
    getFieldScore(p, 'catches')?.toFixed(0) || '',
    getFieldScore(p, 'flyBallForm')?.toFixed(0) || '',
    // Baserunning
    getFieldScore(p, 'bestTime')?.toFixed(0) || '',
    getFieldScore(p, 'baserunningForm')?.toFixed(0) || '',
    // Totals
    p.manualAdjust.toString(),
    p.weightedTotal.toFixed(1),
  ]);

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
}

/**
 * Download CSV content as a file
 */
export function downloadEvaluationCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
