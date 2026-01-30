import { useFormContext, useFieldArray } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';
import type { TemplateFormData } from '../../schemas/evaluationTemplate';
import type { CoachCategoryType } from '../../types';

const DEFAULT_PHYSICAL_ANCHORS: Record<string, string> = {
  '1': 'Below expectations',
  '2': 'Needs improvement',
  '3': 'Meets expectations',
  '4': 'Above expectations',
  '5': 'Exceptional',
};

const DEFAULT_SOFT_ANCHORS: Record<string, string> = {
  '1': 'Rarely demonstrates',
  '2': 'Occasionally demonstrates',
  '3': 'Consistently demonstrates',
  '4': 'Frequently demonstrates',
  '5': 'Exemplary',
};

/**
 * Editor for the coach review categories section.
 * Supports physical and soft skill types with 1-5 anchor editing.
 */
export function CoachCategoryEditor() {
  const { register, formState: { errors } } = useFormContext<TemplateFormData>();

  const { fields, append, remove } = useFieldArray<TemplateFormData>({
    name: 'coachCategories',
  });

  const categoryErrors = errors.coachCategories;

  const handleAddCategory = (type: CoachCategoryType) => {
    const anchors = type === 'physical' ? { ...DEFAULT_PHYSICAL_ANCHORS } : { ...DEFAULT_SOFT_ANCHORS };
    append({
      id: crypto.randomUUID(),
      name: '',
      type,
      min: 1,
      max: 5,
      anchors,
    });
  };

  // Group fields by type for display
  const physicalFields = fields.map((f, i) => ({ field: f, index: i })).filter(
    (item) => (item.field as { type: string }).type === 'physical'
  );
  const softFields = fields.map((f, i) => ({ field: f, index: i })).filter(
    (item) => (item.field as { type: string }).type === 'soft'
  );

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        Coach Review Categories
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Categories that coaches rate players on (1-5 scale). Physical skills cover athletic ability;
        soft skills cover attitude and intangibles.
      </p>

      {/* Physical Skills */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
            Physical
          </span>
          <span className="text-sm text-gray-400 dark:text-gray-500">
            {physicalFields.length} categor{physicalFields.length !== 1 ? 'ies' : 'y'}
          </span>
        </div>

        <div className="space-y-3">
          {physicalFields.map(({ field, index }) => (
            <CategoryCard
              key={field.id}
              index={index}
              type="physical"
              onRemove={() => remove(index)}
              register={register}
              errors={categoryErrors?.[index]}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => handleAddCategory('physical')}
          className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Physical Skill
        </button>
      </div>

      {/* Soft Skills */}
      <div className="pt-2">
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
            Soft
          </span>
          <span className="text-sm text-gray-400 dark:text-gray-500">
            {softFields.length} categor{softFields.length !== 1 ? 'ies' : 'y'}
          </span>
        </div>

        <div className="space-y-3">
          {softFields.map(({ field, index }) => (
            <CategoryCard
              key={field.id}
              index={index}
              type="soft"
              onRemove={() => remove(index)}
              register={register}
              errors={categoryErrors?.[index]}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => handleAddCategory('soft')}
          className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-sm text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-md transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Soft Skill
        </button>
      </div>
    </div>
  );
}

// ---- Internal CategoryCard component ----

interface CategoryCardProps {
  index: number;
  type: CoachCategoryType;
  onRemove: () => void;
  register: ReturnType<typeof useFormContext<TemplateFormData>>['register'];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errors?: any;
}

function CategoryCard({ index, type, onRemove, register, errors }: CategoryCardProps) {
  const borderColor = type === 'physical'
    ? 'border-blue-200 dark:border-blue-800'
    : 'border-purple-200 dark:border-purple-800';
  const bgColor = type === 'physical'
    ? 'bg-blue-50/50 dark:bg-blue-900/10'
    : 'bg-purple-50/50 dark:bg-purple-900/10';

  const anchorKeys = [1, 2, 3, 4, 5];

  return (
    <div className={`border ${borderColor} ${bgColor} rounded-lg p-3`}>
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Category Name
          </label>
          <input
            {...register(`coachCategories.${index}.name`)}
            type="text"
            placeholder={type === 'physical' ? 'e.g. Fielding' : 'e.g. Baseball IQ'}
            className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          {errors?.name && (
            <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">{errors.name.message}</p>
          )}
        </div>

        {/* Type badge (read-only indicator) */}
        <span className={`mt-5 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
          type === 'physical'
            ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
            : 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
        }`}>
          {type}
        </span>

        <button
          type="button"
          onClick={onRemove}
          className="mt-4 p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
          title="Remove category"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Anchors (1-5) */}
      <div className="mt-3">
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
          Rating Anchors (1-5)
        </label>
        <div className="space-y-1.5">
          {anchorKeys.map((key) => (
            <div key={key} className="flex items-center gap-2">
              <span className="w-7 text-center text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded px-1.5 py-0.5">
                {key}
              </span>
              <input
                {...register(`coachCategories.${index}.anchors.${key}`)}
                type="text"
                placeholder={`Description for level ${key}`}
                className="flex-1 px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
