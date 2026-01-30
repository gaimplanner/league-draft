/**
 * TryoutProgressDashboard Component
 *
 * Displays group × station completion status grid with color coding.
 * Supports player-level drill-down and pull-to-refresh.
 */

import React, { useState, useEffect } from 'react';
import PullToRefresh from 'react-simple-pull-to-refresh';
import type { EvaluationTemplate, TryoutProgress } from '../../types';
import { api } from '../../api/client';

interface TryoutProgressDashboardProps {
  seasonId: string;
  template: EvaluationTemplate;
}

export const TryoutProgressDashboard: React.FC<TryoutProgressDashboardProps> = ({
  seasonId,
  template,
}) => {
  const [progressData, setProgressData] = useState<TryoutProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProgress = async () => {
    try {
      setError(null);
      const data = await api.getTryoutProgress(seasonId);
      setProgressData(data);
      return data;
    } catch (err) {
      console.error('Failed to fetch progress:', err);
      setError('Failed to load progress data. Please try again.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProgress();
  }, [seasonId]);

  const handleRefresh = async () => {
    await fetchProgress();
  };

  // Build grid structure: group rows × station columns
  const groups = Array.from(new Set(progressData.map(p => ({ id: p.groupId, name: p.groupName }))))
    .sort((a, b) => a.name.localeCompare(b.name));

  const stations = template.stations || [];

  // Calculate overall completion stats
  const totalCells = groups.length * stations.length;
  const completeCells = progressData.filter(p => p.complete).length;
  const completionPercentage = totalCells > 0 ? Math.round((completeCells / totalCells) * 100) : 0;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Tryout Progress</h2>
            <p className="text-sm text-gray-600 mt-1">
              Overall: {completeCells}/{totalCells} stations complete ({completionPercentage}%)
            </p>
          </div>
          <button
            onClick={handleRefresh}
            className="p-2 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            title="Refresh"
          >
            <svg className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Progress Grid */}
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Group
                  </th>
                  {stations.map(station => (
                    <th key={station.id} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {station.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {groups.map(group => (
                  <tr key={group.id}>
                    <td className="sticky left-0 z-10 bg-white px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {group.name}
                    </td>
                    {stations.map(station => {
                      const cell = progressData.find(p => p.groupId === group.id && p.stationId === station.id);
                      const scoredCount = cell?.scoredCount || 0;
                      const totalPlayers = cell?.totalPlayers || 0;
                      const complete = cell?.complete || false;
                      const partial = scoredCount > 0 && !complete;

                      const bgColor = complete
                        ? 'bg-green-100 hover:bg-green-200'
                        : partial
                        ? 'bg-yellow-100 hover:bg-yellow-200'
                        : 'bg-gray-100 hover:bg-gray-200';
                      const textColor = complete
                        ? 'text-green-800'
                        : partial
                        ? 'text-yellow-800'
                        : 'text-gray-500';

                      return (
                        <td key={station.id} className="px-4 py-4 whitespace-nowrap">
                          <div className={`text-center px-3 py-2 rounded-md ${bgColor} ${textColor} text-sm font-medium`}>
                            {scoredCount}/{totalPlayers}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
            <div className="flex items-center space-x-6 text-xs">
              <div className="flex items-center">
                <div className="w-4 h-4 bg-green-100 rounded mr-2"></div>
                <span className="text-gray-600">Complete</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-yellow-100 rounded mr-2"></div>
                <span className="text-gray-600">Partial</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-gray-100 rounded mr-2"></div>
                <span className="text-gray-600">None</span>
              </div>
            </div>
          </div>
        </div>
      </PullToRefresh>
    </div>
  );
};
