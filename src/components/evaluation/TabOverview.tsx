import { CheckCircle, AlertCircle, AlertTriangle, Users } from 'lucide-react';
import { ImportedWorkbook, ImportError, ImportWarning } from '../../types/evaluation';

interface TabOverviewProps {
  workbook: ImportedWorkbook;
  errors: ImportError[];
  warnings: ImportWarning[];
  onContinue: () => void;
  onBack: () => void;
}

export function TabOverview({
  workbook,
  errors,
  warnings,
  onContinue,
  onBack,
}: TabOverviewProps) {
  const hasErrors = errors.length > 0;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Detected Evaluation Tabs
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          File: <span className="font-mono">{workbook.filename}</span>
        </p>
      </div>

      {/* Summary Stats */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-6 border border-gray-200 dark:border-gray-700">
        <div className="flex justify-around text-center">
          <div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {workbook.tabs.length}
            </div>
            <div className="text-sm text-gray-500">Tabs Found</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {workbook.allBibs.length}
            </div>
            <div className="text-sm text-gray-500">Unique Players</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {workbook.tabs.filter((t) => t.matchedConfig).length}
            </div>
            <div className="text-sm text-gray-500">Categories Matched</div>
          </div>
        </div>
      </div>

      {/* Registration Data Found */}
      {workbook.registrationData && workbook.registrationData.length > 0 && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <div>
              <span className="font-medium text-blue-800 dark:text-blue-200">
                Registration Data Found
              </span>
              <span className="text-blue-600 dark:text-blue-400 ml-2">
                ({workbook.registrationData.length} players with coach/teammate requests, school, grade)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tabs Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                Status
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                Tab Name
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                Category
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                Players
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                Score Columns
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {workbook.tabs.map((tab) => (
              <tr key={tab.name}>
                <td className="px-4 py-3">
                  {tab.matchedConfig ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  )}
                </td>
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{tab.name}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                  {tab.matchedConfig?.name || (
                    <span className="text-yellow-600 dark:text-yellow-400">Unknown</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{tab.playerCount}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                  <div className="flex flex-wrap gap-1">
                    {tab.matchedConfig?.fields.map((field) => (
                      <span
                        key={field.name}
                        className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 rounded"
                      >
                        {field.name}
                      </span>
                    )) || <span className="text-gray-400">-</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            <span className="font-medium text-red-800 dark:text-red-200">Errors</span>
          </div>
          <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
            {errors.map((error, i) => (
              <li key={i}>• {error.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            <span className="font-medium text-yellow-800 dark:text-yellow-200">
              Warnings ({warnings.length})
            </span>
          </div>
          <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1 max-h-32 overflow-y-auto">
            {warnings.slice(0, 10).map((warning, i) => (
              <li key={i}>• {warning.message}</li>
            ))}
            {warnings.length > 10 && (
              <li className="text-yellow-600">...and {warnings.length - 10} more</li>
            )}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
        >
          ← Back
        </button>
        <button
          onClick={onContinue}
          disabled={hasErrors}
          className="px-6 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
        >
          Configure Weights →
        </button>
      </div>
    </div>
  );
}
