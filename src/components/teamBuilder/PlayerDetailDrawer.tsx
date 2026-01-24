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
  Lightbulb,
  Scale,
} from 'lucide-react';
import { Player, CorrectionReason } from '../../types';
import {
  TeamBuilderResult,
  PlayerHappiness,
  TeamSummary,
  AssignmentResult,
  AssignmentReason,
} from '../../utils/teamBuilderAlgorithm';
import { CorrectionPrompt } from './CorrectionPrompt';

interface PlayerDetailDrawerProps {
  player: Player;
  happiness: PlayerHappiness;
  currentTeam: TeamSummary;
  result: TeamBuilderResult;
  allPlayers: Player[];
  assignment?: AssignmentResult;
  onClose: () => void;
  onMovePlayer?: (playerId: string, toTeamId: string, correctionData?: { reason: CorrectionReason; notes?: string }) => void;
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
/**
 * Get a human-readable description of the assignment reason.
 */
const getReasonDescription = (reason: AssignmentReason): { label: string; description: string; icon: string } => {
  switch (reason) {
    case 'coach-kid':
      return {
        label: "Coach's Kid",
        description: 'Automatically assigned to parent coach\'s team',
        icon: '👨‍👧',
      };
    case 'assistant-coach-kid':
      return {
        label: 'Assistant Coach\'s Kid',
        description: 'Automatically assigned to parent assistant coach\'s team',
        icon: '👨‍👧',
      };
    case 'sibling-lock':
      return {
        label: 'Sibling Lock',
        description: 'Placed with sibling who was assigned earlier',
        icon: '👫',
      };
    case 'manual-lock':
      return {
        label: 'Manual Lock',
        description: 'Pre-assigned to this team before algorithm ran',
        icon: '🔒',
      };
    case 'top-talent':
      return {
        label: 'Top Talent Distribution',
        description: 'Distributed to balance skill across teams',
        icon: '⭐',
      };
    case 'two-way-friend':
      return {
        label: 'Two-Way Friend Request',
        description: 'Placed with friend who also requested them',
        icon: '🤝',
      };
    case 'one-way-friend':
      return {
        label: 'One-Way Friend Request',
        description: 'Placed with a friend they requested',
        icon: '👋',
      };
    case 'coach-request':
      return {
        label: 'Coach Request Honored',
        description: 'Placed with requested coach',
        icon: '✅',
      };
    case 'school-cluster':
      return {
        label: 'School Clustering',
        description: 'Placed with players from same school',
        icon: '🏫',
      };
    case 'balance':
      return {
        label: 'Team Balance',
        description: 'Assigned to balance team scores (no satisfiable requests)',
        icon: '⚖️',
      };
    default:
      return {
        label: 'Unknown',
        description: 'Assignment reason not recorded',
        icon: '❓',
      };
  }
};

export const PlayerDetailDrawer = ({
  player,
  happiness,
  currentTeam,
  result,
  allPlayers,
  assignment,
  onClose,
  onMovePlayer,
  onSwapPlayers,
}: PlayerDetailDrawerProps) => {
  // 'confirm' mode is used when a suggested move is clicked - skip team selection
  // 'correction' mode shows the CorrectionPrompt after a move is confirmed
  const [moveMode, setMoveMode] = useState<'none' | 'move' | 'swap' | 'confirm' | 'correction'>('none');
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedSwapPlayerId, setSelectedSwapPlayerId] = useState<string | null>(null);

  // Pending move state for correction prompt flow
  const [pendingMove, setPendingMove] = useState<{
    playerId: string;
    toTeamId: string;
    fromTeamName: string;
    toTeamName: string;
  } | null>(null);

  const playerMap = useMemo(() => new Map(allPlayers.map(p => [p.id, p])), [allPlayers]);

  // Get the selected team details for confirm mode
  const selectedTeam = useMemo(() => {
    if (!selectedTeamId) return null;
    return result.teamSummaries.find(t => t.teamId === selectedTeamId) || null;
  }, [selectedTeamId, result.teamSummaries]);

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

  // Calculate request satisfaction analysis for all teams (for "Why Not Here?" breakdown)
  const alternativesAnalysis = useMemo(() => {
    const currentHonored = teammateRequests.filter(r => r.isHonored).length +
      (coachRequestDetails?.isHonored ? 1 : 0);

    return result.teamSummaries
      .filter(team => team.teamId !== currentTeam.teamId)
      .map(team => {
        let coachMatch = false;
        let friendsOnTeam: string[] = [];

        // Check coach request
        if (coachRequestDetails?.requestedTeam?.teamId === team.teamId) {
          coachMatch = true;
        }

        // Check teammate requests
        for (const req of teammateRequests) {
          if (req.team?.teamId === team.teamId) {
            friendsOnTeam.push(req.name);
          }
        }

        const wouldHonor = friendsOnTeam.length + (coachMatch ? 1 : 0);
        const comparison = wouldHonor > currentHonored ? 'better' :
                          wouldHonor === currentHonored ? 'same' : 'worse';

        return {
          team,
          coachMatch,
          friendsOnTeam,
          wouldHonor,
          comparison,
        };
      })
      .sort((a, b) => b.wouldHonor - a.wouldHonor);
  }, [teammateRequests, coachRequestDetails, currentTeam, result.teamSummaries]);

  const handleMove = () => {
    if (selectedTeamId && onMovePlayer) {
      const toTeam = result.teamSummaries.find(t => t.teamId === selectedTeamId);
      // Set up pending move and show correction prompt
      setPendingMove({
        playerId: player.id,
        toTeamId: selectedTeamId,
        fromTeamName: currentTeam.teamName || currentTeam.coachName,
        toTeamName: toTeam?.teamName || toTeam?.coachName || 'Unknown',
      });
      setMoveMode('correction');
    }
  };

  const handleCorrectionSave = (reason: CorrectionReason, notes?: string) => {
    if (pendingMove && onMovePlayer) {
      // Execute the move with correction data
      onMovePlayer(pendingMove.playerId, pendingMove.toTeamId, { reason, notes });
      // Reset state and close drawer
      setPendingMove(null);
      setMoveMode('none');
      setSelectedTeamId(null);
      onClose();
    }
  };

  const handleCorrectionSkip = () => {
    if (pendingMove && onMovePlayer) {
      // Execute the move without correction data
      onMovePlayer(pendingMove.playerId, pendingMove.toTeamId);
      // Reset state and close drawer
      setPendingMove(null);
      setMoveMode('none');
      setSelectedTeamId(null);
      onClose();
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
        {/* Decision Reasoning - WHY this player was placed here */}
        {assignment && (
          <section>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <Lightbulb className="w-4 h-4" />
              Algorithm Decision
            </h4>
            <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800">
              {(() => {
                const reasonInfo = getReasonDescription(assignment.reason);
                return (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{reasonInfo.icon}</span>
                      <span className="font-medium text-indigo-900 dark:text-indigo-100">
                        {reasonInfo.label}
                      </span>
                    </div>
                    <p className="text-sm text-indigo-700 dark:text-indigo-300 mb-3">
                      {reasonInfo.description}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-indigo-600 dark:text-indigo-400">
                      <span className="flex items-center gap-1">
                        <Scale className="w-3 h-3" />
                        Round {assignment.round}, Pick {assignment.pick}
                      </span>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Show alternatives considered for balance picks */}
            {assignment.reason === 'balance' && (
              <div className="mt-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Why not placed elsewhere?
                </div>
                <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1.5">
                  {!player.coachRequest && !player.teammateRequests?.length && (
                    <li className="flex items-start gap-2">
                      <span className="text-gray-400">•</span>
                      <span>No coach or friend requests made</span>
                    </li>
                  )}
                  {player.coachRequest && happiness.coachRequestHonored !== true && (
                    <li className="flex items-start gap-2">
                      <span className="text-amber-500">•</span>
                      <span>Coach request "{player.coachRequest}" could not be honored (team may be full or request unsatisfiable)</span>
                    </li>
                  )}
                  {player.teammateRequests && player.teammateRequests.length > 0 && happiness.teammateRequestsHonored === 0 && (
                    <li className="flex items-start gap-2">
                      <span className="text-amber-500">•</span>
                      <span>Friend requests could not be honored (friends may already be on full teams)</span>
                    </li>
                  )}
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500">•</span>
                    <span>
                      Assigned to {currentTeam.teamName || currentTeam.coachName} to balance team scores
                      {currentTeam.meanDeltaPercent !== 0 && (
                        <span className={currentTeam.meanDeltaPercent > 0 ? ' text-green-600' : ' text-red-600'}>
                          {' '}({currentTeam.meanDeltaPercent > 0 ? '+' : ''}{currentTeam.meanDeltaPercent.toFixed(1)}% from mean)
                        </span>
                      )}
                    </span>
                  </li>
                </ul>
              </div>
            )}

            {/* Show what requests were honored for request-based placements */}
            {['two-way-friend', 'one-way-friend', 'coach-request'].includes(assignment.reason) && (
              <div className="mt-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <div className="text-sm font-medium text-green-700 dark:text-green-300 mb-2">
                  Request satisfied
                </div>
                <ul className="text-xs text-green-600 dark:text-green-400 space-y-1.5">
                  {assignment.reason === 'coach-request' && (
                    <li className="flex items-start gap-2">
                      <Check className="w-3 h-3 mt-0.5" />
                      <span>Placed with requested coach: {currentTeam.coachName}</span>
                    </li>
                  )}
                  {assignment.reason === 'two-way-friend' && (
                    <li className="flex items-start gap-2">
                      <Check className="w-3 h-3 mt-0.5" />
                      <span>Placed with mutual friend (two-way request)</span>
                    </li>
                  )}
                  {assignment.reason === 'one-way-friend' && (
                    <li className="flex items-start gap-2">
                      <Check className="w-3 h-3 mt-0.5" />
                      <span>Placed with a friend they requested</span>
                    </li>
                  )}
                </ul>
              </div>
            )}
          </section>
        )}

        {/* Team-by-Team Analysis (for players with requests) */}
        {(player.coachRequest || (player.teammateRequests && player.teammateRequests.length > 0)) && (
          <section>
            <details className="group">
              <summary className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer flex items-center gap-2 hover:text-gray-900 dark:hover:text-white">
                <ChevronRight className="w-4 h-4 transition-transform group-open:rotate-90" />
                Team-by-Team Analysis
                <span className="text-xs text-gray-400 font-normal">
                  (click to expand)
                </span>
              </summary>
              <div className="mt-3 space-y-2">
                {/* Current team first */}
                <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      {currentTeam.teamName || currentTeam.coachName}
                      <span className="ml-2 text-xs bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded">
                        Current
                      </span>
                    </span>
                    <span className="text-xs text-blue-600 dark:text-blue-400">
                      {happiness.teammateRequestsHonored + (happiness.coachRequestHonored ? 1 : 0)} requests honored
                    </span>
                  </div>
                </div>

                {/* Other teams sorted by how many requests would be honored */}
                {alternativesAnalysis.map(({ team, coachMatch, friendsOnTeam, wouldHonor }) => (
                  <div
                    key={team.teamId}
                    className={`p-2 rounded-lg border ${
                      wouldHonor > 0
                        ? 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600'
                        : 'bg-gray-50/50 dark:bg-gray-800/30 border-gray-100 dark:border-gray-700/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-sm ${wouldHonor > 0 ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                        {team.teamName || team.coachName}
                      </span>
                      <span className={`text-xs ${
                        wouldHonor > (happiness.teammateRequestsHonored + (happiness.coachRequestHonored ? 1 : 0))
                          ? 'text-purple-600 dark:text-purple-400 font-medium'
                          : wouldHonor > 0
                          ? 'text-gray-600 dark:text-gray-400'
                          : 'text-gray-400 dark:text-gray-500'
                      }`}>
                        {wouldHonor} requests
                      </span>
                    </div>
                    {(coachMatch || friendsOnTeam.length > 0) && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {coachMatch && <span className="mr-2">✓ Coach match</span>}
                        {friendsOnTeam.length > 0 && (
                          <span>✓ {friendsOnTeam.join(', ')}</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </details>
          </section>
        )}

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
              {teammateRequests.map((req, idx) => {
                // Get more context about the requested player
                const requestedPlayer = req.id ? playerMap.get(req.id) : null;
                const requestedPlayerScore = requestedPlayer?.totalScore || 0;

                // Find how many of the current player's OTHER requests are on the same team as this request
                const otherFriendsOnSameTeam = teammateRequests.filter(
                  (otherReq, otherIdx) =>
                    otherIdx !== idx &&
                    otherReq.team?.teamId === req.team?.teamId &&
                    otherReq.id !== req.id
                );

                return (
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
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      <div className="flex items-center gap-1">
                        <span>Currently on:</span>
                        <span className={req.isHonored ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}>
                          {req.team?.teamName || req.team?.coachName || 'Unknown'}
                        </span>
                        {!req.isHonored && req.team && (
                          <ChevronRight className="w-3 h-3" />
                        )}
                      </div>
                      {/* Show score and other friends context */}
                      <div className="mt-1 flex items-center gap-3">
                        {requestedPlayerScore > 0 && (
                          <span>Score: {requestedPlayerScore.toFixed(1)}</span>
                        )}
                        {!req.isHonored && otherFriendsOnSameTeam.length > 0 && (
                          <span className="text-purple-600 dark:text-purple-400">
                            +{otherFriendsOnSameTeam.length} other friend{otherFriendsOnSameTeam.length > 1 ? 's' : ''} on that team
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600">
              <span className="text-sm text-gray-500 dark:text-gray-400">No teammate requests</span>
            </div>
          )}
        </section>

        {/* Suggested Moves */}
        {suggestedMoves.length > 0 && moveMode === 'none' && (
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
                    // Go directly to confirm mode, skipping team selection
                    setMoveMode('confirm');
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

        {/* Action Buttons - only show when not in any selection mode */}
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

        {/* Confirm Move Mode - when clicking a suggested move */}
        {moveMode === 'confirm' && selectedTeam && (
          <section className="space-y-3">
            <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
              <div className="text-sm font-medium text-purple-900 dark:text-purple-100 mb-2">
                Move {player.name} to {selectedTeam.teamName || selectedTeam.coachName}?
              </div>
              <div className="text-xs text-purple-700 dark:text-purple-300 space-y-1">
                <div>Current team: {currentTeam.teamName || currentTeam.coachName}</div>
                <div>New team has {selectedTeam.rosterCount} players (avg: {selectedTeam.averageScore.toFixed(1)})</div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setMoveMode('none');
                  setSelectedTeamId(null);
                }}
                className="flex-1 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleMove}
                className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium"
              >
                Confirm Move
              </button>
            </div>
          </section>
        )}

        {/* Move Mode - Select Team (confirm button moved to footer) */}
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
            <div className="space-y-1">
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
          </section>
        )}
      </div>

      {/* Footer - shows confirm buttons when in selection mode, otherwise shows happiness score */}
      <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        {/* Move mode confirm button */}
        {moveMode === 'move' && selectedTeamId && selectedTeam && (
          <div className="px-4 py-3 space-y-2">
            <div className="text-xs text-gray-600 dark:text-gray-400">
              Move to: <span className="font-medium text-gray-900 dark:text-white">{selectedTeam.teamName || selectedTeam.coachName}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setMoveMode('none');
                  setSelectedTeamId(null);
                }}
                className="flex-1 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleMove}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
              >
                Confirm Move
              </button>
            </div>
          </div>
        )}

        {/* Swap mode confirm button */}
        {moveMode === 'swap' && selectedSwapPlayerId && (
          <div className="px-4 py-3 space-y-2">
            <div className="text-xs text-gray-600 dark:text-gray-400">
              Swap with: <span className="font-medium text-gray-900 dark:text-white">
                {playerMap.get(selectedSwapPlayerId)?.name || 'Unknown'}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setMoveMode('none');
                  setSelectedSwapPlayerId(null);
                }}
                className="flex-1 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSwap}
                className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium"
              >
                Confirm Swap
              </button>
            </div>
          </div>
        )}

        {/* Correction prompt - shown after confirming a move */}
        {moveMode === 'correction' && pendingMove && (
          <div className="px-4 py-3">
            <CorrectionPrompt
              playerName={player.name}
              fromTeamName={pendingMove.fromTeamName}
              toTeamName={pendingMove.toTeamName}
              onSave={handleCorrectionSave}
              onSkip={handleCorrectionSkip}
            />
          </div>
        )}

        {/* Default footer - happiness score (when not in selection mode or nothing selected) */}
        {(moveMode === 'none' || moveMode === 'confirm' || (moveMode === 'move' && !selectedTeamId) || (moveMode === 'swap' && !selectedSwapPlayerId)) && (
          <div className="px-4 py-3">
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
        )}
      </div>
    </div>
  );
};
