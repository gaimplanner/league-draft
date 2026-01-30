import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Lock, AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import type { EvaluationTemplate } from '../../types';
import { useEvaluationTemplates } from '../../hooks/useEvaluationTemplates';

interface TemplateListProps {
  onCreateTemplate: () => void;
  onEditTemplate: (template: EvaluationTemplate) => void;
}

export function TemplateList({ onCreateTemplate, onEditTemplate }: TemplateListProps) {
  const {
    templates,
    isLoading,
    error,
    fetchTemplates,
    deleteTemplate,
  } = useEvaluationTemplates();

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleDelete = async (id: string) => {
    const success = await deleteTemplate(id);
    if (success) {
      setDeleteConfirmId(null);
    }
  };

  // Loading state
  if (isLoading && templates.length === 0) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">Loading templates...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && templates.length === 0) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-3" />
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <button
            onClick={fetchTemplates}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (templates.length === 0) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <Plus className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No evaluation templates yet
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            Create one to define how players are evaluated at stations and by coaches.
          </p>
          <button
            onClick={onCreateTemplate}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <Plus className="w-5 h-5" />
            Create Template
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
            Evaluation Templates
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {templates.length} template{templates.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={onCreateTemplate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          <Plus className="w-4 h-4" />
          Create Template
        </button>
      </div>

      {/* Error banner (when templates are already loaded) */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
        </div>
      )}

      {/* Template list */}
      <div className="space-y-3">
        {templates.map(template => (
          <div
            key={template.id}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              {/* Template info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                    {template.name}
                  </h3>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                    v{template.version}
                  </span>
                  {template.isLocked && (
                    <span title="Locked - editing will create a new version">
                      <Lock className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    </span>
                  )}
                </div>

                {template.description && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2 line-clamp-2">
                    {template.description}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
                  <span>
                    {template.stations.length} station{template.stations.length !== 1 ? 's' : ''}
                  </span>
                  <span className="text-gray-300 dark:text-gray-600">|</span>
                  <span>
                    {template.coachCategories.length} coach categor{template.coachCategories.length !== 1 ? 'ies' : 'y'}
                  </span>
                  <span className="text-gray-300 dark:text-gray-600">|</span>
                  <span>
                    {template.blendWeights.coachRating}% Coach / {template.blendWeights.tryoutScore}% Tryout
                  </span>
                  <span className="text-gray-300 dark:text-gray-600">|</span>
                  <span>
                    Updated {new Date(template.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => onEditTemplate(template)}
                  className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                  title="Edit template"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                {deleteConfirmId === template.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(template.id)}
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
                    onClick={() => setDeleteConfirmId(template.id)}
                    className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title={template.isLocked ? 'Locked templates cannot be deleted' : 'Delete template'}
                    disabled={template.isLocked}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
