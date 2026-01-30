import { useFormContext, useFieldArray } from 'react-hook-form';
import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import type { TemplateFormData } from '../../schemas/evaluationTemplate';
import { ScoreFieldEditor } from './ScoreFieldEditor';

interface StationEditorProps {
  stationIndex: number;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

/**
 * Editor for a single station with its nested score fields.
 * Uses useFieldArray for managing the nested fields array.
 */
export function StationEditor({ stationIndex, onRemove, onMoveUp, onMoveDown }: StationEditorProps) {
  const { register, formState: { errors } } = useFormContext<TemplateFormData>();

  const { fields, append, remove } = useFieldArray<TemplateFormData>({
    name: `stations.${stationIndex}.fields`,
  });

  const stationErrors = errors.stations?.[stationIndex];

  const handleAddField = () => {
    append({
      id: crypto.randomUUID(),
      name: '',
      type: 'scale',
      min: 1,
      max: 5,
      description: '',
    });
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
      {/* Station header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 rounded-t-lg">
        {/* Reorder buttons */}
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={!onMoveUp}
            className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Move station up"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={!onMoveDown}
            className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Move station down"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>

        {/* Station order badge */}
        <span className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-sm font-semibold">
          {stationIndex + 1}
        </span>

        {/* Station name */}
        <div className="flex-1">
          <input
            {...register(`stations.${stationIndex}.name`)}
            type="text"
            placeholder="Station name (e.g. Infield)"
            className="w-full px-3 py-1.5 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          {stationErrors?.name && (
            <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">{stationErrors.name.message}</p>
          )}
        </div>

        {/* Remove station */}
        <button
          type="button"
          onClick={onRemove}
          className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
          title="Remove station"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Score fields */}
      <div className="p-4 space-y-3">
        {fields.length === 0 && (
          <p className="text-sm text-gray-400 dark:text-gray-500 italic text-center py-2">
            No score fields yet. Add at least one.
          </p>
        )}
        {stationErrors?.fields?.root && (
          <p className="text-xs text-red-600 dark:text-red-400">{stationErrors.fields.root.message}</p>
        )}

        {/* CRITICAL: Use field.id as React key, NOT array index */}
        {fields.map((field, fieldIndex) => (
          <ScoreFieldEditor
            key={field.id}
            nestIndex={stationIndex}
            fieldIndex={fieldIndex}
            onRemove={() => remove(fieldIndex)}
          />
        ))}

        <button
          type="button"
          onClick={handleAddField}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Score Field
        </button>
      </div>
    </div>
  );
}
