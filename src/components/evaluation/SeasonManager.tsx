import { useEffect, useState } from 'react';
import { Plus, Trash2, AlertCircle, Loader2, RefreshCw, Calendar } from 'lucide-react';
import { useSeasons } from '../../hooks/useSeasons';
import { useEvaluationTemplates } from '../../hooks/useEvaluationTemplates';
import type { EvaluationTemplate } from '../../types';

/**
 * Season management UI. Allows creating, viewing, and deleting seasons
 * with template assignment.
 */
export function SeasonManager() {
  const { seasons, isLoading, error, fetchSeasons, createSeason, deleteSeason } = useSeasons();
  const { templates, fetchTemplates } = useEvaluationTemplates();

  const [isCreating, setIsCreating] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form state for creating a season
  const [formName, setFormName] = useState('');
  const [formYear, setFormYear] = useState(new Date().getFullYear());
  const [formTemplateId, setFormTemplateId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    fetchSeasons();
    fetchTemplates();
  }, [fetchSeasons, fetchTemplates]);

  const handleCreate = async () => {
    setFormError(null);

    if (!formName.trim()) {
      setFormError('Season name is required.');
      return;
    }
    if (!formTemplateId) {
      setFormError('Please select an evaluation template.');
      return;
    }

    const result = await createSeason({
      name: formName.trim(),
      year: formYear,
      templateId: formTemplateId,
    });

    if (result) {
      // Reset form
      setFormName('');
      setFormYear(new Date().getFullYear());
      setFormTemplateId('');
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    const success = await deleteSeason(id);
    if (success) {
      setDeleteConfirmId(null);
    }
  };

  // Helper to find template name + version for a season
  const getTemplateName = (templateId: string): string => {
    const template = templates.find((t: EvaluationTemplate) => t.id === templateId);
    if (template) {
      return `${template.name} v${template.version}`;
    }
    return 'Unknown template';
  };

  // Loading state
  if (isLoading && seasons.length === 0) {
    return (
      <div className="min-h-[300px] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">Loading seasons...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && seasons.length === 0) {
    return (
      <div className="min-h-[300px] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-3" />
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <button
            onClick={fetchSeasons}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Seasons
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage evaluation seasons and assign templates.
          </p>
        </div>
        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <Plus className="w-4 h-4" />
            Create Season
          </button>
        )}
      </div>

      {/* Error banner (when seasons are already loaded) */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
        </div>
      )}

      {/* Create form (inline) */}
      {isCreating && (
        <div className="mb-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            New Season
          </h3>

          {formError && (
            <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span className="text-sm text-red-700 dark:text-red-400">{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Season Name
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Spring 2026"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Year
              </label>
              <input
                type="number"
                value={formYear}
                onChange={(e) => setFormYear(Number(e.target.value))}
                min={2020}
                max={2099}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Evaluation Template
              </label>
              <select
                value={formTemplateId}
                onChange={(e) => setFormTemplateId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select a template...</option>
                {templates.map((t: EvaluationTemplate) => (
                  <option key={t.id} value={t.id}>
                    {t.name} v{t.version}
                  </option>
                ))}
              </select>
              {templates.length === 0 && (
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  No templates available. Create a template first.
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setIsCreating(false);
                setFormError(null);
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Season
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {seasons.length === 0 && !isCreating && (
        <div className="min-h-[300px] flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No seasons configured
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Create a season and assign an evaluation template.
            </p>
            <button
              onClick={() => setIsCreating(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <Plus className="w-5 h-5" />
              Create Season
            </button>
          </div>
        </div>
      )}

      {/* Season list */}
      {seasons.length > 0 && (
        <div className="space-y-3">
          {seasons.map((season) => (
            <div
              key={season.id}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                      {season.name}
                    </h3>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                      {season.year}
                    </span>
                    {season.isActive && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                        Active
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
                    <span>
                      Template: {getTemplateName(season.templateId)}
                    </span>
                    <span className="text-gray-300 dark:text-gray-600">|</span>
                    <span>
                      Created {new Date(season.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {deleteConfirmId === season.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(season.id)}
                        className="px-2 py-1 text-xs font-medium text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                        disabled={isLoading}
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className="px-2 py-1 text-xs font-medium text-gray-500 bg-gray-50 dark:bg-gray-700 dark:text-gray-400 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirmId(season.id)}
                      className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Delete season"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
