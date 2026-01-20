import { X } from 'lucide-react';
import { useState, useEffect } from 'react';
import {
  EvaluationPlayer,
  EvaluationCategory,
  getCategoryDisplayName,
  EVALUATION_TAB_CONFIGS,
} from '../../types/evaluation';

interface PlayerDetailModalProps {
  player: EvaluationPlayer;
  onClose: () => void;
  onSaveAdjustment: (bib: string, adjustment: number) => void;
}

export function PlayerDetailModal({
  player,
  onClose,
  onSaveAdjustment,
}: PlayerDetailModalProps) {
  const [adjustment, setAdjustment] = useState(player.manualAdjust);

  useEffect(() => {
    setAdjustment(player.manualAdjust);
  }, [player.manualAdjust]);

  const handleSave = () => {
    onSaveAdjustment(player.bib, adjustment);
    onClose();
  };

  const categories: EvaluationCategory[] = [
    'fielding',
    'pitching',
    'hitting',
    'flyBalls',
    'baserunning',
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {player.fullName || player.bib}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              BIB: {player.bib} | LL Age: {player.littleLeagueAge ?? player.age ?? '-'} | Level: {player.level || '-'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Raw Scores */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Raw & Normalized Scores
            </h3>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 dark:bg-gray-600">
                  <tr>
                    <th className="px-3 py-2 text-left text-gray-600 dark:text-gray-300">
                      Category
                    </th>
                    <th className="px-3 py-2 text-left text-gray-600 dark:text-gray-300">Field</th>
                    <th className="px-3 py-2 text-right text-gray-600 dark:text-gray-300">Raw</th>
                    <th className="px-3 py-2 text-right text-gray-600 dark:text-gray-300">
                      Normalized
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                  {EVALUATION_TAB_CONFIGS.map((config) => {
                    const category = config.category;
                    const rawScores = player.rawScores[category] || {};
                    const normalizedScores = player.normalizedScores[category] || {};

                    return config.fields.map((field, idx) => {
                      // Skip individual times, show bestTime instead
                      if (
                        category === 'baserunning' &&
                        (field.name === 'time1' || field.name === 'time2')
                      ) {
                        if (field.name === 'time1') {
                          const raw1 = rawScores['time1'];
                          const raw2 = rawScores['time2'];
                          const bestTime =
                            raw1 && raw2 ? Math.min(raw1, raw2) : raw1 || raw2 || null;
                          return (
                            <tr key={`${category}-bestTime`}>
                              <td className="px-3 py-2 text-gray-900 dark:text-white">
                                {idx === 0 && getCategoryDisplayName(category)}
                              </td>
                              <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                                Best Time
                              </td>
                              <td className="px-3 py-2 text-right text-gray-900 dark:text-white">
                                {bestTime?.toFixed(2) ?? '-'}
                              </td>
                              <td className="px-3 py-2 text-right text-gray-900 dark:text-white">
                                {normalizedScores['bestTime']?.toFixed(1) ?? '-'}
                              </td>
                            </tr>
                          );
                        }
                        return null;
                      }

                      return (
                        <tr key={`${category}-${field.name}`}>
                          <td className="px-3 py-2 text-gray-900 dark:text-white">
                            {idx === 0 && getCategoryDisplayName(category)}
                          </td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                            {field.name}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-900 dark:text-white">
                            {rawScores[field.name]?.toFixed(field.scoreType === 'time' ? 2 : 0) ??
                              '-'}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-900 dark:text-white">
                            {normalizedScores[field.name]?.toFixed(1) ?? '-'}
                          </td>
                        </tr>
                      );
                    });
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Category Totals */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Category Totals
            </h3>
            <div className="flex flex-wrap gap-3">
              {categories.map((cat) => (
                <div
                  key={cat}
                  className={`px-4 py-2 rounded-lg ${
                    player.categoryScores[cat] !== null
                      ? 'bg-green-100 dark:bg-green-900/30'
                      : 'bg-gray-100 dark:bg-gray-700'
                  }`}
                >
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    {getCategoryDisplayName(cat)}
                  </div>
                  <div
                    className={`text-lg font-bold ${
                      player.categoryScores[cat] !== null
                        ? 'text-green-700 dark:text-green-400'
                        : 'text-gray-400 dark:text-gray-500'
                    }`}
                  >
                    {player.categoryScores[cat]?.toFixed(1) ?? '-'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Weighted Total & Adjustment */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-700 dark:text-gray-300">Weighted Total:</span>
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {(player.weightedTotal - player.manualAdjust + adjustment).toFixed(1)}
              </span>
            </div>

            <div className="flex items-center gap-4">
              <label className="text-gray-700 dark:text-gray-300">Manual Adjustment:</label>
              <input
                type="number"
                value={adjustment}
                onChange={(e) => setAdjustment(parseFloat(e.target.value) || 0)}
                step="0.5"
                className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-right"
              />
              <span className="text-gray-600 dark:text-gray-400">→</span>
              <span className="text-xl font-bold text-green-600 dark:text-green-400">
                Final: {(player.weightedTotal - player.manualAdjust + adjustment).toFixed(1)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
