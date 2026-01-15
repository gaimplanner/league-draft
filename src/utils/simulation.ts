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
  console.log('=== SIMULATION START ===');
  console.log('Options:', options);
  console.log('Draft format:', draftFormat);
  console.log('Initial draft order:', draftOrder.map(id => teams.find(t => t.id === id)?.name));

  // Deep clone to avoid mutating real state
  const simPlayers: Player[] = JSON.parse(JSON.stringify(players));
  const simTeams: Team[] = JSON.parse(JSON.stringify(teams));

  // Debug: verify coach kids data
  console.log('=== Coach Kids Verification ===');
  simPlayers.filter(p => p.isCoachKid).forEach(p => {
    const team = simTeams.find(t => t.id === p.coachTeamId);
    const effectiveRound = p.lockedToRound ?? p.projectedRound;
    console.log(`${p.firstName} ${p.lastName}: coachTeamId=${p.coachTeamId}, teamName=${team?.name ?? 'NOT FOUND'}, effectiveRound=${effectiveRound}`);
  });

  // Debug: verify sibling data
  console.log('=== Sibling Verification ===');
  simPlayers.filter(p => p.siblingId).forEach(p => {
    const sibling = simPlayers.find(s => s.id === p.siblingId);
    console.log(`${p.firstName} ${p.lastName}: siblingId=${p.siblingId}, siblingName=${sibling?.firstName} ${sibling?.lastName}, lockedToTeamId=${p.lockedToTeamId}`);
  });

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

  for (let round = 1; round <= totalRounds; round++) {
    // USE THE SAME calculateDraftOrder function as real draft
    const roundOrder = calculateDraftOrder(simTeams, round, draftFormat, draftOrder);

    console.log(`\n=== ROUND ${round} ===`);
    console.log('Draft order:', roundOrder.map(id => simTeams.find(t => t.id === id)?.name));

    for (const teamId of roundOrder) {
      const team = simTeams.find(t => t.id === teamId);
      if (!team) continue;

      // Check if all players are drafted
      const availablePlayers = simPlayers.filter(p => !p.isDrafted);
      if (availablePlayers.length === 0) break;

      let playerToDraft: Player | null = null;
      let pickReason = 'best-available';

      // USE THE SAME getMandatoryPick function as real draft
      const mandatoryResult = getMandatoryPick(simPlayers, teamId, round, options);

      if (mandatoryResult) {
        playerToDraft = mandatoryResult.player;
        pickReason = mandatoryResult.reason;
        console.log(`Team ${team.name}: MANDATORY ${pickReason} - ${playerToDraft.firstName} ${playerToDraft.lastName}`);
      } else {
        // USE THE SAME getBestAvailable function - pass teamId and options to respect checkbox settings
        playerToDraft = getBestAvailable(simPlayers, teamId, options);
        if (playerToDraft) {
          console.log(`Team ${team.name}: Best available - ${playerToDraft.firstName} ${playerToDraft.lastName} (score: ${playerToDraft.totalScore})`);
        }
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

        // Lock siblings to this team (same as real draft)
        if (options.includeSiblings) {
          lockSiblingToTeam(simPlayers, playerToDraft, team.id);
        }
      }
    }
  }

  console.log('\n=== SIMULATION COMPLETE ===');
  simTeams.forEach(team => {
    console.log(`${team.name}: ${team.totalScore.toFixed(1)} pts`);
    team.roster.forEach(p => {
      const tag = p.isCoachKid ? ' [COACH KID]' : p.siblingId ? ' [SIBLING]' : '';
      console.log(`  R${p.draftedInRound}: ${p.firstName} ${p.lastName}${tag}`);
    });
  });

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
