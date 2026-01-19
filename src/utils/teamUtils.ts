import { Team } from '../types';

/**
 * Get display name for a team.
 * Priority: name > headCoach > "Team {position}"
 */
export const getTeamDisplayName = (team: Team): string => {
  if (team.name) return team.name;
  if (team.headCoach) return team.headCoach;
  return `Team ${team.draftPosition}`;
};
