/**
 * Re-export API client and utility functions
 */

export { api, ApiError } from './client';
export type { } from './client';

import { api, ApiError } from './client';
import type { Player, Team } from '../types';

/**
 * Extract error message from ApiError including details
 */
function getErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const details = err.details ? JSON.stringify(err.details) : '';
    return `${err.message}${details ? ` - ${details}` : ''}`;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return 'Unknown error';
}

/**
 * Save players to the API using atomic sync.
 *
 * This uses a database transaction to atomically replace all players.
 * If anything fails, the transaction rolls back and NO data is lost.
 *
 * @throws Error if sync fails (but original data is preserved)
 */
export async function savePlayersToApi(divisionId: string, players: Partial<Player>[]): Promise<Player[]> {
  try {
    // Use atomic sync - if anything fails, nothing changes
    return await api.syncPlayers(divisionId, players);
  } catch (err) {
    console.error('Failed to sync players to API:', err);
    throw new Error(`Failed to save players: ${getErrorMessage(err)}`);
  }
}

/**
 * Save team configurations to the API.
 */
export async function saveTeamsToApi(_divisionId: string, teams: Team[]): Promise<Team[]> {
  try {
    // Update each team
    // Note: Only send teamName and coach fields - draftPosition is not allowed during draft/complete phases
    const updated: Team[] = [];
    for (const team of teams) {
      const result = await api.updateTeam(team.id, {
        teamName: team.teamName,
        headCoach: team.headCoach,
        assistantCoach: team.assistantCoach,
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
