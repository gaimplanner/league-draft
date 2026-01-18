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
 * This operation deletes existing players then creates new ones.
 * The backend handles this in separate transactions - true atomicity
 * would require a dedicated endpoint with database transactions.
 *
 * Error handling: If the delete succeeds but create fails, the division
 * will have no players. The caller should handle this by retrying or
 * notifying the user to re-import.
 */
export async function savePlayersToApi(divisionId: string, players: Partial<Player>[]): Promise<Player[]> {
  try {
    // Delete existing players first
    await api.deleteAllPlayers(divisionId);

    // Create new players
    return await api.bulkCreatePlayers(divisionId, players);
  } catch (err) {
    console.error('Failed to save players to API:', err);
    // Re-throw with more context for caller to handle
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
