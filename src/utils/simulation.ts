import { Player, Team, DraftFormat } from '../types';
import { calculateDraftOrder } from './draftOrder';

export interface SimulationOptions {
  includeCoachKids: boolean;
  includeSiblings: boolean;
}

export interface SimulationResult {
  teams: Team[];
  players: Player[];
  timestamp: Date;
  options: SimulationOptions;
}

/**
 * Get mandatory coach's kid for a team in a given round
 */
function getMandatoryCoachKid(
  players: Player[],
  teamId: string,
  round: number
): Player | null {
  return players.find(
    (p) =>
      !p.isDrafted &&
      p.isCoachKid &&
      p.coachTeamId === teamId &&
      (p.lockedToRound ?? p.projectedRound) === round
  ) || null;
}

/**
 * Get mandatory sibling for a team in a given round
 */
function getMandatorySibling(
  players: Player[],
  teamId: string,
  round: number
): Player | null {
  return players.find((p) => {
    if (p.isDrafted || !p.siblingId) return false;

    // If locked to this team, must draft in their locked/projected round
    if (p.lockedToTeamId === teamId) {
      const requiredRound = p.lockedToRound ?? p.projectedRound;
      return requiredRound === round;
    }

    return false;
  }) || null;
}

/**
 * Run a draft simulation without affecting real data
 */
export function runSimulation(
  players: Player[],
  teams: Team[],
  draftOrder: string[],
  draftFormat: DraftFormat,
  options: SimulationOptions
): SimulationResult {
  // Deep clone to avoid mutating real state
  const simPlayers: Player[] = JSON.parse(JSON.stringify(players));
  const simTeams: Team[] = JSON.parse(JSON.stringify(teams));

  // Reset all draft state on cloned data
  simPlayers.forEach(p => {
    p.isDrafted = false;
    p.draftedByTeamId = undefined;
    p.draftedInRound = undefined;
    p.draftedAtPick = undefined;
  });

  simTeams.forEach(t => {
    t.roster = [];
    t.totalScore = 0;
    t.ageBreakdown = {};
  });

  const totalRounds = Math.ceil(simPlayers.length / simTeams.length);
  let overallPick = 0;

  for (let round = 1; round <= totalRounds; round++) {
    // Calculate draft order for this round
    const roundOrder = calculateDraftOrder(simTeams, round, draftFormat, draftOrder);

    for (const teamId of roundOrder) {
      const team = simTeams.find(t => t.id === teamId);
      if (!team) continue;

      // Check if all players are drafted
      const availablePlayers = simPlayers.filter(p => !p.isDrafted);
      if (availablePlayers.length === 0) break;

      let playerToDraft: Player | null = null;

      // Check for mandatory coach's kid
      if (options.includeCoachKids) {
        playerToDraft = getMandatoryCoachKid(simPlayers, teamId, round);
      }

      // Check for mandatory sibling
      if (!playerToDraft && options.includeSiblings) {
        playerToDraft = getMandatorySibling(simPlayers, teamId, round);
      }

      // Otherwise, pick best available
      if (!playerToDraft) {
        playerToDraft = availablePlayers
          .sort((a, b) => b.totalScore - a.totalScore)[0] || null;
      }

      if (playerToDraft) {
        overallPick++;

        // Execute simulated draft
        playerToDraft.isDrafted = true;
        playerToDraft.draftedByTeamId = team.id;
        playerToDraft.draftedInRound = round;
        playerToDraft.draftedAtPick = overallPick;

        // Update team roster and score
        team.roster.push(playerToDraft);
        team.totalScore += playerToDraft.totalScore;

        // Update age breakdown
        const age = playerToDraft.littleLeagueAge;
        team.ageBreakdown[age] = (team.ageBreakdown[age] || 0) + 1;

        // If this player has a sibling, lock them to this team
        if (options.includeSiblings && playerToDraft.siblingId) {
          const sibling = simPlayers.find(p => p.id === playerToDraft!.siblingId);
          if (sibling && !sibling.isDrafted) {
            sibling.lockedToTeamId = team.id;
          }
        }
      }
    }
  }

  return {
    teams: simTeams,
    players: simPlayers,
    timestamp: new Date(),
    options,
  };
}

/**
 * Calculate simulation statistics
 */
export function getSimulationStats(result: SimulationResult) {
  const teamScores = result.teams.map(t => t.totalScore);
  const highest = Math.max(...teamScores);
  const lowest = Math.min(...teamScores);
  const spread = highest - lowest;
  const average = teamScores.reduce((a, b) => a + b, 0) / teamScores.length;

  return {
    highest,
    lowest,
    spread,
    average,
  };
}
