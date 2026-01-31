import { useState, useEffect } from 'react';
import { AlertCircle, Loader2, Check } from 'lucide-react';
import { api } from '../../api/client';
import { mapCompositeToPlayers } from '../../utils/compositeToPlayerMapper';
import type { Player, Season, CompositeExportResponse, CompositeDataTier } from '../../types';

interface SeasonPlayerImportProps {
  teamCount: number;
  onComplete: (players: Player[]) => void;
  onCancel: () => void;
}

export function SeasonPlayerImport({ teamCount, onComplete, onCancel }: SeasonPlayerImportProps) {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);
  const [exportResponse, setExportResponse] = useState<CompositeExportResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch seasons on mount
  useEffect(() => {
    const loadSeasons = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const seasonsList = await api.listSeasons();
        setSeasons(seasonsList);
      } catch (err) {
        console.error('Failed to load seasons:', err);
        setError('Failed to load seasons. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    loadSeasons();
  }, []);

  const handleSeasonSelect = async (seasonId: string) => {
    setSelectedSeasonId(seasonId);
    setIsLoading(true);
    setError(null);
    try {
      // Use default 50/50 blend for now
      const weights = { coachRating: 50, tryoutScore: 50 };
      const response = await api.exportCompositeForDraft(seasonId, weights, teamCount);
      setExportResponse(response);
    } catch (err) {
      console.error('Failed to export composite scores:', err);
      setError('Failed to load composite scores. Please try again.');
      setSelectedSeasonId(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = () => {
    if (!exportResponse) return;
    const players = mapCompositeToPlayers(exportResponse.players);
    onComplete(players);
  };

  const handleChangeSeasonClick = () => {
    setSelectedSeasonId(null);
    setExportResponse(null);
    setError(null);
  };

  const getTierBadge = (tier: CompositeDataTier) => {
    switch (tier) {
      case 'full':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Full</span>;
      case 'coach_only':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">Coach Only</span>;
      case 'tryout_only':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">Tryout Only</span>;
    }
  };

  // Loading state
  if (isLoading && seasons.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading seasons...</span>
        </div>
      </div>
    );
  }

  // Error state (season list fetch failed)
  if (error && seasons.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-red-900 dark:text-red-200 mb-2">
                  Failed to Load Seasons
                </h3>
                <p className="text-sm text-red-800 dark:text-red-300 mb-4">{error}</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium"
                  >
                    Retry
                  </button>
                  <button
                    onClick={onCancel}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 rounded-lg font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Empty state (no seasons exist)
  if (seasons.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-8 border border-gray-200 dark:border-gray-700">
            <AlertCircle className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No Seasons Found
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Create a season and complete evaluations first before importing composite scores.
            </p>
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 rounded-lg font-medium"
            >
              Back to Import Selection
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Season selection step
  if (!selectedSeasonId || !exportResponse) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
              Select Season
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Choose a season to import composite scores from
            </p>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {seasons.map((season) => (
              <button
                key={season.id}
                onClick={() => handleSeasonSelect(season.id)}
                disabled={isLoading}
                className="w-full bg-white dark:bg-gray-800 rounded-lg p-6 border-2 border-gray-200 dark:border-gray-700 hover:border-indigo-500 dark:hover:border-indigo-500 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                      {season.name}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {season.year}
                    </p>
                  </div>
                  {isLoading && selectedSeasonId === season.id && (
                    <Loader2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 animate-spin" />
                  )}
                </div>
              </button>
            ))}
          </div>

          <div className="mt-6">
            <button
              onClick={onCancel}
              className="w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 rounded-lg font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Preview step (exportResponse is set)
  const selectedSeason = seasons.find(s => s.id === selectedSeasonId);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Preview Composite Rankings
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Review the player rankings before importing
          </p>
        </div>

        {/* Summary Banner */}
        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
              <Check className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-indigo-900 dark:text-indigo-200 mb-2">
                {exportResponse.playerCount} Players from {selectedSeason?.name || exportResponse.seasonName}
              </h3>
              <div className="flex flex-wrap gap-4 text-sm text-indigo-800 dark:text-indigo-300">
                <div>
                  <span className="font-medium">{exportResponse.tierCounts.full}</span> with full data
                </div>
                <div>
                  <span className="font-medium">{exportResponse.tierCounts.coachOnly}</span> coach-only
                </div>
                <div>
                  <span className="font-medium">{exportResponse.tierCounts.tryoutOnly}</span> tryout-only
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Preview Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
          <div className="overflow-x-auto" style={{ maxHeight: '500px' }}>
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Rank
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Tier
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Coach Score
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Tryout Score
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {exportResponse.players.map((player) => (
                  <tr
                    key={`${player.firstName}-${player.lastName}-${player.rank}`}
                    className={player.isDNE ? 'opacity-50' : ''}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {player.rank}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {player.firstName} {player.lastName}
                      </div>
                      {player.isDNE && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">DNE</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
                      {player.totalScore.toFixed(1)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getTierBadge(player.tier)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-600 dark:text-gray-400">
                      {player.coachAggregate !== null ? player.coachAggregate.toFixed(1) : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-600 dark:text-gray-400">
                      {player.tryoutAggregate !== null ? player.tryoutAggregate.toFixed(1) : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={onCancel}
            className="px-6 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 rounded-lg font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleChangeSeasonClick}
            className="px-6 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 rounded-lg font-medium"
          >
            Change Season
          </button>
          <button
            onClick={handleApprove}
            className="flex-1 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2"
          >
            Approve and Import {exportResponse.playerCount} Players
          </button>
        </div>
      </div>
    </div>
  );
}
