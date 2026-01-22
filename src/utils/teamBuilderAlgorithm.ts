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

import {
  Player,
  Team,
  DraftPick,
  ResolvedRequest,
  RequestCluster,
  RequestsFirstConfig,
  DEFAULT_REQUESTS_FIRST_CONFIG,
  TradeCandidate,
} from '../types';
import { buildRequestClusters, splitOversizedCluster } from './teamBuilderParser';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface TeamBuilderConfig {
  balanceTolerance: number; // e.g., 0.10 for ±10%
  topTalentRounds: number; // Number of "rounds" of top talent to spread (e.g., 2)
  maxRosterSize: number; // Hard max per team (e.g., 13)
  minRosterSize: number; // Minimum players per team (e.g., 10)
  prioritizeBalance: boolean; // If true, balance > happiness; if false, happiness > balance
  forceEvenTeams: boolean; // If true, all teams will have same size (or differ by at most 1)
}

export const DEFAULT_TEAM_BUILDER_CONFIG: TeamBuilderConfig = {
  balanceTolerance: 0.10,
  topTalentRounds: 2,
  maxRosterSize: 13,
  minRosterSize: 10,
  prioritizeBalance: true,
  forceEvenTeams: false,
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
  averageScore: number; // Average score per player (totalScore / rosterCount)
  meanDelta: number; // Difference from mean average (positive = above, negative = below)
  meanDeltaPercent: number; // As percentage of mean average
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

  // Calculate target roster size for even teams
  const baseRosterSize = Math.floor(players.length / teams.length);
  const extraPlayers = players.length % teams.length;
  // Some teams get baseRosterSize + 1, others get baseRosterSize
  // The first 'extraPlayers' teams (by current roster count) can have the extra player

  // Helper to check if team can accept more players
  const canAcceptPlayer = (team: TeamBuilderTeam): boolean => {
    if (team.assignedPlayerIds.length >= config.maxRosterSize) {
      return false;
    }

    if (config.forceEvenTeams) {
      // Count how many teams already have baseRosterSize + 1 players
      const teamsWithExtra = workingTeams.filter(t => t.assignedPlayerIds.length > baseRosterSize).length;

      // If this team is at baseRosterSize, it can only accept if there are still extra slots available
      if (team.assignedPlayerIds.length >= baseRosterSize) {
        // Team is at base size - can only go to base+1 if extra slots remain
        if (team.assignedPlayerIds.length === baseRosterSize && teamsWithExtra < extraPlayers) {
          return true;
        }
        return false;
      }
      return true;
    }

    return true;
  };

  // Helper to check if any team is below minimum roster size
  const getTeamsBelowMinimum = (): TeamBuilderTeam[] => {
    return workingTeams.filter(t =>
      t.assignedPlayerIds.length < config.minRosterSize && canAcceptPlayer(t)
    );
  };

  // Helper to get the team with fewest players that's below minimum (for priority filling)
  const getSmallestTeamBelowMinimum = (): TeamBuilderTeam | null => {
    const belowMin = getTeamsBelowMinimum();
    if (belowMin.length === 0) return null;
    return belowMin.reduce((smallest, team) =>
      team.assignedPlayerIds.length < smallest.assignedPlayerIds.length ? team : smallest
    );
  };

  // Helper to get team with lowest score that can accept
  // Prioritizes teams below minimum roster size first
  const getLowestScoreTeam = (): TeamBuilderTeam | null => {
    // First, try to fill teams that are below minimum
    const smallestBelowMin = getSmallestTeamBelowMinimum();
    if (smallestBelowMin) {
      // Among teams below minimum with same roster count, pick lowest score
      const belowMinSameCount = getTeamsBelowMinimum().filter(
        t => t.assignedPlayerIds.length === smallestBelowMin.assignedPlayerIds.length
      );
      return belowMinSameCount.reduce((lowest, team) =>
        team.currentScore < lowest.currentScore ? team : lowest
      );
    }

    // All teams are at or above minimum, use normal logic
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

    // Check if any teams are below minimum - they get priority
    const teamsBelowMin = getTeamsBelowMinimum();
    if (teamsBelowMin.length > 0) {
      // Must fill teams to minimum first - pick the smallest team with lowest score
      const smallestCount = Math.min(...teamsBelowMin.map(t => t.assignedPlayerIds.length));
      const smallestTeams = teamsBelowMin.filter(t => t.assignedPlayerIds.length === smallestCount);
      const targetTeam = smallestTeams.reduce((lowest, team) =>
        team.currentScore < lowest.currentScore ? team : lowest
      );
      assignPlayer(player.id, targetTeam.id, 'balance');
      continue;
    }

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

  // Team summaries - use average scores for balance comparison since teams may have different sizes
  const teamAverages = workingTeams.map(team => ({
    team,
    averageScore: team.assignedPlayerIds.length > 0
      ? team.currentScore / team.assignedPlayerIds.length
      : 0,
  }));
  const meanAverageScore = teamAverages.length > 0
    ? teamAverages.reduce((sum, t) => sum + t.averageScore, 0) / teamAverages.length
    : 0;

  const teamSummaries: TeamSummary[] = workingTeams.map(team => {
    const rosterCount = team.assignedPlayerIds.length;
    const averageScore = rosterCount > 0 ? team.currentScore / rosterCount : 0;
    return {
      teamId: team.id,
      teamName: team.teamName || team.headCoach,
      coachName: team.headCoach,
      rosterCount,
      totalScore: team.currentScore,
      averageScore,
      meanDelta: averageScore - meanAverageScore,
      meanDeltaPercent: meanAverageScore > 0 ? ((averageScore - meanAverageScore) / meanAverageScore) * 100 : 0,
    };
  });

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

// -----------------------------------------------------------------------------
// Requests-First Algorithm
// -----------------------------------------------------------------------------

/**
 * Extended result type for requests-first algorithm.
 */
export interface RequestsFirstResult extends TeamBuilderResult {
  clusters: RequestCluster[];
  suggestedTrades: TradeCandidate[];
}

/**
 * Run the requests-first team builder algorithm.
 *
 * This algorithm prioritizes request satisfaction over balance:
 * 1. Place locked players (coach kids, siblings)
 * 2. Build and place two-way request clusters
 * 3. Place remaining players by request weight (two-way > one-way > coach)
 * 4. Suggest trades to improve balance without breaking satisfied requests
 */
export function runRequestsFirstAlgorithm(
  players: TeamBuilderPlayer[],
  teams: Team[],
  resolvedRequests: ResolvedRequest[],
  config: Partial<RequestsFirstConfig> = {}
): RequestsFirstResult {
  const fullConfig = { ...DEFAULT_REQUESTS_FIRST_CONFIG, ...config };
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
      return false;
    }

    if (team.assignedPlayerIds.length >= fullConfig.maxRosterSize) {
      warnings.push(`Team ${team.teamName || team.headCoach} is full, cannot assign ${player.name}`);
      return false;
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

    return true;
  };

  // Calculate target roster sizes for even teams
  const numTeams = workingTeams.length;
  const totalPlayers = players.length;
  const baseRosterSize = Math.floor(totalPlayers / numTeams);
  const extraPlayers = totalPlayers % numTeams;
  // Some teams get baseRosterSize + 1, others get baseRosterSize
  // Teams are filled in order, so first `extraPlayers` teams get the extra player

  // Helper to get max size for a team when forceEvenTeams is enabled
  const getMaxSizeForTeam = (teamIndex: number): number => {
    if (!fullConfig.forceEvenTeams) {
      return fullConfig.maxRosterSize;
    }
    // First `extraPlayers` teams get one extra player
    return teamIndex < extraPlayers ? baseRosterSize + 1 : baseRosterSize;
  };

  // Helper to check if team can accept more players
  const canAcceptPlayer = (team: TeamBuilderTeam): boolean => {
    const teamIndex = workingTeams.indexOf(team);
    const maxSize = getMaxSizeForTeam(teamIndex);
    return team.assignedPlayerIds.length < maxSize;
  };

  // Helper to get team with lowest score that can accept
  const getLowestScoreTeam = (): TeamBuilderTeam | null => {
    const eligible = workingTeams.filter(canAcceptPlayer);
    if (eligible.length === 0) return null;
    return eligible.reduce((lowest, team) =>
      team.currentScore < lowest.currentScore ? team : lowest
    );
  };

  // Helper to get team with fewest players that can accept (for even distribution)
  const getSmallestTeam = (): TeamBuilderTeam | null => {
    const eligible = workingTeams.filter(canAcceptPlayer);
    if (eligible.length === 0) return null;
    return eligible.reduce((smallest, team) =>
      team.assignedPlayerIds.length < smallest.assignedPlayerIds.length ? team : smallest
    );
  };

  // Build request lookup maps
  const playerRequests = new Map<string, ResolvedRequest[]>();
  for (const req of resolvedRequests) {
    if (!playerRequests.has(req.playerId)) {
      playerRequests.set(req.playerId, []);
    }
    playerRequests.get(req.playerId)!.push(req);
  }

  // =========================================================================
  // PHASE 0: Place locked players (coach kids, siblings)
  // =========================================================================

  // 0a: Coach kids
  for (const player of players) {
    if (!unassignedPlayers.has(player.id)) continue;

    if (player.isCoachKid && player.coachTeamId) {
      const team = workingTeams.find(t => t.id === player.coachTeamId);
      if (team && canAcceptPlayer(team)) {
        assignPlayer(player.id, team.id, 'coach-kid');
      }
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
    const assignedSibling = siblingIds.find(id => !unassignedPlayers.has(id));
    if (assignedSibling) {
      const assignment = assignments.find(a => a.playerId === assignedSibling);
      if (assignment) {
        for (const sibId of siblingIds) {
          if (unassignedPlayers.has(sibId)) {
            const team = workingTeams.find(t => t.id === assignment.teamId);
            if (team && canAcceptPlayer(team)) {
              assignPlayer(sibId, assignment.teamId, 'sibling-lock');
            }
          }
        }
      }
    }
  }

  // 0c: Manually locked players
  for (const player of players) {
    if (!unassignedPlayers.has(player.id)) continue;

    if (player.lockedToTeamId) {
      const team = workingTeams.find(t => t.id === player.lockedToTeamId);
      if (team && canAcceptPlayer(team)) {
        assignPlayer(player.id, team.id, 'manual-lock');
      }
    }
  }

  // =========================================================================
  // PHASE 1: Build and place two-way request clusters
  // =========================================================================

  // Build clusters from confirmed requests
  const confirmedRequests = resolvedRequests.filter(
    r => r.status === 'auto-confirmed' || r.status === 'user-confirmed'
  );

  let clusters = buildRequestClusters(
    confirmedRequests,
    players.map(p => ({ id: p.id, firstName: p.firstName, lastName: p.lastName })),
    fullConfig.maxRosterSize
  );

  // Split oversized clusters
  const processedClusters: RequestCluster[] = [];
  for (const cluster of clusters) {
    if (cluster.playerIds.length > fullConfig.maxRosterSize) {
      const split = splitOversizedCluster(cluster, confirmedRequests, fullConfig.maxRosterSize);
      processedClusters.push(...split);
    } else {
      processedClusters.push(cluster);
    }
  }
  clusters = processedClusters;

  // Sort clusters by weight (descending)
  clusters.sort((a, b) => b.totalWeight - a.totalWeight);

  // Place each cluster
  for (const cluster of clusters) {
    // Skip if all players already assigned
    const unassignedInCluster = cluster.playerIds.filter(id => unassignedPlayers.has(id));
    if (unassignedInCluster.length === 0) continue;

    // Find best team for this cluster
    // Prefer teams where some cluster members are already assigned
    // Then prefer teams with coach requests from cluster members
    // Then prefer team with lowest score

    let bestTeam: TeamBuilderTeam | null = null;
    let bestScore = -Infinity;

    for (const team of workingTeams) {
      if (!canAcceptPlayer(team)) continue;
      // Check if team can fit all unassigned cluster members
      const remainingCapacity = fullConfig.maxRosterSize - team.assignedPlayerIds.length;
      if (remainingCapacity < unassignedInCluster.length) continue;

      let score = 0;

      // Bonus for cluster members already on team
      const alreadyOnTeam = cluster.playerIds.filter(id =>
        team.assignedPlayerIds.includes(id)
      ).length;
      score += alreadyOnTeam * 200;

      // Bonus for coach request preference
      if (cluster.preferredTeamIds.includes(team.id)) {
        score += fullConfig.coachRequestWeight;
      }

      // Small penalty for team score (prefer lower-score teams slightly)
      score -= team.currentScore * 0.01;

      if (score > bestScore) {
        bestScore = score;
        bestTeam = team;
      }
    }

    // If no team can fit the whole cluster, pick team with most capacity
    if (!bestTeam) {
      const teamsWithCapacity = workingTeams
        .filter(canAcceptPlayer)
        .sort((a, b) => {
          const capA = fullConfig.maxRosterSize - a.assignedPlayerIds.length;
          const capB = fullConfig.maxRosterSize - b.assignedPlayerIds.length;
          return capB - capA;
        });
      bestTeam = teamsWithCapacity[0] || null;
    }

    if (bestTeam) {
      for (const playerId of unassignedInCluster) {
        if (canAcceptPlayer(bestTeam)) {
          assignPlayer(playerId, bestTeam.id, 'two-way-friend');
        } else {
          warnings.push(`Could not place all cluster members together: ${playerId}`);
        }
      }
    } else {
      for (const playerId of unassignedInCluster) {
        warnings.push(`No team available for cluster member: ${playerId}`);
      }
    }
  }

  // =========================================================================
  // PHASE 2: Place remaining players by request weight
  // =========================================================================

  // Calculate request weight for each remaining player
  interface PlayerWeight {
    playerId: string;
    weight: number;
    preferredTeamIds: string[];
    oneWayTargets: string[];
  }

  const playerWeights: PlayerWeight[] = [];

  for (const playerId of unassignedPlayers) {
    const requests = playerRequests.get(playerId) || [];
    let weight = 0;
    const preferredTeamIds: string[] = [];
    const oneWayTargets: string[] = [];

    for (const req of requests) {
      if (req.status !== 'auto-confirmed' && req.status !== 'user-confirmed') continue;
      if (!req.resolvedTargetId) continue;

      if (req.requestType === 'coach') {
        weight += fullConfig.coachRequestWeight;
        preferredTeamIds.push(req.resolvedTargetId);
      } else if (req.requestType === 'teammate') {
        if (req.isTwoWay) {
          weight += fullConfig.twoWayTeammateWeight;
        } else {
          weight += fullConfig.oneWayTeammateWeight;
          oneWayTargets.push(req.resolvedTargetId);
        }
      }
    }

    // Add school cluster weight if player has school
    const player = playerMap.get(playerId);
    if (player?.school) {
      weight += fullConfig.schoolClusterWeight;
    }

    playerWeights.push({
      playerId,
      weight,
      preferredTeamIds,
      oneWayTargets,
    });
  }

  // Sort by weight descending (players with more/higher-priority requests first)
  playerWeights.sort((a, b) => b.weight - a.weight);

  // Place each player to maximize their request satisfaction
  for (const { playerId, preferredTeamIds, oneWayTargets } of playerWeights) {
    if (!unassignedPlayers.has(playerId)) continue;

    const player = playerMap.get(playerId);
    if (!player) continue;

    let bestTeam: TeamBuilderTeam | null = null;
    let bestScore = -Infinity;
    let bestReason: AssignmentReason = 'balance';

    for (const team of workingTeams) {
      if (!canAcceptPlayer(team)) continue;

      let score = 0;
      let reason: AssignmentReason = 'balance';

      // Check one-way targets on this team
      const oneWayOnTeam = oneWayTargets.filter(targetId =>
        team.assignedPlayerIds.includes(targetId)
      ).length;
      if (oneWayOnTeam > 0) {
        score += oneWayOnTeam * fullConfig.oneWayTeammateWeight;
        reason = 'one-way-friend';
      }

      // Check coach preference
      if (preferredTeamIds.includes(team.id)) {
        score += fullConfig.coachRequestWeight;
        if (reason === 'balance') reason = 'coach-request';
      }

      // Check school clustering
      if (player.school) {
        const schoolmatesOnTeam = team.assignedPlayerIds.filter(id => {
          const p = playerMap.get(id);
          return p?.school && p.school.toLowerCase() === player.school!.toLowerCase();
        }).length;
        if (schoolmatesOnTeam > 0) {
          score += schoolmatesOnTeam * fullConfig.schoolClusterWeight;
          if (reason === 'balance') reason = 'school-cluster';
        }
      }

      // Small penalty for team score (prefer lower-score teams for balance)
      score -= team.currentScore * 0.001;

      if (score > bestScore) {
        bestScore = score;
        bestTeam = team;
        bestReason = reason;
      }
    }

    // If no team with requests, use smallest team (for even teams) or lowest score team
    if (!bestTeam || bestScore <= 0) {
      bestTeam = fullConfig.forceEvenTeams ? getSmallestTeam() : getLowestScoreTeam();
      bestReason = 'balance';
    }

    if (bestTeam) {
      assignPlayer(playerId, bestTeam.id, bestReason);
    } else {
      warnings.push(`No team available for player: ${player.name}`);
    }
  }

  // =========================================================================
  // PHASE 3: Place any remaining unassigned players
  // =========================================================================

  for (const playerId of unassignedPlayers) {
    const player = playerMap.get(playerId);
    if (!player) continue;

    // Use smallest team for even distribution, or lowest score team otherwise
    const targetTeam = fullConfig.forceEvenTeams ? getSmallestTeam() : getLowestScoreTeam();
    if (targetTeam) {
      assignPlayer(playerId, targetTeam.id, 'balance');
    } else {
      warnings.push(`Could not place player ${player.name} - all teams full`);
    }
  }

  // =========================================================================
  // PHASE 4: Calculate suggested trades for balance
  // =========================================================================

  const suggestedTrades = findBalancingTrades(
    workingTeams,
    players,
    resolvedRequests,
    assignments,
    fullConfig
  );

  // =========================================================================
  // Calculate results
  // =========================================================================

  // Team summaries
  const teamAverages = workingTeams.map(team => ({
    team,
    averageScore: team.assignedPlayerIds.length > 0
      ? team.currentScore / team.assignedPlayerIds.length
      : 0,
  }));
  const meanAverageScore = teamAverages.length > 0
    ? teamAverages.reduce((sum, t) => sum + t.averageScore, 0) / teamAverages.length
    : 0;

  const teamSummaries: TeamSummary[] = workingTeams.map(team => {
    const rosterCount = team.assignedPlayerIds.length;
    const averageScore = rosterCount > 0 ? team.currentScore / rosterCount : 0;
    return {
      teamId: team.id,
      teamName: team.teamName || team.headCoach,
      coachName: team.headCoach,
      rosterCount,
      totalScore: team.currentScore,
      averageScore,
      meanDelta: averageScore - meanAverageScore,
      meanDeltaPercent: meanAverageScore > 0 ? ((averageScore - meanAverageScore) / meanAverageScore) * 100 : 0,
    };
  });

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
    const requests = playerRequests.get(player.id) || [];

    // Coach request
    const coachRequests = requests.filter(r =>
      r.requestType === 'coach' &&
      (r.status === 'auto-confirmed' || r.status === 'user-confirmed') &&
      r.resolvedTargetId
    );
    const hasCoachRequest = coachRequests.length > 0;
    const coachRequestHonored = hasCoachRequest
      ? coachRequests.some(r => r.resolvedTargetId === teamId)
      : null;

    // Teammate requests
    const teammateRequests = requests.filter(r =>
      r.requestType === 'teammate' &&
      (r.status === 'auto-confirmed' || r.status === 'user-confirmed') &&
      r.resolvedTargetId
    );

    const twoWayTotal = teammateRequests.filter(r => r.isTwoWay).length;
    const oneWayTotal = teammateRequests.filter(r => !r.isTwoWay).length;
    const teammateRequestsTotal = twoWayTotal + oneWayTotal;

    const twoWayHonored = teammateRequests.filter(r =>
      r.isTwoWay && team.assignedPlayerIds.includes(r.resolvedTargetId!)
    ).length;
    const oneWayHonored = teammateRequests.filter(r =>
      !r.isTwoWay && team.assignedPlayerIds.includes(r.resolvedTargetId!)
    ).length;
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

  // Average happiness
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
    clusters,
    suggestedTrades,
  };
}

// -----------------------------------------------------------------------------
// Trade Suggestions for Balance
// -----------------------------------------------------------------------------

/**
 * Find trades that would improve team balance without breaking satisfied requests.
 *
 * A player is "tradeable" if:
 * - They have NO requests, OR
 * - ALL their requests are already satisfied on their current team
 */
export function findBalancingTrades(
  teams: TeamBuilderTeam[],
  players: TeamBuilderPlayer[],
  resolvedRequests: ResolvedRequest[],
  assignments: AssignmentResult[],
  config: RequestsFirstConfig
): TradeCandidate[] {
  const candidates: TradeCandidate[] = [];
  const playerMap = new Map(players.map(p => [p.id, p]));

  // Build lookup for which team each player is on
  const playerTeamMap = new Map<string, string>();
  for (const assignment of assignments) {
    playerTeamMap.set(assignment.playerId, assignment.teamId);
  }

  // Build request lookup
  const playerRequests = new Map<string, ResolvedRequest[]>();
  for (const req of resolvedRequests) {
    if (!playerRequests.has(req.playerId)) {
      playerRequests.set(req.playerId, []);
    }
    playerRequests.get(req.playerId)!.push(req);
  }

  // Determine which players are tradeable
  // A player is ONLY tradeable if they have NO requests at all
  // If they have any requests (satisfied or not), trading them could break those requests
  const isPlayerTradeable = (playerId: string): boolean => {
    const player = playerMap.get(playerId);
    if (!player) return false;

    // Coach kids are never tradeable
    if (player.isCoachKid) return false;

    // Siblings are not tradeable (would need to trade both)
    if (player.siblingId) return false;

    // Players locked to teams are not tradeable
    if (player.lockedToTeamId) return false;

    const requests = playerRequests.get(playerId) || [];
    const confirmedRequests = requests.filter(
      r => (r.status === 'auto-confirmed' || r.status === 'user-confirmed') && r.resolvedTargetId
    );

    // Only tradeable if they have NO confirmed requests
    // If they have any requests (coach or teammate), trading them would potentially
    // break satisfied requests or move them away from where they want to be
    return confirmedRequests.length === 0;
  };

  // Get tradeable players per team with their scores
  const tradeableByTeam = new Map<string, Array<{ playerId: string; score: number; name: string }>>();
  for (const team of teams) {
    const tradeable: Array<{ playerId: string; score: number; name: string }> = [];
    for (const playerId of team.assignedPlayerIds) {
      if (isPlayerTradeable(playerId)) {
        const player = playerMap.get(playerId);
        if (player) {
          tradeable.push({
            playerId,
            score: player.totalScore,
            name: player.name,
          });
        }
      }
    }
    tradeableByTeam.set(team.id, tradeable);
  }

  // Calculate current balance metrics
  const teamScores = teams.map(t => ({
    team: t,
    avgScore: t.assignedPlayerIds.length > 0
      ? t.currentScore / t.assignedPlayerIds.length
      : 0,
  }));
  const meanAvg = teamScores.reduce((sum, t) => sum + t.avgScore, 0) / teamScores.length;

  // Sort teams by average score
  teamScores.sort((a, b) => b.avgScore - a.avgScore);

  // Find trades between high and low scoring teams
  let tradeId = 0;
  for (let i = 0; i < teamScores.length; i++) {
    for (let j = teamScores.length - 1; j > i; j--) {
      const highTeam = teamScores[i].team;
      const lowTeam = teamScores[j].team;

      // Get tradeable players
      const highTradeable = tradeableByTeam.get(highTeam.id) || [];
      const lowTradeable = tradeableByTeam.get(lowTeam.id) || [];

      // Try to find beneficial swaps
      for (const highPlayer of highTradeable) {
        for (const lowPlayer of lowTradeable) {
          // Only consider if high player has more points
          if (highPlayer.score <= lowPlayer.score) continue;

          // Calculate new averages after trade
          const newHighTotal = highTeam.currentScore - highPlayer.score + lowPlayer.score;
          const newLowTotal = lowTeam.currentScore - lowPlayer.score + highPlayer.score;

          const newHighAvg = newHighTotal / highTeam.assignedPlayerIds.length;
          const newLowAvg = newLowTotal / lowTeam.assignedPlayerIds.length;

          // Calculate improvement (how much closer to mean)
          const oldHighDelta = Math.abs(teamScores[i].avgScore - meanAvg);
          const oldLowDelta = Math.abs(teamScores[j].avgScore - meanAvg);
          const newHighDelta = Math.abs(newHighAvg - meanAvg);
          const newLowDelta = Math.abs(newLowAvg - meanAvg);

          const improvement = (oldHighDelta + oldLowDelta) - (newHighDelta + newLowDelta);

          // Only suggest if it improves balance
          if (improvement > 0) {
            candidates.push({
              id: `trade-${tradeId++}`,
              fromTeamId: highTeam.id,
              toTeamId: lowTeam.id,
              player1Id: highPlayer.playerId,
              player2Id: lowPlayer.playerId,
              balanceImprovement: improvement,
              player1Name: highPlayer.name,
              player2Name: lowPlayer.name,
              fromTeamName: highTeam.teamName || highTeam.headCoach,
              toTeamName: lowTeam.teamName || lowTeam.headCoach,
            });
          }
        }
      }
    }
  }

  // Sort by improvement (descending) and limit
  candidates.sort((a, b) => b.balanceImprovement - a.balanceImprovement);

  // Deduplicate - remove trades involving same players
  const seen = new Set<string>();
  const unique: TradeCandidate[] = [];
  for (const trade of candidates) {
    const key1 = trade.player1Id;
    const key2 = trade.player2Id;
    if (!seen.has(key1) && !seen.has(key2)) {
      unique.push(trade);
      seen.add(key1);
      seen.add(key2);
    }
  }

  return unique.slice(0, config.maxAutoTrades);
}

/**
 * Apply a trade to update team assignments.
 */
export function applyTrade(
  teams: TeamBuilderTeam[],
  assignments: AssignmentResult[],
  trade: TradeCandidate
): { teams: TeamBuilderTeam[]; assignments: AssignmentResult[] } {
  // Clone data
  const newTeams = teams.map(t => ({
    ...t,
    assignedPlayerIds: [...t.assignedPlayerIds],
  }));
  const newAssignments = [...assignments];

  // Find teams
  const fromTeam = newTeams.find(t => t.id === trade.fromTeamId);
  const toTeam = newTeams.find(t => t.id === trade.toTeamId);

  if (!fromTeam || !toTeam) return { teams, assignments };

  // Update team rosters
  fromTeam.assignedPlayerIds = fromTeam.assignedPlayerIds
    .filter(id => id !== trade.player1Id);
  fromTeam.assignedPlayerIds.push(trade.player2Id);

  toTeam.assignedPlayerIds = toTeam.assignedPlayerIds
    .filter(id => id !== trade.player2Id);
  toTeam.assignedPlayerIds.push(trade.player1Id);

  // Update assignments
  const a1Idx = newAssignments.findIndex(a => a.playerId === trade.player1Id);
  const a2Idx = newAssignments.findIndex(a => a.playerId === trade.player2Id);

  if (a1Idx >= 0) {
    newAssignments[a1Idx] = { ...newAssignments[a1Idx], teamId: trade.toTeamId };
  }
  if (a2Idx >= 0) {
    newAssignments[a2Idx] = { ...newAssignments[a2Idx], teamId: trade.fromTeamId };
  }

  return { teams: newTeams, assignments: newAssignments };
}

// -----------------------------------------------------------------------------
// Skill-Tiered Draft Algorithm
// -----------------------------------------------------------------------------

/**
 * Configuration for the skill-tiered draft algorithm.
 */
export interface SkillTieredDraftConfig {
  // Roster constraints
  maxRosterSize: number;           // Hard max per team (e.g., 13)
  minRosterSize: number;           // Minimum players per team (e.g., 10)
  forceEvenTeams: boolean;         // If true, teams differ by at most 1 player

  // Request weights for tiebreaking within skill tier
  twoWayTeammateWeight: number;    // Weight for two-way friend requests (default: 100)
  oneWayTeammateWeight: number;    // Weight for one-way friend requests (default: 50)
  coachRequestWeight: number;      // Weight for coach requests (default: 30)
  schoolSameGradeWeight: number;   // Weight for school + same grade (default: 20)
  schoolDiffGradeWeight: number;   // Weight for school only (default: 10)

  // Deferral settings
  enableDeferral: boolean;         // Allow deferring players who can be happy elsewhere
  deferralThreshold: number;       // Min request score on another team to defer (default: 50)

  // Balance settings
  maxAutoTrades: number;           // Max number of suggested trades
}

export const DEFAULT_SKILL_TIERED_CONFIG: SkillTieredDraftConfig = {
  maxRosterSize: 13,
  minRosterSize: 10,
  forceEvenTeams: false,
  twoWayTeammateWeight: 100,
  oneWayTeammateWeight: 50,
  coachRequestWeight: 30,
  schoolSameGradeWeight: 20,
  schoolDiffGradeWeight: 10,
  enableDeferral: true,
  deferralThreshold: 50,
  maxAutoTrades: 10,
};

/**
 * Extended result type for skill-tiered draft algorithm.
 */
export interface SkillTieredDraftResult extends TeamBuilderResult {
  draftLog: DraftLogEntry[];
  suggestedTrades: TradeCandidate[];
}

/**
 * Log entry for each pick in the skill-tiered draft.
 */
export interface DraftLogEntry {
  round: number;
  pick: number;
  teamId: string;
  teamName: string;
  playerId: string;
  playerName: string;
  reason: AssignmentReason;
  wasDeferred: boolean;
  tiebreakScore?: number;
}

/**
 * Run the skill-tiered draft algorithm.
 *
 * This algorithm simulates a real draft process:
 * 1. Place coach kids first on their assigned teams
 * 2. Calculate initial draft order based on team scores (from top 2 coach kids)
 * 3. For each round, players in that skill tier (projectedRound) are available
 * 4. Picking team selects based on request tiebreakers (not just best score)
 * 5. Draft order recalculated each round (lowest score team picks first)
 * 6. Players can be deferred if they can be happy on another team
 */
export function runSkillTieredDraft(
  players: TeamBuilderPlayer[],
  teams: Team[],
  resolvedRequests: ResolvedRequest[],
  config: Partial<SkillTieredDraftConfig> = {}
): SkillTieredDraftResult {
  const fullConfig = { ...DEFAULT_SKILL_TIERED_CONFIG, ...config };
  const warnings: string[] = [];
  const assignments: AssignmentResult[] = [];
  const draftLog: DraftLogEntry[] = [];

  // Initialize working copies
  const workingTeams: TeamBuilderTeam[] = teams.map(t => ({
    ...t,
    assignedPlayerIds: [],
    currentScore: 0,
  }));

  const unassignedPlayers = new Set(players.map(p => p.id));
  const playerMap = new Map(players.map(p => [p.id, p]));
  const teamMap = new Map(workingTeams.map(t => [t.id, t]));

  // Build request lookup maps
  const playerRequests = new Map<string, ResolvedRequest[]>();
  for (const req of resolvedRequests) {
    if (!playerRequests.has(req.playerId)) {
      playerRequests.set(req.playerId, []);
    }
    playerRequests.get(req.playerId)!.push(req);
  }

  // Track sibling locks
  const siblingLocks = new Map<string, string>(); // playerId -> teamId

  // Calculate total rounds needed
  const totalPlayers = players.length;
  const numTeams = workingTeams.length;
  const totalRounds = Math.ceil(totalPlayers / numTeams);

  // Calculate target roster sizes for even teams
  const baseRosterSize = Math.floor(totalPlayers / numTeams);
  const extraPlayers = totalPlayers % numTeams;

  // Helper: get max size for a team when forceEvenTeams is enabled
  const getMaxSizeForTeam = (team: TeamBuilderTeam): number => {
    if (!fullConfig.forceEvenTeams) {
      return fullConfig.maxRosterSize;
    }
    const teamIndex = workingTeams.indexOf(team);
    return teamIndex < extraPlayers ? baseRosterSize + 1 : baseRosterSize;
  };

  // Helper: check if team can accept more players
  const canAcceptPlayer = (team: TeamBuilderTeam): boolean => {
    return team.assignedPlayerIds.length < getMaxSizeForTeam(team);
  };

  // Helper: assign a player to a team
  const assignPlayer = (
    playerId: string,
    teamId: string,
    round: number,
    pick: number,
    reason: AssignmentReason,
    wasDeferred: boolean = false,
    tiebreakScore?: number
  ): boolean => {
    const player = playerMap.get(playerId);
    const team = teamMap.get(teamId);

    if (!player || !team) {
      warnings.push(`Failed to assign player ${playerId} to team ${teamId}`);
      return false;
    }

    if (!canAcceptPlayer(team)) {
      warnings.push(`Team ${team.teamName || team.headCoach} is full, cannot assign ${player.name}`);
      return false;
    }

    team.assignedPlayerIds.push(playerId);
    team.currentScore += player.totalScore;
    unassignedPlayers.delete(playerId);

    assignments.push({
      playerId,
      teamId,
      round,
      pick,
      reason,
    });

    draftLog.push({
      round,
      pick,
      teamId,
      teamName: team.teamName || team.headCoach,
      playerId,
      playerName: player.name,
      reason,
      wasDeferred,
      tiebreakScore,
    });

    return true;
  };

  // Helper: lock siblings to a team when one is drafted
  const lockSiblingsToTeam = (playerId: string, teamId: string) => {
    const player = playerMap.get(playerId);
    if (!player) return;

    // Find all siblings (forward and reverse links)
    const toProcess = [playerId];
    const processed = new Set<string>([playerId]);

    while (toProcess.length > 0) {
      const currentId = toProcess.shift()!;
      const current = playerMap.get(currentId);
      if (!current) continue;

      // Check siblingId (forward)
      if (current.siblingId && !processed.has(current.siblingId)) {
        siblingLocks.set(current.siblingId, teamId);
        processed.add(current.siblingId);
        toProcess.push(current.siblingId);
      }

      // Check reverse (players whose siblingId points to current)
      for (const [otherId, other] of playerMap) {
        if (other.siblingId === currentId && !processed.has(otherId)) {
          siblingLocks.set(otherId, teamId);
          processed.add(otherId);
          toProcess.push(otherId);
        }
      }
    }
  };

  // Helper: calculate request tiebreak score for a player on a given team
  const calculateTiebreakScore = (
    playerId: string,
    teamId: string,
    team: TeamBuilderTeam
  ): number => {
    const player = playerMap.get(playerId);
    if (!player) return 0;

    const requests = playerRequests.get(playerId) || [];
    let score = 0;

    for (const req of requests) {
      if (req.status !== 'auto-confirmed' && req.status !== 'user-confirmed') continue;
      if (!req.resolvedTargetId) continue;

      if (req.requestType === 'coach') {
        // Coach request satisfied if this is the requested team
        if (req.resolvedTargetId === teamId) {
          score += fullConfig.coachRequestWeight;
        }
      } else if (req.requestType === 'teammate') {
        // Teammate request satisfied if target is on this team
        if (team.assignedPlayerIds.includes(req.resolvedTargetId)) {
          score += req.isTwoWay ? fullConfig.twoWayTeammateWeight : fullConfig.oneWayTeammateWeight;
        }
      }
    }

    // School clustering bonus
    if (player.school) {
      for (const assignedId of team.assignedPlayerIds) {
        const teammate = playerMap.get(assignedId);
        if (teammate?.school?.toLowerCase() === player.school.toLowerCase()) {
          if (teammate.grade && player.grade && teammate.grade === player.grade) {
            score += fullConfig.schoolSameGradeWeight;
          } else {
            score += fullConfig.schoolDiffGradeWeight;
          }
        }
      }
    }

    return score;
  };

  // Helper: check if player could be happy on another team (for deferral)
  const canBeHappyElsewhere = (
    playerId: string,
    currentTeamId: string
  ): { canDefer: boolean; bestAlternateTeamId?: string; bestScore?: number } => {
    if (!fullConfig.enableDeferral) {
      return { canDefer: false };
    }

    let bestScore = 0;
    let bestTeamId: string | undefined;

    for (const team of workingTeams) {
      if (team.id === currentTeamId) continue;
      if (!canAcceptPlayer(team)) continue;

      const score = calculateTiebreakScore(playerId, team.id, team);
      if (score > bestScore) {
        bestScore = score;
        bestTeamId = team.id;
      }
    }

    return {
      canDefer: bestScore >= fullConfig.deferralThreshold,
      bestAlternateTeamId: bestTeamId,
      bestScore,
    };
  };

  // Helper: calculate draft order for a round (recalculated mode)
  const calculateRoundOrder = (): string[] => {
    // Sort teams by total score ascending (lowest score picks first)
    // Use original draftPosition as tiebreaker
    const sorted = [...workingTeams].sort((a, b) => {
      const scoreDiff = a.currentScore - b.currentScore;
      if (Math.abs(scoreDiff) < 0.01) {
        // Same score - use original draft position as tiebreaker
        return a.draftPosition - b.draftPosition;
      }
      return scoreDiff;
    });
    return sorted.map(t => t.id);
  };

  // Helper: get players available in a given skill tier (round)
  const getPlayersInSkillTier = (round: number): TeamBuilderPlayer[] => {
    return players.filter(p => {
      if (!unassignedPlayers.has(p.id)) return false;
      // Use lockedToRound if set, otherwise projectedRound
      const effectiveRound = p.lockedToRound ?? p.projectedRound;
      return effectiveRound === round;
    });
  };

  // Helper: get all available players (regardless of tier) - for late rounds
  const getAllAvailablePlayers = (): TeamBuilderPlayer[] => {
    return players.filter(p => unassignedPlayers.has(p.id));
  };

  // =========================================================================
  // PHASE 0: Place coach kids first
  // =========================================================================

  // Track picks per round for proper round.pickInRound display
  const roundPickCounts = new Map<number, number>();
  const getNextPickInRound = (round: number): number => {
    const current = roundPickCounts.get(round) || 0;
    roundPickCounts.set(round, current + 1);
    return current + 1;
  };

  // Sort coach kids by projected round to place them in order
  const coachKids = players.filter(p => p.isCoachKid && p.coachTeamId);
  coachKids.sort((a, b) => {
    const aRound = a.lockedToRound ?? a.projectedRound;
    const bRound = b.lockedToRound ?? b.projectedRound;
    return aRound - bRound;
  });

  // Place each coach kid
  for (const coachKid of coachKids) {
    if (!unassignedPlayers.has(coachKid.id)) continue;

    const team = teamMap.get(coachKid.coachTeamId!);
    if (!team || !canAcceptPlayer(team)) {
      warnings.push(`Could not place coach kid ${coachKid.name} on team ${coachKid.coachTeamId}`);
      continue;
    }

    const round = coachKid.lockedToRound ?? coachKid.projectedRound;
    const pickInRound = getNextPickInRound(round);
    assignPlayer(coachKid.id, team.id, round, pickInRound, 'coach-kid');

    // Lock any siblings to this team
    lockSiblingsToTeam(coachKid.id, team.id);
  }

  // =========================================================================
  // PHASE 1: Place siblings of coach kids (locked siblings)
  // =========================================================================

  for (const [siblingId, teamId] of siblingLocks) {
    if (!unassignedPlayers.has(siblingId)) continue;

    const sibling = playerMap.get(siblingId);
    const team = teamMap.get(teamId);
    if (!sibling || !team || !canAcceptPlayer(team)) {
      warnings.push(`Could not place sibling ${siblingId} on locked team ${teamId}`);
      continue;
    }

    const round = sibling.lockedToRound ?? sibling.projectedRound;
    const pickInRound = getNextPickInRound(round);
    assignPlayer(siblingId, teamId, round, pickInRound, 'sibling-lock');
  }

  // =========================================================================
  // PHASE 2: Run draft rounds
  // =========================================================================

  for (let round = 1; round <= totalRounds && unassignedPlayers.size > 0; round++) {
    // Get draft order for this round
    const roundOrder = calculateRoundOrder();

    // Get players available in this skill tier
    let tierPlayers = getPlayersInSkillTier(round);

    // Track which players were deferred this round
    const deferredThisRound = new Set<string>();

    // Each team picks in order
    for (const teamId of roundOrder) {
      if (unassignedPlayers.size === 0) break;

      const team = teamMap.get(teamId);
      if (!team || !canAcceptPlayer(team)) continue;

      // Check if team needs to fill minimum roster size
      const remainingRounds = totalRounds - round + 1;
      const remainingPicks = remainingRounds; // One pick per remaining round
      const neededForMinimum = Math.max(0, fullConfig.minRosterSize - team.assignedPlayerIds.length);
      const mustPickNow = neededForMinimum >= remainingPicks;

      // Check for mandatory sibling pick
      const mandatorySibling = [...siblingLocks.entries()].find(
        ([playerId, lockedTeamId]) =>
          lockedTeamId === teamId &&
          unassignedPlayers.has(playerId) &&
          (playerMap.get(playerId)?.lockedToRound ?? playerMap.get(playerId)?.projectedRound) === round
      );

      if (mandatorySibling) {
        const [siblingId] = mandatorySibling;
        const pickInRound = getNextPickInRound(round);
        assignPlayer(siblingId, teamId, round, pickInRound, 'sibling-lock');
        lockSiblingsToTeam(siblingId, teamId);
        continue;
      }

      // Get eligible players for this pick
      // Include tier players + any previously deferred players + players below minimum if needed
      let eligiblePlayers = [
        ...tierPlayers.filter(p =>
          unassignedPlayers.has(p.id) &&
          !deferredThisRound.has(p.id) &&
          (!siblingLocks.has(p.id) || siblingLocks.get(p.id) === teamId)
        ),
      ];

      // If no tier players available, look at all available players
      if (eligiblePlayers.length === 0) {
        eligiblePlayers = getAllAvailablePlayers().filter(p =>
          !siblingLocks.has(p.id) || siblingLocks.get(p.id) === teamId
        );
      }

      if (eligiblePlayers.length === 0) {
        // No eligible players, skip this pick
        continue;
      }

      // Score each eligible player by tiebreak score on this team
      const scoredPlayers = eligiblePlayers.map(p => ({
        player: p,
        tiebreakScore: calculateTiebreakScore(p.id, teamId, team),
      }));

      // Sort by tiebreak score (descending), then by totalScore (descending) as final tiebreaker
      scoredPlayers.sort((a, b) => {
        const scoreDiff = b.tiebreakScore - a.tiebreakScore;
        if (Math.abs(scoreDiff) < 0.01) {
          return b.player.totalScore - a.player.totalScore;
        }
        return scoreDiff;
      });

      // Try to pick the best player
      let picked = false;
      for (const { player, tiebreakScore } of scoredPlayers) {
        // Check for deferral (unless we must pick now for minimum)
        if (!mustPickNow && tiebreakScore === 0 && fullConfig.enableDeferral) {
          const { canDefer, bestScore } = canBeHappyElsewhere(player.id, teamId);
          if (canDefer && bestScore !== undefined && bestScore >= fullConfig.deferralThreshold) {
            // Defer this player - they can be happier elsewhere
            deferredThisRound.add(player.id);
            continue;
          }
        }

        // Determine reason
        let reason: AssignmentReason = 'balance';
        if (tiebreakScore >= fullConfig.twoWayTeammateWeight) {
          reason = 'two-way-friend';
        } else if (tiebreakScore >= fullConfig.oneWayTeammateWeight) {
          reason = 'one-way-friend';
        } else if (tiebreakScore >= fullConfig.coachRequestWeight) {
          reason = 'coach-request';
        } else if (tiebreakScore >= fullConfig.schoolSameGradeWeight) {
          reason = 'school-cluster';
        }

        const wasDeferred = deferredThisRound.has(player.id);
        const pickInRound = getNextPickInRound(round);
        if (assignPlayer(player.id, teamId, round, pickInRound, reason, wasDeferred, tiebreakScore)) {
          lockSiblingsToTeam(player.id, teamId);
          picked = true;
          break;
        }
      }

      // If still no pick (all eligible were deferred), pick the best by score
      if (!picked && eligiblePlayers.length > 0) {
        const bestByScore = eligiblePlayers.sort((a, b) => b.totalScore - a.totalScore)[0];
        const tiebreakScore = calculateTiebreakScore(bestByScore.id, teamId, team);
        const pickInRound = getNextPickInRound(round);
        assignPlayer(bestByScore.id, teamId, round, pickInRound, 'balance', true, tiebreakScore);
        lockSiblingsToTeam(bestByScore.id, teamId);
      }
    }
  }

  // =========================================================================
  // PHASE 3: Handle any remaining players
  // =========================================================================

  while (unassignedPlayers.size > 0) {
    const remaining = getAllAvailablePlayers();
    if (remaining.length === 0) break;

    // Sort by score descending
    remaining.sort((a, b) => b.totalScore - a.totalScore);

    for (const player of remaining) {
      if (!unassignedPlayers.has(player.id)) continue;

      // Check for sibling lock
      const lockedTeamId = siblingLocks.get(player.id);
      if (lockedTeamId) {
        const team = teamMap.get(lockedTeamId);
        if (team && canAcceptPlayer(team)) {
          const overflowRound = totalRounds + 1;
          const pickInRound = getNextPickInRound(overflowRound);
          assignPlayer(player.id, lockedTeamId, overflowRound, pickInRound, 'sibling-lock');
          continue;
        }
      }

      // Find team with lowest score that can accept
      const eligibleTeams = workingTeams
        .filter(canAcceptPlayer)
        .sort((a, b) => a.currentScore - b.currentScore);

      if (eligibleTeams.length > 0) {
        // Find best team by tiebreak score
        let bestTeam = eligibleTeams[0];
        let bestTiebreak = calculateTiebreakScore(player.id, eligibleTeams[0].id, eligibleTeams[0]);

        for (const team of eligibleTeams) {
          const tiebreak = calculateTiebreakScore(player.id, team.id, team);
          if (tiebreak > bestTiebreak) {
            bestTiebreak = tiebreak;
            bestTeam = team;
          }
        }

        const overflowRound = totalRounds + 1;
        const pickInRound = getNextPickInRound(overflowRound);
        assignPlayer(player.id, bestTeam.id, overflowRound, pickInRound, 'balance');
        lockSiblingsToTeam(player.id, bestTeam.id);
      } else {
        warnings.push(`Could not place player ${player.name} - all teams full`);
        unassignedPlayers.delete(player.id);
      }
    }
  }

  // =========================================================================
  // PHASE 4: Calculate suggested trades for balance
  // =========================================================================

  const confirmedRequests = resolvedRequests.filter(
    r => r.status === 'auto-confirmed' || r.status === 'user-confirmed'
  );

  const suggestedTrades = findBalancingTrades(
    workingTeams,
    players,
    confirmedRequests,
    assignments,
    {
      ...DEFAULT_REQUESTS_FIRST_CONFIG,
      maxAutoTrades: fullConfig.maxAutoTrades,
    }
  );

  // =========================================================================
  // Calculate results
  // =========================================================================

  // Team summaries
  const teamAverages = workingTeams.map(team => ({
    team,
    averageScore: team.assignedPlayerIds.length > 0
      ? team.currentScore / team.assignedPlayerIds.length
      : 0,
  }));
  const meanAverageScore = teamAverages.length > 0
    ? teamAverages.reduce((sum, t) => sum + t.averageScore, 0) / teamAverages.length
    : 0;

  const teamSummaries: TeamSummary[] = workingTeams.map(team => {
    const rosterCount = team.assignedPlayerIds.length;
    const averageScore = rosterCount > 0 ? team.currentScore / rosterCount : 0;
    return {
      teamId: team.id,
      teamName: team.teamName || team.headCoach,
      coachName: team.headCoach,
      rosterCount,
      totalScore: team.currentScore,
      averageScore,
      meanDelta: averageScore - meanAverageScore,
      meanDeltaPercent: meanAverageScore > 0 ? ((averageScore - meanAverageScore) / meanAverageScore) * 100 : 0,
    };
  });

  // Player happiness - treats coach request same as teammate request for scoring
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
    const team = teamMap.get(teamId)!;
    const requests = playerRequests.get(player.id) || [];

    // Coach request
    const coachRequests = requests.filter(r =>
      r.requestType === 'coach' &&
      (r.status === 'auto-confirmed' || r.status === 'user-confirmed') &&
      r.resolvedTargetId
    );
    const hasCoachRequest = coachRequests.length > 0;
    const coachRequestHonored = hasCoachRequest
      ? coachRequests.some(r => r.resolvedTargetId === teamId)
      : null;

    // Teammate requests
    const teammateRequests = requests.filter(r =>
      r.requestType === 'teammate' &&
      (r.status === 'auto-confirmed' || r.status === 'user-confirmed') &&
      r.resolvedTargetId
    );

    const twoWayTotal = teammateRequests.filter(r => r.isTwoWay).length;
    const oneWayTotal = teammateRequests.filter(r => !r.isTwoWay).length;
    const teammateRequestsTotal = twoWayTotal + oneWayTotal;

    const twoWayHonored = teammateRequests.filter(r =>
      r.isTwoWay && team.assignedPlayerIds.includes(r.resolvedTargetId!)
    ).length;
    const oneWayHonored = teammateRequests.filter(r =>
      !r.isTwoWay && team.assignedPlayerIds.includes(r.resolvedTargetId!)
    ).length;
    const teammateRequestsHonored = twoWayHonored + oneWayHonored;

    // Calculate happiness score
    // Coach request counts the same as a teammate request for happiness
    let score: HappinessScore;
    const totalRequests = teammateRequestsTotal + (hasCoachRequest ? 1 : 0);
    const totalHonored = teammateRequestsHonored + (coachRequestHonored ? 1 : 0);

    // Check for school clustering bonus (partial happiness)
    let hasSchoolBonus = false;
    if (player.school) {
      for (const assignedId of team.assignedPlayerIds) {
        if (assignedId === player.id) continue;
        const teammate = playerMap.get(assignedId);
        if (teammate?.school?.toLowerCase() === player.school.toLowerCase() &&
            teammate.grade && player.grade && teammate.grade === player.grade) {
          hasSchoolBonus = true;
          break;
        }
      }
    }

    if (totalRequests === 0) {
      score = hasSchoolBonus ? 'some' : 'no-requests';
    } else if (totalHonored === totalRequests) {
      score = 'all';
    } else if (totalHonored > 0 || hasSchoolBonus) {
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

  // Average happiness
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
    draftLog,
    suggestedTrades,
  };
}
