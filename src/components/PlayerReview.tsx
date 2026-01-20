import { useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft, Users, Link, Wand2, CheckCircle2 } from 'lucide-react';
import { Player, Team, ScoringMode } from '../types';
import { autoDetectCoachKids, autoDetectSiblings, CoachKidMatch, SiblingMatch } from '../utils/coachKidDetection';
import { useScoringWeights } from '../hooks/useScoringWeights';
import { recalculateAllScores } from '../utils/scoreCalculation';
import { PlayerReviewTable } from './PlayerReviewTable';

// Security: Team name validation constants
const MAX_TEAM_NAME_LENGTH = 100;

/**
 * Sanitize team name to prevent XSS and enforce length limits.
 */
function sanitizeTeamName(name: string): string {
  return name
    .trim()
    .slice(0, MAX_TEAM_NAME_LENGTH)
    .replace(/[<>]/g, ''); // Remove HTML-like characters
}

interface PlayerReviewProps {
  players: Player[];
  teams: Team[];
  scoringMode: ScoringMode;
  onScoringModeChange: (mode: ScoringMode) => void;
  onUpdatePlayer: (playerId: string, field: keyof Pick<Player, 'fieldingSubtotal' | 'hittingSubtotal' | 'pitchingSubtotal' | 'catchScore' | 'runningScore' | 'officialAdjust'>, value: number) => void;
  onUpdatePlayerField: (playerId: string, updates: Partial<Player>) => void;
  onSetAllPlayers: (players: Player[]) => void;
  onTeamsUpdate: (teams: Team[]) => void;
  onLinkSiblings: (playerId1: string, playerId2: string) => void;
  onUnlinkSibling: (playerId: string) => void;
  onNext: (updatedPlayers?: Player[]) => void;
  onBack?: () => void;
}

export const PlayerReview = ({ players, teams, scoringMode, onScoringModeChange, onUpdatePlayer, onUpdatePlayerField, onSetAllPlayers, onTeamsUpdate, onLinkSiblings, onUnlinkSibling, onNext, onBack }: PlayerReviewProps) => {
  const [autoDetectedMatches, setAutoDetectedMatches] = useState<CoachKidMatch[]>([]);
  const [siblingMatches, setSiblingMatches] = useState<SiblingMatch[]>([]);
  const [showAutoDetectModal, setShowAutoDetectModal] = useState(false);
  const [selectedMatches, setSelectedMatches] = useState<Set<string>>(new Set());
  const [selectedSiblingPairs, setSelectedSiblingPairs] = useState<Set<string>>(new Set());
  const { weights, updateWeight, resetToDefaults, validation } = useScoringWeights();

  // Recalculate all player scores when weights change (raw mode) or mode changes
  useEffect(() => {
    // In raw mode: weights affect calculation, so recalculate on weight changes
    // When switching modes: always recalculate to restore correct values from raw scores
    // Skip weight validation in pre-weighted mode since weights aren't used
    if (scoringMode === 'raw' && !validation.isValid) return;

    if (players.length > 0) {
      const recalculated = recalculateAllScores(players, weights, scoringMode);
      // Only update if scores actually changed to avoid infinite loops
      const hasChanges = recalculated.some((p, i) =>
        Math.abs(p.totalScore - players[i].totalScore) > 0.01
      );
      if (hasChanges) {
        // Update players through parent callback
        // This is a bit awkward but maintains the existing data flow
        recalculated.forEach(player => {
          onUpdatePlayerField(player.id, {
            fieldingSubtotal: player.fieldingSubtotal,
            hittingSubtotal: player.hittingSubtotal,
            pitchingSubtotal: player.pitchingSubtotal,
            subjectiveTotal: player.subjectiveTotal,
            objectiveTotal: player.objectiveTotal,
            totalScore: player.totalScore,
          });
        });
      }
    }
  }, [weights, scoringMode]);

  const handleTeamNameUpdate = (teamId: string, newName: string) => {
    // Security: Sanitize team name input
    const sanitizedName = sanitizeTeamName(newName);
    const updatedTeams = teams.map(t =>
      t.id === teamId ? { ...t, name: sanitizedName } : t
    );
    onTeamsUpdate(updatedTeams);
  };

  const handleAssistantCoachUpdate = (teamId: string, assistantCoachText: string) => {
    // Security: Sanitize assistant coach name
    const assistantCoach = sanitizeTeamName(assistantCoachText);

    const updatedTeams = teams.map(t =>
      t.id === teamId ? { ...t, assistantCoach } : t
    );
    onTeamsUpdate(updatedTeams);
  };

  const handleCoachKidToggle = (playerId: string, isCoachKid: boolean) => {
    if (isCoachKid) {
      onUpdatePlayerField(playerId, { isCoachKid: true });
    } else {
      onUpdatePlayerField(playerId, { isCoachKid: false, coachTeamId: undefined });
      const updatedTeams = teams.map(t => ({
        ...t,
        coachKids: t.coachKids.filter(id => id !== playerId)
      }));
      onTeamsUpdate(updatedTeams);
    }
  };

  const handleCoachTeamAssignment = (playerId: string, teamId: string) => {
    onUpdatePlayerField(playerId, { coachTeamId: teamId });
    const updatedTeams = teams.map(t => {
      if (t.id === teamId) {
        return {
          ...t,
          coachKids: t.coachKids.includes(playerId) ? t.coachKids : [...t.coachKids, playerId]
        };
      } else {
        return {
          ...t,
          coachKids: t.coachKids.filter(id => id !== playerId)
        };
      }
    });
    onTeamsUpdate(updatedTeams);
  };

  const handleSiblingLink = (playerId: string, siblingId: string) => {
    onLinkSiblings(playerId, siblingId);
  };

  const handleSiblingUnlink = (playerId: string) => {
    onUnlinkSibling(playerId);
  };

  const handleAutoDetect = () => {
    const coachMatches = autoDetectCoachKids(players, teams);
    const siblingPairs = autoDetectSiblings(players);

    setAutoDetectedMatches(coachMatches);
    setSiblingMatches(siblingPairs);

    if (coachMatches.length > 0 || siblingPairs.length > 0) {
      // Pre-select ALL matches including already marked/linked (user can uncheck to remove)
      setSelectedMatches(new Set(coachMatches.map(m => m.playerId)));
      setSelectedSiblingPairs(new Set(siblingPairs.map(s => `${s.player1Id}-${s.player2Id}`)));
      setShowAutoDetectModal(true);
    }
  };

  const handleToggleMatch = (playerId: string) => {
    setSelectedMatches(prev => {
      const newSet = new Set(prev);
      if (newSet.has(playerId)) {
        newSet.delete(playerId);
      } else {
        newSet.add(playerId);
      }
      return newSet;
    });
  };

  const handleToggleSiblingPair = (pairKey: string) => {
    setSelectedSiblingPairs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pairKey)) {
        newSet.delete(pairKey);
      } else {
        newSet.add(pairKey);
      }
      return newSet;
    });
  };

  const handleApplyMatches = () => {
    // Apply or clear coach kid assignments based on selection
    autoDetectedMatches.forEach(match => {
      if (selectedMatches.has(match.playerId)) {
        handleCoachKidToggle(match.playerId, true);
        handleCoachTeamAssignment(match.playerId, match.teamId);
      } else {
        // Not selected - clear coach kid status if it was previously set
        handleCoachKidToggle(match.playerId, false);
      }
    });

    // Apply or clear sibling links based on selection
    siblingMatches.forEach(match => {
      const pairKey = `${match.player1Id}-${match.player2Id}`;
      if (selectedSiblingPairs.has(pairKey)) {
        handleSiblingLink(match.player1Id, match.player2Id);
      } else {
        // Not selected - clear sibling links if they were previously set
        handleSiblingUnlink(match.player1Id);
        handleSiblingUnlink(match.player2Id);
      }
    });

    setShowAutoDetectModal(false);
    setAutoDetectedMatches([]);
    setSiblingMatches([]);
    setSelectedMatches(new Set());
    setSelectedSiblingPairs(new Set());
  };

  const handleSelectAll = () => {
    setSelectedMatches(new Set(autoDetectedMatches.map(m => m.playerId)));
    setSelectedSiblingPairs(new Set(siblingMatches.map(s => `${s.player1Id}-${s.player2Id}`)));
  };

  const handleDeselectAll = () => {
    setSelectedMatches(new Set());
    setSelectedSiblingPairs(new Set());
  };

  const coachKidsCount = players.filter(p => p.isCoachKid).length;
  const unassignedCoachKids = players.filter(p => p.isCoachKid && !p.coachTeamId).length;

  const brokenSiblingLinks = players.filter(p => {
    if (!p.siblingId) return false;
    const sibling = players.find(s => s.id === p.siblingId);
    return !sibling || sibling.siblingId !== p.id;
  });

  const handleNext = () => {
    if (unassignedCoachKids > 0) {
      if (!window.confirm(`${unassignedCoachKids} coach's kid(s) are not assigned to teams. Continue anyway?`)) {
        return;
      }
    }

    // Start with current players, will be modified if repairs or assignments needed
    let workingPlayers = [...players];

    // Auto-repair broken sibling links by making them bidirectional
    if (brokenSiblingLinks.length > 0) {
      brokenSiblingLinks.forEach(player => {
        if (!player.siblingId) return;
        const siblingIndex = workingPlayers.findIndex(p => p.id === player.siblingId);
        if (siblingIndex !== -1) {
          const sibling = workingPlayers[siblingIndex];
          // If sibling exists but doesn't link back, create the reciprocal link
          if (sibling.siblingId !== player.id) {
            workingPlayers[siblingIndex] = {
              ...sibling,
              siblingId: player.id,
              sibling: player.name,
            };
          }
        } else {
          // Sibling doesn't exist - clear the broken link
          const playerIndex = workingPlayers.findIndex(p => p.id === player.id);
          if (playerIndex !== -1) {
            workingPlayers[playerIndex] = {
              ...workingPlayers[playerIndex],
              siblingId: undefined,
              sibling: undefined,
            };
          }
        }
      });
    }

    // Resolve coach's kid round conflicts
    const coachKidsByTeam: Record<string, Player[]> = {};
    workingPlayers.filter(p => p.isCoachKid && p.coachTeamId).forEach(p => {
      const teamId = p.coachTeamId!;
      if (!coachKidsByTeam[teamId]) {
        coachKidsByTeam[teamId] = [];
      }
      coachKidsByTeam[teamId].push(p);
    });

    const roundAssignments: Record<string, number> = {};
    const conflictMessages: string[] = [];

    for (const [teamId, teamKids] of Object.entries(coachKidsByTeam)) {
      const team = teams.find(t => t.id === teamId);
      const teamDisplayName = team ? (team.name || `Team ${team.draftPosition}`) : 'Unknown Team';

      const assignedRounds = new Set<number>();

      const sortedKids = [...teamKids].sort((a, b) => {
        if (a.projectedRound !== b.projectedRound) {
          return a.projectedRound - b.projectedRound;
        }
        return b.totalScore - a.totalScore;
      });

      const kidsByProjectedRound: Record<number, Player[]> = {};
      sortedKids.forEach(kid => {
        const round = kid.projectedRound;
        if (!kidsByProjectedRound[round]) {
          kidsByProjectedRound[round] = [];
        }
        kidsByProjectedRound[round].push(kid);
      });

      for (const [roundStr, kidsInRound] of Object.entries(kidsByProjectedRound)) {
        if (kidsInRound.length > 1) {
          const round = parseInt(roundStr);
          const sortedInRound = [...kidsInRound].sort((a, b) => b.totalScore - a.totalScore);

          const conflictInfo = sortedInRound.map((p, idx) => {
            const targetRound = idx === 0 ? round : round + idx;
            const action = idx === 0 ? `stays in Round ${round}` : `moves to Round ${targetRound}`;
            return `  • ${p.name} (Score: ${p.totalScore.toFixed(1)}) → ${action}`;
          }).join('\n');

          conflictMessages.push(`${teamDisplayName} has ${kidsInRound.length} coach's kids in Round ${round}:\n${conflictInfo}`);
        }
      }

      for (const kid of sortedKids) {
        let targetRound = kid.projectedRound;

        while (assignedRounds.has(targetRound)) {
          targetRound++;
        }

        assignedRounds.add(targetRound);
        roundAssignments[kid.id] = targetRound;
      }
    }

    if (conflictMessages.length > 0) {
      const message = `Coach's Kid Round Conflicts Detected:\n\n${conflictMessages.join('\n\n')}\n\nA team can only draft one coach's kid per round. Lower-scored kids will be moved to subsequent rounds.\n\nContinue?`;

      if (!window.confirm(message)) {
        return;
      }
    }

    // Apply round assignments if any
    if (Object.keys(roundAssignments).length > 0) {
      workingPlayers = workingPlayers.map(player => {
        if (roundAssignments[player.id] !== undefined) {
          return { ...player, lockedToRound: roundAssignments[player.id] };
        }
        return player;
      });
    }

    // Always pass workingPlayers (may have sibling repairs and/or round assignments)
    onSetAllPlayers(workingPlayers);
    onNext(workingPlayers);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Review Players & Setup Teams</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {players.length} players loaded • {coachKidsCount} coach's kids • Click cells to edit scores
            </p>
            {unassignedCoachKids > 0 && (
              <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">
                {unassignedCoachKids} coach's kid{unassignedCoachKids > 1 ? 's' : ''} not assigned to a team
              </p>
            )}
          </div>

          <div className="flex gap-2">
            {onBack && (
              <button
                onClick={onBack}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium flex items-center gap-2 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
                Back
              </button>
            )}
            <button
              onClick={handleNext}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium flex items-center gap-2"
            >
              Continue to Draft Setup
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Re-import notice - show when players have pre-assigned coach kids or siblings */}
        {(players.some(p => p.isCoachKid) || players.some(p => p.siblingId || p.sibling)) && (
          <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-yellow-800 dark:text-yellow-200">
                  Coach Kid and Sibling Assignments Detected
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  We found {players.filter(p => p.isCoachKid).length} coach's kid{players.filter(p => p.isCoachKid).length !== 1 ? 's' : ''} and {players.filter(p => p.siblingId || p.sibling).length} sibling assignment{players.filter(p => p.siblingId || p.sibling).length !== 1 ? 's' : ''} from your import.
                  Please review and confirm these assignments in the Teams panel below, or use "Find Coaches' Kids and Siblings" to re-detect.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Legend for bumped rounds */}
        {players.some(p => p.lockedToRound && p.lockedToRound !== p.projectedRound) && (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
            <span className="text-blue-600 dark:text-blue-400 font-bold">*</span>
            <span>Round adjusted due to coach's kid same-round conflict (multiple coach's kids from same team in same round)</span>
          </div>
        )}

        {/* Player Review Table */}
        <PlayerReviewTable
          players={players}
          teams={teams}
          scoringMode={scoringMode}
          weights={weights}
          weightsValidation={validation}
          onScoringModeChange={onScoringModeChange}
          onUpdateWeight={updateWeight}
          onResetWeights={resetToDefaults}
          onUpdatePlayer={onUpdatePlayer}
          onCoachKidToggle={handleCoachKidToggle}
          onCoachTeamAssignment={handleCoachTeamAssignment}
          onSiblingLink={handleSiblingLink}
          onSiblingUnlink={handleSiblingUnlink}
          onTeamNameUpdate={handleTeamNameUpdate}
          onAssistantCoachUpdate={handleAssistantCoachUpdate}
          onRunAutoDetection={handleAutoDetect}
        />
      </div>

      {/* Auto-Detect Modal */}
      {showAutoDetectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <Wand2 className="w-6 h-6 text-purple-500" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Auto-Detection Results
                </h2>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                Found {autoDetectedMatches.length} coach's kid match{autoDetectedMatches.length !== 1 ? 'es' : ''} and {siblingMatches.length} sibling pair{siblingMatches.length !== 1 ? 's' : ''} based on last name matching.
              </p>
            </div>

            <div className="p-6 overflow-y-auto max-h-[50vh]">
              {autoDetectedMatches.length === 0 && siblingMatches.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No matches found. Make sure team names match player last names for coaches, and check for players with shared last names for siblings.
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Coach's Kids Section */}
                  {autoDetectedMatches.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                        <Users className="w-5 h-5 text-blue-500" />
                        Coach's Kids ({autoDetectedMatches.length})
                      </h3>
                      <div className="space-y-3">
                        {autoDetectedMatches.map((match) => {
                          const player = players.find(p => p.id === match.playerId);
                          const isSelected = selectedMatches.has(match.playerId);

                          return (
                            <label
                              key={match.playerId}
                              className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                                isSelected
                                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                                  : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleMatch(match.playerId)}
                                className="mt-1 w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                              />
                              <div className="flex-1">
                                <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                  {match.playerName}
                                  {match.alreadyMarked && (
                                    <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                                      Previously assigned
                                    </span>
                                  )}
                                  {isSelected && (
                                    <CheckCircle2 className="w-5 h-5 text-purple-600" />
                                  )}
                                </div>
                                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                  → {match.teamName}
                                </div>
                                {player && (
                                  <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                    Rank #{player.rank} • Round {player.lockedToRound ?? player.projectedRound} • Age {player.littleLeagueAge}
                                  </div>
                                )}
                                <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                                  {match.reason}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Siblings Section */}
                  {siblingMatches.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                        <Link className="w-5 h-5 text-purple-500" />
                        Siblings ({siblingMatches.length} pair{siblingMatches.length !== 1 ? 's' : ''})
                      </h3>
                      <div className="space-y-3">
                        {siblingMatches.map((match) => {
                          const player1 = players.find(p => p.id === match.player1Id);
                          const player2 = players.find(p => p.id === match.player2Id);
                          const pairKey = `${match.player1Id}-${match.player2Id}`;
                          const isSelected = selectedSiblingPairs.has(pairKey);

                          return (
                            <label
                              key={pairKey}
                              className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                                isSelected
                                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                                  : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleSiblingPair(pairKey)}
                                className="mt-1 w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                              />
                              <div className="flex-1">
                                <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                  {match.player1Name} ↔ {match.player2Name}
                                  {match.alreadyLinked && (
                                    <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                                      Previously linked
                                    </span>
                                  )}
                                  {isSelected && (
                                    <CheckCircle2 className="inline-block w-5 h-5 text-purple-600" />
                                  )}
                                </div>
                                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                  Shared last name: {match.sharedLastName}
                                </div>
                                {player1 && player2 && (
                                  <div className="text-xs text-gray-500 dark:text-gray-500 mt-1 flex gap-4">
                                    <span>{player1.name} - Rank #{player1.rank}, Age {player1.littleLeagueAge}</span>
                                    <span>{player2.name} - Rank #{player2.rank}, Age {player2.littleLeagueAge}</span>
                                  </div>
                                )}
                                <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                                  {match.reason}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center gap-3">
              <div className="flex gap-2">
                <button
                  onClick={handleSelectAll}
                  className="px-3 py-2 text-sm text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg font-medium"
                >
                  Select All
                </button>
                <button
                  onClick={handleDeselectAll}
                  className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium"
                >
                  Deselect All
                </button>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowAutoDetectModal(false);
                    setAutoDetectedMatches([]);
                    setSiblingMatches([]);
                    setSelectedMatches(new Set());
                    setSelectedSiblingPairs(new Set());
                  }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApplyMatches}
                  disabled={selectedMatches.size === 0 && selectedSiblingPairs.size === 0}
                  className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  Apply {(selectedMatches.size > 0 || selectedSiblingPairs.size > 0) && `(${selectedMatches.size + selectedSiblingPairs.size})`}
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
