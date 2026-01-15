import { RotateCcw, AlertCircle, CheckCircle } from 'lucide-react';
import { FieldWeight, EvaluationCategory, getCategoryDisplayName } from '../../types/evaluation';

interface FieldWeightSlidersProps {
  weights: FieldWeight[];
  totalWeight: number;
  onWeightChange: (fieldId: string, weight: number) => void;
  onToggleField: (fieldId: string, enabled: boolean) => void;
  onReset: () => void;
  onContinue: () => void;
  onBack: () => void;
}

const CATEGORY_ORDER: EvaluationCategory[] = ['pitching', 'hitting', 'fielding', 'flyBalls', 'baserunning'];

export function FieldWeightSliders({
  weights,
  totalWeight,
  onWeightChange,
  onToggleField,
  onReset,
  onContinue,
  onBack,
}: FieldWeightSlidersProps) {
  const isValid = totalWeight === 100;

  // Group fields by category
  const fieldsByCategory = CATEGORY_ORDER.map((category) => ({
    category,
    fields: weights.filter((w) => w.category === category),
    categoryTotal: weights
      .filter((w) => w.category === category && w.enabled)
      .reduce((sum, w) => sum + w.weight, 0),
  }));

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Field Weights
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Adjust how much each evaluation field contributes to the total score
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 mb-6">
        {/* Field Weights by Category */}
        <div className="space-y-6">
          {fieldsByCategory.map(({ category, fields, categoryTotal }) => (
            <div key={category}>
              {/* Category Header */}
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {getCategoryDisplayName(category)}
                </h3>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {categoryTotal}%
                </span>
              </div>

              {/* Fields in this Category */}
              <div className="space-y-4 pl-2">
                {fields.map((field) => (
                  <div key={field.fieldId} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={field.enabled}
                          onChange={(e) => onToggleField(field.fieldId, e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-green-500 focus:ring-green-500"
                        />
                        <label
                          className={`text-sm ${
                            field.enabled
                              ? 'text-gray-700 dark:text-gray-300'
                              : 'text-gray-400 dark:text-gray-500'
                          }`}
                        >
                          {field.displayName}
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={field.weight}
                          onChange={(e) =>
                            onWeightChange(field.fieldId, Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))
                          }
                          disabled={!field.enabled}
                          className="w-14 px-2 py-1 text-right text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                        />
                        <span className="text-gray-500 text-sm">%</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-4" /> {/* Spacer for checkbox alignment */}
                      <input
                        type="range"
                        min="0"
                        max="50"
                        value={field.weight}
                        onChange={(e) => onWeightChange(field.fieldId, parseInt(e.target.value))}
                        disabled={!field.enabled}
                        className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                        style={{
                          background: field.enabled
                            ? `linear-gradient(to right, #22c55e 0%, #22c55e ${field.weight * 2}%, #e5e7eb ${field.weight * 2}%, #e5e7eb 100%)`
                            : undefined,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <span className="font-medium text-gray-700 dark:text-gray-300">Total</span>
            <div className="flex items-center gap-2">
              <span
                className={`text-lg font-bold ${
                  isValid ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {totalWeight}%
              </span>
              {isValid ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-500" />
              )}
            </div>
          </div>
          {!isValid && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              Weights must sum to exactly 100%
            </p>
          )}
        </div>

        {/* Reset Button */}
        <div className="mt-4 flex justify-end">
          <button
            onClick={onReset}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          >
            <RotateCcw className="w-4 h-4" />
            Reset to Defaults
          </button>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          <strong>Default weights:</strong> Pitching 30% (Form 18%, Arm 12%), Hitting 25% (Form 12%,
          Contact 10%, Hits 3%), Fielding 20%, Fly Balls 15%, Baserunning 10%
        </p>
        <p className="text-sm text-blue-700 dark:text-blue-300 mt-2">
          Scores are normalized to 0-100 scale before weighting. Disable a field to exclude it
          from the total (remaining weights will be redistributed).
        </p>
      </div>

      {/* Actions */}
      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
        >
          ← Back
        </button>
        <button
          onClick={onContinue}
          disabled={!isValid}
          className="px-6 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
        >
          Preview Players →
        </button>
      </div>
    </div>
  );
}
