import { FileSpreadsheet, FileText, Users, TrendingUp } from 'lucide-react';

interface ImportTypeSelectorProps {
  onSelectCSV: () => void;
  onSelectExcel: () => void;
  onSelectDualCSV?: () => void;
  onSelectEvaluation?: () => void;
}

export function ImportTypeSelector({ onSelectCSV, onSelectExcel, onSelectDualCSV, onSelectEvaluation }: ImportTypeSelectorProps) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Import Player Data
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Choose how you want to import your player evaluations
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* CSV Import Option */}
          <button
            onClick={onSelectCSV}
            className="bg-white dark:bg-gray-800 rounded-lg p-6 border-2 border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-colors text-left group"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors">
                <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Summary CSV
                </h2>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Pre-calculated scores. Map columns and draft.
            </p>
            <ul className="text-xs text-gray-500 dark:text-gray-500 space-y-1">
              <li>• Pre-calculated subtotals</li>
              <li>• Standard column mapping</li>
              <li>• Quick setup</li>
            </ul>
          </button>

          {/* Excel Import Option */}
          <button
            onClick={onSelectExcel}
            className="bg-white dark:bg-gray-800 rounded-lg p-6 border-2 border-gray-200 dark:border-gray-700 hover:border-green-500 dark:hover:border-green-500 transition-colors text-left group"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center group-hover:bg-green-200 dark:group-hover:bg-green-900/50 transition-colors">
                <FileSpreadsheet className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Evaluation Excel
                </h2>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Raw evaluation data from multi-tab workbook.
            </p>
            <ul className="text-xs text-gray-500 dark:text-gray-500 space-y-1">
              <li>• Multi-tab Excel support</li>
              <li>• Automatic normalization</li>
              <li>• Customizable weights</li>
            </ul>
          </button>

          {/* Dual CSV with Registration Verification */}
          {onSelectDualCSV && (
            <button
              onClick={onSelectDualCSV}
              className="bg-white dark:bg-gray-800 rounded-lg p-6 border-2 border-gray-200 dark:border-gray-700 hover:border-purple-500 dark:hover:border-purple-500 transition-colors text-left group"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center group-hover:bg-purple-200 dark:group-hover:bg-purple-900/50 transition-colors">
                  <Users className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    With Registration
                  </h2>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Two CSVs: evaluations + registration list for eligibility verification.
              </p>
              <ul className="text-xs text-gray-500 dark:text-gray-500 space-y-1">
                <li>• Verify paid/registered</li>
                <li>• Exclude non-registered</li>
                <li>• Flag DNE players</li>
              </ul>
            </button>
          )}

          {/* Evaluation-based Import (From Composite Scores) */}
          {onSelectEvaluation && (
            <button
              onClick={onSelectEvaluation}
              className="bg-white dark:bg-gray-800 rounded-lg p-6 border-2 border-gray-200 dark:border-gray-700 hover:border-indigo-500 dark:hover:border-indigo-500 transition-colors text-left group"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center group-hover:bg-indigo-200 dark:group-hover:bg-indigo-900/50 transition-colors">
                  <TrendingUp className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    From Evaluations
                  </h2>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Import composite scores from a completed season.
              </p>
              <ul className="text-xs text-gray-500 dark:text-gray-500 space-y-1">
                <li>• Pre-calculated composites</li>
                <li>• Coach + tryout blended</li>
                <li>• Admin-approved rankings</li>
              </ul>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
