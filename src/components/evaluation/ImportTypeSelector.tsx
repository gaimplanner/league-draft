import { FileSpreadsheet, FileText } from 'lucide-react';

interface ImportTypeSelectorProps {
  onSelectCSV: () => void;
  onSelectExcel: () => void;
}

export function ImportTypeSelector({ onSelectCSV, onSelectExcel }: ImportTypeSelectorProps) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-3xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Import Player Data
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Choose how you want to import your player evaluations
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* CSV Import Option */}
          <button
            onClick={onSelectCSV}
            className="bg-white dark:bg-gray-800 rounded-lg p-8 border-2 border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-colors text-left group"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors">
                <FileText className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Import Summary CSV
                </h2>
              </div>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Scores are already calculated in your spreadsheet. Just map the columns and you're
              ready to draft.
            </p>
            <ul className="text-sm text-gray-500 dark:text-gray-500 space-y-1">
              <li>• Pre-calculated subtotals</li>
              <li>• Standard column mapping</li>
              <li>• Quick setup</li>
            </ul>
          </button>

          {/* Excel Import Option */}
          <button
            onClick={onSelectExcel}
            className="bg-white dark:bg-gray-800 rounded-lg p-8 border-2 border-gray-200 dark:border-gray-700 hover:border-green-500 dark:hover:border-green-500 transition-colors text-left group"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center group-hover:bg-green-200 dark:group-hover:bg-green-900/50 transition-colors">
                <FileSpreadsheet className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Import Evaluation Spreadsheet
                </h2>
              </div>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Raw evaluation data from multi-tab Excel workbook. The app will normalize scores and
              calculate weighted totals.
            </p>
            <ul className="text-sm text-gray-500 dark:text-gray-500 space-y-1">
              <li>• Multi-tab Excel support</li>
              <li>• Automatic score normalization</li>
              <li>• Customizable category weights</li>
            </ul>
          </button>
        </div>
      </div>
    </div>
  );
}
