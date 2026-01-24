interface WeightSliderProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  suggestedValue?: number;
  onChange: (value: number) => void;
  description?: string;
}

/**
 * A slider component for adjusting algorithm weights.
 * Shows a marker for suggested value when pattern analysis
 * indicates an adjustment.
 */
export const WeightSlider = ({
  label,
  value,
  min = 0,
  max = 100,
  step = 5,
  suggestedValue,
  onChange,
  description,
}: WeightSliderProps) => {
  const hasSuggestion = suggestedValue !== undefined && suggestedValue !== value;

  // Calculate percentage position for suggested marker
  const suggestedPercent = suggestedValue !== undefined
    ? ((suggestedValue - min) / (max - min)) * 100
    : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {value}
          </span>
          {hasSuggestion && (
            <span className="text-xs text-indigo-600 dark:text-indigo-400">
              (suggested: {suggestedValue})
            </span>
          )}
        </div>
      </div>

      <div className="relative">
        {/* Slider track */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />

        {/* Suggested value marker */}
        {hasSuggestion && (
          <div
            className="absolute top-0 w-1 h-2 bg-indigo-500 rounded-full pointer-events-none"
            style={{ left: `${suggestedPercent}%`, transform: 'translateX(-50%)' }}
          />
        )}
      </div>

      {description && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {description}
        </p>
      )}

      {/* Apply suggestion button */}
      {hasSuggestion && (
        <button
          onClick={() => onChange(suggestedValue!)}
          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          Apply suggested value
        </button>
      )}
    </div>
  );
};
