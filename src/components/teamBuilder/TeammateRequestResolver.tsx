import { useState } from 'react';
import { Users, UserPlus, ArrowRight, Check, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { nameSimilarity } from '../../utils/teamBuilderParser';

interface TeammateRequest {
  rawString: string;
  resolvedPlayerId: string | null;
  resolvedPlayerName: string | null;
  isTwoWay: boolean;
}

interface PlayerWithRequests {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  requests: TeammateRequest[];
}

interface TeammateRequestResolverProps {
  players: PlayerWithRequests[];
  allPlayers: Array<{ id: string; firstName: string; lastName: string; fullName: string }>;
  onResolve: (playerId: string, requestIndex: number, resolvedPlayerId: string | null) => void;
}

/**
 * UI component for reviewing and resolving teammate requests.
 * Shows each player's teammate requests with resolution status.
 */
export const TeammateRequestResolver = ({
  players,
  allPlayers,
  onResolve,
}: TeammateRequestResolverProps) => {
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);
  const [searchTerms, setSearchTerms] = useState<Map<string, string>>(new Map());

  const toggleExpanded = (playerId: string) => {
    setExpandedPlayerId(expandedPlayerId === playerId ? null : playerId);
  };

  const getSearchKey = (playerId: string, requestIndex: number) => `${playerId}-${requestIndex}`;

  const handleSearchChange = (playerId: string, requestIndex: number, term: string) => {
    const key = getSearchKey(playerId, requestIndex);
    setSearchTerms(new Map(searchTerms).set(key, term));
  };

  const getFilteredPlayers = (playerId: string, requestIndex: number) => {
    const key = getSearchKey(playerId, requestIndex);
    const searchTerm = (searchTerms.get(key) || '').toLowerCase();

    // Filter out the requesting player themselves
    let filtered = allPlayers.filter(p => p.id !== playerId);

    if (searchTerm) {
      filtered = filtered.filter(p =>
        p.fullName.toLowerCase().includes(searchTerm)
      );
    }

    return filtered;
  };

  const getSuggestedMatches = (rawRequest: string, excludePlayerId: string) => {
    const normalizedRequest = rawRequest.toLowerCase().trim();

    return allPlayers
      .filter(p => p.id !== excludePlayerId)
      .map(p => ({
        ...p,
        score: Math.max(
          nameSimilarity(normalizedRequest, p.fullName.toLowerCase()),
          nameSimilarity(normalizedRequest, p.lastName.toLowerCase()) * 0.8
        ),
      }))
      .filter(p => p.score >= 0.4)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  };

  // Count stats
  const totalRequests = players.reduce((sum, p) => sum + p.requests.length, 0);
  const resolvedRequests = players.reduce(
    (sum, p) => sum + p.requests.filter(r => r.resolvedPlayerId !== null).length,
    0
  );
  const twoWayCount = players.reduce(
    (sum, p) => sum + p.requests.filter(r => r.isTwoWay).length,
    0
  );

  // Filter to players with unresolved requests
  const playersWithUnresolved = players.filter(p =>
    p.requests.some(r => r.resolvedPlayerId === null && r.rawString.trim() !== '')
  );

  if (totalRequests === 0) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <p className="text-gray-600 dark:text-gray-400">
          No teammate requests found in the registration data.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats header */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{totalRequests}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Total Requests</div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-green-500" />
            <span className="text-2xl font-bold text-green-600 dark:text-green-400">{twoWayCount / 2}</span>
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Two-Way Pairs</div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {resolvedRequests}/{totalRequests}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Resolved</div>
        </div>
      </div>

      {/* Unresolved requests */}
      {playersWithUnresolved.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Unresolved Requests ({playersWithUnresolved.length} players)
            </h3>
          </div>

          {playersWithUnresolved.map((player) => (
            <div
              key={player.id}
              className="border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 rounded-lg overflow-hidden"
            >
              <button
                onClick={() => toggleExpanded(player.id)}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-amber-100 dark:hover:bg-amber-900/30"
              >
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  <span className="font-medium text-gray-900 dark:text-white">
                    {player.fullName}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    ({player.requests.filter(r => r.resolvedPlayerId === null && r.rawString.trim() !== '').length} unresolved)
                  </span>
                </div>
                {expandedPlayerId === player.id ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </button>

              {expandedPlayerId === player.id && (
                <div className="px-4 pb-4 border-t border-amber-200 dark:border-amber-700">
                  {player.requests.map((request, requestIndex) => {
                    if (request.rawString.trim() === '') return null;

                    const isResolved = request.resolvedPlayerId !== null;
                    const suggestions = getSuggestedMatches(request.rawString, player.id);
                    const filtered = getFilteredPlayers(player.id, requestIndex);

                    return (
                      <div
                        key={requestIndex}
                        className={`mt-3 p-3 rounded-lg ${
                          isResolved
                            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                            : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            Requested:
                          </span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            "{request.rawString}"
                          </span>
                          {isResolved && (
                            <>
                              <ArrowRight className="w-4 h-4 text-gray-400" />
                              <span className="text-green-600 dark:text-green-400">
                                {request.resolvedPlayerName}
                              </span>
                              {request.isTwoWay && (
                                <span className="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
                                  Two-way
                                </span>
                              )}
                            </>
                          )}
                        </div>

                        {!isResolved && (
                          <div className="space-y-2">
                            {/* Suggestions */}
                            {suggestions.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {suggestions.map((suggestion) => (
                                  <button
                                    key={suggestion.id}
                                    onClick={() => onResolve(player.id, requestIndex, suggestion.id)}
                                    className="px-2 py-1 text-sm border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50"
                                  >
                                    {suggestion.fullName}
                                    <span className="text-xs text-blue-500 ml-1">
                                      ({Math.round(suggestion.score * 100)}%)
                                    </span>
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Search */}
                            <input
                              type="text"
                              placeholder="Search all players..."
                              value={searchTerms.get(getSearchKey(player.id, requestIndex)) || ''}
                              onChange={(e) => handleSearchChange(player.id, requestIndex, e.target.value)}
                              className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                            />

                            {/* Filtered list (show when searching) */}
                            {searchTerms.get(getSearchKey(player.id, requestIndex)) && (
                              <div className="max-h-32 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded">
                                {filtered.map((p) => (
                                  <button
                                    key={p.id}
                                    onClick={() => onResolve(player.id, requestIndex, p.id)}
                                    className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                                  >
                                    {p.fullName}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* All resolved */}
      {playersWithUnresolved.length === 0 && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
            <span className="text-green-800 dark:text-green-200 font-medium">
              All teammate requests resolved
            </span>
          </div>
        </div>
      )}

      {/* Two-way request summary */}
      {twoWayCount > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
            Two-Way Friend Requests ({twoWayCount / 2} pairs)
          </h4>
          <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
            These pairs of players requested each other and will be prioritized to be placed on the same team.
          </p>
          <div className="flex flex-wrap gap-2">
            {players.flatMap((player) =>
              player.requests
                .filter(r => r.isTwoWay && r.resolvedPlayerId)
                .filter(r => player.id < r.resolvedPlayerId!) // Avoid duplicates
                .map((request) => (
                  <div
                    key={`${player.id}-${request.resolvedPlayerId}`}
                    className="flex items-center gap-2 px-3 py-1 bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700 rounded-full text-sm"
                  >
                    <span className="font-medium text-gray-900 dark:text-white">
                      {player.fullName}
                    </span>
                    <span className="text-blue-500">↔</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {request.resolvedPlayerName}
                    </span>
                  </div>
                ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
