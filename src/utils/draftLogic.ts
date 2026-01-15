import { Player } from '../types';

export interface MandatoryPickResult {
  player: Player;
  reason: 'coach-kid' | 'sibling';
  siblingName?: string;
}

/**
 * Get mandatory pick for a team in a given round.
 * This is the SINGLE SOURCE OF TRUTH for mandatory pick logic.
 * Used by both the real draft (useDraft.ts) and simulation (simulation.ts).
 */
export function getMandatoryPick(
  players: Player[],
  teamId: string,
  round: number,
  options: { includeCoachKids: boolean; includeSiblings: boolean } = { includeCoachKids: true, includeSiblings: true }
): MandatoryPickResult | null {
  // Check for coach's kids that must be drafted this round
  if (options.includeCoachKids) {
    const coachKidToDraft = players.find(
      (p) =>
        !p.isDrafted &&
        p.isCoachKid &&
        p.coachTeamId === teamId &&
        (p.lockedToRound ?? p.projectedRound) === round
    );

    if (coachKidToDraft) {
      return {
        player: coachKidToDraft,
        reason: 'coach-kid',
      };
    }
  }

  // Check for sibling requirements
  if (options.includeSiblings) {
    const siblingToDraft = players.find((p) => {
      if (p.isDrafted || !p.siblingId) return false;

      // If locked to this team, must draft in their lockedToRound or projectedRound
      if (p.lockedToTeamId === teamId) {
        const requiredRound = p.lockedToRound ?? p.projectedRound;
        return requiredRound === round;
      }

      // Legacy check: sibling by name match in effective round
      if (p.sibling && (p.lockedToRound ?? p.projectedRound) === round) {
        const sibling = players.find(
          (other) =>
            other.name.toLowerCase() === p.sibling!.toLowerCase() &&
            other.draftedByTeamId === teamId
        );
        return !!sibling;
      }

      return false;
    });

    if (siblingToDraft) {
      const siblingPlayer = players.find(p => p.id === siblingToDraft.siblingId);
      return {
        player: siblingToDraft,
        reason: 'sibling',
        siblingName: siblingPlayer?.name || siblingToDraft.sibling,
      };
    }
  }

  return null;
}

/**
 * Lock a sibling to follow the drafted player to their team.
 * Call this after drafting a player who has siblings.
 * Handles both directions of the sibling link.
 */
export function lockSiblingToTeam(
  players: Player[],
  draftedPlayer: Player,
  teamId: string
): void {
  // Check drafted player's siblingId (forward direction)
  if (draftedPlayer.siblingId) {
    const sibling = players.find(p => p.id === draftedPlayer.siblingId);
    if (sibling && !sibling.isDrafted) {
      sibling.lockedToTeamId = teamId;
    }
  }

  // Also check for any players whose siblingId points to the drafted player (reverse direction)
  players.forEach(p => {
    if (p.siblingId === draftedPlayer.id && !p.isDrafted) {
      p.lockedToTeamId = teamId;
    }
  });
}

/**
 * Get the best available player for a team (highest score, not drafted, not restricted).
 * Excludes:
 * - Coach's kids assigned to OTHER teams
 * - Siblings locked to OTHER teams
 */
export function getBestAvailable(
  players: Player[],
  currentTeamId?: string
): Player | null {
  return players
    .filter(p => {
      if (p.isDrafted) return false;

      // Exclude coach's kids assigned to OTHER teams
      if (p.isCoachKid && p.coachTeamId && p.coachTeamId !== currentTeamId) {
        return false;
      }

      // Exclude siblings locked to OTHER teams
      if (p.lockedToTeamId && p.lockedToTeamId !== currentTeamId) {
        return false;
      }

      return true;
    })
    .sort((a, b) => b.totalScore - a.totalScore)[0] || null;
}
