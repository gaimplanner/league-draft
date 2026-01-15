import { Player, Team } from '../types';

export interface CoachKidMatch {
  playerId: string;
  teamId: string;
  playerName: string;
  teamName: string;
  reason: string;
}

export interface SiblingMatch {
  player1Id: string;
  player2Id: string;
  player1Name: string;
  player2Name: string;
  sharedLastName: string;
  reason: string;
}

/**
 * Auto-detect potential coach's kids by matching player last names with team names
 * Uses exact matching (case-insensitive)
 */
export function autoDetectCoachKids(
  players: Player[],
  teams: Team[]
): CoachKidMatch[] {
  const matches: CoachKidMatch[] = [];

  for (const team of teams) {
    // Extract team name and normalize
    const teamName = team.name.trim().toLowerCase();

    // Skip default team names
    if (teamName.startsWith('team ')) continue;

    for (const player of players) {
      const lastName = player.lastName.trim().toLowerCase();

      // Skip if already marked as coach's kid
      if (player.isCoachKid && player.coachTeamId) continue;

      // Skip empty last names
      if (!lastName) continue;

      // Check if matches head coach (team name) - EXACT match only
      if (teamName === lastName) {
        matches.push({
          playerId: player.id,
          teamId: team.id,
          playerName: player.name,
          teamName: team.name,
          reason: `Last name "${player.lastName}" matches team "${team.name}"`,
        });
        continue; // Don't check assistant coaches if already matched head coach
      }

      // Check if matches any assistant coach
      if (team.assistantCoaches && team.assistantCoaches.length > 0) {
        for (const assistantCoach of team.assistantCoaches) {
          const assistantLastName = assistantCoach.trim().toLowerCase();
          if (!assistantLastName) continue;

          // EXACT match only (case-insensitive)
          if (lastName === assistantLastName) {
            matches.push({
              playerId: player.id,
              teamId: team.id,
              playerName: player.name,
              teamName: team.name,
              reason: `Last name "${player.lastName}" matches assistant coach "${assistantCoach}" on team "${team.name}"`,
            });
            break; // Found a match, no need to check other assistant coaches
          }
        }
      }
    }
  }

  return matches;
}

/**
 * Check if a player's last name matches a team name (EXACT match, case-insensitive)
 */
export function isLastNameMatch(playerLastName: string, teamName: string): boolean {
  const lastName = playerLastName.trim().toLowerCase();
  const team = teamName.trim().toLowerCase();

  if (!lastName || !team) return false;
  if (team.startsWith('team ')) return false;

  // EXACT match only
  return team === lastName;
}

/**
 * Auto-detect potential siblings by matching last names
 * Returns pairs of players who share the same last name and aren't already linked
 */
export function autoDetectSiblings(players: Player[]): SiblingMatch[] {
  const matches: SiblingMatch[] = [];
  const processed = new Set<string>();

  // Group players by last name (case-insensitive)
  const lastNameGroups = new Map<string, Player[]>();

  for (const player of players) {
    const lastName = player.lastName.trim().toLowerCase();

    // Skip empty last names or already linked siblings
    if (!lastName || player.siblingId) continue;

    if (!lastNameGroups.has(lastName)) {
      lastNameGroups.set(lastName, []);
    }
    lastNameGroups.get(lastName)!.push(player);
  }

  // Find groups with 2+ players (potential siblings)
  for (const [, playersWithSameName] of lastNameGroups) {
    if (playersWithSameName.length < 2) continue;

    // Create matches for all pairs in this group
    for (let i = 0; i < playersWithSameName.length; i++) {
      for (let j = i + 1; j < playersWithSameName.length; j++) {
        const player1 = playersWithSameName[i];
        const player2 = playersWithSameName[j];

        // Create a unique key for this pair (sorted IDs to avoid duplicates)
        const pairKey = [player1.id, player2.id].sort().join('-');
        if (processed.has(pairKey)) continue;
        processed.add(pairKey);

        matches.push({
          player1Id: player1.id,
          player2Id: player2.id,
          player1Name: player1.name,
          player2Name: player2.name,
          sharedLastName: player1.lastName,
          reason: `Both players share last name "${player1.lastName}"`,
        });
      }
    }
  }

  return matches;
}

/**
 * Check if two players share the same last name
 */
export function haveSameLastName(player1: Player, player2: Player): boolean {
  const lastName1 = player1.lastName.trim().toLowerCase();
  const lastName2 = player2.lastName.trim().toLowerCase();

  if (!lastName1 || !lastName2) return false;
  return lastName1 === lastName2;
}
