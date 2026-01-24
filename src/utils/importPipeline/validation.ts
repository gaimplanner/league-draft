/**
 * Player Import Validation
 *
 * Pre-flight validation before API calls to catch data issues early.
 * Uses PLAYER_FIELD_DEFINITIONS as the source of truth for validation rules.
 */

import type { Player } from '../../types';
import { getScoreFields } from './fieldDefinitions';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface ValidationError {
  playerId?: string;
  playerName?: string;
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

// -----------------------------------------------------------------------------
// Validation Rules
// -----------------------------------------------------------------------------

/**
 * Validate a single player
 */
export function validatePlayer(player: Partial<Player>): ValidationError[] {
  const errors: ValidationError[] = [];
  const playerInfo = {
    playerId: player.id,
    playerName: player.name || `${player.firstName || ''} ${player.lastName || ''}`.trim() || 'Unknown',
  };

  // Check required fields
  if (!player.firstName?.trim()) {
    errors.push({
      ...playerInfo,
      field: 'firstName',
      message: 'First name is required',
      severity: 'error',
    });
  }

  if (!player.lastName?.trim()) {
    errors.push({
      ...playerInfo,
      field: 'lastName',
      message: 'Last name is required',
      severity: 'error',
    });
  }

  if (!player.bib?.trim()) {
    errors.push({
      ...playerInfo,
      field: 'bib',
      message: 'BIB number is required',
      severity: 'error',
    });
  }

  // Validate age
  if (player.littleLeagueAge === undefined || player.littleLeagueAge === null) {
    errors.push({
      ...playerInfo,
      field: 'littleLeagueAge',
      message: 'Little League age is required',
      severity: 'error',
    });
  } else if (player.littleLeagueAge < 4 || player.littleLeagueAge > 18) {
    errors.push({
      ...playerInfo,
      field: 'littleLeagueAge',
      message: `Invalid age: ${player.littleLeagueAge}. Expected 4-18.`,
      severity: 'error',
    });
  }

  // Validate birthday
  if (!player.birthday?.trim()) {
    errors.push({
      ...playerInfo,
      field: 'birthday',
      message: 'Birthday is required',
      severity: 'error',
    });
  }

  // Validate score fields (warnings for out-of-range)
  const scoreFields = getScoreFields();
  for (const fieldDef of scoreFields) {
    const value = (player as Record<string, unknown>)[fieldDef.frontend] as number | undefined;
    if (value !== undefined && value !== null) {
      if (value < 0) {
        errors.push({
          ...playerInfo,
          field: fieldDef.frontend,
          message: `${fieldDef.frontend} cannot be negative: ${value}`,
          severity: 'warning',
        });
      }
      // Total score typically shouldn't exceed 100, but this may vary
      if (fieldDef.frontend === 'totalScore' && value > 200) {
        errors.push({
          ...playerInfo,
          field: fieldDef.frontend,
          message: `Total score unusually high: ${value}. Please verify.`,
          severity: 'warning',
        });
      }
    }
  }

  // Validate coach kid setup
  if (player.isCoachKid && !player.coachTeamId) {
    errors.push({
      ...playerInfo,
      field: 'coachTeamId',
      message: 'Coach kid must have an assigned coach team',
      severity: 'error',
    });
  }

  // Validate sibling setup
  if (player.siblingId && !player.sibling) {
    errors.push({
      ...playerInfo,
      field: 'sibling',
      message: 'Sibling name should be set when siblingId is present',
      severity: 'warning',
    });
  }

  // Validate projected round
  if (player.projectedRound !== undefined && player.projectedRound < 1) {
    errors.push({
      ...playerInfo,
      field: 'projectedRound',
      message: `Invalid projected round: ${player.projectedRound}. Must be >= 1.`,
      severity: 'error',
    });
  }

  // Validate rank
  if (player.rank !== undefined && player.rank < 0) {
    errors.push({
      ...playerInfo,
      field: 'rank',
      message: `Invalid rank: ${player.rank}. Must be >= 0.`,
      severity: 'error',
    });
  }

  return errors;
}

/**
 * Validate an array of players before saving to API
 */
export function validatePlayersBeforeSave(players: Partial<Player>[]): ValidationResult {
  const allErrors: ValidationError[] = [];
  const allWarnings: ValidationError[] = [];

  // Validate each player
  for (const player of players) {
    const playerErrors = validatePlayer(player);
    for (const error of playerErrors) {
      if (error.severity === 'error') {
        allErrors.push(error);
      } else {
        allWarnings.push(error);
      }
    }
  }

  // Check for duplicate BIBs
  const bibCounts = new Map<string, string[]>();
  for (const player of players) {
    if (player.bib) {
      const names = bibCounts.get(player.bib) || [];
      names.push(player.name || `${player.firstName} ${player.lastName}`);
      bibCounts.set(player.bib, names);
    }
  }

  for (const [bib, names] of bibCounts) {
    if (names.length > 1) {
      allErrors.push({
        field: 'bib',
        message: `Duplicate BIB "${bib}" found for players: ${names.join(', ')}`,
        severity: 'error',
      });
    }
  }

  // Check for circular sibling references
  const siblingMap = new Map<string, string>();
  for (const player of players) {
    if (player.id && player.siblingId) {
      siblingMap.set(player.id, player.siblingId);
    }
  }

  for (const player of players) {
    if (player.id && player.siblingId) {
      // Check if sibling points back (expected)
      const siblingsSibling = siblingMap.get(player.siblingId);
      if (siblingsSibling && siblingsSibling !== player.id) {
        // Sibling chain - could be 3+ siblings, this is OK
        // But warn if it creates a loop that doesn't include this player
        const visited = new Set<string>([player.id]);
        let current = player.siblingId;
        let loopDetected = false;

        while (current && !visited.has(current)) {
          visited.add(current);
          const next = siblingMap.get(current);
          if (next && visited.has(next) && next !== player.id) {
            loopDetected = true;
            break;
          }
          current = next || '';
        }

        if (loopDetected) {
          allWarnings.push({
            playerId: player.id,
            playerName: player.name,
            field: 'siblingId',
            message: 'Complex sibling chain detected. Please verify sibling links.',
            severity: 'warning',
          });
        }
      }
    }
  }

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
  };
}

/**
 * Format validation result for display
 */
export function formatValidationResult(result: ValidationResult): string {
  const lines: string[] = [];

  if (result.valid) {
    lines.push('✓ Validation passed');
  } else {
    lines.push(`✗ Validation failed with ${result.errors.length} error(s)`);
  }

  if (result.warnings.length > 0) {
    lines.push(`⚠ ${result.warnings.length} warning(s)`);
  }

  if (result.errors.length > 0) {
    lines.push('\nErrors:');
    for (const error of result.errors) {
      const player = error.playerName ? ` (${error.playerName})` : '';
      lines.push(`  • ${error.field}${player}: ${error.message}`);
    }
  }

  if (result.warnings.length > 0) {
    lines.push('\nWarnings:');
    for (const warning of result.warnings) {
      const player = warning.playerName ? ` (${warning.playerName})` : '';
      lines.push(`  • ${warning.field}${player}: ${warning.message}`);
    }
  }

  return lines.join('\n');
}
