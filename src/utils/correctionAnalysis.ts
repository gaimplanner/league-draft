/**
 * Correction Analysis for Algorithm Teaching Tool
 *
 * Analyzes user corrections to detect patterns and suggest weight adjustments
 * for the Team Builder algorithm.
 */

import {
  AssignmentCorrection,
  CorrectionReason,
  CorrectionAnalysis,
  CorrectionPattern,
  WeightSuggestion,
  RequestsFirstConfig,
} from '../types';

/**
 * Minimum number of corrections needed before making suggestions.
 * Too few corrections leads to unreliable patterns.
 */
const MIN_CORRECTIONS_FOR_PATTERN = 3;

/**
 * Confidence threshold for suggesting a weight change.
 */
const MIN_CONFIDENCE_FOR_SUGGESTION = 0.6;

/**
 * Analyze corrections to detect patterns and suggest weight adjustments.
 */
export function analyzeCorrections(
  corrections: AssignmentCorrection[],
  currentConfig: RequestsFirstConfig
): CorrectionAnalysis {
  const totalCorrections = corrections.length;

  // Count corrections by reason
  const correctionsByReason: Record<CorrectionReason, number> = {
    'coach-request-priority': 0,
    'friend-request-priority': 0,
    'balance-override': 0,
    'sibling-issue': 0,
    'other': 0,
  };

  for (const correction of corrections) {
    correctionsByReason[correction.correctionReason]++;
  }

  // Detect patterns
  const patterns = detectPatterns(corrections, correctionsByReason, totalCorrections);

  // Generate weight suggestions based on patterns
  const suggestedWeights = generateWeightSuggestions(
    patterns,
    currentConfig,
    totalCorrections
  );

  return {
    totalCorrections,
    correctionsByReason,
    patterns,
    suggestedWeights,
  };
}

/**
 * Detect patterns in the corrections.
 */
function detectPatterns(
  corrections: AssignmentCorrection[],
  byReason: Record<CorrectionReason, number>,
  total: number
): CorrectionPattern[] {
  const patterns: CorrectionPattern[] = [];

  if (total < MIN_CORRECTIONS_FOR_PATTERN) {
    return patterns;
  }

  // Pattern: Coach requests being prioritized
  const coachPriorityPercent = (byReason['coach-request-priority'] / total) * 100;
  if (coachPriorityPercent >= 30) {
    const confidence = Math.min(coachPriorityPercent / 100 + 0.3, 1);
    patterns.push({
      description: `Coach requests overrode algorithm decisions ${coachPriorityPercent.toFixed(0)}% of the time`,
      count: byReason['coach-request-priority'],
      percentage: coachPriorityPercent,
      confidence,
    });
  }

  // Pattern: Friend requests being prioritized
  const friendPriorityPercent = (byReason['friend-request-priority'] / total) * 100;
  if (friendPriorityPercent >= 30) {
    const confidence = Math.min(friendPriorityPercent / 100 + 0.3, 1);
    patterns.push({
      description: `Friend requests overrode algorithm decisions ${friendPriorityPercent.toFixed(0)}% of the time`,
      count: byReason['friend-request-priority'],
      percentage: friendPriorityPercent,
      confidence,
    });
  }

  // Pattern: Balance being prioritized over requests
  const balancePriorityPercent = (byReason['balance-override'] / total) * 100;
  if (balancePriorityPercent >= 30) {
    const confidence = Math.min(balancePriorityPercent / 100 + 0.3, 1);
    patterns.push({
      description: `Team balance overrode requests ${balancePriorityPercent.toFixed(0)}% of the time`,
      count: byReason['balance-override'],
      percentage: balancePriorityPercent,
      confidence,
    });
  }

  // Pattern: Looking at original reasons that were overridden
  const overriddenReasons = new Map<string, number>();
  for (const correction of corrections) {
    const reason = correction.originalReason;
    overriddenReasons.set(reason, (overriddenReasons.get(reason) || 0) + 1);
  }

  // If balance decisions are frequently overridden
  const balanceOverrides = overriddenReasons.get('balance') || 0;
  if (balanceOverrides >= 3 && balanceOverrides / total >= 0.4) {
    const percent = (balanceOverrides / total) * 100;
    patterns.push({
      description: `${percent.toFixed(0)}% of balance-based placements were manually corrected`,
      count: balanceOverrides,
      percentage: percent,
      confidence: Math.min(percent / 100 + 0.2, 0.9),
    });
  }

  return patterns.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Generate weight suggestions based on detected patterns.
 */
function generateWeightSuggestions(
  patterns: CorrectionPattern[],
  currentConfig: RequestsFirstConfig,
  totalCorrections: number
): WeightSuggestion[] {
  const suggestions: WeightSuggestion[] = [];

  if (totalCorrections < MIN_CORRECTIONS_FOR_PATTERN) {
    return suggestions;
  }

  // Look for coach request priority pattern
  const coachPattern = patterns.find(p =>
    p.description.includes('Coach requests overrode')
  );
  if (coachPattern && coachPattern.confidence >= MIN_CONFIDENCE_FOR_SUGGESTION) {
    // Suggest increasing coach request weight
    const increase = Math.round(coachPattern.percentage / 2);
    const newWeight = Math.min(currentConfig.coachRequestWeight + increase, 100);

    if (newWeight !== currentConfig.coachRequestWeight) {
      suggestions.push({
        weightKey: 'coachRequestWeight',
        currentValue: currentConfig.coachRequestWeight,
        suggestedValue: newWeight,
        reason: `Coach requests were prioritized in ${coachPattern.count} corrections`,
        confidence: coachPattern.confidence,
      });
    }
  }

  // Look for friend request priority pattern
  const friendPattern = patterns.find(p =>
    p.description.includes('Friend requests overrode')
  );
  if (friendPattern && friendPattern.confidence >= MIN_CONFIDENCE_FOR_SUGGESTION) {
    // Suggest increasing two-way and one-way teammate weights
    const increase = Math.round(friendPattern.percentage / 2);

    const newTwoWay = Math.min(currentConfig.twoWayTeammateWeight + increase, 150);
    if (newTwoWay !== currentConfig.twoWayTeammateWeight) {
      suggestions.push({
        weightKey: 'twoWayTeammateWeight',
        currentValue: currentConfig.twoWayTeammateWeight,
        suggestedValue: newTwoWay,
        reason: `Friend requests were prioritized in ${friendPattern.count} corrections`,
        confidence: friendPattern.confidence,
      });
    }

    const newOneWay = Math.min(currentConfig.oneWayTeammateWeight + Math.round(increase * 0.7), 100);
    if (newOneWay !== currentConfig.oneWayTeammateWeight) {
      suggestions.push({
        weightKey: 'oneWayTeammateWeight',
        currentValue: currentConfig.oneWayTeammateWeight,
        suggestedValue: newOneWay,
        reason: `Friend requests were prioritized in ${friendPattern.count} corrections`,
        confidence: friendPattern.confidence * 0.9,
      });
    }
  }

  // Look for balance priority pattern (suggests reducing request weights)
  const balancePattern = patterns.find(p =>
    p.description.includes('Team balance overrode requests')
  );
  if (balancePattern && balancePattern.confidence >= MIN_CONFIDENCE_FOR_SUGGESTION) {
    // Suggest decreasing request weights to favor balance
    const decrease = Math.round(balancePattern.percentage / 3);

    const newCoachWeight = Math.max(currentConfig.coachRequestWeight - decrease, 10);
    if (newCoachWeight !== currentConfig.coachRequestWeight) {
      suggestions.push({
        weightKey: 'coachRequestWeight',
        currentValue: currentConfig.coachRequestWeight,
        suggestedValue: newCoachWeight,
        reason: `Balance was prioritized over requests in ${balancePattern.count} corrections`,
        confidence: balancePattern.confidence,
      });
    }
  }

  return suggestions.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Format a human-readable summary of correction analysis.
 */
export function formatCorrectionSummary(analysis: CorrectionAnalysis): string {
  if (analysis.totalCorrections === 0) {
    return 'No corrections recorded yet.';
  }

  if (analysis.totalCorrections < MIN_CORRECTIONS_FOR_PATTERN) {
    return `${analysis.totalCorrections} correction${analysis.totalCorrections === 1 ? '' : 's'} recorded. Make ${MIN_CORRECTIONS_FOR_PATTERN - analysis.totalCorrections} more to see pattern suggestions.`;
  }

  const lines: string[] = [];
  lines.push(`Analyzed ${analysis.totalCorrections} corrections:`);

  for (const pattern of analysis.patterns) {
    lines.push(`  - ${pattern.description}`);
  }

  if (analysis.suggestedWeights.length > 0) {
    lines.push('');
    lines.push('Suggested weight adjustments:');
    for (const suggestion of analysis.suggestedWeights) {
      lines.push(`  - ${suggestion.weightKey}: ${suggestion.currentValue} -> ${suggestion.suggestedValue} (${suggestion.reason})`);
    }
  }

  return lines.join('\n');
}

/**
 * Apply suggested weights to a config, returning a new config.
 */
export function applyWeightSuggestions(
  currentConfig: RequestsFirstConfig,
  suggestions: WeightSuggestion[]
): RequestsFirstConfig {
  const newConfig = { ...currentConfig };

  for (const suggestion of suggestions) {
    const key = suggestion.weightKey;
    if (key in newConfig) {
      // Only update numeric weight keys
      if (typeof newConfig[key] === 'number') {
        (newConfig as unknown as Record<string, number>)[key] = suggestion.suggestedValue;
      }
    }
  }

  return newConfig;
}
