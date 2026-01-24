import { useMemo } from 'react';
import { TrendingUp, Lightbulb, Check, ArrowRight } from 'lucide-react';
import { AssignmentCorrection, RequestsFirstConfig, CorrectionReason } from '../../types';
import { analyzeCorrections, applyWeightSuggestions } from '../../utils/correctionAnalysis';

interface CorrectionSummaryProps {
  corrections: AssignmentCorrection[];
  config: RequestsFirstConfig;
  onApplySuggestions?: (newConfig: RequestsFirstConfig) => void;
}

const REASON_LABELS: Record<CorrectionReason, { label: string; color: string }> = {
  'coach-request-priority': { label: 'Coach Request', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  'friend-request-priority': { label: 'Friend Request', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  'balance-override': { label: 'Balance', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  'sibling-issue': { label: 'Sibling', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  'other': { label: 'Other', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
};

const MIN_CORRECTIONS_FOR_PATTERNS = 3;

/**
 * Displays a summary of user corrections with detected patterns
 * and weight adjustment suggestions.
 */
export const CorrectionSummary = ({
  corrections,
  config,
  onApplySuggestions,
}: CorrectionSummaryProps) => {
  const analysis = useMemo(
    () => analyzeCorrections(corrections, config),
    [corrections, config]
  );

  // Don't show anything if no corrections
  if (corrections.length === 0) {
    return null;
  }

  const needsMoreData = corrections.length < MIN_CORRECTIONS_FOR_PATTERNS;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Learning from Your Corrections
          </h3>
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {corrections.length} correction{corrections.length === 1 ? '' : 's'} recorded
        </span>
      </div>

      {/* Correction breakdown by reason */}
      <div className="mb-4">
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Correction Types
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.entries(analysis.correctionsByReason) as [CorrectionReason, number][])
            .filter(([_, count]) => count > 0)
            .sort(([_, a], [__, b]) => b - a)
            .map(([reason, count]) => {
              const { label, color } = REASON_LABELS[reason];
              const percent = Math.round((count / analysis.totalCorrections) * 100);
              return (
                <span
                  key={reason}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${color}`}
                >
                  {label}
                  <span className="opacity-70">
                    {count} ({percent}%)
                  </span>
                </span>
              );
            })}
        </div>
      </div>

      {/* Needs more data message */}
      {needsMoreData && (
        <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
          Make {MIN_CORRECTIONS_FOR_PATTERNS - corrections.length} more correction{MIN_CORRECTIONS_FOR_PATTERNS - corrections.length === 1 ? '' : 's'} to see pattern analysis and weight suggestions.
        </div>
      )}

      {/* Detected patterns */}
      {!needsMoreData && analysis.patterns.length > 0 && (
        <div className="mb-4">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
            <Lightbulb className="w-4 h-4" />
            Detected Patterns
          </div>
          <div className="space-y-2">
            {analysis.patterns.map((pattern, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-2"
              >
                <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                <span>{pattern.description}</span>
                <span className="ml-auto text-xs text-gray-400">
                  {Math.round(pattern.confidence * 100)}% confidence
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weight suggestions */}
      {!needsMoreData && analysis.suggestedWeights.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Suggested Weight Adjustments
          </div>
          <div className="space-y-2 mb-4">
            {analysis.suggestedWeights.map((suggestion, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                    {suggestion.weightKey.replace(/Weight$/, '').replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                  <div className="flex items-center gap-1 text-sm">
                    <span className="text-gray-500">{suggestion.currentValue}</span>
                    <ArrowRight className="w-3 h-3 text-gray-400" />
                    <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                      {suggestion.suggestedValue}
                    </span>
                  </div>
                </div>
                <span className="text-xs text-gray-400">
                  +{suggestion.suggestedValue - suggestion.currentValue}
                </span>
              </div>
            ))}
          </div>

          {onApplySuggestions && (
            <button
              onClick={() => {
                const newConfig = applyWeightSuggestions(config, analysis.suggestedWeights);
                onApplySuggestions(newConfig);
              }}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              Apply Suggested Weights & Re-run
            </button>
          )}
        </div>
      )}

      {/* No patterns detected */}
      {!needsMoreData && analysis.patterns.length === 0 && (
        <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
          No clear patterns detected yet. Continue making corrections to help the algorithm learn your preferences.
        </div>
      )}
    </div>
  );
};
