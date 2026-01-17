import { useState, useEffect, useRef } from 'react';
import { Undo, ChevronLeft, AlertCircle, Search, ChevronRight } from 'lucide-react';
import { DraftState, Team, DivisionAgeRange } from '../types';
import { TeamRosters } from './TeamRosters';
import { getNextPick, calculateDraftOrder } from '../utils/draftOrder';
import { useViewMode } from '../contexts/ViewContext';
import { getTeamDisplayName } from '../utils/teamUtils';

interface DraftBoardProps {
  draftState: DraftState;
  onDraftPlayer: (playerId: string) => void;
  onSkipPick: () => void;
  onUndo: () => void;
  onReset: () => void;
  enforceAgeLimit: boolean;
  maxPerAge: number;
  ageRange?: DivisionAgeRange;
  pendingComplete: boolean;
  onFinalizeDraft: () => void;
  onCancelComplete: () => void;
}

export const DraftBoard = ({
  draftState,
  onDraftPlayer,
  onSkipPick,
  onUndo,
  onReset,
  enforceAgeLimit,
  maxPerAge,
  ageRange,
  pendingComplete,
  onFinalizeDraft,
  onCancelComplete,
}: DraftBoardProps) => {
  const viewMode = useViewMode();
  const isPublicView = viewMode === 'public';

  const [searchTerm, setSearchTerm] = useState('');
  const [showRoundInterstitial, setShowRoundInterstitial] = useState(false);
  const [interstitialData, setInterstitialData] = useState<{
    completedRound: number;
    nextRound: number;
    newOrder: Array<{ team: Team; position: number; score: number }>;
  } | null>(null);
  const previousRoundRef = useRef(draftState.currentRound);

  // Detect when we advance to a new round
  useEffect(() => {
    if (draftState.currentRound > previousRoundRef.current && draftState.currentRound > 1) {
      // Round has advanced - show interstitial
      const newOrder = draftState.currentRoundOrder.map((teamId, index) => {
        const team = draftState.teams.find(t => t.id === teamId)!;
        return {
          team,
          position: index + 1,
          score: team.totalScore,
        };
      });

      setInterstitialData({
        completedRound: previousRoundRef.current,
        nextRound: draftState.currentRound,
        newOrder,
      });
      setShowRoundInterstitial(true);
    }
    previousRoundRef.current = draftState.currentRound;
  }, [draftState.currentRound, draftState.currentRoundOrder, draftState.teams]);

  const availablePlayers = draftState.players
    .filter((p) => !p.isDrafted)
    .filter((p) =>
      searchTerm === '' ||
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

  const currentTeam = draftState.teams.find((t) => t.id === draftState.currentTeamId);

  // Calculate next team
  const { round: nextRound, pickInRound: nextPickInRound } = getNextPick(
    draftState.currentRound,
    draftState.currentPickInRound,
    draftState.teams.length
  );

  // For next team preview, we need to check if we're advancing to a new round
  let nextTeamId: string | null = null;
  if (nextRound === draftState.currentRound) {
    // Same round - use cached order
    nextTeamId = draftState.currentRoundOrder[nextPickInRound - 1] || null;
  } else {
    // Would be next round - calculate what that order would be
    // (This is just for preview, the actual order will be calculated when the pick is made)
    const previewNextRoundOrder = calculateDraftOrder(
      draftState.teams,
      nextRound,
      draftState.draftFormat,
      draftState.draftOrder
    );
    nextTeamId = previewNextRoundOrder[0] || null;
  }

  const nextTeam = draftState.teams.find((t) => t.id === nextTeamId);

  const totalRounds = Math.ceil(draftState.players.length / draftState.teams.length);
  const totalPicks = draftState.teams.length * totalRounds;
  const currentPickNumber = (draftState.currentRound - 1) * draftState.teams.length + draftState.currentPickInRound;
  const isFinalRound = draftState.currentRound === totalRounds;

  const handleSkipPick = () => {
    if (!currentTeam) return;
    if (window.confirm(`Skip pick for ${getTeamDisplayName(currentTeam)}? They will have one fewer player.`)) {
      onSkipPick();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      {/* Round Completion Interstitial Modal */}
      {showRoundInterstitial && interstitialData && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-500 to-blue-500 p-4 text-white text-center flex-shrink-0">
              <div className="text-base opacity-90 mb-1">🎉 Round {interstitialData.completedRound} Complete!</div>
              <h2 className="text-xl font-bold">Draft Order for Round {interstitialData.nextRound}</h2>
            </div>

            {/* Team Order - no scroll, compact rows */}
            <div className="p-4 flex-1">
              <div className="space-y-1">
                {interstitialData.newOrder.map(({ team, position, score }) => (
                  <div
                    key={team.id}
                    className="flex items-center gap-3 py-2 px-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <div className="w-7 h-7 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
                      {position}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-white">
                        {getTeamDisplayName(team)}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-gray-900 dark:text-white">{score.toFixed(1)}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">pts</span>
                    </div>
                  </div>
                ))}
              </div>

              {draftState.draftFormat === 'recalculated' && (
                <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-800 dark:text-blue-200">
                  📊 Order recalculated based on team scores (lowest picks first)
                </div>
              )}
              {draftState.draftFormat === 'snake' && (
                <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-800 dark:text-blue-200">
                  🐍 Snake draft: Order reversed from previous round
                </div>
              )}
            </div>

            {/* Continue Button */}
            <div className="p-4 pt-0 flex-shrink-0">
              <button
                onClick={() => setShowRoundInterstitial(false)}
                className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold text-lg rounded-lg shadow-lg flex items-center justify-center gap-2"
              >
                Continue to Round {interstitialData.nextRound}
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        {/* Prominent Draft Header - ESPN Style */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-500 rounded-lg p-6 sm:p-8 mb-4 text-white shadow-lg">
          {/* Header with centered content and absolute-positioned buttons */}
          <div className="relative">
            {/* Centered content */}
            {currentTeam && (
              <div className="text-center">
                <div className="text-sm uppercase tracking-wide opacity-90 mb-1">
                  Round {draftState.currentRound}, Pick {currentPickNumber} of {totalPicks}
                </div>
                <h1 className="text-3xl sm:text-4xl font-bold mb-2">
                  Now Drafting: {getTeamDisplayName(currentTeam)}
                </h1>
                {nextTeam && (
                  <div className="text-lg opacity-80">
                    Up Next: {getTeamDisplayName(nextTeam)}
                  </div>
                )}
                {/* Age Breakdown - only show if age limit is enforced */}
                {enforceAgeLimit && maxPerAge > 0 && (
                  <div className="mt-2 flex items-center justify-center gap-2 text-sm">
                    <span className="text-white/60">Roster:</span>
                    {Object.entries(currentTeam.ageBreakdown || {})
                      .sort(([a], [b]) => Number(a) - Number(b))
                      .map(([age, count]) => (
                        <span
                          key={age}
                          className={`px-2 py-1 rounded ${
                            count >= maxPerAge
                              ? 'bg-red-500/30 text-red-300'
                              : count >= maxPerAge - 1
                              ? 'bg-yellow-500/30 text-yellow-300'
                              : 'bg-white/20 text-white/90'
                          }`}
                        >
                          {age}yr: {count}
                        </span>
                      ))}
                    {Object.keys(currentTeam.ageBreakdown || {}).length === 0 && (
                      <span className="text-white/60">Empty</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Admin controls - absolute positioned top-right, smaller buttons */}
            {!isPublicView && (
              <div className="absolute top-0 right-0 flex gap-1">
                {/* Skip Pick - only available in final round */}
                {isFinalRound && (
                  <button
                    onClick={handleSkipPick}
                    className="px-2 py-1 bg-yellow-500 hover:bg-yellow-600 text-white rounded text-xs font-medium flex items-center gap-1 backdrop-blur-sm"
                    title="Skip this team's pick"
                  >
                    <span>⏭️</span>
                    <span className="hidden sm:inline">Skip</span>
                  </button>
                )}
                <button
                  onClick={onUndo}
                  disabled={draftState.picks.length === 0}
                  className="px-2 py-1 bg-white/20 hover:bg-white/30 text-white rounded text-xs font-medium flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed backdrop-blur-sm"
                  title="Undo last pick"
                >
                  <Undo className="w-3 h-3" />
                  <span className="hidden sm:inline">Undo</span>
                </button>
                <button
                  onClick={onReset}
                  className="px-2 py-1 bg-white/20 hover:bg-white/30 text-white rounded text-xs font-medium flex items-center gap-1 backdrop-blur-sm"
                  title="Return to Draft Setup - this will delete all draft picks"
                >
                  <ChevronLeft className="w-3 h-3" />
                  <span className="hidden sm:inline">Reset</span>
                </button>
              </div>
            )}
            {/* Public view indicator - absolute positioned */}
            {isPublicView && (
              <div className="absolute top-0 right-0 px-3 py-2 bg-white/20 text-white rounded-lg font-medium backdrop-blur-sm">
                Live View
              </div>
            )}
          </div>

          {/* Mandatory Pick Warning */}
          {draftState.mandatoryPick && !isPublicView && (() => {
            const mandatoryPlayer = draftState.players.find((p) => p.id === draftState.mandatoryPick?.playerId);
            return (
              <div className="mt-4 flex justify-center">
                <div className="bg-yellow-50 dark:bg-yellow-900/30 border-2 border-yellow-400 dark:border-yellow-600 rounded-lg p-4 inline-block text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <AlertCircle className="w-6 h-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                    <span className="font-bold text-lg text-yellow-800 dark:text-yellow-200">
                      Mandatory Pick Required
                    </span>
                  </div>
                  <div className="text-sm text-yellow-700 dark:text-yellow-300 mb-3">
                    {draftState.mandatoryPick.reason === 'coach-kid' ? (
                      <>
                        <strong>{mandatoryPlayer?.name}</strong> is a coach's kid and must be drafted in Round {draftState.currentRound}.
                      </>
                    ) : (
                      <>
                        <strong>{mandatoryPlayer?.name}</strong> must be drafted with their sibling ({draftState.mandatoryPick.siblingName}).
                      </>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      if (mandatoryPlayer) {
                        // Directly draft the mandatory player
                        onDraftPlayer(mandatoryPlayer.id);
                      }
                    }}
                    className="px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-bold text-lg rounded-lg inline-flex items-center justify-center gap-2 shadow-lg"
                  >
                    Draft {mandatoryPlayer?.name}
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Best Available by Age - show when no mandatory pick */}
          {!draftState.mandatoryPick && !isPublicView && (() => {
            // Get top 2 available players for each age (only eligible players for current team)
            const topByAge: Record<number, typeof availablePlayers> = {};
            availablePlayers.forEach(player => {
              // Skip players that current team cannot draft
              const isCoachKidForOtherTeam = player.isCoachKid && player.coachTeamId && player.coachTeamId !== draftState.currentTeamId;
              const isSiblingLocked = player.lockedToTeamId && player.lockedToTeamId !== draftState.currentTeamId;
              if (isCoachKidForOtherTeam || isSiblingLocked) return;

              const age = player.littleLeagueAge;
              if (!topByAge[age]) {
                topByAge[age] = [];
              }
              topByAge[age].push(player);
            });

            // Sort each age group by score and keep top 2
            Object.keys(topByAge).forEach(age => {
              topByAge[Number(age)] = topByAge[Number(age)]
                .sort((a, b) => b.totalScore - a.totalScore)
                .slice(0, 2);
            });

            // Only show ages that have available players
            const ages = Object.keys(topByAge)
              .map(Number)
              .filter(age => topByAge[age] && topByAge[age].length > 0)
              .sort((a, b) => a - b);

            if (ages.length === 0) return null;

            return (
              <div className="mt-4 flex justify-center">
                <div className="bg-white/10 rounded-lg p-4 inline-block">
                  <div className="text-sm font-semibold text-white/80 mb-3 text-center">
                    📊 BEST AVAILABLE BY AGE
                  </div>
                  <div className="inline-flex gap-3 flex-wrap justify-center">
                  {ages.map(age => {
                    const players = topByAge[age] || [];
                    return (
                      <div
                        key={age}
                        className="bg-white/10 rounded-lg p-3 flex flex-col items-center min-w-[120px]"
                      >
                        <span className="text-xs text-white/60 mb-2">Age {age}</span>
                        {players.length === 0 ? (
                          <span className="text-sm text-white/40 italic">None available</span>
                        ) : (
                          players.map((player, idx) => (
                            <div key={player.id} className={`flex flex-col items-center w-full ${idx > 0 ? 'mt-2 pt-2 border-t border-white/20' : ''}`}>
                              <span className="font-medium text-white text-sm text-center">
                                {player.firstName} {player.lastName.charAt(0)}.
                              </span>
                              <span className="text-sm text-white/80 mb-1">
                                {player.totalScore.toFixed(1)} pts
                              </span>
                              <button
                                onClick={() => onDraftPlayer(player.id)}
                                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs font-medium w-full"
                              >
                                Draft
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    );
                  })}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Round Order Display */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Round {draftState.currentRound} Draft Order
            </h3>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Format: {draftState.draftFormat}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {draftState.currentRoundOrder.map((teamId, index) => {
              const team = draftState.teams.find(t => t.id === teamId);
              const isPastPick = index + 1 < draftState.currentPickInRound;
              const isCurrentPick = index + 1 === draftState.currentPickInRound;

              return (
                <div
                  key={teamId}
                  className={`
                    flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all
                    ${isCurrentPick
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 shadow-md scale-105'
                      : isPastPick
                      ? 'border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 opacity-50'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700'
                    }
                  `}
                >
                  <span className={`
                    w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                    ${isCurrentPick
                      ? 'bg-blue-500 text-white'
                      : isPastPick
                      ? 'bg-gray-400 text-white'
                      : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                    }
                  `}>
                    {index + 1}
                  </span>
                  <span className={`
                    text-sm font-medium
                    ${isCurrentPick
                      ? 'text-blue-700 dark:text-blue-200'
                      : isPastPick
                      ? 'text-gray-500 dark:text-gray-500 line-through'
                      : 'text-gray-700 dark:text-gray-300'
                    }
                  `}>
                    {team ? getTeamDisplayName(team) : 'Unknown'}
                  </span>
                  {isCurrentPick && (
                    <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">
                      NOW
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Available Players */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 sticky top-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Available Players
                </h2>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {availablePlayers.length} left
                </span>
              </div>

              {/* Search */}
              <div className="mb-4 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search players..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </div>

              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {availablePlayers.map((player) => {
                  const isMandatory = draftState.mandatoryPick?.playerId === player.id;

                  // Check if this is a coach's kid assigned to another team
                  const isCoachKidForOtherTeam = player.isCoachKid &&
                                                  player.coachTeamId &&
                                                  player.coachTeamId !== draftState.currentTeamId;
                  const coachTeam = isCoachKidForOtherTeam
                    ? draftState.teams.find(t => t.id === player.coachTeamId)
                    : null;

                  // Check if this is a sibling locked to another team
                  const isSiblingLockedToOtherTeam = player.lockedToTeamId &&
                                                      player.lockedToTeamId !== draftState.currentTeamId;
                  const siblingLockedTeam = isSiblingLockedToOtherTeam
                    ? draftState.teams.find(t => t.id === player.lockedToTeamId)
                    : null;

                  // Check if player's age is at/over limit for current team (only if age limit is enforced)
                  // This is now a WARNING, not a block
                  const playerAge = player.littleLeagueAge;
                  const currentTeamAgeCount = currentTeam?.ageBreakdown?.[playerAge] || 0;
                  const isAgeWarning = enforceAgeLimit && maxPerAge > 0 && currentTeamAgeCount >= maxPerAge - 1;
                  const isAgeMaxed = enforceAgeLimit && maxPerAge > 0 && currentTeamAgeCount >= maxPerAge;

                  // Player is restricted ONLY if they're a coach's kid for another team or locked sibling
                  // Age limit is a WARNING, not a restriction
                  const isRestricted = isCoachKidForOtherTeam || isSiblingLockedToOtherTeam;
                  return (
                    <div
                      key={player.id}
                      id={`player-${player.id}`}
                      className={`
                        w-full text-left p-3 rounded-lg border-2 transition-all
                        ${
                          isRestricted && !isPublicView
                            ? 'opacity-50 border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/10'
                            : isMandatory && !isPublicView
                            ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20'
                            : 'border-gray-200 dark:border-gray-700'
                        }
                      `}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 dark:text-white truncate">
                            {player.name}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            Rank #{player.rank} • Round {player.lockedToRound ?? player.projectedRound}
                            {player.lockedToRound && player.lockedToRound !== player.projectedRound && (
                              <span className="text-blue-600 dark:text-blue-400 font-bold">*</span>
                            )}
                            {' '}• Age {player.littleLeagueAge}
                          </div>

                          {/* Restricted player warning */}
                          {isCoachKidForOtherTeam && (
                            <div className="text-xs text-red-600 dark:text-red-400 mt-2 font-semibold">
                              ⚠ Coach's kid - Can only be drafted by {coachTeam ? getTeamDisplayName(coachTeam) : 'Unknown'}
                            </div>
                          )}
                          {isSiblingLockedToOtherTeam && !isCoachKidForOtherTeam && (
                            <div className="text-xs text-red-600 dark:text-red-400 mt-2 font-semibold">
                              ⚠ Sibling locked - Must be drafted by {siblingLockedTeam ? getTeamDisplayName(siblingLockedTeam) : 'Unknown'}
                            </div>
                          )}
                          {isAgeMaxed && !isCoachKidForOtherTeam && !isSiblingLockedToOtherTeam && (
                            <div className="text-xs text-orange-600 dark:text-orange-400 mt-2 font-semibold">
                              ⚠️ Warning: Team has {currentTeamAgeCount} players age {playerAge} (limit: {maxPerAge})
                            </div>
                          )}
                          {isAgeWarning && !isAgeMaxed && !isCoachKidForOtherTeam && !isSiblingLockedToOtherTeam && (
                            <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
                              ⚠️ Team has {currentTeamAgeCount} players age {playerAge}
                            </div>
                          )}

                          <div className="flex gap-1 mt-1 flex-wrap">
                            {player.isCoachKid && (
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                isRestricted
                                  ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                                  : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                              }`}>
                                Coach's Kid{coachTeam ? ` (${getTeamDisplayName(coachTeam)})` : ''}
                              </span>
                            )}
                            {player.isDNE && (
                              <span className="text-xs bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 px-2 py-0.5 rounded">
                                DNE
                              </span>
                            )}
                            {player.isAllStar && (
                              <span className="text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-2 py-0.5 rounded">
                                All-Star
                              </span>
                            )}
                            {player.sibling && (
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                isSiblingLockedToOtherTeam
                                  ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                                  : player.lockedToTeamId
                                  ? 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200'
                                  : 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200'
                              }`}>
                                Sibling{player.lockedToTeamId ? ` → ${(() => { const t = draftState.teams.find(t => t.id === player.lockedToTeamId); return t ? getTeamDisplayName(t) : 'Unknown'; })()}` : ''}
                              </span>
                            )}
                          </div>
                        </div>
                        {/* Scores and Draft Button - hidden in public view */}
                        {!isPublicView && (
                          <div className="ml-2 flex items-center gap-3">
                            <div className="text-right">
                              <div className={`text-lg font-bold ${
                                isRestricted
                                  ? 'text-gray-400 dark:text-gray-600'
                                  : 'text-gray-900 dark:text-white'
                              }`}>
                                {player.totalScore.toFixed(1)}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                H:{player.hittingSubtotal.toFixed(0)} F:{player.fieldingSubtotal.toFixed(0)} P:{player.pitchingSubtotal.toFixed(0)}
                              </div>
                            </div>
                            {/* Draft Button */}
                            {!isRestricted && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Check for age warning confirmation
                                  if (enforceAgeLimit && maxPerAge > 0 && currentTeamAgeCount >= maxPerAge) {
                                    if (!window.confirm(`Warning: Team already has ${currentTeamAgeCount} players age ${playerAge} (limit: ${maxPerAge}). Continue anyway?`)) {
                                      return;
                                    }
                                  }
                                  onDraftPlayer(player.id);
                                }}
                                className={`px-3 py-2 rounded-lg font-semibold text-sm transition-all ${
                                  isMandatory
                                    ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                                    : 'bg-green-600 hover:bg-green-700 text-white'
                                }`}
                              >
                                Draft
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Team Rosters */}
          <div className="lg:col-span-2">
            <TeamRosters
              teams={draftState.teams}
              currentTeamId={draftState.currentTeamId}
              enforceAgeLimit={enforceAgeLimit}
              maxPerAge={maxPerAge}
            />
          </div>
        </div>
      </div>

      {/* Draft Complete Confirmation Modal */}
      {pendingComplete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-md w-full text-center shadow-xl">
            <div className="text-5xl mb-4">🏆</div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Draft Complete!
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              All {draftState.picks.length} picks have been made.
              <br />
              Ready to finalize the draft?
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={onCancelComplete}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg font-medium transition-colors"
              >
                ← Go Back & Review
              </button>
              <button
                onClick={onFinalizeDraft}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
              >
                Finalize Draft →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
