import { Settings, RotateCcw, AlertCircle, CheckCircle } from 'lucide-react';
import { ScoringWeights } from '../types';

interface ScoringWeightsConfigProps {
  weights: ScoringWeights;
  onUpdateWeight: (category: keyof ScoringWeights, field: string, value: number) => void;
  onReset: () => void;
  validation: { isValid: boolean; total: number };
}

export const ScoringWeightsConfig = ({
  weights,
  onUpdateWeight,
  onReset,
  validation,
}: ScoringWeightsConfigProps) => {
  const handleInputChange = (
    category: keyof ScoringWeights,
    field: string,
    value: string
  ) => {
    const numValue = parseFloat(value) || 0;
    onUpdateWeight(category, field, numValue);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Scoring Weights Configuration
          </h2>
        </div>
        <button
          onClick={onReset}
          className="px-3 py-2 text-sm bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg flex items-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          Reset to Defaults
        </button>
      </div>

      {/* Validation Banner */}
      <div
        className={`mb-4 p-3 rounded-lg flex items-center gap-3 ${
          validation.isValid
            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
        }`}
      >
        {validation.isValid ? (
          <>
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
            <div className="text-sm">
              <span className="font-semibold text-green-800 dark:text-green-200">
                Valid: Total = 100.0%
              </span>
            </div>
          </>
        ) : (
          <>
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
            <div className="text-sm">
              <span className="font-semibold text-red-800 dark:text-red-200">
                Invalid: Total = {validation.total.toFixed(1)}%
              </span>
              <span className="text-red-700 dark:text-red-300 ml-2">
                (must equal 100%)
              </span>
            </div>
          </>
        )}
      </div>

      {/* Weights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Fielding */}
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Fielding (Total: {(weights.fielding.field + weights.fielding.throw).toFixed(1)}%)
          </h3>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
              Field Score
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={weights.fielding.field}
                onChange={(e) => handleInputChange('fielding', 'field', e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <span className="text-gray-600 dark:text-gray-400">%</span>
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
              Throw Score
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={weights.fielding.throw}
                onChange={(e) => handleInputChange('fielding', 'throw', e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <span className="text-gray-600 dark:text-gray-400">%</span>
            </div>
          </div>
        </div>

        {/* Hitting */}
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Hitting (Total: {(weights.hitting.power + weights.hitting.form + weights.hitting.contact).toFixed(1)}%)
          </h3>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
              Hit Power
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={weights.hitting.power}
                onChange={(e) => handleInputChange('hitting', 'power', e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <span className="text-gray-600 dark:text-gray-400">%</span>
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
              Hit Form
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={weights.hitting.form}
                onChange={(e) => handleInputChange('hitting', 'form', e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <span className="text-gray-600 dark:text-gray-400">%</span>
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
              Hit Contact
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={weights.hitting.contact}
                onChange={(e) => handleInputChange('hitting', 'contact', e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <span className="text-gray-600 dark:text-gray-400">%</span>
            </div>
          </div>
        </div>

        {/* Pitching */}
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Pitching (Total: {(weights.pitching.strength + weights.pitching.form).toFixed(1)}%)
          </h3>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
              Pitching Strength
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={weights.pitching.strength}
                onChange={(e) => handleInputChange('pitching', 'strength', e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <span className="text-gray-600 dark:text-gray-400">%</span>
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
              Pitching Form
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={weights.pitching.form}
                onChange={(e) => handleInputChange('pitching', 'form', e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <span className="text-gray-600 dark:text-gray-400">%</span>
            </div>
          </div>
        </div>

        {/* Catching & Running */}
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Other Skills (Total: {(weights.catching + weights.running).toFixed(1)}%)
          </h3>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
              Catching
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={weights.catching}
                onChange={(e) => handleInputChange('catching', 'catching', e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <span className="text-gray-600 dark:text-gray-400">%</span>
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
              Base Running
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={weights.running}
                onChange={(e) => handleInputChange('running', 'running', e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <span className="text-gray-600 dark:text-gray-400">%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Help Text */}
      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          <strong>Note:</strong> Adjusting weights will automatically recalculate all player scores
          and rankings. The sum of all weights must equal 100%.
        </p>
      </div>
    </div>
  );
};
