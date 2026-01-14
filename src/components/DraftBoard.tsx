import { useState } from 'react';
import { Undo, RotateCcw, AlertCircle, Search, ChevronRight } from 'lucide-react';
import { DraftState } from '../types';
import { TeamRosters } from './TeamRosters';
import { getNextPick, calculateDraftOrder } from '../utils/draftOrder';

interface DraftBoardProps {
  draftState: DraftState;
  onDraftPlayer: (playerId: string) => void;
  onUndo: () => void;
  onReset: () => void;
}

export const DraftBoard = ({ draftState, onDraftPlayer, onUndo, onReset }: DraftBoardProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

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

  const selectedPlayer = selectedPlayerId
    ? draftState.players.find((p) => p.id === selectedPlayerId)
    : null;

  const totalPicks = draftState.teams.length * Math.ceil(draftState.players.length / draftState.teams.length);
  const currentPickNumber = (draftState.currentRound - 1) * draftState.teams.length + draftState.currentPickInRound;

  const handlePlayerClick = (playerId: string) => {
    console.log('🔵 handlePlayerClick called with playerId:', playerId);
    console.log('🔵 Current selectedPlayerId:', selectedPlayerId);

    // Toggle selection - click same player to deselect
    const newSelection = selectedPlayerId === playerId ? null : playerId;
    console.log('🔵 Setting selectedPlayerId to:', newSelection);
    setSelectedPlayerId(newSelection);
  };

  const handleConfirmDraft = () => {
    console.log('🟢 handleConfirmDraft called');
    console.log('🟢 selectedPlayerId:', selectedPlayerId);
    console.log('🟢 selectedPlayer:', selectedPlayer);

    if (selectedPlayerId) {
      console.log('🟢 Calling onDraftPlayer with:', selectedPlayerId);
      onDraftPlayer(selectedPlayerId);
      console.log('🟢 Clearing selection');
      setSelectedPlayerId(null); // Clear selection after draft
    } else {
      console.log('🔴 No player selected!');
    }
  };

  console.log('🔄 DraftBoard render - selectedPlayerId:', selectedPlayerId);
  console.log('🔄 DraftBoard render - selectedPlayer:', selectedPlayer);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Prominent Draft Header - ESPN Style */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-500 rounded-lg p-6 sm:p-8 mb-4 text-white shadow-lg">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex-1">
              {currentTeam && (
                <>
                  <div className="text-sm uppercase tracking-wide opacity-90 mb-1">
                    Round {draftState.currentRound}, Pick {currentPickNumber} of {totalPicks}
                  </div>
                  <h1 className="text-3xl sm:text-4xl font-bold mb-2">
                    Now Drafting: {currentTeam.name}
                  </h1>
                  {nextTeam && (
                    <div className="text-lg opacity-80">
                      Up Next: {nextTeam.name}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={onUndo}
                disabled={draftState.picks.length === 0}
                className="px-3 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg font-medium flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed backdrop-blur-sm"
                title="Undo last pick"
              >
                <Undo className="w-4 h-4" />
                <span className="hidden sm:inline">Undo</span>
              </button>
              <button
                onClick={onReset}
                className="px-3 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg font-medium flex items-center gap-2 backdrop-blur-sm"
                title="Reset entire draft"
              >
                <RotateCcw className="w-4 h-4" />
                <span className="hidden sm:inline">Reset</span>
              </button>
            </div>
          </div>

          {/* Mandatory Pick Warning */}
          {draftState.mandatoryPick && (() => {
            const mandatoryPlayer = draftState.players.find((p) => p.id === draftState.mandatoryPick?.playerId);
            return (
              <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/30 border-2 border-yellow-400 dark:border-yellow-600 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-6 h-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-bold text-lg text-yellow-800 dark:text-yellow-200">
                      Mandatory Pick Required
                    </div>
                    <div className="text-sm text-yellow-700 dark:text-yellow-300 mt-1 mb-3">
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
                          setSelectedPlayerId(mandatoryPlayer.id);
                          // Scroll to the player in the list
                          const playerElement = document.getElementById(`player-${mandatoryPlayer.id}`);
                          playerElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                      }}
                      className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white font-semibold rounded-lg flex items-center gap-2 shadow-md"
                    >
                      Select {mandatoryPlayer?.name}
                      <ChevronRight className="w-4 h-4" />
                    </button>
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
                    {team?.name || 'Unknown'}
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

              {/* Draft Confirmation Button */}
              {selectedPlayer && (
                <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border-2 border-green-500 rounded-lg sticky top-0 z-10">
                  <div className="text-sm text-green-800 dark:text-green-200 mb-2">
                    Selected: <strong>{selectedPlayer.name}</strong> ({selectedPlayer.totalScore.toFixed(1)})
                  </div>
                  <button
                    onClick={handleConfirmDraft}
                    className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-lg flex items-center justify-center gap-2 shadow-lg"
                  >
                    Draft {selectedPlayer.name}
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}

              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {availablePlayers.map((player) => {
                  const isMandatory = draftState.mandatoryPick?.playerId === player.id;
                  const isSelected = selectedPlayerId === player.id;

                  // Check if this is a coach's kid assigned to another team
                  const isCoachKidForOtherTeam = player.isCoachKid &&
                                                  player.coachTeamId &&
                                                  player.coachTeamId !== draftState.currentTeamId;
                  const coachTeam = isCoachKidForOtherTeam
                    ? draftState.teams.find(t => t.id === player.coachTeamId)
                    : null;

                  return (
                    <button
                      key={player.id}
                      id={`player-${player.id}`}
                      onClick={() => !isCoachKidForOtherTeam && handlePlayerClick(player.id)}
                      disabled={isCoachKidForOtherTeam || undefined}
                      className={`
                        w-full text-left p-3 rounded-lg border-2 transition-all
                        ${
                          isCoachKidForOtherTeam
                            ? 'opacity-50 cursor-not-allowed border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/10'
                            : isSelected
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 shadow-lg scale-105'
                            : isMandatory
                            ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 hover:bg-yellow-100 dark:hover:bg-yellow-900/30'
                            : 'border-gray-200 dark:border-gray-700 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                        }
                      `}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 dark:text-white truncate">
                            {player.name}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            Rank #{player.rank} • Round {player.projectedRound} • Age {player.littleLeagueAge}
                          </div>

                          {/* Restricted player warning */}
                          {isCoachKidForOtherTeam && (
                            <div className="text-xs text-red-600 dark:text-red-400 mt-2 font-semibold">
                              ⚠ Coach's kid - Can only be drafted by {coachTeam?.name}
                            </div>
                          )}

                          <div className="flex gap-1 mt-1 flex-wrap">
                            {player.isCoachKid && (
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                isCoachKidForOtherTeam
                                  ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                                  : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                              }`}>
                                Coach's Kid{coachTeam ? ` (${coachTeam.name})` : ''}
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
                              <span className="text-xs bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 px-2 py-0.5 rounded">
                                Sibling
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="ml-2 text-right">
                          <div className={`text-lg font-bold ${
                            isCoachKidForOtherTeam
                              ? 'text-gray-400 dark:text-gray-600'
                              : 'text-gray-900 dark:text-white'
                          }`}>
                            {player.totalScore.toFixed(1)}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                            H:{player.hittingSubtotal.toFixed(0)} F:{player.fieldingSubtotal.toFixed(0)} P:{player.pitchingSubtotal.toFixed(0)}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Team Rosters */}
          <div className="lg:col-span-2">
            <TeamRosters teams={draftState.teams} currentTeamId={draftState.currentTeamId} />
          </div>
        </div>
      </div>
    </div>
  );
};
