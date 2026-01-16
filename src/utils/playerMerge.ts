import { Player } from '../types';

export interface MergeResult {
  merged: Player[];
  newPlayers: Player[];
  updatedCount: number;
  unchangedCount: number;
}

/**
 * Merge imported players with existing players by bib number.
 * - Match by `bib` field (unique ID from evaluation day)
 * - Update scores for matches while preserving coach kid and sibling settings
 * - Create new players for unmatched bib numbers
 */
export function mergePlayersByBib(
  existing: Player[],
  imported: Player[]
): MergeResult {
  const existingByBib = new Map<string, Player>();
  existing.forEach(p => {
    if (p.bib) {
      existingByBib.set(p.bib.toLowerCase(), p);
    }
  });

  const merged: Player[] = [];
  const newPlayers: Player[] = [];
  let updatedCount = 0;
  let unchangedCount = 0;

  // Track which existing players were matched
  const matchedBibs = new Set<string>();

  // Process imported players
  for (const importedPlayer of imported) {
    const bibKey = importedPlayer.bib?.toLowerCase();
    const existingPlayer = bibKey ? existingByBib.get(bibKey) : undefined;

    if (existingPlayer) {
      // Match found - update scores but preserve special flags
      matchedBibs.add(bibKey!);

      // Check if scores actually changed
      const scoresChanged =
        existingPlayer.fieldingSubtotal !== importedPlayer.fieldingSubtotal ||
        existingPlayer.hittingSubtotal !== importedPlayer.hittingSubtotal ||
        existingPlayer.pitchingSubtotal !== importedPlayer.pitchingSubtotal ||
        existingPlayer.catchScore !== importedPlayer.catchScore ||
        existingPlayer.runningScore !== importedPlayer.runningScore ||
        existingPlayer.officialAdjust !== importedPlayer.officialAdjust ||
        existingPlayer.totalScore !== importedPlayer.totalScore;

      if (scoresChanged) {
        updatedCount++;
      } else {
        unchangedCount++;
      }

      merged.push({
        ...importedPlayer,
        // Preserve existing ID so references stay intact
        id: existingPlayer.id,
        // Preserve coach kid settings
        isCoachKid: existingPlayer.isCoachKid,
        coachTeamId: existingPlayer.coachTeamId,
        // Preserve sibling settings
        sibling: existingPlayer.sibling,
        siblingId: existingPlayer.siblingId,
        // Preserve locked assignments
        lockedToRound: existingPlayer.lockedToRound,
        lockedToTeamId: existingPlayer.lockedToTeamId,
        // Preserve draft status (in case of mid-draft re-import)
        isDrafted: existingPlayer.isDrafted,
        draftedByTeamId: existingPlayer.draftedByTeamId,
        draftedInRound: existingPlayer.draftedInRound,
        draftedAtPick: existingPlayer.draftedAtPick,
      });
    } else {
      // No match - this is a new player
      newPlayers.push(importedPlayer);
      merged.push(importedPlayer);
    }
  }

  // Add existing players that weren't in the import (they remain unchanged)
  for (const existingPlayer of existing) {
    const bibKey = existingPlayer.bib?.toLowerCase();
    if (!bibKey || !matchedBibs.has(bibKey)) {
      merged.push(existingPlayer);
      unchangedCount++;
    }
  }

  return {
    merged,
    newPlayers,
    updatedCount,
    unchangedCount,
  };
}

/**
 * Generate a summary message for the merge result
 */
export function getMergeSummary(result: MergeResult): string {
  const parts: string[] = [];

  if (result.updatedCount > 0) {
    parts.push(`${result.updatedCount} player${result.updatedCount !== 1 ? 's' : ''} updated`);
  }

  if (result.newPlayers.length > 0) {
    parts.push(`${result.newPlayers.length} new player${result.newPlayers.length !== 1 ? 's' : ''} added`);
  }

  if (result.unchangedCount > 0) {
    parts.push(`${result.unchangedCount} player${result.unchangedCount !== 1 ? 's' : ''} unchanged`);
  }

  return parts.length > 0 ? parts.join(', ') : 'No changes';
}
