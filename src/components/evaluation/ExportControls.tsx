import { Download, ChevronRight } from 'lucide-react';

interface ExportControlsProps {
  playerCount: number;
  onExportCSV: () => void;
  onContinueToDraft: () => void;
  onBack: () => void;
}

export function ExportControls({
  playerCount,
  onExportCSV,
  onContinueToDraft,
  onBack,
}: ExportControlsProps) {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
      <div className="text-sm text-gray-600 dark:text-gray-400">
        <span className="font-medium text-gray-900 dark:text-white">{playerCount}</span> players
        ready for draft
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
        >
          ← Adjust Weights
        </button>

        <button
          onClick={onExportCSV}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>

        <button
          onClick={onContinueToDraft}
          className="flex items-center gap-2 px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium"
        >
          Continue to Draft
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
