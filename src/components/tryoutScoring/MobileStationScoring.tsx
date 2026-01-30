import { useState, useEffect } from 'react';
import type { EvaluationTemplate } from '../../types';
import { useTryoutScoring } from '../../hooks/useTryoutScoring';
import { BibNumpad } from './BibNumpad';
import { PlayerScoreCard } from './PlayerScoreCard';

interface MobileStationScoringProps {
  seasonId: string;
  template: EvaluationTemplate;
}

export function MobileStationScoring({ seasonId, template }: MobileStationScoringProps) {
  const {
    groups,
    activeGroup,
    activeStationId,
    stationScores,
    activePlayerIndex,
    showConfirmation,
    isLoading,
    error,
    fetchGroups,
    setActiveGroup,
    setActiveStation,
    fetchScoresForGroupStation,
    submitScore,
    advanceToPlayer,
    lookupByBib,
    getPlayerScoreStatus,
  } = useTryoutScoring();

  const [viewMode, setViewMode] = useState<'bib-lookup' | 'scoring'>('bib-lookup');
  const [bibNotFound, setBibNotFound] = useState(false);

  // Load groups on mount
  useEffect(() => {
    fetchGroups(seasonId);
  }, [seasonId, fetchGroups]);

  // Load scores when group or station changes
  useEffect(() => {
    if (activeGroup && activeStationId) {
      fetchScoresForGroupStation(seasonId, activeGroup.id, activeStationId);
    }
  }, [seasonId, activeGroup, activeStationId, fetchScoresForGroupStation]);

  const handleBibEnter = (bibNumber: number) => {
    const found = lookupByBib(bibNumber);
    if (found) {
      setBibNotFound(false);
      setViewMode('scoring');
    } else {
      setBibNotFound(true);
    }
  };

  const handleSubmitScore = (scores: Record<string, number>) => {
    if (!activeGroup || !activeStationId) return;

    const activePlayer = activeGroup.players[activePlayerIndex];
    if (!activePlayer) return;

    submitScore(seasonId, {
      playerId: activePlayer.id,
      stationId: activeStationId,
      scores,
    });
  };

  const activeStation = template.stations.find((s) => s.id === activeStationId);
  const activePlayer = activeGroup?.players[activePlayerIndex];

  // Check if all players scored
  const allPlayersScored =
    activeGroup && activeStationId
      ? activeGroup.players.every((p) => getPlayerScoreStatus(p.id))
      : false;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Bar - Station and Group Selectors */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="space-y-3">
          {/* Station Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Station</label>
            <select
              value={activeStationId || ''}
              onChange={(e) => {
                setActiveStation(e.target.value);
                setViewMode('bib-lookup');
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select a station...</option>
              {template.stations.map((station) => (
                <option key={station.id} value={station.id}>
                  {station.name}
                </option>
              ))}
            </select>
          </div>

          {/* Group Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Group</label>
            <select
              value={activeGroup?.id || ''}
              onChange={(e) => {
                const group = groups.find((g) => g.id === e.target.value);
                if (group) {
                  setActiveGroup(group);
                  setViewMode('bib-lookup');
                }
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select a group...</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name} ({group.playerCount} players)
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 m-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Station Complete Banner */}
      {allPlayersScored && (
        <div className="bg-green-50 border-l-4 border-green-500 p-4 m-4">
          <p className="text-green-700 font-medium">
            All players scored for {activeStation?.name}!
          </p>
        </div>
      )}

      {/* Main Content */}
      <div className="p-4">
        {!activeStationId || !activeGroup ? (
          <div className="text-center py-12 text-gray-500">
            <p>Select a station and group to begin scoring</p>
          </div>
        ) : viewMode === 'bib-lookup' ? (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Enter Bib Number</h2>
            {bibNotFound && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                Bib not found in this group
              </div>
            )}
            <BibNumpad onBibEnter={handleBibEnter} players={activeGroup.players} />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Back to Bib Lookup */}
            <button
              onClick={() => setViewMode('bib-lookup')}
              className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              ← Back to bib entry
            </button>

            {/* Active Player Score Card */}
            {activePlayer && activeStation && (
              <PlayerScoreCard
                player={activePlayer}
                station={activeStation}
                existingScores={
                  stationScores.find((s) => s.playerId === activePlayer.id)?.scores
                }
                onSubmit={handleSubmitScore}
                showConfirmation={showConfirmation}
              />
            )}

            {/* Player List */}
            <div className="bg-white rounded-lg shadow-md">
              <h3 className="px-4 py-3 border-b border-gray-200 font-medium text-gray-700">
                All Players ({activeGroup.players.length})
              </h3>
              <div className="divide-y divide-gray-200 max-h-[400px] overflow-y-auto">
                {activeGroup.players.map((player, index) => {
                  const isActive = index === activePlayerIndex;
                  const isScored = getPlayerScoreStatus(player.id);

                  return (
                    <button
                      key={player.id}
                      onClick={() => advanceToPlayer(index)}
                      className={`w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 ${
                        isActive ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded">
                          #{player.bibNumber}
                        </span>
                        <span className="font-medium">
                          {player.firstName} {player.lastName}
                        </span>
                      </div>
                      <div>
                        {isScored ? (
                          <svg
                            className="w-6 h-6 text-green-500"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                        ) : (
                          <svg
                            className="w-6 h-6 text-gray-300"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl px-6 py-4 flex items-center gap-3">
            <svg className="w-5 h-5 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="text-gray-700 font-medium">Loading...</span>
          </div>
        </div>
      )}
    </div>
  );
}
