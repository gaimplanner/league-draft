/**
 * TryoutProgressDashboard Component
 *
 * Displays group × station completion status grid with color coding.
 * Supports player-level drill-down and pull-to-refresh.
 */

import React, { useState, useEffect, useRef } from 'react';
import PullToRefresh from 'react-simple-pull-to-refresh';
import type { EvaluationTemplate, TryoutProgress, TryoutGroup } from '../../types';
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

  // State for drill-down modal
  const [selectedCell, setSelectedCell] = useState<{
    groupId: string;
    groupName: string;
    stationId: string;
    stationName: string;
  } | null>(null);
  const [cellPlayers, setCellPlayers] = useState<{
    bib: number;
    firstName: string;
    lastName: string;
    scored: boolean;
  }[]>([]);
  const [cellLoading, setCellLoading] = useState(false);

  // Cache groups to avoid redundant API calls
  const groupsCache = useRef<TryoutGroup[] | null>(null);

  const fetchProgress = async () => {
    try {
      setError(null);
      const data = await api.getTryoutProgress(seasonId);
      setProgressData(data);
      // Invalidate groups cache on refresh
      groupsCache.current = null;
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

  const handleCellClick = async (groupId: string, groupName: string, stationId: string, stationName: string) => {
    setSelectedCell({ groupId, groupName, stationId, stationName });
    setCellLoading(true);
    try {
      // Cache groups (contains player lists)
      if (!groupsCache.current) {
        groupsCache.current = await api.listTryoutGroups(seasonId);
      }
      const group = groupsCache.current.find(g => g.id === groupId);
      if (!group) {
        setCellLoading(false);
        return;
      }

      // Fetch scores for this specific group-station
      const scores = await api.listStationScores(seasonId, { groupId, stationId });
      const scoredPlayerIds = new Set(scores.map(s => s.playerId));

      // Build player list with scored status
      const players = group.players.map(p => ({
        bib: p.bibNumber,
        firstName: p.firstName,
        lastName: p.lastName,
        scored: scoredPlayerIds.has(p.id),
      }));

      // Sort: missing first (by bib), then scored (by bib)
      players.sort((a, b) => {
        if (a.scored !== b.scored) return a.scored ? 1 : -1;
        return a.bib - b.bib;
      });

      setCellPlayers(players);
    } catch (err) {
      console.error('Failed to fetch player details:', err);
      setCellPlayers([]);
    } finally {
      setCellLoading(false);
    }
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
                          <div
                            className={`text-center px-3 py-2 rounded-md ${bgColor} ${textColor} text-sm font-medium cursor-pointer`}
                            onClick={() => handleCellClick(group.id, group.name, station.id, station.name)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleCellClick(group.id, group.name, station.id, station.name);
                              }
                            }}
                            title={`Click to see player details for ${group.name} - ${station.name}`}
                          >
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

      {/* Player Detail Modal */}
      {selectedCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={() => setSelectedCell(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{selectedCell.stationName}</h3>
                <p className="text-sm text-gray-500">{selectedCell.groupName}</p>
              </div>
              <button
                onClick={() => setSelectedCell(null)}
                className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600"
              >
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            {/* Player list */}
            <div className="overflow-y-auto flex-1 px-6 py-4">
              {cellLoading ? (
                <div className="flex justify-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <div className="space-y-2">
                  {cellPlayers.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">No players found</p>
                  ) : (
                    cellPlayers.map((player, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center justify-between px-3 py-2 rounded-md ${
                          player.scored ? 'bg-green-50' : 'bg-red-50'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${
                            player.scored ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'
                          }`}>
                            {player.bib}
                          </span>
                          <span className="text-sm font-medium text-gray-900">
                            {player.firstName} {player.lastName}
                          </span>
                        </div>
                        <span className={`text-xs font-medium ${player.scored ? 'text-green-700' : 'text-red-700'}`}>
                          {player.scored ? 'Scored' : 'Missing'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Footer summary */}
            {!cellLoading && cellPlayers.length > 0 && (
              <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 rounded-b-lg">
                <p className="text-xs text-gray-600">
                  {cellPlayers.filter(p => p.scored).length}/{cellPlayers.length} scored
                  {cellPlayers.filter(p => !p.scored).length > 0 && (
                    <span className="text-red-600 ml-2">
                      ({cellPlayers.filter(p => !p.scored).length} missing)
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
