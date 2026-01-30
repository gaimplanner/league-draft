import { useState } from 'react';
import { useForm, useFieldArray, FormProvider } from 'react-hook-form';
import type { Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, ChevronLeft, AlertCircle, Loader2, Sparkles } from 'lucide-react';
import { templateFormSchema, type TemplateFormData } from '../../schemas/evaluationTemplate';
import type { EvaluationTemplate } from '../../types';
import { useEvaluationTemplates } from '../../hooks/useEvaluationTemplates';
import { getStandardPreset } from './templatePresets';
import { StationEditor } from './StationEditor';
import { CoachCategoryEditor } from './CoachCategoryEditor';
import { BlendWeightsEditor } from './BlendWeightsEditor';

// zodResolver with refined schemas (ZodEffects) produces slightly different
// input/output types. Cast to align with react-hook-form's expectations.
const formResolver = zodResolver(templateFormSchema) as Resolver<TemplateFormData>;

interface TemplateEditorProps {
  existingTemplate?: EvaluationTemplate;
  onSave: (template: EvaluationTemplate) => void;
  onCancel: () => void;
}

function templateToFormData(template: EvaluationTemplate): TemplateFormData {
  return {
    name: template.name,
    description: template.description ?? '',
    stations: template.stations.map((s) => ({
      id: s.id,
      name: s.name,
      order: s.order,
      fields: s.fields.map((f) => ({
        id: f.id,
        name: f.name,
        type: f.type,
        min: f.min,
        max: f.max,
        description: f.description ?? '',
        unit: f.unit,
        lowerIsBetter: f.lowerIsBetter,
        anchors: f.anchors,
      })),
    })),
    coachCategories: template.coachCategories.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      min: c.min,
      max: c.max,
      anchors: c.anchors,
    })),
    blendWeights: {
      coachRating: template.blendWeights.coachRating,
      tryoutScore: template.blendWeights.tryoutScore,
    },
  };
}

const EMPTY_DEFAULTS: TemplateFormData = {
  name: '',
  description: '',
  stations: [],
  coachCategories: [],
  blendWeights: { coachRating: 40, tryoutScore: 60 },
};

/**
 * Main template editor form. Orchestrates all sub-components:
 * StationEditor, CoachCategoryEditor, BlendWeightsEditor.
 * Supports both create and edit modes.
 */
export function TemplateEditor({ existingTemplate, onSave, onCancel }: TemplateEditorProps) {
  const { createTemplate, updateTemplate } = useEvaluationTemplates();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const methods = useForm<TemplateFormData>({
    resolver: formResolver,
    defaultValues: existingTemplate
      ? templateToFormData(existingTemplate)
      : EMPTY_DEFAULTS,
  });

  const { register, handleSubmit, reset, formState: { errors } } = methods;

  const { fields: stationFields, append: appendStation, remove: removeStation, move: moveStation } =
    useFieldArray<TemplateFormData>({
      control: methods.control,
      name: 'stations',
    });

  const isEditing = !!existingTemplate;
  const isLocked = existingTemplate?.isLocked ?? false;

  const handleLoadPreset = () => {
    const preset = getStandardPreset();
    reset({
      name: preset.name,
      description: preset.description ?? '',
      stations: preset.stations.map((s) => ({
        id: s.id,
        name: s.name,
        order: s.order,
        fields: s.fields.map((f) => ({
          id: f.id,
          name: f.name,
          type: f.type,
          min: f.min,
          max: f.max,
          description: f.description ?? '',
          unit: f.unit,
          lowerIsBetter: f.lowerIsBetter,
          anchors: f.anchors,
        })),
      })),
      coachCategories: preset.coachCategories.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        min: c.min,
        max: c.max,
        anchors: c.anchors,
      })),
      blendWeights: preset.blendWeights,
    });
  };

  const handleAddStation = () => {
    appendStation({
      id: crypto.randomUUID(),
      name: '',
      order: stationFields.length + 1,
      fields: [
        {
          id: crypto.randomUUID(),
          name: '',
          type: 'scale',
          min: 1,
          max: 5,
          description: '',
        },
      ],
    } as TemplateFormData['stations'][number]);
  };

  const onSubmit = async (data: TemplateFormData) => {
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      // Recompute station order based on array position
      const ordered = {
        ...data,
        stations: data.stations.map((s, i) => ({ ...s, order: i + 1 })),
      };

      let result: EvaluationTemplate | null = null;

      if (isEditing && existingTemplate) {
        result = await updateTemplate(existingTemplate.id, ordered);
      } else {
        result = await createTemplate(ordered);
      }

      if (result) {
        onSave(result);
      } else {
        setSubmitError('Failed to save template. Please try again.');
      }
    } catch (err) {
      console.error('Template save error:', err);
      setSubmitError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Header / Back */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isEditing ? 'Edit Template' : 'Create Template'}
          </h2>
        </div>

        {/* Locked banner */}
        {isLocked && (
          <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <p className="text-sm text-amber-700 dark:text-amber-300">
              This template has been used for scoring. Saving will create a new version.
            </p>
          </div>
        )}

        {/* Form-level errors */}
        {submitError && (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <span className="text-sm text-red-700 dark:text-red-400">{submitError}</span>
          </div>
        )}

        {Object.keys(errors).length > 0 && (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <span className="text-sm text-red-700 dark:text-red-400">
              Please fix the validation errors below before saving.
            </span>
          </div>
        )}

        {/* Section 1: Name & Description */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Template Name
            </label>
            <input
              {...register('name')}
              type="text"
              placeholder="e.g. Standard Little League Tryout"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description (optional)
            </label>
            <textarea
              {...register('description')}
              rows={2}
              placeholder="Brief description of this evaluation template..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
          </div>

          {/* Preset button (only for new templates) */}
          {!isEditing && (
            <button
              type="button"
              onClick={handleLoadPreset}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              Start from Standard Little League preset
            </button>
          )}
        </div>

        {/* Section 2: Tryout Stations */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Tryout Stations
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Define stations where players are evaluated with objective scores.
              </p>
            </div>
            <span className="text-sm text-gray-400 dark:text-gray-500">
              {stationFields.length} station{stationFields.length !== 1 ? 's' : ''}
            </span>
          </div>

          {errors.stations?.root && (
            <p className="text-sm text-red-600 dark:text-red-400">{errors.stations.root.message}</p>
          )}

          <div className="space-y-4">
            {/* CRITICAL: Use field.id as React key, NOT array index */}
            {stationFields.map((field, index) => (
              <StationEditor
                key={field.id}
                stationIndex={index}
                onRemove={() => removeStation(index)}
                onMoveUp={index > 0 ? () => moveStation(index, index - 1) : undefined}
                onMoveDown={index < stationFields.length - 1 ? () => moveStation(index, index + 1) : undefined}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={handleAddStation}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Station
          </button>
        </div>

        {/* Section 3: Coach Review Categories */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <CoachCategoryEditor />
        </div>

        {/* Section 4: Blend Weights */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <BlendWeightsEditor />
        </div>

        {/* Footer: Cancel + Save */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEditing ? (isLocked ? 'Save as New Version' : 'Update Template') : 'Create Template'}
          </button>
        </div>
      </form>
    </FormProvider>
  );
}
