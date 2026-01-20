import { useState } from 'react';
import { Tag, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { Team } from '../../types';
import { getTeamDisplayName } from '../../utils/teamUtils';

interface TeamNameAssignmentProps {
  teams: Team[];
  onUpdateTeam: (teamId: string, updates: Partial<Team>) => void;
  title?: string;
  description?: string;
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

/**
 * Component for assigning actual team names (e.g., "Guardians", "Yankees") to teams.
 * This is typically done after the draft when teams get their official names.
 *
 * Before assignment: Teams are identified by headCoach name (e.g., "Bonacorsi")
 * After assignment: Teams are identified by teamName (e.g., "Guardians")
 */
export function TeamNameAssignment({
  teams,
  onUpdateTeam,
  title = 'Assign Team Names',
  description = 'Give each team their official name (e.g., "Guardians", "Yankees"). Teams will be identified by these names going forward.',
  collapsible = true,
  defaultExpanded = false,
}: TeamNameAssignmentProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const sortedTeams = [...teams].sort((a, b) => a.draftPosition - b.draftPosition);
  const teamsWithNames = teams.filter(t => t.teamName).length;

  const content = (
    <div className="space-y-4">
      {description && (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {description}
        </p>
      )}

      <div className="grid gap-3">
        {sortedTeams.map((team) => (
          <div
            key={team.id}
            className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
          >
            {/* Current identifier (headCoach) */}
            <div className="w-32 flex-shrink-0">
              <span className="text-xs text-gray-500 dark:text-gray-400 block">
                Manager
              </span>
              <span className="font-medium text-gray-900 dark:text-white">
                {team.headCoach || `Team ${team.draftPosition}`}
              </span>
            </div>

            {/* Arrow */}
            <span className="text-gray-400">→</span>

            {/* Team name input */}
            <div className="flex-1">
              <input
                type="text"
                value={team.teamName || ''}
                onChange={(e) => onUpdateTeam(team.id, { teamName: e.target.value })}
                placeholder="Enter team name (e.g., Guardians)"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Status indicator */}
            {team.teamName && (
              <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
            )}
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-700">
        <span>
          {teamsWithNames} of {teams.length} teams named
        </span>
        {teamsWithNames > 0 && teamsWithNames < teams.length && (
          <span className="text-amber-600 dark:text-amber-400">
            Some teams still need names
          </span>
        )}
        {teamsWithNames === teams.length && (
          <span className="text-green-600 dark:text-green-400">
            All teams named!
          </span>
        )}
      </div>
    </div>
  );

  if (!collapsible) {
    return (
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Tag className="w-5 h-5 text-blue-500" />
          {title}
        </h3>
        {content}
      </div>
    );
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-900/70 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {title}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-500">
            ({teamsWithNames}/{teams.length} named)
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        )}
      </button>

      {isExpanded && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          {content}
        </div>
      )}
    </div>
  );
}

/**
 * Compact team name display/edit for inline use.
 */
export function TeamNameBadge({
  team,
  onUpdateTeam,
  editable = false,
}: {
  team: Team;
  onUpdateTeam?: (teamId: string, updates: Partial<Team>) => void;
  editable?: boolean;
}) {
  const displayName = getTeamDisplayName(team);
  const hasTeamName = !!team.teamName;

  if (!editable) {
    return (
      <span className={`
        inline-flex items-center gap-1 px-2 py-1 rounded text-sm font-medium
        ${hasTeamName
          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
        }
      `}>
        {hasTeamName && <Tag className="w-3 h-3" />}
        {displayName}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={team.teamName || ''}
        onChange={(e) => onUpdateTeam?.(team.id, { teamName: e.target.value })}
        placeholder={team.headCoach || `Team ${team.draftPosition}`}
        className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-1 focus:ring-blue-500"
      />
    </div>
  );
}
