import { Team } from '../types';

/**
 * Get display name for a team.
 * Priority: teamName (e.g., "Guardians") > headCoach (e.g., "Bonacorsi") > "Team {position}"
 *
 * During draft setup and execution, teams typically show headCoach name.
 * After draft, teams can be assigned actual teamNames (e.g., "Yankees", "Red Sox").
 */
export const getTeamDisplayName = (team: Team): string => {
  if (team.teamName) return team.teamName;
  if (team.headCoach) return team.headCoach;
  return `Team ${team.draftPosition}`;
};

/**
 * Get the coach display name (manager's last name).
 * Used when you specifically want the coach name, not the team name.
 */
export const getCoachDisplayName = (team: Team): string => {
  if (team.headCoach) return team.headCoach;
  return `Team ${team.draftPosition}`;
};
