import { useState, useEffect, useMemo } from 'react';
import { ChevronRight, CheckCircle, AlertCircle } from 'lucide-react';
import { Team, Player, DraftFormat } from '../types';

interface DraftConfigProps {
  teams: Team[];
  players: Player[];
  onConfigComplete: (draftFormat: DraftFormat, draftOrder: string[], resolvedPlayers: Player[]) => void;
}

// Validation result for draft order
interface OrderValidation {
  valid: boolean;
  error?: string;
  duplicates: number[];
  missing: number[];
}

function validateDraftOrder(positions: (number | null)[], teamCount: number): OrderValidation {
  const validPositions = positions.filter((p): p is number => p !== null && p >= 1 && p <= teamCount);
  const expected = Array.from({ length: teamCount }, (_, i) => i + 1);

  // Find duplicates
  const seen = new Set<number>();
  const duplicates: number[] = [];
  for (const pos of validPositions) {
    if (seen.has(pos)) {
      duplicates.push(pos);
    }
    seen.add(pos);
  }

  // Find missing positions
  const missing = expected.filter(n => !validPositions.includes(n));

  if (duplicates.length > 0) {
    return { valid: false, error: `Duplicate position: ${duplicates[0]}`, duplicates, missing };
  }

  if (missing.length > 0) {
    return { valid: false, error: `Missing positions: ${missing.join(', ')}`, duplicates, missing };
  }

  return { valid: true, duplicates: [], missing: [] };
}

// Helper to get display name for a team (fallback when empty)
const getTeamDisplayName = (team: Team) => team.name || `Team ${team.draftPosition}`;

export const DraftConfig = ({ teams, players, onConfigComplete }: DraftConfigProps) => {
  const [draftFormat, setDraftFormat] = useState<DraftFormat | null>(null);
  // Store position by team ID
  const [teamPositions, setTeamPositions] = useState<Record<string, number | null>>({});

  // Compute resolved players with lockedToRound set for coach's kids with conflicts
  // This is a defensive fix to handle cases where lockedToRound wasn't set in PlayerReview
  const resolvedPlayers = useMemo(() => {
    // Group coach's kids by team
    const coachKidsByTeam: Record<string, Player[]> = {};
    players.filter(p => p.isCoachKid && p.coachTeamId).forEach(p => {
      const teamId = p.coachTeamId!;
      if (!coachKidsByTeam[teamId]) {
        coachKidsByTeam[teamId] = [];
      }
      coachKidsByTeam[teamId].push(p);
    });

    // Build round assignments for each team's coach kids
    const roundAssignments: Record<string, number> = {};

    for (const [, teamKids] of Object.entries(coachKidsByTeam)) {
      const assignedRounds = new Set<number>();

      // Sort by projected round, then by score (descending) within each round
      const sortedKids = [...teamKids].sort((a, b) => {
        if (a.projectedRound !== b.projectedRound) {
          return a.projectedRound - b.projectedRound;
        }
        return b.totalScore - a.totalScore;
      });

      for (const kid of sortedKids) {
        let targetRound = kid.projectedRound;
        // Find next available round
        while (assignedRounds.has(targetRound)) {
          targetRound++;
        }
        assignedRounds.add(targetRound);
        roundAssignments[kid.id] = targetRound;
      }
    }

    // Apply round assignments to players
    return players.map(player => {
      if (roundAssignments[player.id] !== undefined) {
        const newLockedRound = roundAssignments[player.id];
        // Only update if different from current or if not set
        if (player.lockedToRound !== newLockedRound) {
          console.log(`=== DraftConfig: Setting lockedToRound for ${player.firstName} ${player.lastName} to ${newLockedRound} (was ${player.lockedToRound}) ===`);
          return { ...player, lockedToRound: newLockedRound };
        }
      }
      return player;
    });
  }, [players]);

  // TRACE 8: Log players on mount
  useEffect(() => {
    console.log('=== TRACE 8: DraftConfig mounted ===');
    console.log('Coach kids from props:', players.filter(p => p.isCoachKid).map(p => ({
      name: `${p.firstName} ${p.lastName}`,
      projected: p.projectedRound,
      locked: p.lockedToRound
    })));
    console.log('Coach kids after resolution:', resolvedPlayers.filter(p => p.isCoachKid).map(p => ({
      name: `${p.firstName} ${p.lastName}`,
      projected: p.projectedRound,
      locked: p.lockedToRound
    })));
  }, [players, resolvedPlayers]);

  // Initialize team positions from teams (all empty by default)
  useEffect(() => {
    const initial: Record<string, number | null> = {};
    teams.forEach((team) => {
      initial[team.id] = null;
    });
    setTeamPositions(initial);
  }, [teams]);

  const coachKids = resolvedPlayers.filter((p) => p.isCoachKid);

  // Convert positions to array for validation
  const positionsArray = useMemo(() => {
    return teams.map(t => teamPositions[t.id] ?? null);
  }, [teams, teamPositions]);

  // Validate the current order
  const validation = useMemo(() => {
    return validateDraftOrder(positionsArray, teams.length);
  }, [positionsArray, teams.length]);

  // Build the draft order from positions
  const draftOrder = useMemo(() => {
    if (!validation.valid) return [];

    // Create array of [teamId, position] pairs and sort by position
    const pairs = teams
      .map(t => ({ id: t.id, position: teamPositions[t.id] ?? 0 }))
      .filter(p => p.position > 0)
      .sort((a, b) => a.position - b.position);

    return pairs.map(p => p.id);
  }, [teams, teamPositions, validation.valid]);

  // Handle position change for a team
  const handlePositionChange = (teamId: string, value: string) => {
    const num = parseInt(value);
    setTeamPositions(prev => ({
      ...prev,
      [teamId]: isNaN(num) ? null : num,
    }));
  };

  // Check if a position has a duplicate
  const isDuplicate = (position: number | null): boolean => {
    if (position === null) return false;
    return validation.duplicates.includes(position);
  };

  // Randomize draft order using Fisher-Yates shuffle
  const handleRandomizeOrder = () => {
    const teamIds = [...teams.map(t => t.id)];

    // Fisher-Yates shuffle
    for (let i = teamIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [teamIds[i], teamIds[j]] = [teamIds[j], teamIds[i]];
    }

    // Assign positions 1 through N
    const newPositions: Record<string, number | null> = {};
    teamIds.forEach((id, index) => {
      newPositions[id] = index + 1;
    });

    setTeamPositions(newPositions);
  };

  const handleStart = () => {
    // Validate draft format is selected
    if (!draftFormat) {
      alert('Please select a draft format before starting.');
      return;
    }

    // Validate all coach kids are assigned
    const unassignedCoachKids = coachKids.filter(p => !p.coachTeamId);

    if (unassignedCoachKids.length > 0) {
      alert(`Please go back and assign all coach's kids to teams before starting the draft.\n\nUnassigned: ${unassignedCoachKids.map(p => p.name).join(', ')}`);
      return;
    }

    // Validate draft order
    if (!validation.valid) {
      alert(`Please fix the draft order: ${validation.error}`);
      return;
    }

    // Debug: Log the draft order and resolved players being passed
    console.log('🎯 DraftConfig.handleStart - draftOrder:', draftOrder);
    console.log('🎯 DraftConfig.handleStart - teams:', teams.map(t => ({ id: t.id, name: t.name })));
    console.log('🎯 DraftConfig.handleStart - teamPositions:', teamPositions);
    console.log('🎯 DraftConfig.handleStart - resolvedPlayers coach kids:', resolvedPlayers.filter(p => p.isCoachKid).map(p => ({
      name: `${p.firstName} ${p.lastName}`,
      projected: p.projectedRound,
      locked: p.lockedToRound
    })));

    onConfigComplete(draftFormat, draftOrder, resolvedPlayers);
  };

  // Sort teams by their current position for display
  const sortedTeams = useMemo(() => {
    return [...teams].sort((a, b) => {
      const posA = teamPositions[a.id] ?? Infinity;
      const posB = teamPositions[b.id] ?? Infinity;
      return posA - posB;
    });
  }, [teams, teamPositions]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Draft Configuration</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Set up teams, draft order, and format
            </p>
          </div>

          <button
            onClick={handleStart}
            disabled={!validation.valid || !draftFormat}
            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${
              validation.valid && draftFormat
                ? 'bg-blue-500 hover:bg-blue-600 text-white'
                : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
            }`}
          >
            Start Draft
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Coach's Kids Summary */}
        {coachKids.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Coach's Kids Assignments
            </h2>
            {coachKids.every(p => p.coachTeamId) ? (
              <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-medium text-green-800 dark:text-green-200 mb-2">
                    All coach's kids assigned
                  </div>
                  <div className="space-y-1">
                    {coachKids.map(player => {
                      const team = teams.find(t => t.id === player.coachTeamId);
                      const effectiveRound = player.lockedToRound ?? player.projectedRound;
                      const isBumped = player.lockedToRound && player.lockedToRound !== player.projectedRound;
                      return (
                        <div key={player.id} className="text-sm text-green-700 dark:text-green-300">
                          • {player.name} → {team ? getTeamDisplayName(team) : 'Unknown'} (Round {effectiveRound}{isBumped && '*'})
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-medium text-orange-800 dark:text-orange-200 mb-2">
                    Coach's kids need assignment
                  </div>
                  <div className="text-sm text-orange-700 dark:text-orange-300 mb-2">
                    Please go back to the Review phase to assign these players to their teams:
                  </div>
                  <div className="space-y-1">
                    {coachKids.filter(p => !p.coachTeamId).map(player => (
                      <div key={player.id} className="text-sm text-orange-700 dark:text-orange-300">
                        • {player.name} (Rank #{player.rank}, Round {player.lockedToRound ?? player.projectedRound})
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Draft Format */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Draft Format
            </h2>
            <div className="space-y-3">
              {[
                { value: 'straight', label: 'Straight', desc: '1-8, 1-8, 1-8...' },
                { value: 'snake', label: 'Snake', desc: '1-8, 8-1, 1-8, 8-1...' },
                { value: 'recalculated', label: 'Recalculated', desc: 'Lowest score picks first each round' },
              ].map((format) => (
                <label
                  key={format.value}
                  className="flex items-start gap-3 p-3 border border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <input
                    type="radio"
                    name="format"
                    value={format.value}
                    checked={draftFormat === format.value}
                    onChange={(e) => setDraftFormat(e.target.value as DraftFormat)}
                    className="mt-1 accent-blue-600"
                  />
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{format.label}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">{format.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Draft Order */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Draft Order
              </h2>
              <button
                onClick={handleRandomizeOrder}
                className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium flex items-center gap-1"
              >
                🎲 Randomize
              </button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Enter a position number (1-{teams.length}) for each team. Position 1 picks first in round 1.
            </p>

            {/* Validation Error */}
            {!validation.valid && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-red-700 dark:text-red-300">{validation.error}</span>
              </div>
            )}

            <div className="space-y-2">
              {sortedTeams.map((team) => {
                const position = teamPositions[team.id];
                const teamCoachKids = resolvedPlayers.filter(p => p.coachTeamId === team.id);
                const hasError = isDuplicate(position) || (position !== null && (position < 1 || position > teams.length));

                return (
                  <div
                    key={team.id}
                    className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                      hasError
                        ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                        : 'bg-gray-50 dark:bg-gray-700'
                    }`}
                  >
                    <input
                      type="number"
                      min="1"
                      max={teams.length}
                      value={position ?? ''}
                      onChange={(e) => handlePositionChange(team.id, e.target.value)}
                      className={`w-16 px-3 py-2 text-center border rounded-lg font-semibold text-lg ${
                        hasError
                          ? 'border-red-500 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                          : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white'
                      } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                    />
                    <div className="flex-1">
                      <span className="text-gray-900 dark:text-white font-medium">{getTeamDisplayName(team)}</span>
                      {teamCoachKids.length > 0 && (
                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                          (Coach: {teamCoachKids.map(p => p.name).join(', ')})
                        </span>
                      )}
                    </div>
                    {hasError && isDuplicate(position) && (
                      <span className="text-xs text-red-600 dark:text-red-400">
                        Duplicate
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Valid Order Preview */}
            {validation.valid && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Draft order preview:
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {draftOrder.map(id => {
                    const team = teams.find(t => t.id === id);
                    return team ? getTeamDisplayName(team) : 'Unknown';
                  }).join(' → ')}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
