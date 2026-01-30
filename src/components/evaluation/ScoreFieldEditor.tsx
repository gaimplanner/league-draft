import { useFormContext, Controller } from 'react-hook-form';
import { Trash2 } from 'lucide-react';
import type { TemplateFormData } from '../../schemas/evaluationTemplate';

interface ScoreFieldEditorProps {
  nestIndex: number;   // station index
  fieldIndex: number;  // field index within station
  onRemove: () => void;
}

/**
 * Editor for a single score field within a station.
 * Supports scale (with anchors), time (with unit, lowerIsBetter), and count types.
 */
export function ScoreFieldEditor({ nestIndex, fieldIndex, onRemove }: ScoreFieldEditorProps) {
  const { register, watch, control, formState: { errors } } = useFormContext<TemplateFormData>();

  const fieldType = watch(`stations.${nestIndex}.fields.${fieldIndex}.type`);
  const fieldMin = watch(`stations.${nestIndex}.fields.${fieldIndex}.min`);
  const fieldMax = watch(`stations.${nestIndex}.fields.${fieldIndex}.max`);

  // Get nested errors safely
  const fieldErrors = errors.stations?.[nestIndex]?.fields?.[fieldIndex];

  // Generate anchor keys for scale type based on min/max
  const anchorKeys: number[] = [];
  if (fieldType === 'scale' && typeof fieldMin === 'number' && typeof fieldMax === 'number') {
    for (let i = fieldMin; i <= fieldMax; i++) {
      anchorKeys.push(i);
    }
  }

  return (
    <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 bg-gray-50 dark:bg-gray-800/50">
      <div className="flex items-start gap-3">
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* Field Name */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Field Name
            </label>
            <input
              {...register(`stations.${nestIndex}.fields.${fieldIndex}.name`)}
              type="text"
              placeholder="e.g. Ground Balls"
              className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {fieldErrors?.name && (
              <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">{fieldErrors.name.message}</p>
            )}
          </div>

          {/* Type */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Type
            </label>
            <select
              {...register(`stations.${nestIndex}.fields.${fieldIndex}.type`)}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="scale">Scale</option>
              <option value="time">Time</option>
              <option value="count">Count</option>
            </select>
          </div>

          {/* Min / Max */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Min
              </label>
              <input
                {...register(`stations.${nestIndex}.fields.${fieldIndex}.min`, { valueAsNumber: true })}
                type="number"
                className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Max
              </label>
              <input
                {...register(`stations.${nestIndex}.fields.${fieldIndex}.max`, { valueAsNumber: true })}
                type="number"
                className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {fieldErrors?.max && (
                <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">{fieldErrors.max.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Remove button */}
        <button
          type="button"
          onClick={onRemove}
          className="mt-5 p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
          title="Remove field"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Description (optional) */}
      <div className="mt-2">
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
          Description (optional)
        </label>
        <input
          {...register(`stations.${nestIndex}.fields.${fieldIndex}.description`)}
          type="text"
          placeholder="Brief description of what is being measured"
          className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Conditional fields based on type */}
      {fieldType === 'time' && (
        <div className="mt-2 flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Unit
            </label>
            <input
              {...register(`stations.${nestIndex}.fields.${fieldIndex}.unit`)}
              type="text"
              placeholder="seconds"
              defaultValue="seconds"
              className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex items-center gap-2 pt-4">
            <Controller
              name={`stations.${nestIndex}.fields.${fieldIndex}.lowerIsBetter`}
              control={control}
              render={({ field }) => (
                <input
                  type="checkbox"
                  checked={field.value ?? true}
                  onChange={(e) => field.onChange(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                />
              )}
            />
            <label className="text-xs text-gray-600 dark:text-gray-400">
              Lower is better
            </label>
          </div>
        </div>
      )}

      {fieldType === 'scale' && anchorKeys.length > 0 && (
        <div className="mt-3">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
            Scale Anchors
          </label>
          <div className="space-y-1.5">
            {anchorKeys.map((key) => (
              <div key={key} className="flex items-center gap-2">
                <span className="w-8 text-center text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded px-1.5 py-0.5">
                  {key}
                </span>
                <input
                  {...register(`stations.${nestIndex}.fields.${fieldIndex}.anchors.${key}`)}
                  type="text"
                  placeholder={`Description for level ${key}`}
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
