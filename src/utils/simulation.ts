import { Player, Team, DraftFormat } from '../types';
import { calculateDraftOrder } from './draftOrder';
import { getMandatoryPick, lockSiblingToTeam, getBestAvailable } from './draftLogic';

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
 * Run a draft simulation without affecting real data.
 * Uses the SAME logic as the real draft (getMandatoryPick, calculateDraftOrder).
 */
export function runSimulation(
  players: Player[],
  teams: Team[],
  draftOrder: string[],
  draftFormat: DraftFormat,
  options: SimulationOptions
): SimulationResult {
  // Deep clone to avoid mutating real state
  const simPlayers: Player[] = structuredClone(players);
  const simTeams: Team[] = structuredClone(teams);

  // Reset all draft state on cloned data
  simPlayers.forEach(p => {
    p.isDrafted = false;
    p.draftedByTeamId = undefined;
    p.draftedInRound = undefined;
    p.draftedAtPick = undefined;
    // Note: Don't reset lockedToTeamId - it may have been set for siblings of coach's kids
  });

  simTeams.forEach(t => {
    t.roster = [];
    t.totalScore = 0;
    t.ageBreakdown = {};
  });

  const totalRounds = Math.ceil(simPlayers.length / simTeams.length);
  let overallPick = 0;

  // Track picks made by each team
  const teamPicksMade: Record<string, number> = {};
  simTeams.forEach(t => { teamPicksMade[t.id] = 0; });

  for (let round = 1; round <= totalRounds; round++) {
    // USE THE SAME calculateDraftOrder function as real draft
    const roundOrder = calculateDraftOrder(simTeams, round, draftFormat, draftOrder);

    for (const teamId of roundOrder) {
      const team = simTeams.find(t => t.id === teamId);
      if (!team) continue;

      // Check if all players are drafted
      const availablePlayers = simPlayers.filter(p => !p.isDrafted);
      if (availablePlayers.length === 0) break;

      let playerToDraft: Player | null = null;

      // USE THE SAME getMandatoryPick function as real draft
      // Pass totalRounds and teamPicksMade to enable "not enough picks" logic
      const mandatoryResult = getMandatoryPick(simPlayers, teamId, round, {
        ...options,
        totalRounds,
        teamPicksMade: teamPicksMade[teamId],
      });

      if (mandatoryResult) {
        playerToDraft = mandatoryResult.player;
      } else {
        // USE THE SAME getBestAvailable function - pass teamId and options to respect checkbox settings
        playerToDraft = getBestAvailable(simPlayers, teamId, options);
      }

      if (playerToDraft) {
        overallPick++;
        teamPicksMade[teamId]++;

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

        // Lock siblings to this team (same as real draft)
        if (options.includeSiblings) {
          lockSiblingToTeam(simPlayers, playerToDraft, team.id);
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
