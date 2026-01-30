import type { CompositePlayerDetail, EvaluationTemplate } from '../../types';

interface PlayerEvaluationBreakdownProps {
  detail: CompositePlayerDetail | null;
  template: EvaluationTemplate;
  loading: boolean;
}

/**
 * Inline expanded detail showing coach rating + tryout station breakdown.
 * Displays raw and normalized scores with aggregates.
 */
export function PlayerEvaluationBreakdown({
  detail,
  template,
  loading,
}: PlayerEvaluationBreakdownProps) {
  if (loading) {
    return (
      <div className="p-6 bg-blue-50 dark:bg-blue-900/10 text-center">
        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-sm text-gray-600 dark:text-gray-400">
          Loading evaluation details...
        </span>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="p-6 bg-blue-50 dark:bg-blue-900/10 text-center text-sm text-gray-600 dark:text-gray-400">
        No evaluation data available
      </div>
    );
  }

  const hasCoachData = detail.coachDetail !== null;
  const hasTryoutData = detail.tryoutDetail !== null;

  return (
    <div className="p-6 bg-blue-50 dark:bg-blue-900/10 border-t border-blue-200 dark:border-blue-800">
      <div className={`grid gap-6 ${hasCoachData && hasTryoutData ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
        {/* Coach Rating Section */}
        {hasCoachData && detail.coachDetail && (
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
              Coach Rating
            </h4>
            <div className="space-y-2">
              {template.coachCategories.map((category) => {
                const raw = detail.coachDetail!.rawScores[category.id];
                const normalized = detail.coachDetail!.normalizedScores[category.id];
                return (
                  <div key={category.id} className="flex justify-between text-sm">
                    <span className="text-gray-700 dark:text-gray-300">
                      {category.name}
                    </span>
                    <span className="text-gray-900 dark:text-white font-medium">
                      {raw !== undefined ? `${raw} (${normalized.toFixed(1)})` : 'N/A'}
                    </span>
                  </div>
                );
              })}
              <div className="pt-2 border-t border-gray-300 dark:border-gray-600 flex justify-between font-semibold">
                <span className="text-gray-900 dark:text-white">Coach Subtotal</span>
                <span className="text-blue-600 dark:text-blue-400">
                  {detail.coachDetail.aggregate.toFixed(1)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Tryout Scores Section */}
        {hasTryoutData && detail.tryoutDetail && (
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
              Tryout Scores ({detail.tryoutDetail.stationsScored}/{detail.tryoutDetail.stationsTotal} stations)
            </h4>
            <div className="space-y-4">
              {template.stations
                .filter((station) => detail.tryoutDetail!.stations[station.id])
                .map((station) => {
                  const stationDetail = detail.tryoutDetail!.stations[station.id];
                  return (
                    <div key={station.id}>
                      <div className="font-medium text-sm text-gray-800 dark:text-gray-200 mb-1">
                        {station.name}
                      </div>
                      <div className="space-y-1 pl-3">
                        {station.fields.map((field) => {
                          const raw = stationDetail.rawScores[field.id];
                          const normalized = stationDetail.normalizedScores[field.id];
                          return (
                            <div key={field.id} className="flex justify-between text-xs">
                              <span className="text-gray-600 dark:text-gray-400">
                                {field.name}
                              </span>
                              <span className="text-gray-700 dark:text-gray-300">
                                {raw !== undefined
                                  ? `${raw}${field.unit || ''} → ${normalized.toFixed(1)}`
                                  : 'N/A'}
                              </span>
                            </div>
                          );
                        })}
                        <div className="flex justify-between text-xs font-medium pt-1 border-t border-gray-200 dark:border-gray-700">
                          <span className="text-gray-700 dark:text-gray-300">Subtotal</span>
                          <span className="text-gray-900 dark:text-white">
                            {stationDetail.aggregate.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              <div className="pt-2 border-t border-gray-300 dark:border-gray-600 flex justify-between font-semibold">
                <span className="text-gray-900 dark:text-white">Tryout Subtotal</span>
                <span className="text-blue-600 dark:text-blue-400">
                  {detail.tryoutDetail.aggregate.toFixed(1)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
