import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { CompositeWeights, EvaluationTemplate } from '../../types';

interface WeightConfigPanelProps {
  weights: CompositeWeights;
  template: EvaluationTemplate;
  onChange: (weights: CompositeWeights) => void;
}

/**
 * Weight configuration panel for composite scoring.
 * Shows linked coach/tryout slider and expandable station weights.
 */
export function WeightConfigPanel({
  weights,
  template,
  onChange,
}: WeightConfigPanelProps) {
  const [coachWeight, setCoachWeight] = useState(weights.coachRating);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [stationWeights, setStationWeights] = useState<Record<string, number>>(
    weights.stationWeights || {}
  );
  const [customizeStations, setCustomizeStations] = useState(
    !!weights.stationWeights && Object.keys(weights.stationWeights).length > 0
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  // Debounced onChange handler (150ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      const newWeights: CompositeWeights = {
        coachRating: coachWeight,
        tryoutScore: 100 - coachWeight,
        stationWeights: customizeStations ? stationWeights : undefined,
      };
      onChange(newWeights);
    }, 150);

    return () => clearTimeout(timer);
  }, [coachWeight, stationWeights, customizeStations, onChange]);

  const handleCoachWeightChange = (value: number) => {
    setCoachWeight(value);
  };

  const handleStationWeightChange = (stationId: string, value: number) => {
    setStationWeights(prev => ({ ...prev, [stationId]: value }));
  };

  const enableCustomStations = () => {
    // Initialize equal weights
    const equalWeight = Math.floor(100 / template.stations.length);
    const remainder = 100 - (equalWeight * template.stations.length);
    const initial: Record<string, number> = {};
    template.stations.forEach((station, i) => {
      initial[station.id] = equalWeight + (i === 0 ? remainder : 0);
    });
    setStationWeights(initial);
    setCustomizeStations(true);
  };

  // Validate station weights sum to 100
  useEffect(() => {
    if (customizeStations) {
      const sum = Object.values(stationWeights).reduce((a, b) => a + b, 0);
      if (Math.abs(sum - 100) > 0.01) {
        setValidationError(`Station weights must sum to 100 (current: ${sum.toFixed(1)})`);
      } else {
        setValidationError(null);
      }
    } else {
      setValidationError(null);
    }
  }, [stationWeights, customizeStations]);

  const tryoutWeight = 100 - coachWeight;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Blend Weights
      </h3>

      {/* Top-level linked slider */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Coach Rating
          </span>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Tryout Score
          </span>
        </div>

        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={coachWeight}
          onChange={(e) => handleCoachWeightChange(Number(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-blue-600"
        />

        <div className="text-center mt-2 text-sm font-medium text-gray-900 dark:text-white">
          {coachWeight}% Coach / {tryoutWeight}% Tryout
        </div>
      </div>

      {/* Advanced panel toggle */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
      >
        {showAdvanced ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
        Station Weights (Advanced)
      </button>

      {/* Advanced station weights panel */}
      {showAdvanced && (
        <div className="mt-4 pl-6 border-l-2 border-gray-200 dark:border-gray-700">
          {!customizeStations ? (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Equal weights (default)
              </span>
              <button
                onClick={enableCustomStations}
                className="px-3 py-1 text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
              >
                Customize
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {template.stations.map((station) => (
                <div key={station.id}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {station.name}
                    </label>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {stationWeights[station.id] || 0}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={stationWeights[station.id] || 0}
                    onChange={(e) =>
                      handleStationWeightChange(station.id, Number(e.target.value))
                    }
                    className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-blue-500"
                  />
                </div>
              ))}

              {validationError && (
                <div className="text-sm text-red-600 dark:text-red-400 mt-2">
                  {validationError}
                </div>
              )}

              <button
                onClick={() => setCustomizeStations(false)}
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                Reset to equal weights
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
