import { useState, useEffect, useRef } from 'react';
import { Undo, ChevronLeft, AlertCircle, ChevronRight, X, Users, Grid3X3, Eye, EyeOff } from 'lucide-react';
import { DraftState, Team, DivisionAgeRange, Player } from '../types';
import { getNextPick, calculateDraftOrder } from '../utils/draftOrder';
import { useViewMode } from '../contexts/ViewContext';
import { getTeamDisplayName } from '../utils/teamUtils';
import { DraftBoardPlayerGrid } from './draft/DraftBoardPlayerGrid';
import { DraftBoardRosterView } from './draft/DraftBoardRosterView';

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
  // Issue #20: isLoading prop to disable buttons during API calls
  isLoading?: boolean;
  // Mandatory pick error modal
  mandatoryPickError?: string | null;
  onClearMandatoryPickError?: () => void;
}

export const DraftBoard = ({
  draftState,
  onDraftPlayer,
  onSkipPick,
  onUndo,
  onReset,
  enforceAgeLimit,
  maxPerAge,
  ageRange: _ageRange,
  pendingComplete,
  onFinalizeDraft,
  onCancelComplete,
  isLoading = false,
  mandatoryPickError,
  onClearMandatoryPickError,
}: DraftBoardProps) => {
  const viewMode = useViewMode();
  const isPublicView = viewMode === 'public';

  const [drawerMode, setDrawerMode] = useState<'players' | 'rosters'>('players');
  const [showScores, setShowScores] = useState(!isPublicView);
  const [showRoundInterstitial, setShowRoundInterstitial] = useState(false);
  // Pending draft confirmation (replaces browser confirm dialog)
  const [pendingDraftPlayer, setPendingDraftPlayer] = useState<Player | null>(null);
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

  const availablePlayers = draftState.players.filter((p) => !p.isDrafted);

  // Try to get current team from currentTeamId, fallback to deriving from currentRoundOrder
  const derivedCurrentTeamId = draftState.currentTeamId ||
    draftState.currentRoundOrder[draftState.currentPickInRound - 1] || null;
  const currentTeam = draftState.teams.find((t) => t.id === derivedCurrentTeamId);

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

  // Calculate if skip is allowed (can't skip if all remaining players must be drafted)
  const remainingSpots = totalPicks - draftState.picks.length;
  const canSkip = availablePlayers.length < remainingSpots;

  const handleSkipPick = () => {
    if (!currentTeam) return;
    if (!canSkip) {
      window.alert('Cannot skip - all remaining players must be drafted.');
      return;
    }
    if (window.confirm(`Skip pick for ${getTeamDisplayName(currentTeam)}? They will have one fewer player.`)) {
      onSkipPick();
    }
  };

  // Handle confirming a pending draft pick
  const handleConfirmDraft = () => {
    if (pendingDraftPlayer) {
      onDraftPlayer(pendingDraftPlayer.id);
      setPendingDraftPlayer(null);
    }
  };

  // Clear pending draft when team changes or draft completes
  useEffect(() => {
    setPendingDraftPlayer(null);
  }, [draftState.currentTeamId, draftState.isDraftComplete]);

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
        {/* Sticky Draft Header Container - top-10 accounts for the fixed division header */}
        <div className="sticky top-10 z-40 bg-gray-50 dark:bg-gray-900 -mx-4 px-4 pt-0 pb-4">
        {/* Compact Draft Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-500 rounded-lg p-4 text-white shadow-lg">
          {/* Header row */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {/* Left: Pick info and current team */}
            {currentTeam && (
              <div className="flex items-center gap-4 flex-wrap">
                <div className="text-xs uppercase tracking-wide opacity-80 bg-white/10 px-2 py-1 rounded">
                  R{draftState.currentRound} · Pick {currentPickNumber}/{totalPicks}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">{getTeamDisplayName(currentTeam)}</span>
                  {nextTeam && (
                    <span className="text-sm opacity-70">→ {getTeamDisplayName(nextTeam)}</span>
                  )}
                </div>
                {/* Age Breakdown - compact inline badges */}
                {enforceAgeLimit && maxPerAge > 0 && Object.keys(currentTeam.ageBreakdown || {}).length > 0 && (
                  <div className="flex items-center gap-1">
                    {Object.entries(currentTeam.ageBreakdown || {})
                      .sort(([a], [b]) => Number(a) - Number(b))
                      .map(([age, count]) => (
                        <span
                          key={age}
                          className={`px-1.5 py-0.5 rounded text-xs ${
                            count >= maxPerAge
                              ? 'bg-red-500/40 text-red-200'
                              : count >= maxPerAge - 1
                              ? 'bg-yellow-500/40 text-yellow-200'
                              : 'bg-white/20 text-white/80'
                          }`}
                        >
                          {age}:{count}
                        </span>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* Right: Admin controls */}
            {!isPublicView && (
              <div className="flex gap-1 flex-shrink-0">
                {isFinalRound && (
                  <button
                    onClick={handleSkipPick}
                    disabled={!canSkip || isLoading}
                    className="px-2 py-1 bg-yellow-500 hover:bg-yellow-600 text-white rounded text-xs font-medium flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed"
                    title={canSkip ? "Skip this team's pick" : "Cannot skip - all remaining players must be drafted"}
                  >
                    ⏭️ <span className="hidden sm:inline">Skip</span>
                  </button>
                )}
                <button
                  onClick={onUndo}
                  disabled={draftState.picks.length === 0 || isLoading}
                  className="px-2 py-1 bg-white/20 hover:bg-white/30 text-white rounded text-xs font-medium flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Undo last pick"
                >
                  <Undo className="w-3 h-3" />
                  <span className="hidden sm:inline">Undo</span>
                </button>
                <button
                  onClick={onReset}
                  className="px-2 py-1 bg-white/20 hover:bg-white/30 text-white rounded text-xs font-medium flex items-center gap-1"
                  title="Return to Draft Setup"
                >
                  <ChevronLeft className="w-3 h-3" />
                  <span className="hidden sm:inline">Reset</span>
                </button>
              </div>
            )}
            {isPublicView && (
              <div className="px-2 py-1 bg-white/20 text-white rounded text-xs font-medium">
                Live View
              </div>
            )}
          </div>

          {/* Mandatory Pick Warning - compact inline */}
          {draftState.mandatoryPick && !isPublicView && (() => {
            const mandatoryPlayer = draftState.players.find((p) => p.id === draftState.mandatoryPick?.playerId);
            return (
              <div className="mt-3 flex items-center justify-center gap-3 bg-yellow-500/20 border border-yellow-400/50 rounded-lg px-4 py-2">
                <AlertCircle className="w-5 h-5 text-yellow-300 flex-shrink-0" />
                <span className="text-sm text-yellow-100">
                  <strong>Mandatory:</strong> {mandatoryPlayer?.name}
                  {draftState.mandatoryPick.reason === 'coach-kid' ? ' (coach\'s kid)' : ` (sibling of ${draftState.mandatoryPick.siblingName})`}
                </span>
                <button
                  onClick={() => mandatoryPlayer && onDraftPlayer(mandatoryPlayer.id)}
                  disabled={isLoading}
                  className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white font-medium text-sm rounded flex items-center gap-1 disabled:opacity-50"
                >
                  {isLoading ? '...' : 'Draft'} <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            );
          })()}

          {/* Pending Draft Confirmation Banner */}
          {pendingDraftPlayer && !draftState.mandatoryPick && !isPublicView && (
            <div className="mt-3 flex items-center justify-center gap-3 bg-blue-500/20 border border-blue-400/50 rounded-lg px-4 py-2">
              <span className="text-sm text-blue-100">
                <strong>Confirm:</strong> Draft {pendingDraftPlayer.name} ({pendingDraftPlayer.totalScore.toFixed(1)} pts)?
              </span>
              <button
                onClick={handleConfirmDraft}
                disabled={isLoading}
                className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white font-medium text-sm rounded flex items-center gap-1 disabled:opacity-50"
              >
                {isLoading ? '...' : 'Draft'} <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPendingDraftPlayer(null)}
                disabled={isLoading}
                className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white font-medium text-sm rounded flex items-center gap-1 disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Best Available by Age - compact horizontal layout */}
          {!draftState.mandatoryPick && !pendingDraftPlayer && !isPublicView && (() => {
            const topByAge: Record<number, typeof availablePlayers> = {};
            availablePlayers.forEach(player => {
              const isCoachKidForOtherTeam = player.isCoachKid && player.coachTeamId && player.coachTeamId !== derivedCurrentTeamId;
              const isSiblingLocked = player.lockedToTeamId && player.lockedToTeamId !== derivedCurrentTeamId;
              if (isCoachKidForOtherTeam || isSiblingLocked) return;
              const age = player.littleLeagueAge;
              if (!topByAge[age]) topByAge[age] = [];
              topByAge[age].push(player);
            });

            Object.keys(topByAge).forEach(age => {
              topByAge[Number(age)] = topByAge[Number(age)]
                .sort((a, b) => b.totalScore - a.totalScore)
                .slice(0, 2);
            });

            const ages = Object.keys(topByAge)
              .map(Number)
              .filter(age => topByAge[age] && topByAge[age].length > 0)
              .sort((a, b) => a - b);

            if (ages.length === 0) return null;

            return (
              <div className="mt-3 bg-white/10 rounded-lg px-3 py-2">
                <div className="flex items-center gap-4 overflow-x-auto">
                  <span className="text-xs font-medium text-white/70 whitespace-nowrap flex-shrink-0">Best by Age</span>
                  {ages.map(age => {
                    const players = topByAge[age] || [];
                    return (
                      <div key={age} className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-white/50 w-6">{age}:</span>
                        {players.map((player) => (
                          <button
                            key={player.id}
                            onClick={() => setPendingDraftPlayer(player)}
                            disabled={isLoading}
                            className="px-2 py-1 rounded text-xs font-medium transition-colors disabled:opacity-50 bg-white/10 hover:bg-white/20 text-white"
                            title={`Draft ${player.firstName} ${player.lastName} (${player.totalScore.toFixed(1)} pts)`}
                          >
                            {player.firstName} {player.lastName.charAt(0)}. <span className="opacity-70">{player.totalScore.toFixed(1)}</span>
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
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

        {/* Drawer Header Bar */}
        <div className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 mb-4">
          {/* Mode Toggle */}
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setDrawerMode('players')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                drawerMode === 'players'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Grid3X3 className="w-4 h-4" />
              <span className="hidden sm:inline">Available Players</span>
              <span className="sm:hidden">Players</span>
              <span className="text-xs bg-gray-200 dark:bg-gray-500 px-1.5 py-0.5 rounded">
                {availablePlayers.length}
              </span>
            </button>
            <button
              onClick={() => setDrawerMode('rosters')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                drawerMode === 'rosters'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Team Rosters</span>
              <span className="sm:hidden">Rosters</span>
            </button>
          </div>

          {/* Score Toggle */}
          <button
            onClick={() => setShowScores(!showScores)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              showScores
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
            }`}
            title={showScores ? 'Hide scores (presentation mode)' : 'Show scores'}
          >
            {showScores ? (
              <>
                <Eye className="w-4 h-4" />
                <span className="hidden sm:inline">Scores Visible</span>
              </>
            ) : (
              <>
                <EyeOff className="w-4 h-4" />
                <span className="hidden sm:inline">Scores Hidden</span>
              </>
            )}
          </button>
        </div>

        {/* Drawer Content */}
        <div className="overflow-auto">
          {drawerMode === 'players' ? (
            <DraftBoardPlayerGrid
              players={draftState.players}
              currentTeamId={derivedCurrentTeamId}
              teams={draftState.teams}
              showScores={showScores}
              onDraftPlayer={onDraftPlayer}
              mandatoryPick={draftState.mandatoryPick}
              isLoading={isLoading}
              enforceAgeLimit={enforceAgeLimit}
              maxPerAge={maxPerAge}
              currentTeamAgeBreakdown={currentTeam?.ageBreakdown || {}}
              isPublicView={isPublicView}
            />
          ) : (
            <DraftBoardRosterView
              teams={draftState.teams}
              players={draftState.players}
              draftOrder={draftState.draftOrder}
              currentRound={draftState.currentRound}
              currentPickInRound={draftState.currentPickInRound}
              currentRoundOrder={draftState.currentRoundOrder}
              showScores={showScores}
              totalRounds={totalRounds}
              isPublicView={isPublicView}
            />
          )}
        </div>
      </div>

      {/* Mandatory Pick Error Modal */}
      {mandatoryPickError && draftState.mandatoryPick && (() => {
        const mandatoryPlayer = draftState.players.find(p => p.id === draftState.mandatoryPick?.playerId);
        const reason = draftState.mandatoryPick.reason === 'coach-kid' ? "Coach's kid" : 'Sibling requirement';

        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full shadow-2xl">
              {/* Header */}
              <div className="flex items-start gap-3 mb-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div className="text-left">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    Mandatory Pick
                  </h3>
                  <p className="text-sm text-yellow-600 dark:text-yellow-400 font-medium">
                    {reason}
                  </p>
                </div>
              </div>

              {/* Player Info */}
              {mandatoryPlayer && (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-5">
                  <div className="flex items-start justify-between">
                    <div className="text-left">
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">
                        {mandatoryPlayer.name}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        BIB #{mandatoryPlayer.bib} · Age {mandatoryPlayer.littleLeagueAge} · Rank #{mandatoryPlayer.rank}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {mandatoryPlayer.totalScore.toFixed(1)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">points</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={onClearMandatoryPickError}
                  className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (mandatoryPlayer) {
                      onClearMandatoryPickError?.();
                      onDraftPlayer(mandatoryPlayer.id);
                    }
                  }}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? 'Drafting...' : 'Draft Player'}
                  {!isLoading && <ChevronRight className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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
                disabled={isLoading}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ← Go Back & Review
              </button>
              <button
                onClick={onFinalizeDraft}
                disabled={isLoading}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Finalizing...' : 'Finalize Draft →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
