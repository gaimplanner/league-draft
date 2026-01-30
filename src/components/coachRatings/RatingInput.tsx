import type { CoachCategoryDefinition } from '../../types';

interface RatingInputProps {
  category: CoachCategoryDefinition;
  value: number | undefined;
  onChange: (value: number) => void;
  disabled?: boolean;
}

/**
 * 1-N rating input with radio buttons and optional anchor labels.
 * Renders a row: category name | [1] [2] [3] [4] [5] buttons
 */
export function RatingInput({ category, value, onChange, disabled }: RatingInputProps) {
  const buttons: number[] = [];
  for (let i = category.min; i <= category.max; i++) {
    buttons.push(i);
  }

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-40 flex-shrink-0">
        <span className="text-sm font-medium text-gray-900 dark:text-white">
          {category.name}
        </span>
      </div>
      <div className="flex gap-1.5">
        {buttons.map(num => {
          const isSelected = value === num;
          const anchor = category.anchors?.[String(num)];
          return (
            <button
              key={num}
              type="button"
              disabled={disabled}
              onClick={() => onChange(num)}
              title={anchor || `${num}`}
              className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {num}
            </button>
          );
        })}
      </div>
      {/* Show anchor text for selected value */}
      {value !== undefined && category.anchors?.[String(value)] && (
        <span className="text-xs text-gray-500 dark:text-gray-400 italic ml-1">
          {category.anchors[String(value)]}
        </span>
      )}
    </div>
  );
}
