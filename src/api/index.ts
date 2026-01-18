/**
 * Re-export API client and utility functions
 */

export { api, ApiError } from './client';
export type { } from './client';

import { api } from './client';
import type { Player, Team } from '../types';

/**
 * Save players to the API (bulk create/replace).
 *
 * This operation fetches existing players as backup, deletes them, then creates new ones.
 * If creation fails, attempts to restore the backup to prevent data loss (Issue #2).
 *
 * @throws Error if save fails and restore also fails (data loss scenario)
 */
export async function savePlayersToApi(divisionId: string, players: Partial<Player>[]): Promise<Player[]> {
  // Fetch existing players as backup before delete (Issue #2)
  let backup: Player[] = [];
  try {
    const division = await api.getDivision(divisionId);
    backup = division.players || [];
  } catch {
    // If we can't fetch backup, continue anyway - better to try than fail completely
    console.warn('Could not fetch backup players before save');
  }

  try {
    // Delete existing players first
    await api.deleteAllPlayers(divisionId);

    // Create new players
    return await api.bulkCreatePlayers(divisionId, players);
  } catch (err) {
    console.error('Failed to save players to API:', err);

    // Attempt to restore backup if we have one (Issue #2)
    if (backup.length > 0) {
      console.warn('Attempting to restore backup players...');
      try {
        await api.bulkCreatePlayers(divisionId, backup);
        console.log('Backup restored successfully');
        // Re-throw with context that backup was restored
        throw new Error(`Failed to save players (backup restored): ${err instanceof Error ? err.message : 'Unknown error'}`);
      } catch (restoreErr) {
        console.error('Failed to restore backup:', restoreErr);
        // Critical: both save and restore failed
        throw new Error(`Critical: Failed to save players AND restore backup. Data may be lost. Original error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    // No backup available, just re-throw original error
    throw new Error(`Failed to save players: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

/**
 * Save team configurations to the API.
 */
export async function saveTeamsToApi(_divisionId: string, teams: Team[]): Promise<Team[]> {
  try {
    // Update each team
    const updated: Team[] = [];
    for (const team of teams) {
      const result = await api.updateTeam(team.id, {
        name: team.name,
        draftPosition: team.draftPosition,
        assistantCoaches: team.assistantCoaches,
      });
      updated.push(result);
    }
    return updated;
  } catch (err) {
    console.error('Failed to save teams to API:', err);
    throw new Error(`Failed to save teams: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

/**
 * Check if API mode is enabled.
 * Always returns true - localStorage mode has been removed.
 */
export function isApiMode(): boolean {
  return true;
}
