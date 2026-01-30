import { useFormContext, Controller } from 'react-hook-form';
import type { TemplateFormData } from '../../schemas/evaluationTemplate';

/**
 * Linked blend weight sliders for Coach Rating and Tryout Score.
 * The two values always sum to 100 (see-saw behavior).
 */
export function BlendWeightsEditor() {
  const { control, setValue, formState: { errors } } = useFormContext<TemplateFormData>();

  const blendErrors = errors.blendWeights;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        Blend Weights
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        How much each source contributes to the final composite score. Values must sum to 100%.
      </p>

      {/* Root-level blend weights error (sum !== 100) */}
      {blendErrors?.root && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {blendErrors.root.message}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Coach Rating slider */}
        <div>
          <Controller
            name="blendWeights.coachRating"
            control={control}
            render={({ field }) => (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Coach Rating
                  </label>
                  <span className="text-2xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                    {field.value}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={field.value}
                  onChange={(e) => {
                    const coachValue = Number(e.target.value);
                    field.onChange(coachValue);
                    setValue('blendWeights.tryoutScore', 100 - coachValue, {
                      shouldValidate: true,
                    });
                  }}
                  className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>
            )}
          />
          {blendErrors?.coachRating && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {blendErrors.coachRating.message}
            </p>
          )}
        </div>

        {/* Tryout Score slider */}
        <div>
          <Controller
            name="blendWeights.tryoutScore"
            control={control}
            render={({ field }) => (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Tryout Score
                  </label>
                  <span className="text-2xl font-bold text-green-600 dark:text-green-400 tabular-nums">
                    {field.value}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={field.value}
                  onChange={(e) => {
                    const tryoutValue = Number(e.target.value);
                    field.onChange(tryoutValue);
                    setValue('blendWeights.coachRating', 100 - tryoutValue, {
                      shouldValidate: true,
                    });
                  }}
                  className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-green-600"
                />
                <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>
            )}
          />
          {blendErrors?.tryoutScore && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {blendErrors.tryoutScore.message}
            </p>
          )}
        </div>
      </div>

      {/* Visual bar showing the split */}
      <Controller
        name="blendWeights.coachRating"
        control={control}
        render={({ field }) => (
          <div className="flex h-3 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700">
            <div
              className="bg-blue-500 transition-all duration-150"
              style={{ width: `${field.value}%` }}
            />
            <div
              className="bg-green-500 transition-all duration-150"
              style={{ width: `${100 - field.value}%` }}
            />
          </div>
        )}
      />
    </div>
  );
}
