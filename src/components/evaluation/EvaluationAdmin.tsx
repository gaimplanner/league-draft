import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import type { EvaluationTemplate } from '../../types';
import { TemplateList } from './TemplateList';
import { TemplateEditor } from './TemplateEditor';
import { SeasonManager } from './SeasonManager';

type AdminView = 'list' | 'editor' | 'seasons';

interface EvaluationAdminProps {
  onBack: () => void;
}

/**
 * Top-level admin page for evaluation template and season management.
 * Orchestrates TemplateList, TemplateEditor, and SeasonManager views.
 */
export function EvaluationAdmin({ onBack }: EvaluationAdminProps) {
  const [view, setView] = useState<AdminView>('list');
  const [editingTemplate, setEditingTemplate] = useState<EvaluationTemplate | null>(null);

  // Active tab for non-editor views
  const activeTab = view === 'seasons' ? 'seasons' : 'templates';

  const handleCreateTemplate = () => {
    setEditingTemplate(null);
    setView('editor');
  };

  const handleEditTemplate = (template: EvaluationTemplate) => {
    setEditingTemplate(template);
    setView('editor');
  };

  const handleEditorSave = () => {
    setEditingTemplate(null);
    setView('list');
  };

  const handleEditorCancel = () => {
    setEditingTemplate(null);
    setView('list');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Top bar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <button
            onClick={view === 'editor' ? handleEditorCancel : onBack}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Evaluation Setup
          </h1>
        </div>
      </div>

      {/* Tab navigation (hidden in editor view) */}
      {view !== 'editor' && (
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-5xl mx-auto px-4">
            <nav className="flex gap-6" aria-label="Evaluation admin tabs">
              <button
                onClick={() => setView('list')}
                className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'templates'
                    ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                Templates
              </button>
              <button
                onClick={() => setView('seasons')}
                className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'seasons'
                    ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                Seasons
              </button>
            </nav>
          </div>
        </div>
      )}

      {/* Content area */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        {view === 'list' && (
          <TemplateList
            onCreateTemplate={handleCreateTemplate}
            onEditTemplate={handleEditTemplate}
          />
        )}

        {view === 'editor' && (
          <TemplateEditor
            existingTemplate={editingTemplate ?? undefined}
            onSave={handleEditorSave}
            onCancel={handleEditorCancel}
          />
        )}

        {view === 'seasons' && (
          <SeasonManager />
        )}
      </div>
    </div>
  );
}
