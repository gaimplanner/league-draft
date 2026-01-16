import { Team } from '../types';

/**
 * Get display name for a team (fallback when name is empty)
 */
export const getTeamDisplayName = (team: Team): string =>
  team.name || `Team ${team.draftPosition}`;
