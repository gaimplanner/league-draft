import { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Edit2, Users, Link, X, Search, Wand2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Player, Team, ScoringMode } from '../types';
import { autoDetectCoachKids, autoDetectSiblings, CoachKidMatch, SiblingMatch } from '../utils/coachKidDetection';
import { useScoringWeights } from '../hooks/useScoringWeights';
import { ScoringWeightsConfig } from './ScoringWeightsConfig';
import { recalculateAllScores } from '../utils/scoreCalculation';

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
}

export const PlayerReview = ({ players, teams, scoringMode, onScoringModeChange, onUpdatePlayer, onUpdatePlayerField, onSetAllPlayers, onTeamsUpdate, onLinkSiblings, onUnlinkSibling, onNext }: PlayerReviewProps) => {
  const [editingPlayer, setEditingPlayer] = useState<string | null>(null);
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);
  const [linkingSiblingFor, setLinkingSiblingFor] = useState<string | null>(null);
  const [autoDetectedMatches, setAutoDetectedMatches] = useState<CoachKidMatch[]>([]);
  const [siblingMatches, setSiblingMatches] = useState<SiblingMatch[]>([]);
  const [showAutoDetectModal, setShowAutoDetectModal] = useState(false);
  const [selectedMatches, setSelectedMatches] = useState<Set<string>>(new Set());
  const [selectedSiblingPairs, setSelectedSiblingPairs] = useState<Set<string>>(new Set());
  const { weights, updateWeight, resetToDefaults, validation } = useScoringWeights();

  // Recalculate all player scores when weights change (only in raw mode)
  useEffect(() => {
    // Skip recalculation in pre-weighted mode - CSV scores are already weighted
    if (scoringMode === 'pre-weighted') return;

    if (validation.isValid && players.length > 0) {
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

  const handleEdit = (playerId: string, field: keyof Pick<Player, 'fieldingSubtotal' | 'hittingSubtotal' | 'pitchingSubtotal' | 'catchScore' | 'runningScore' | 'officialAdjust'>, value: string) => {
    const numValue = parseFloat(value) || 0;
    onUpdatePlayer(playerId, field, numValue);
  };

  const handleTeamNameUpdate = (teamId: string, newName: string) => {
    // Keep the actual name (can be empty to show placeholder)
    const updatedTeams = teams.map(t =>
      t.id === teamId ? { ...t, name: newName } : t
    );
    onTeamsUpdate(updatedTeams);
  };

  // Helper to get display name for a team (fallback when empty)
  const getTeamDisplayName = (team: Team) => team.name || `Team ${team.draftPosition}`;

  const handleAssistantCoachesUpdate = (teamId: string, assistantCoachesText: string) => {
    // Parse comma-separated list of assistant coach last names
    const assistantCoaches = assistantCoachesText
      .split(',')
      .map(name => name.trim())
      .filter(name => name.length > 0);

    const updatedTeams = teams.map(t =>
      t.id === teamId ? { ...t, assistantCoaches } : t
    );
    onTeamsUpdate(updatedTeams);
  };

  const handleCoachKidToggle = (playerId: string, isCoachKid: boolean) => {
    if (isCoachKid) {
      // Turning ON coach's kid - set flag
      onUpdatePlayerField(playerId, { isCoachKid: true });
    } else {
      // Turning OFF - remove coach assignment
      onUpdatePlayerField(playerId, { isCoachKid: false, coachTeamId: undefined });

      // Remove from team's coachKids array
      const updatedTeams = teams.map(t => ({
        ...t,
        coachKids: t.coachKids.filter(id => id !== playerId)
      }));
      onTeamsUpdate(updatedTeams);
    }
  };

  const handleCoachTeamAssignment = (playerId: string, teamId: string) => {
    // Update player's coachTeamId
    onUpdatePlayerField(playerId, { coachTeamId: teamId });

    // Update team's coachKids array
    const updatedTeams = teams.map(t => {
      if (t.id === teamId) {
        // Add to this team if not already there
        return {
          ...t,
          coachKids: t.coachKids.includes(playerId) ? t.coachKids : [...t.coachKids, playerId]
        };
      } else {
        // Remove from other teams
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
    setLinkingSiblingFor(null);
  };

  const handleSiblingUnlink = (playerId: string) => {
    onUnlinkSibling(playerId);
  };

  // Auto-detection is now manual - user clicks button after entering coach names
  const handleAutoDetect = () => {
    const coachMatches = autoDetectCoachKids(players, teams);
    const siblingPairs = autoDetectSiblings(players);

    setAutoDetectedMatches(coachMatches);
    setSiblingMatches(siblingPairs);

    if (coachMatches.length > 0 || siblingPairs.length > 0) {
      // Select all matches by default
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
    // Apply selected coach's kid matches
    autoDetectedMatches.forEach(match => {
      if (selectedMatches.has(match.playerId)) {
        // Mark as coach's kid and assign to team
        handleCoachKidToggle(match.playerId, true);
        handleCoachTeamAssignment(match.playerId, match.teamId);
      }
    });

    // Apply selected sibling matches
    siblingMatches.forEach(match => {
      const pairKey = `${match.player1Id}-${match.player2Id}`;
      if (selectedSiblingPairs.has(pairKey)) {
        // Link siblings
        handleSiblingLink(match.player1Id, match.player2Id);
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

  const PlayerCard = ({ player }: { player: Player }) => {
    const assignedTeam = teams.find(t => t.id === player.coachTeamId);
    const availableSiblings = players.filter(p => p.id !== player.id && !p.siblingId);
    const isExpanded = expandedPlayerId === player.id;

    // Condensed row view (default) - click to expand
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Condensed Header Row - Always visible */}
        <button
          onClick={() => setExpandedPlayerId(isExpanded ? null : player.id)}
          className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
        >
          {/* Expand/Collapse Icon */}
          <div className="flex-shrink-0">
            {isExpanded ? (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-400" />
            )}
          </div>

          {/* Rank */}
          <div className="w-12 flex-shrink-0">
            <span className="text-sm font-bold text-gray-900 dark:text-white">#{player.rank}</span>
          </div>

          {/* Name and badges */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-gray-900 dark:text-white truncate">{player.name}</span>
              <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded font-mono">
                {player.bib}
              </span>
              {player.isCoachKid && (
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  player.coachTeamId
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                    : 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200'
                }`}>
                  Coach{player.coachTeamId ? `: ${assignedTeam ? getTeamDisplayName(assignedTeam) : 'Unknown'}` : ' (unassigned)'}
                </span>
              )}
              {player.siblingId && (
                <span className="text-xs bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 px-1.5 py-0.5 rounded">
                  Sibling: {player.sibling}
                </span>
              )}
              {player.isDNE && (
                <span className="text-xs bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 px-1.5 py-0.5 rounded">
                  DNE
                </span>
              )}
              {player.isAllStar && (
                <span className="text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-1.5 py-0.5 rounded">
                  All-Star
                </span>
              )}
            </div>
          </div>

          {/* Age */}
          <div className="w-12 flex-shrink-0 text-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">{player.littleLeagueAge}</span>
          </div>

          {/* Round */}
          <div className="w-12 flex-shrink-0 text-center">
            <span className={`text-sm ${player.lockedToRound && player.lockedToRound !== player.projectedRound ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-600 dark:text-gray-400'}`}>
              R{player.lockedToRound ?? player.projectedRound}
              {player.lockedToRound && player.lockedToRound !== player.projectedRound && '*'}
            </span>
          </div>

          {/* Score */}
          <div className="w-16 flex-shrink-0 text-right">
            <span className="font-bold text-gray-900 dark:text-white">{player.totalScore.toFixed(1)}</span>
          </div>
        </button>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="p-4 pt-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            {/* Scores breakdown */}
            <div className="mb-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Score Breakdown:</p>
              <div className="flex flex-wrap gap-3 text-sm">
                <span className="text-gray-600 dark:text-gray-400">F: <strong className="text-gray-900 dark:text-white">{player.fieldingSubtotal.toFixed(1)}</strong></span>
                <span className="text-gray-600 dark:text-gray-400">H: <strong className="text-gray-900 dark:text-white">{player.hittingSubtotal.toFixed(1)}</strong></span>
                <span className="text-gray-600 dark:text-gray-400">P: <strong className="text-gray-900 dark:text-white">{player.pitchingSubtotal.toFixed(1)}</strong></span>
                <span className="text-gray-600 dark:text-gray-400">C: <strong className="text-gray-900 dark:text-white">{player.catchScore.toFixed(1)}</strong></span>
                <span className="text-gray-600 dark:text-gray-400">R: <strong className="text-gray-900 dark:text-white">{player.runningScore.toFixed(1)}</strong></span>
                {player.officialAdjust !== 0 && (
                  <span className="text-gray-600 dark:text-gray-400">
                    Adj: <strong className={player.officialAdjust > 0 ? 'text-green-600' : 'text-red-600'}>
                      {player.officialAdjust > 0 ? '+' : ''}{player.officialAdjust.toFixed(1)}
                    </strong>
                  </span>
                )}
              </div>
              {player.birthday && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Birthday: {player.birthday}</p>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {/* Coach's Kid Controls */}
              <div className="p-3 bg-white dark:bg-gray-700/50 rounded border border-gray-200 dark:border-gray-600">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={player.isCoachKid}
                    onChange={(e) => handleCoachKidToggle(player.id, e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    Coach's Kid
                  </span>
                </label>

                {player.isCoachKid && (
                  <div className="mt-2">
                    <select
                      value={player.coachTeamId || ''}
                      onChange={(e) => handleCoachTeamAssignment(player.id, e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">Select team...</option>
                      {teams.map(team => (
                        <option key={team.id} value={team.id}>{getTeamDisplayName(team)}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Sibling Linking */}
              <div className="p-3 bg-white dark:bg-gray-700/50 rounded border border-gray-200 dark:border-gray-600">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Sibling</span>
                  {!player.siblingId && (
                    <button
                      onClick={() => setLinkingSiblingFor(linkingSiblingFor === player.id ? null : player.id)}
                      className="text-xs px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded flex items-center gap-1"
                    >
                      <Link className="w-3 h-3" />
                      Link
                    </button>
                  )}
                </div>

                {player.siblingId ? (
                  <div className="flex items-center justify-between p-2 bg-purple-50 dark:bg-purple-900/20 rounded border border-purple-200 dark:border-purple-800">
                    <span className="text-sm text-purple-800 dark:text-purple-200">
                      {player.sibling}
                    </span>
                    <button
                      onClick={() => handleSiblingUnlink(player.id)}
                      className="p-1 hover:bg-purple-100 dark:hover:bg-purple-900/40 rounded"
                      title="Unlink sibling"
                    >
                      <X className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    </button>
                  </div>
                ) : linkingSiblingFor === player.id ? (
                  <select
                    onChange={(e) => e.target.value && handleSiblingLink(player.id, e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    defaultValue=""
                  >
                    <option value="">Select sibling...</option>
                    {availableSiblings.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} (Rank #{p.rank}, Age {p.littleLeagueAge})
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs text-gray-500 dark:text-gray-400">No sibling linked</p>
                )}
              </div>
            </div>

            {/* Score Editing */}
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900 dark:text-white">Edit Scores</span>
                <button
                  onClick={() => setEditingPlayer(editingPlayer === player.id ? null : player.id)}
                  className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 rounded flex items-center gap-1"
                >
                  <Edit2 className="w-3 h-3" />
                  {editingPlayer === player.id ? 'Done' : 'Edit'}
                </button>
              </div>
              {editingPlayer === player.id && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {(['fieldingSubtotal', 'hittingSubtotal', 'pitchingSubtotal', 'catchScore', 'runningScore', 'officialAdjust'] as const).map((field) => (
                    <div key={field}>
                      <label className="text-xs text-gray-600 dark:text-gray-400 capitalize block mb-1">
                        {field === 'fieldingSubtotal' ? 'Fielding' :
                         field === 'hittingSubtotal' ? 'Hitting' :
                         field === 'pitchingSubtotal' ? 'Pitching' :
                         field === 'catchScore' ? 'Catch' :
                         field === 'runningScore' ? 'Running' :
                         field === 'officialAdjust' ? 'Adjustment' : field}
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={player[field]}
                        onChange={(e) => handleEdit(player.id, field, e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const coachKidsCount = players.filter(p => p.isCoachKid).length;
  const unassignedCoachKids = players.filter(p => p.isCoachKid && !p.coachTeamId).length;

  // Validate sibling links are bidirectional
  const brokenSiblingLinks = players.filter(p => {
    if (!p.siblingId) return false;
    const sibling = players.find(s => s.id === p.siblingId);
    return !sibling || sibling.siblingId !== p.id;
  });

  const handleNext = () => {
    // TRACE 0: Log ALL coach's kids at the start of handleNext
    const allCoachKids = players.filter(p => p.isCoachKid);
    console.log('=== TRACE 0: handleNext() called ===');
    console.log('All coach kids:', allCoachKids.map(p => ({
      name: `${p.firstName} ${p.lastName}`,
      coachTeamId: p.coachTeamId,
      projectedRound: p.projectedRound,
      totalScore: p.totalScore,
      rank: p.rank
    })));
    console.log('Teams:', teams.map(t => ({ id: t.id, name: t.name })));

    if (unassignedCoachKids > 0) {
      if (!window.confirm(`${unassignedCoachKids} coach's kid(s) are not assigned to teams. Continue anyway?`)) {
        return;
      }
    }

    if (brokenSiblingLinks.length > 0) {
      alert(`Warning: Found broken sibling links. Please check: ${brokenSiblingLinks.map(p => p.name).join(', ')}`);
      return;
    }

    // ============================================================
    // RESOLVE ALL COACH'S KID ROUND CONFLICTS
    // A conflict occurs when the SAME TEAM has multiple coach's kids in the SAME ROUND
    // ============================================================

    // Group coach's kids by their assigned team
    const coachKidsByTeam: Record<string, Player[]> = {};
    players.filter(p => p.isCoachKid && p.coachTeamId).forEach(p => {
      const teamId = p.coachTeamId!;
      if (!coachKidsByTeam[teamId]) {
        coachKidsByTeam[teamId] = [];
      }
      coachKidsByTeam[teamId].push(p);
    });

    // TRACE 0.5: Log grouped coach kids by team
    console.log('=== TRACE 0.5: Coach kids grouped by team ===');
    for (const [teamId, kids] of Object.entries(coachKidsByTeam)) {
      const team = teams.find(t => t.id === teamId);
      console.log(`Team ${team?.name || teamId}:`, kids.map(k => ({
        name: `${k.firstName} ${k.lastName}`,
        projectedRound: k.projectedRound,
        score: k.totalScore
      })));
    }

    // Build a map of all lockedToRound assignments
    // This will be applied in a single batch update
    const roundAssignments: Record<string, number> = {};
    const conflictMessages: string[] = [];

    // Process each team's coach's kids
    for (const [teamId, teamKids] of Object.entries(coachKidsByTeam)) {
      const team = teams.find(t => t.id === teamId);
      const teamDisplayName = team ? (team.name || `Team ${team.draftPosition}`) : 'Unknown Team';

      // Track which rounds are already assigned for this team
      const assignedRounds = new Set<number>();

      // Sort all team's coach kids by projected round, then by score (descending) within each round
      const sortedKids = [...teamKids].sort((a, b) => {
        if (a.projectedRound !== b.projectedRound) {
          return a.projectedRound - b.projectedRound;
        }
        return b.totalScore - a.totalScore; // Higher score first within same round
      });

      // Group by projected round to detect conflicts
      const kidsByProjectedRound: Record<number, Player[]> = {};
      sortedKids.forEach(kid => {
        const round = kid.projectedRound;
        if (!kidsByProjectedRound[round]) {
          kidsByProjectedRound[round] = [];
        }
        kidsByProjectedRound[round].push(kid);
      });

      // Check for conflicts and build resolution info
      for (const [roundStr, kidsInRound] of Object.entries(kidsByProjectedRound)) {
        if (kidsInRound.length > 1) {
          const round = parseInt(roundStr);
          // Sort by score descending within this round
          const sortedInRound = [...kidsInRound].sort((a, b) => b.totalScore - a.totalScore);

          const conflictInfo = sortedInRound.map((p, idx) => {
            const targetRound = idx === 0 ? round : round + idx;
            const action = idx === 0 ? `stays in Round ${round}` : `moves to Round ${targetRound}`;
            return `  • ${p.name} (Score: ${p.totalScore.toFixed(1)}) → ${action}`;
          }).join('\n');

          conflictMessages.push(`${teamDisplayName} has ${kidsInRound.length} coach's kids in Round ${round}:\n${conflictInfo}`);
        }
      }

      // Now assign rounds for all of this team's kids, handling conflicts
      for (const kid of sortedKids) {
        let targetRound = kid.projectedRound;

        // Find next available round (not already assigned to another coach's kid on this team)
        while (assignedRounds.has(targetRound)) {
          targetRound++;
        }

        assignedRounds.add(targetRound);
        roundAssignments[kid.id] = targetRound;
      }
    }

    // If there were any conflicts, show summary and ask for confirmation
    if (conflictMessages.length > 0) {
      const message = `Coach's Kid Round Conflicts Detected:\n\n${conflictMessages.join('\n\n')}\n\nA team can only draft one coach's kid per round. Lower-scored kids will be moved to subsequent rounds.\n\nContinue?`;

      if (!window.confirm(message)) {
        return;
      }
    }

    // TRACE 1: Log round assignments
    console.log('=== TRACE 1: Conflict Resolution ===');
    console.log('roundAssignments:', roundAssignments);

    // Apply all round assignments in a single batch update
    if (Object.keys(roundAssignments).length > 0) {
      const updatedPlayers = players.map(player => {
        if (roundAssignments[player.id] !== undefined) {
          // TRACE 2: Log each player update
          console.log(`=== TRACE 2: Setting lockedToRound for ${player.firstName} ${player.lastName} to ${roundAssignments[player.id]} ===`);
          return { ...player, lockedToRound: roundAssignments[player.id] };
        }
        return player;
      });

      // TRACE 3: Log updatedPlayers being passed
      console.log('=== TRACE 3: updatedPlayers being passed to onNext ===');
      console.log(updatedPlayers.filter(p => p.isCoachKid).map(p => ({
        name: `${p.firstName} ${p.lastName}`,
        projected: p.projectedRound,
        locked: p.lockedToRound
      })));

      // Use batch update to ensure all changes are applied atomically
      onSetAllPlayers(updatedPlayers);

      // TRACE 4: About to call onNext WITH updatedPlayers
      console.log('=== TRACE 4: About to call onNext WITH updatedPlayers ===');
      onNext(updatedPlayers);
      return;
    }

    // TRACE 4b: No round assignments, calling onNext without players
    console.log('=== TRACE 4b: No round assignments, calling onNext without updatedPlayers ===');
    onNext();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Review Players & Setup Teams</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {players.length} players loaded • {coachKidsCount} coach's kids • Edit scores, assign coaches, link siblings
            </p>
            {unassignedCoachKids > 0 && (
              <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">
                ⚠ {unassignedCoachKids} coach's kid{unassignedCoachKids > 1 ? 's' : ''} not assigned to a team
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleAutoDetect}
              className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-medium flex items-center gap-2"
              title="Auto-detect coach's kids and siblings by matching last names"
            >
              <Search className="w-5 h-5" />
              <span className="hidden sm:inline">Find Coaches' Kids and Siblings</span>
            </button>

            <button
              onClick={handleNext}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium flex items-center gap-2"
            >
              Continue to Draft Setup
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Team Names Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Team Names & Coaches</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {teams.map(team => {
              const teamCoachKids = players.filter(p => p.coachTeamId === team.id);
              return (
                <div key={team.id} className="space-y-2">
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Head Coach (Team Name)
                    </label>
                    <input
                      type="text"
                      value={team.name}
                      onChange={(e) => handleTeamNameUpdate(team.id, e.target.value)}
                      placeholder={`Coach Name (e.g., Smith)`}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Assistant Coaches (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={team.assistantCoaches.join(', ')}
                      onChange={(e) => handleAssistantCoachesUpdate(team.id, e.target.value)}
                      placeholder="Smith, Jones"
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  {teamCoachKids.length > 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Coach's Kids: {teamCoachKids.map(p => p.name).join(', ')}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Scoring Mode Toggle */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 mb-6">
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Scoring Mode</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Choose how to interpret the imported CSV scores.
              </p>

              <div className="flex gap-4">
                <label className={`flex-1 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  scoringMode === 'pre-weighted'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}>
                  <input
                    type="radio"
                    name="scoringMode"
                    value="pre-weighted"
                    checked={scoringMode === 'pre-weighted'}
                    onChange={() => onScoringModeChange('pre-weighted')}
                    className="sr-only"
                  />
                  <div className="font-medium text-gray-900 dark:text-white mb-1">
                    Pre-weighted Scores
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    CSV values are already weighted (spreadsheet applied weights). Scores will be summed directly.
                  </div>
                </label>

                <label className={`flex-1 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  scoringMode === 'raw'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}>
                  <input
                    type="radio"
                    name="scoringMode"
                    value="raw"
                    checked={scoringMode === 'raw'}
                    onChange={() => onScoringModeChange('raw')}
                    className="sr-only"
                  />
                  <div className="font-medium text-gray-900 dark:text-white mb-1">
                    Raw Scores
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    CSV values are raw evaluation scores. App will apply weight percentages below.
                  </div>
                </label>
              </div>

              {scoringMode === 'pre-weighted' && (
                <div className="mt-4 flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800 dark:text-amber-200">
                    <strong>Pre-weighted mode:</strong> Weight configuration is disabled. Scores from the CSV will be used as-is.
                    If player totals look incorrect (too low), your CSV may contain raw scores - switch to "Raw Scores" mode.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Scoring Weights Configuration (only shown in raw mode) */}
        {scoringMode === 'raw' && (
          <ScoringWeightsConfig
            weights={weights}
            onUpdateWeight={updateWeight}
            onReset={resetToDefaults}
            validation={validation}
          />
        )}

        {/* Legend for bumped rounds */}
        {players.some(p => p.lockedToRound && p.lockedToRound !== p.projectedRound) && (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
            <span className="text-blue-600 dark:text-blue-400 font-bold">*</span>
            <span>Round adjusted due to coach's kid same-round conflict (multiple coach's kids from same team in same round)</span>
          </div>
        )}

        {/* Players List */}
        <div className="space-y-1">
          {/* Header row for list view */}
          <div className="hidden md:flex items-center gap-3 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            <div className="w-5 flex-shrink-0"></div>
            <div className="w-12 flex-shrink-0">Rank</div>
            <div className="flex-1">Player</div>
            <div className="w-12 flex-shrink-0 text-center">Age</div>
            <div className="w-12 flex-shrink-0 text-center">Round</div>
            <div className="w-16 flex-shrink-0 text-right">Score</div>
          </div>
          {players.map((player) => (
            <PlayerCard key={player.id} player={player} />
          ))}
        </div>
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
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {match.playerName}
                            {isSelected && (
                              <CheckCircle2 className="inline-block ml-2 w-5 h-5 text-purple-600" />
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
