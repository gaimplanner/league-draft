import { useState, useMemo } from 'react';
import {
  X,
  ArrowRight,
  ArrowLeftRight,
  User,
  Users,
  Check,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import { Player } from '../../types';
import {
  TeamBuilderResult,
  PlayerHappiness,
  TeamSummary,
} from '../../utils/teamBuilderAlgorithm';

interface PlayerDetailDrawerProps {
  player: Player;
  happiness: PlayerHappiness;
  currentTeam: TeamSummary;
  result: TeamBuilderResult;
  allPlayers: Player[];
  onClose: () => void;
  onMovePlayer?: (playerId: string, toTeamId: string) => void;
  onSwapPlayers?: (player1Id: string, player2Id: string) => void;
}

interface RequestedPlayer {
  id: string | null;
  name: string;
  rawRequest: string;
  team: TeamSummary | null;
  isTwoWay: boolean;
  isHonored: boolean;
}

/**
 * Slide-out drawer showing detailed request information for a player.
 * Enables quick moves/swaps to satisfy requests.
 */
export const PlayerDetailDrawer = ({
  player,
  happiness,
  currentTeam,
  result,
  allPlayers,
  onClose,
  onMovePlayer,
  onSwapPlayers,
}: PlayerDetailDrawerProps) => {
  const [moveMode, setMoveMode] = useState<'none' | 'move' | 'swap'>('none');
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedSwapPlayerId, setSelectedSwapPlayerId] = useState<string | null>(null);

  const playerMap = useMemo(() => new Map(allPlayers.map(p => [p.id, p])), [allPlayers]);

  // Build teammate request details
  const teammateRequests: RequestedPlayer[] = useMemo(() => {
    if (!player.teammateRequests || player.teammateRequests.length === 0) return [];

    const tbPlayer = player as Player & {
      resolvedTeammateIds?: string[];
      twoWayTeammateIds?: string[];
    };
    const resolvedIds = tbPlayer.resolvedTeammateIds || [];
    const twoWayIds = new Set(tbPlayer.twoWayTeammateIds || []);

    return player.teammateRequests.map((reqName, idx) => {
      const resolvedId = resolvedIds[idx] || null;
      const resolvedPlayer = resolvedId ? playerMap.get(resolvedId) : null;
      const assignment = resolvedId
        ? result.assignments.find(a => a.playerId === resolvedId)
        : null;
      const team = assignment
        ? result.teamSummaries.find(t => t.teamId === assignment.teamId) || null
        : null;

      const isOnSameTeam = team?.teamId === currentTeam.teamId;

      return {
        id: resolvedId,
        name: resolvedPlayer?.name || reqName,
        rawRequest: reqName,
        team,
        isTwoWay: resolvedId ? twoWayIds.has(resolvedId) : false,
        isHonored: isOnSameTeam,
      };
    });
  }, [player, result, currentTeam, playerMap]);

  // Coach request details
  const coachRequestDetails = useMemo(() => {
    if (!player.coachRequest) return null;

    // Find if the requested coach matches any team
    const requestedTeam = result.teamSummaries.find(t =>
      t.coachName.toLowerCase().includes(player.coachRequest!.toLowerCase()) ||
      player.coachRequest!.toLowerCase().includes(t.coachName.toLowerCase())
    );

    return {
      rawRequest: player.coachRequest,
      requestedTeam,
      isHonored: happiness.coachRequestHonored === true,
      currentTeam,
    };
  }, [player, result, happiness, currentTeam]);

  // Get players on each team for swap selection
  const teamRosters = useMemo(() => {
    const rosters = new Map<string, Player[]>();
    for (const team of result.teamSummaries) {
      const teamPlayers = result.assignments
        .filter(a => a.teamId === team.teamId)
        .map(a => playerMap.get(a.playerId))
        .filter((p): p is Player => p !== undefined)
        .sort((a, b) => a.name.localeCompare(b.name));
      rosters.set(team.teamId, teamPlayers);
    }
    return rosters;
  }, [result, playerMap]);

  // Suggested moves: teams where this player would have more requests honored
  const suggestedMoves = useMemo(() => {
    const suggestions: Array<{
      team: TeamSummary;
      newHonoredCount: number;
      currentHonoredCount: number;
      reason: string;
    }> = [];

    const currentHonored = teammateRequests.filter(r => r.isHonored).length +
      (coachRequestDetails?.isHonored ? 1 : 0);

    for (const team of result.teamSummaries) {
      if (team.teamId === currentTeam.teamId) continue;

      let newHonored = 0;
      const reasons: string[] = [];

      // Check teammate requests
      for (const req of teammateRequests) {
        if (req.team?.teamId === team.teamId) {
          newHonored++;
          reasons.push(`${req.name} is on this team`);
        }
      }

      // Check coach request
      if (coachRequestDetails?.requestedTeam?.teamId === team.teamId) {
        newHonored++;
        reasons.push(`Requested coach ${team.coachName}`);
      }

      if (newHonored > currentHonored) {
        suggestions.push({
          team,
          newHonoredCount: newHonored,
          currentHonoredCount: currentHonored,
          reason: reasons.join(', '),
        });
      }
    }

    return suggestions.sort((a, b) => b.newHonoredCount - a.newHonoredCount);
  }, [teammateRequests, coachRequestDetails, currentTeam, result.teamSummaries]);

  const handleMove = () => {
    if (selectedTeamId && onMovePlayer) {
      onMovePlayer(player.id, selectedTeamId);
      setMoveMode('none');
      setSelectedTeamId(null);
    }
  };

  const handleSwap = () => {
    if (selectedSwapPlayerId && onSwapPlayers) {
      onSwapPlayers(player.id, selectedSwapPlayerId);
      setMoveMode('none');
      setSelectedSwapPlayerId(null);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white dark:bg-gray-800 shadow-xl border-l border-gray-200 dark:border-gray-700 z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">
            {player.name}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {currentTeam.teamName || currentTeam.coachName} • Score: {player.totalScore.toFixed(1)}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Coach Request */}
        <section>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
            <User className="w-4 h-4" />
            Coach Request
          </h4>
          {coachRequestDetails ? (
            <div className={`p-3 rounded-lg border ${
              coachRequestDetails.isHonored
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Requested: <strong>{coachRequestDetails.rawRequest}</strong>
                </span>
                {coachRequestDetails.isHonored ? (
                  <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400" />
                )}
              </div>
              {!coachRequestDetails.isHonored && coachRequestDetails.requestedTeam && (
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Coach {coachRequestDetails.requestedTeam.coachName} is on team "{coachRequestDetails.requestedTeam.teamName || coachRequestDetails.requestedTeam.coachName}"
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600">
              <span className="text-sm text-gray-500 dark:text-gray-400">No coach request</span>
            </div>
          )}
        </section>

        {/* Teammate Requests */}
        <section>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
            <Users className="w-4 h-4" />
            Teammate Requests ({happiness.teammateRequestsHonored}/{happiness.teammateRequestsTotal})
          </h4>
          {teammateRequests.length > 0 ? (
            <div className="space-y-2">
              {teammateRequests.map((req, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border ${
                    req.isHonored
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                      : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {req.name}
                      </span>
                      {req.isTwoWay && (
                        <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded">
                          Two-way
                        </span>
                      )}
                    </div>
                    {req.isHonored ? (
                      <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400" />
                    )}
                  </div>
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <span>Currently on:</span>
                    <span className={req.isHonored ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}>
                      {req.team?.teamName || req.team?.coachName || 'Unknown'}
                    </span>
                    {!req.isHonored && req.team && (
                      <ChevronRight className="w-3 h-3" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600">
              <span className="text-sm text-gray-500 dark:text-gray-400">No teammate requests</span>
            </div>
          )}
        </section>

        {/* Suggested Moves */}
        {suggestedMoves.length > 0 && (
          <section>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <ArrowRight className="w-4 h-4" />
              Suggested Moves
            </h4>
            <div className="space-y-2">
              {suggestedMoves.slice(0, 3).map((suggestion) => (
                <button
                  key={suggestion.team.teamId}
                  onClick={() => {
                    setMoveMode('move');
                    setSelectedTeamId(suggestion.team.teamId);
                  }}
                  className="w-full p-3 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 text-left transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-purple-900 dark:text-purple-100">
                      Move to {suggestion.team.teamName || suggestion.team.coachName}
                    </span>
                    <span className="text-xs bg-purple-200 dark:bg-purple-800 text-purple-800 dark:text-purple-200 px-2 py-0.5 rounded">
                      +{suggestion.newHonoredCount - suggestion.currentHonoredCount} requests
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-purple-700 dark:text-purple-300">
                    {suggestion.reason}
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Action Buttons */}
        {(onMovePlayer || onSwapPlayers) && moveMode === 'none' && (
          <section className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Manual Actions
            </h4>
            <div className="flex gap-2">
              {onMovePlayer && (
                <button
                  onClick={() => setMoveMode('move')}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-blue-500 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-sm"
                >
                  <ArrowRight className="w-4 h-4" />
                  Move to Team
                </button>
              )}
              {onSwapPlayers && (
                <button
                  onClick={() => setMoveMode('swap')}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-amber-500 text-amber-600 dark:text-amber-400 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 text-sm"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  Swap with Player
                </button>
              )}
            </div>
          </section>
        )}

        {/* Move Mode - Select Team */}
        {moveMode === 'move' && (
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Select Destination Team
              </h4>
              <button
                onClick={() => {
                  setMoveMode('none');
                  setSelectedTeamId(null);
                }}
                className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                Cancel
              </button>
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {result.teamSummaries
                .filter(t => t.teamId !== currentTeam.teamId)
                .map(team => (
                  <button
                    key={team.teamId}
                    onClick={() => setSelectedTeamId(team.teamId)}
                    className={`w-full p-2 rounded-lg text-left text-sm flex items-center justify-between ${
                      selectedTeamId === team.teamId
                        ? 'bg-blue-100 dark:bg-blue-900/30 border border-blue-500'
                        : 'bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                  >
                    <span>{team.teamName || team.coachName}</span>
                    <span className="text-xs text-gray-500">
                      {team.rosterCount} players
                    </span>
                  </button>
                ))}
            </div>
            {selectedTeamId && (
              <button
                onClick={handleMove}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
              >
                Confirm Move
              </button>
            )}
          </section>
        )}

        {/* Swap Mode - Select Player */}
        {moveMode === 'swap' && (
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Select Player to Swap With
              </h4>
              <button
                onClick={() => {
                  setMoveMode('none');
                  setSelectedSwapPlayerId(null);
                }}
                className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                Cancel
              </button>
            </div>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {result.teamSummaries
                .filter(t => t.teamId !== currentTeam.teamId)
                .map(team => {
                  const roster = teamRosters.get(team.teamId) || [];
                  return (
                    <div key={team.teamId}>
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        {team.teamName || team.coachName}
                      </div>
                      <div className="space-y-1">
                        {roster.map(p => (
                          <button
                            key={p.id}
                            onClick={() => setSelectedSwapPlayerId(p.id)}
                            className={`w-full p-2 rounded-lg text-left text-sm flex items-center justify-between ${
                              selectedSwapPlayerId === p.id
                                ? 'bg-amber-100 dark:bg-amber-900/30 border border-amber-500'
                                : 'bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                            }`}
                          >
                            <span>{p.name}</span>
                            <span className="text-xs text-gray-500">
                              {p.totalScore.toFixed(1)}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
            </div>
            {selectedSwapPlayerId && (
              <button
                onClick={handleSwap}
                className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium"
              >
                Confirm Swap
              </button>
            )}
          </section>
        )}
      </div>

      {/* Footer summary */}
      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">
            Happiness Score
          </span>
          <span className={`font-medium ${
            happiness.score === 'all' ? 'text-green-600 dark:text-green-400' :
            happiness.score === 'some' ? 'text-amber-600 dark:text-amber-400' :
            happiness.score === 'none' ? 'text-red-600 dark:text-red-400' :
            'text-gray-500'
          }`}>
            {happiness.score === 'all' ? '🟢 All Requests Honored' :
             happiness.score === 'some' ? '🟡 Some Requests Honored' :
             happiness.score === 'none' ? '🔴 No Requests Honored' :
             '⚪ No Requests Made'}
          </span>
        </div>
      </div>
    </div>
  );
};
