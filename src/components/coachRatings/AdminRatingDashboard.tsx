import { useEffect } from 'react';
import { BarChart3, Users } from 'lucide-react';
import type { CoachRatingProgress } from '../../types';

interface AdminRatingDashboardProps {
  progress: CoachRatingProgress[];
  seasonId: string;
  seasonName: string;
  onFetchProgress: (seasonId: string) => Promise<void>;
  isLoading?: boolean;
}

export function AdminRatingDashboard({
  progress,
  seasonId,
  seasonName,
  onFetchProgress,
  isLoading = false,
}: AdminRatingDashboardProps) {
  useEffect(() => {
    onFetchProgress(seasonId);
  }, [seasonId, onFetchProgress]);

  const totalSubmitted = progress.reduce((sum, p) => sum + p.submittedRatings, 0);
  const totalRatings = progress.reduce((sum, p) => sum + p.totalRatings, 0);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <BarChart3 className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Rating Progress
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {seasonName} — {totalSubmitted}/{totalRatings} ratings submitted
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          Loading progress...
        </div>
      ) : progress.length > 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Coach
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Email
                </th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Submitted
                </th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Draft
                </th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Progress
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {progress.map(coach => {
                const pct = coach.totalRatings > 0
                  ? Math.round((coach.submittedRatings / coach.totalRatings) * 100)
                  : 0;
                return (
                  <tr key={coach.coachId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                      {coach.coachFirstName} {coach.coachLastName}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {coach.coachEmail}
                    </td>
                    <td className="px-4 py-3 text-sm text-center text-green-600 dark:text-green-400 font-medium">
                      {coach.submittedRatings}
                    </td>
                    <td className="px-4 py-3 text-sm text-center text-yellow-600 dark:text-yellow-400 font-medium">
                      {coach.draftRatings}
                    </td>
                    <td className="px-4 py-3 text-sm text-center text-gray-700 dark:text-gray-300 font-medium">
                      {coach.totalRatings}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 w-10 text-right">
                          {pct}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12">
          <Users className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500 dark:text-gray-400">
            No ratings have been submitted for this season yet.
          </p>
        </div>
      )}
    </div>
  );
}
