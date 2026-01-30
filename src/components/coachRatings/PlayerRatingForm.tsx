import { useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Save, Send, CheckCircle } from 'lucide-react';
import type { CoachRating, CoachCategoryDefinition } from '../../types';
import { buildRatingSchema } from '../../schemas/coachRating';
import { RatingInput } from './RatingInput';

interface PlayerRatingFormProps {
  rating: CoachRating;
  coachCategories: CoachCategoryDefinition[];
  onSaveDraft: (scores: Record<string, number>) => Promise<void>;
  onSubmit: (ratingId: string) => Promise<void>;
  onBack: () => void;
  isSaving?: boolean;
}

export function PlayerRatingForm({
  rating,
  coachCategories,
  onSaveDraft,
  onSubmit,
  onBack,
  isSaving = false,
}: PlayerRatingFormProps) {
  const isSubmitted = rating.status === 'submitted';

  const physicalCategories = useMemo(
    () => coachCategories.filter(c => c.type === 'physical'),
    [coachCategories]
  );
  const softCategories = useMemo(
    () => coachCategories.filter(c => c.type === 'soft'),
    [coachCategories]
  );

  // For draft save: all fields optional. For submit: all required.
  const schema = useMemo(
    () => buildRatingSchema(coachCategories, false),
    [coachCategories]
  );

  const { watch, setValue, handleSubmit, formState: { isDirty } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: rating.scores || {},
  });

  const rawScores = watch();
  // Cast to record since the dynamic schema produces generic types
  const scores = rawScores as Record<string, number | undefined>;

  const handleScoreChange = useCallback((categoryId: string, value: number) => {
    setValue(categoryId, value, { shouldDirty: true });
  }, [setValue]);

  const handleDraftSave = useCallback(async () => {
    // Save whatever scores exist (partial is OK for drafts)
    const currentScores: Record<string, number> = {};
    for (const cat of coachCategories) {
      const val = scores[cat.id];
      if (val !== undefined && val !== null) {
        currentScores[cat.id] = val;
      }
    }
    await onSaveDraft(currentScores);
  }, [scores, coachCategories, onSaveDraft]);

  const handleFormSubmit = handleSubmit(async () => {
    // First save current scores, then submit
    const currentScores: Record<string, number> = {};
    for (const cat of coachCategories) {
      const val = scores[cat.id];
      if (val !== undefined && val !== null) {
        currentScores[cat.id] = val;
      }
    }
    await onSaveDraft(currentScores);
    await onSubmit(rating.id);
  });

  // Check if all categories have scores (for enabling submit button)
  const allScored = coachCategories.every(cat => {
    const val = scores[cat.id];
    return val !== undefined && val !== null;
  });

  const renderCategoryGroup = (title: string, categories: CoachCategoryDefinition[]) => {
    if (categories.length === 0) return null;
    return (
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
          {title}
        </h3>
        <div className="space-y-1">
          {categories.map(cat => (
            <RatingInput
              key={cat.id}
              category={cat}
              value={scores[cat.id]}
              onChange={(val) => handleScoreChange(cat.id, val)}
              disabled={isSubmitted}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {rating.playerFirstName} {rating.playerLastName}
            </h2>
            {isSubmitted && (
              <span className="inline-flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                <CheckCircle className="w-4 h-4" />
                Submitted
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Rating Form */}
      <form onSubmit={handleFormSubmit}>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          {renderCategoryGroup('Physical Skills', physicalCategories)}
          {renderCategoryGroup('Soft Skills', softCategories)}
        </div>

        {/* Actions */}
        {!isSubmitted && (
          <div className="flex items-center justify-end gap-3 mt-4">
            <button
              type="button"
              onClick={handleDraftSave}
              disabled={isSaving || !isDirty}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save className="w-4 h-4" />
              Save Draft
            </button>
            <button
              type="submit"
              disabled={isSaving || !allScored}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title={!allScored ? 'All categories must be scored before submitting' : ''}
            >
              <Send className="w-4 h-4" />
              Submit Rating
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
