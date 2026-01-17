/**
 * Re-export API client and utility functions
 */

export { api, ApiError } from './client';
export type { } from './client';

import { api } from './client';
import type { Player, Team } from '../types';

// Feature flag to use API vs localStorage
const USE_API = import.meta.env.VITE_USE_API === 'true';

/**
 * Save players to the API (bulk create/replace)
 * In localStorage mode, this is a no-op (players are saved via updateActiveDivision)
 */
export async function savePlayersToApi(divisionId: string, players: Partial<Player>[]): Promise<Player[]> {
  if (!USE_API) {
    return players as Player[];
  }

  try {
    // Delete existing players first
    await api.deleteAllPlayers(divisionId);

    // Create new players
    return await api.bulkCreatePlayers(divisionId, players);
  } catch (err) {
    console.error('Failed to save players to API:', err);
    throw err;
  }
}

/**
 * Save team configurations to the API
 * In localStorage mode, this is a no-op (teams are saved via updateActiveDivision)
 */
export async function saveTeamsToApi(_divisionId: string, teams: Team[]): Promise<Team[]> {
  if (!USE_API) {
    return teams;
  }

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
    throw err;
  }
}

/**
 * Check if API mode is enabled
 */
export function isApiMode(): boolean {
  return USE_API;
}
