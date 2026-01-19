/**
 * Team Builder Auto-Assignment Algorithm
 *
 * Implements a greedy assignment algorithm that:
 * 1. Places locked players first (coach kids, siblings)
 * 2. Spreads top talent evenly across teams
 * 3. Honors friend requests (two-way > one-way)
 * 4. Honors coach requests
 * 5. Clusters by school when no other signal
 * 6. Falls back to team balance
 *
 * Outputs assignments in draft-compatible format (simulated picks).
 */

import { Player, Team, DraftPick } from '../types';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface TeamBuilderConfig {
  balanceTolerance: number; // e.g., 0.10 for ±10%
  topTalentRounds: number; // Number of "rounds" of top talent to spread (e.g., 2)
  maxRosterSize: number; // Hard max per team (e.g., 13)
  prioritizeBalance: boolean; // If true, balance > happiness; if false, happiness > balance
}

export const DEFAULT_TEAM_BUILDER_CONFIG: TeamBuilderConfig = {
  balanceTolerance: 0.10,
  topTalentRounds: 2,
  maxRosterSize: 13,
  prioritizeBalance: true,
};

export interface TeamBuilderPlayer extends Player {
  // Resolved request data (from Phase 2 resolution)
  resolvedCoachTeamId?: string | null;
  resolvedTeammateIds?: string[]; // Player IDs of resolved teammate requests
  twoWayTeammateIds?: string[]; // Subset that are two-way
  oneWayTeammateIds?: string[]; // Subset that are one-way
}

export interface TeamBuilderTeam extends Team {
  // Track assignments during algorithm
  assignedPlayerIds: string[];
  currentScore: number;
}

export type HappinessScore = 'all' | 'some' | 'none' | 'no-requests';

export interface AssignmentResult {
  playerId: string;
  teamId: string;
  round: number;
  pick: number;
  reason: AssignmentReason;
}

export type AssignmentReason =
  | 'coach-kid'
  | 'assistant-coach-kid'
  | 'sibling-lock'
  | 'manual-lock'
  | 'top-talent'
  | 'two-way-friend'
  | 'one-way-friend'
  | 'coach-request'
  | 'school-cluster'
  | 'balance';

export interface PlayerHappiness {
  playerId: string;
  score: HappinessScore;
  coachRequestHonored: boolean | null; // null if no request
  teammateRequestsHonored: number;
  teammateRequestsTotal: number;
  twoWayRequestsHonored: number;
  twoWayRequestsTotal: number;
}

export interface TeamBuilderResult {
  assignments: AssignmentResult[];
  teamSummaries: TeamSummary[];
  playerHappiness: PlayerHappiness[];
  warnings: string[];
  stats: {
    totalPlayers: number;
    lockedPlayers: number;
    topTalentPlayers: number;
    requestBasedPlayers: number;
    balanceBasedPlayers: number;
    twoWayRequestsHonored: number;
    twoWayRequestsTotal: number;
    oneWayRequestsHonored: number;
    oneWayRequestsTotal: number;
    coachRequestsHonored: number;
    coachRequestsTotal: number;
    averageHappiness: number; // 0-1
  };
}

export interface TeamSummary {
  teamId: string;
  teamName: string;
  coachName: string;
  rosterCount: number;
  totalScore: number;
  meanDelta: number; // Difference from mean (positive = above, negative = below)
  meanDeltaPercent: number; // As percentage
}

// -----------------------------------------------------------------------------
// Main Algorithm
// -----------------------------------------------------------------------------

/**
 * Run the team builder auto-assignment algorithm.
 */
export function runTeamBuilderAlgorithm(
  players: TeamBuilderPlayer[],
  teams: Team[],
  config: TeamBuilderConfig = DEFAULT_TEAM_BUILDER_CONFIG
): TeamBuilderResult {
  const warnings: string[] = [];
  const assignments: AssignmentResult[] = [];

  // Initialize working copies
  const workingTeams: TeamBuilderTeam[] = teams.map(t => ({
    ...t,
    assignedPlayerIds: [],
    currentScore: 0,
  }));

  const unassignedPlayers = new Set(players.map(p => p.id));
  const playerMap = new Map(players.map(p => [p.id, p]));

  let currentRound = 1;
  let currentPick = 1;

  // Helper to assign a player
  const assignPlayer = (
    playerId: string,
    teamId: string,
    reason: AssignmentReason
  ) => {
    const player = playerMap.get(playerId);
    const team = workingTeams.find(t => t.id === teamId);

    if (!player || !team) {
      warnings.push(`Failed to assign player ${playerId} to team ${teamId}`);
      return;
    }

    team.assignedPlayerIds.push(playerId);
    team.currentScore += player.totalScore;
    unassignedPlayers.delete(playerId);

    assignments.push({
      playerId,
      teamId,
      round: currentRound,
      pick: currentPick,
      reason,
    });

    currentPick++;
    if (currentPick > teams.length) {
      currentRound++;
      currentPick = 1;
    }
  };

  // Helper to check if team can accept more players
  const canAcceptPlayer = (team: TeamBuilderTeam): boolean => {
    return team.assignedPlayerIds.length < config.maxRosterSize;
  };

  // Helper to get team with lowest score that can accept
  const getLowestScoreTeam = (): TeamBuilderTeam | null => {
    const eligible = workingTeams.filter(canAcceptPlayer);
    if (eligible.length === 0) return null;
    return eligible.reduce((lowest, team) =>
      team.currentScore < lowest.currentScore ? team : lowest
    );
  };

  // Helper to check balance tolerance
  const wouldBreakBalance = (team: TeamBuilderTeam, playerScore: number): boolean => {
    if (!config.prioritizeBalance) return false;

    const totalScoreAfter = workingTeams.reduce((sum, t) =>
      sum + t.currentScore + (t.id === team.id ? playerScore : 0), 0
    );
    const teamCountWithPlayers = workingTeams.filter(t =>
      t.assignedPlayerIds.length > 0 || t.id === team.id
    ).length;

    if (teamCountWithPlayers === 0) return false;

    const meanScore = totalScoreAfter / teamCountWithPlayers;
    const teamScoreAfter = team.currentScore + playerScore;
    const delta = Math.abs(teamScoreAfter - meanScore) / meanScore;

    return delta > config.balanceTolerance;
  };

  // =========================================================================
  // PHASE 0: Place locked players
  // =========================================================================

  // 0a: Coach kids and assistant coach kids
  for (const player of players) {
    if (!unassignedPlayers.has(player.id)) continue;

    if (player.isCoachKid && player.coachTeamId) {
      const team = workingTeams.find(t => t.id === player.coachTeamId);
      if (team && canAcceptPlayer(team)) {
        assignPlayer(player.id, team.id, 'coach-kid');
      }
      // Note: If team not found, player will be assigned in later phases
      // This can happen if coachTeamId doesn't match actual team IDs
    }
  }

  // 0b: Siblings - place with their locked sibling
  const siblingGroups = new Map<string, string[]>();
  for (const player of players) {
    if (player.siblingId) {
      const groupKey = [player.id, player.siblingId].sort().join('-');
      if (!siblingGroups.has(groupKey)) {
        siblingGroups.set(groupKey, []);
      }
      siblingGroups.get(groupKey)!.push(player.id);
    }
  }

  for (const [, siblingIds] of siblingGroups) {
    // Find if any sibling is already assigned
    const assignedSibling = siblingIds.find(id => !unassignedPlayers.has(id));
    if (assignedSibling) {
      const assignment = assignments.find(a => a.playerId === assignedSibling);
      if (assignment) {
        // Assign remaining siblings to same team
        for (const sibId of siblingIds) {
          if (unassignedPlayers.has(sibId)) {
            const team = workingTeams.find(t => t.id === assignment.teamId);
            if (team && canAcceptPlayer(team)) {
              assignPlayer(sibId, assignment.teamId, 'sibling-lock');
            } else {
              warnings.push(`Sibling ${sibId} could not be placed with sibling on team ${assignment.teamId}`);
            }
          }
        }
      }
    }
  }

  // 0c: Manually locked players (lockedToTeamId)
  for (const player of players) {
    if (!unassignedPlayers.has(player.id)) continue;

    if (player.lockedToTeamId) {
      const team = workingTeams.find(t => t.id === player.lockedToTeamId);
      if (team && canAcceptPlayer(team)) {
        assignPlayer(player.id, team.id, 'manual-lock');
      }
      // Note: If team not found, player will be assigned in later phases
    }
  }

  // =========================================================================
  // PHASE 1: Top talent distribution
  // =========================================================================

  const topTalentCount = config.topTalentRounds * teams.length;
  const sortedByScore = [...players]
    .filter(p => unassignedPlayers.has(p.id))
    .sort((a, b) => b.totalScore - a.totalScore);

  const topTalent = sortedByScore.slice(0, topTalentCount);

  for (const player of topTalent) {
    if (!unassignedPlayers.has(player.id)) continue;

    const lowestTeam = getLowestScoreTeam();
    if (lowestTeam) {
      assignPlayer(player.id, lowestTeam.id, 'top-talent');
    } else {
      warnings.push(`No team available for top talent player ${player.name}`);
    }
  }

  // =========================================================================
  // PHASE 2: Request-based placement
  // =========================================================================

  const remainingByScore = [...players]
    .filter(p => unassignedPlayers.has(p.id))
    .sort((a, b) => b.totalScore - a.totalScore);

  for (const player of remainingByScore) {
    if (!unassignedPlayers.has(player.id)) continue;

    const eligibleTeams = workingTeams.filter(t =>
      canAcceptPlayer(t) && !wouldBreakBalance(t, player.totalScore)
    );

    if (eligibleTeams.length === 0) {
      // Fall back to any team that can accept (ignore balance)
      const anyTeam = workingTeams.filter(canAcceptPlayer);
      if (anyTeam.length > 0) {
        const lowestTeam = anyTeam.reduce((lowest, team) =>
          team.currentScore < lowest.currentScore ? team : lowest
        );
        assignPlayer(player.id, lowestTeam.id, 'balance');
        warnings.push(`Player ${player.name} placed ignoring balance tolerance`);
      } else {
        warnings.push(`No team available for player ${player.name}`);
      }
      continue;
    }

    // Priority 1: Two-way teammate request
    if (player.twoWayTeammateIds && player.twoWayTeammateIds.length > 0) {
      const teamWithTwoWayFriend = eligibleTeams.find(team =>
        player.twoWayTeammateIds!.some(friendId =>
          team.assignedPlayerIds.includes(friendId)
        )
      );
      if (teamWithTwoWayFriend) {
        assignPlayer(player.id, teamWithTwoWayFriend.id, 'two-way-friend');
        continue;
      }
    }

    // Priority 2: One-way teammate request
    if (player.oneWayTeammateIds && player.oneWayTeammateIds.length > 0) {
      const teamWithOneWayFriend = eligibleTeams.find(team =>
        player.oneWayTeammateIds!.some(friendId =>
          team.assignedPlayerIds.includes(friendId)
        )
      );
      if (teamWithOneWayFriend) {
        assignPlayer(player.id, teamWithOneWayFriend.id, 'one-way-friend');
        continue;
      }
    }

    // Priority 3: Coach request
    if (player.resolvedCoachTeamId) {
      const requestedTeam = eligibleTeams.find(t => t.id === player.resolvedCoachTeamId);
      if (requestedTeam) {
        assignPlayer(player.id, requestedTeam.id, 'coach-request');
        continue;
      }
    }

    // Priority 4: School clustering
    if (player.school) {
      const teamSchoolCounts = eligibleTeams.map(team => {
        const schoolmates = team.assignedPlayerIds.filter(pid => {
          const p = playerMap.get(pid);
          return p && p.school && p.school.toLowerCase() === player.school!.toLowerCase();
        }).length;
        return { team, schoolmates };
      });

      const bestSchoolTeam = teamSchoolCounts.reduce((best, current) =>
        current.schoolmates > best.schoolmates ? current : best
      );

      if (bestSchoolTeam.schoolmates > 0) {
        assignPlayer(player.id, bestSchoolTeam.team.id, 'school-cluster');
        continue;
      }
    }

    // Priority 5: Balance fallback (lowest score team)
    const lowestTeam = eligibleTeams.reduce((lowest, team) =>
      team.currentScore < lowest.currentScore ? team : lowest
    );
    assignPlayer(player.id, lowestTeam.id, 'balance');
  }

  // =========================================================================
  // PHASE 3: Remaining players (shouldn't be any, but just in case)
  // =========================================================================

  for (const playerId of unassignedPlayers) {
    const player = playerMap.get(playerId);
    if (!player) continue;

    const lowestTeam = getLowestScoreTeam();
    if (lowestTeam) {
      assignPlayer(playerId, lowestTeam.id, 'balance');
    } else {
      warnings.push(`Could not place player ${player.name} - all teams full`);
    }
  }

  // =========================================================================
  // Calculate results
  // =========================================================================

  // Team summaries
  const totalScore = workingTeams.reduce((sum, t) => sum + t.currentScore, 0);
  const meanScore = totalScore / workingTeams.length;

  const teamSummaries: TeamSummary[] = workingTeams.map(team => ({
    teamId: team.id,
    teamName: team.name || team.headCoach,
    coachName: team.headCoach,
    rosterCount: team.assignedPlayerIds.length,
    totalScore: team.currentScore,
    meanDelta: team.currentScore - meanScore,
    meanDeltaPercent: meanScore > 0 ? ((team.currentScore - meanScore) / meanScore) * 100 : 0,
  }));

  // Player happiness
  const playerHappiness: PlayerHappiness[] = players.map(player => {
    const assignment = assignments.find(a => a.playerId === player.id);
    if (!assignment) {
      return {
        playerId: player.id,
        score: 'no-requests' as HappinessScore,
        coachRequestHonored: null,
        teammateRequestsHonored: 0,
        teammateRequestsTotal: 0,
        twoWayRequestsHonored: 0,
        twoWayRequestsTotal: 0,
      };
    }

    const teamId = assignment.teamId;
    const team = workingTeams.find(t => t.id === teamId)!;

    // Coach request
    const hasCoachRequest = !!player.resolvedCoachTeamId;
    const coachRequestHonored = hasCoachRequest ? player.resolvedCoachTeamId === teamId : null;

    // Teammate requests
    const twoWayTotal = player.twoWayTeammateIds?.length || 0;
    const oneWayTotal = player.oneWayTeammateIds?.length || 0;
    const teammateRequestsTotal = twoWayTotal + oneWayTotal;

    const twoWayHonored = player.twoWayTeammateIds?.filter(id =>
      team.assignedPlayerIds.includes(id)
    ).length || 0;

    const oneWayHonored = player.oneWayTeammateIds?.filter(id =>
      team.assignedPlayerIds.includes(id)
    ).length || 0;

    const teammateRequestsHonored = twoWayHonored + oneWayHonored;

    // Calculate happiness score
    let score: HappinessScore;
    const totalRequests = teammateRequestsTotal + (hasCoachRequest ? 1 : 0);
    const totalHonored = teammateRequestsHonored + (coachRequestHonored ? 1 : 0);

    if (totalRequests === 0) {
      score = 'no-requests';
    } else if (totalHonored === totalRequests) {
      score = 'all';
    } else if (totalHonored > 0) {
      score = 'some';
    } else {
      score = 'none';
    }

    return {
      playerId: player.id,
      score,
      coachRequestHonored,
      teammateRequestsHonored,
      teammateRequestsTotal,
      twoWayRequestsHonored: twoWayHonored,
      twoWayRequestsTotal: twoWayTotal,
    };
  });

  // Stats
  const lockedCount = assignments.filter(a =>
    ['coach-kid', 'assistant-coach-kid', 'sibling-lock', 'manual-lock'].includes(a.reason)
  ).length;

  const topTalentAssigned = assignments.filter(a => a.reason === 'top-talent').length;

  const requestBasedCount = assignments.filter(a =>
    ['two-way-friend', 'one-way-friend', 'coach-request', 'school-cluster'].includes(a.reason)
  ).length;

  const balanceBasedCount = assignments.filter(a => a.reason === 'balance').length;

  const twoWayTotal = players.reduce((sum, p) => sum + (p.twoWayTeammateIds?.length || 0), 0);
  const twoWayHonored = playerHappiness.reduce((sum, h) => sum + h.twoWayRequestsHonored, 0);

  const oneWayTotal = players.reduce((sum, p) => sum + (p.oneWayTeammateIds?.length || 0), 0);
  const oneWayHonored = playerHappiness.reduce((sum, h) =>
    sum + (h.teammateRequestsHonored - h.twoWayRequestsHonored), 0
  );

  const coachRequestTotal = players.filter(p => p.resolvedCoachTeamId).length;
  const coachRequestHonored = playerHappiness.filter(h => h.coachRequestHonored === true).length;

  // Average happiness (0-1)
  const happinessScores = playerHappiness.filter(h => h.score !== 'no-requests');
  const avgHappiness = happinessScores.length > 0
    ? happinessScores.reduce((sum, h) => {
        if (h.score === 'all') return sum + 1;
        if (h.score === 'some') return sum + 0.5;
        return sum;
      }, 0) / happinessScores.length
    : 1;

  return {
    assignments,
    teamSummaries,
    playerHappiness,
    warnings,
    stats: {
      totalPlayers: players.length,
      lockedPlayers: lockedCount,
      topTalentPlayers: topTalentAssigned,
      requestBasedPlayers: requestBasedCount,
      balanceBasedPlayers: balanceBasedCount,
      twoWayRequestsHonored: twoWayHonored,
      twoWayRequestsTotal: twoWayTotal,
      oneWayRequestsHonored: oneWayHonored,
      oneWayRequestsTotal: oneWayTotal,
      coachRequestsHonored: coachRequestHonored,
      coachRequestsTotal: coachRequestTotal,
      averageHappiness: avgHappiness,
    },
  };
}

// -----------------------------------------------------------------------------
// Convert to Draft Format
// -----------------------------------------------------------------------------

/**
 * Convert team builder assignments to draft picks format.
 * This allows reuse of existing trade and export modules.
 */
export function convertToDraftPicks(
  assignments: AssignmentResult[]
): DraftPick[] {
  return assignments.map(a => ({
    round: a.round,
    pick: a.pick,
    teamId: a.teamId,
    playerId: a.playerId,
    timestamp: Date.now(),
    wasSkipped: false,
  }));
}

/**
 * Apply assignments to players and teams.
 * Updates isDrafted, draftedByTeamId, etc. on players.
 */
export function applyAssignments(
  players: Player[],
  teams: Team[],
  assignments: AssignmentResult[]
): { players: Player[]; teams: Team[] } {
  const playerMap = new Map(players.map(p => [p.id, { ...p }]));
  const teamMap = new Map(teams.map(t => [t.id, { ...t, roster: [] as Player[] }]));

  for (const assignment of assignments) {
    const player = playerMap.get(assignment.playerId);
    const team = teamMap.get(assignment.teamId);

    if (player && team) {
      player.isDrafted = true;
      player.draftedByTeamId = assignment.teamId;
      player.draftedInRound = assignment.round;
      player.draftedAtPick = assignment.pick;

      team.roster.push(player);
      team.totalScore = team.roster.reduce((sum, p) => sum + p.totalScore, 0);
    }
  }

  // Update age breakdown for each team
  for (const team of teamMap.values()) {
    const ageBreakdown: Record<string, number> = {};
    for (const player of team.roster) {
      const age = String(player.littleLeagueAge);
      ageBreakdown[age] = (ageBreakdown[age] || 0) + 1;
    }
    team.ageBreakdown = ageBreakdown;
  }

  return {
    players: Array.from(playerMap.values()),
    teams: Array.from(teamMap.values()),
  };
}
