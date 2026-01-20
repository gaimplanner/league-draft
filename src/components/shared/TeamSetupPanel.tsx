import { Users, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { Team } from '../../types';

interface TeamSetupPanelProps {
  teams: Team[];
  onUpdateTeam: (teamId: string, updates: Partial<Team>) => void;
  title?: string;
  description?: string;
  showTeamName?: boolean; // Whether to show the actual team name field (e.g., "Guardians")
  collapsible?: boolean;
  defaultExpanded?: boolean;
  compact?: boolean; // Use more compact layout
}

/**
 * Shared component for configuring team coaches.
 * Used by both Live Draft and Team Builder flows.
 *
 * Team naming convention:
 * - teamName: The actual team name (e.g., "Guardians", "Yankees") - optional, assigned after draft
 * - headCoach: Manager's last name (e.g., "Bonacorsi") - primary identifier during draft
 * - assistantCoach: Assistant's last name
 */
export function TeamSetupPanel({
  teams,
  onUpdateTeam,
  title = 'Team Coaches',
  description = 'Enter the head coach (manager) last name for each team. This will be used to identify teams during the draft.',
  showTeamName = false,
  collapsible = true,
  defaultExpanded = false,
  compact = false,
}: TeamSetupPanelProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const sortedTeams = [...teams].sort((a, b) => a.draftPosition - b.draftPosition);

  const content = (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {!compact && description && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          {description}
        </p>
      )}
      <div className={compact ? 'grid gap-2' : 'grid gap-3'}>
        {sortedTeams.map((team, index) => (
          <div
            key={team.id}
            className={`flex items-center gap-3 ${compact ? '' : 'p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg'}`}
          >
            {/* Team number badge */}
            <span className={`
              flex items-center justify-center font-bold text-white
              ${compact ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm'}
              rounded-full bg-gray-400 dark:bg-gray-600
            `}>
              {index + 1}
            </span>

            {/* Team name field (optional - for actual team names like "Guardians") */}
            {showTeamName && (
              <input
                type="text"
                value={team.teamName || ''}
                onChange={(e) => onUpdateTeam(team.id, { teamName: e.target.value })}
                placeholder="Team name (e.g., Guardians)"
                className={`
                  flex-1 border border-gray-300 dark:border-gray-600 rounded-lg
                  bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400
                  focus:ring-2 focus:ring-blue-500 focus:border-transparent
                  ${compact ? 'px-2 py-1 text-sm' : 'px-3 py-2 text-sm'}
                `}
              />
            )}

            {/* Head Coach field */}
            <div className="flex-1">
              <input
                type="text"
                value={team.headCoach || ''}
                onChange={(e) => onUpdateTeam(team.id, { headCoach: e.target.value })}
                placeholder="Manager (last name)"
                className={`
                  w-full border border-gray-300 dark:border-gray-600 rounded-lg
                  bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400
                  focus:ring-2 focus:ring-blue-500 focus:border-transparent
                  ${compact ? 'px-2 py-1 text-sm' : 'px-3 py-2 text-sm'}
                `}
              />
            </div>

            {/* Assistant Coach field */}
            <div className="flex-1">
              <input
                type="text"
                value={team.assistantCoach || ''}
                onChange={(e) => onUpdateTeam(team.id, { assistantCoach: e.target.value })}
                placeholder="Assistant (last name)"
                className={`
                  w-full border border-gray-300 dark:border-gray-600 rounded-lg
                  bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400
                  focus:ring-2 focus:ring-blue-500 focus:border-transparent
                  ${compact ? 'px-2 py-1 text-sm' : 'px-3 py-2 text-sm'}
                `}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (!collapsible) {
    return (
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <Users className="w-5 h-5 text-gray-500" />
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
          <Users className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {title}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-500">
            ({teams.filter(t => t.headCoach).length}/{teams.length} configured)
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
 * Compact inline team setup for use in forms.
 * Shows teams in a grid layout.
 */
export function TeamSetupGrid({
  teams,
  onUpdateTeam,
  showTeamName = false,
  columns = 2,
}: {
  teams: Team[];
  onUpdateTeam: (teamId: string, updates: Partial<Team>) => void;
  showTeamName?: boolean;
  columns?: 1 | 2 | 3 | 4;
}) {
  const sortedTeams = [...teams].sort((a, b) => a.draftPosition - b.draftPosition);

  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <div className={`grid ${gridCols[columns]} gap-4`}>
      {sortedTeams.map((team, index) => (
        <div key={team.id} className="space-y-2">
          {/* Team Name (actual name like "Guardians") */}
          {showTeamName && (
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                Team {index + 1} Name
              </label>
              <input
                type="text"
                value={team.teamName || ''}
                onChange={(e) => onUpdateTeam(team.id, { teamName: e.target.value })}
                placeholder="e.g., Guardians"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
              />
            </div>
          )}

          {/* Head Coach */}
          <div>
            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
              {showTeamName ? 'Manager' : `Team ${index + 1} - Manager`}
            </label>
            <input
              type="text"
              value={team.headCoach || ''}
              onChange={(e) => onUpdateTeam(team.id, { headCoach: e.target.value })}
              placeholder="Last name only (e.g., Smith)"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
            />
          </div>

          {/* Assistant Coach */}
          <div>
            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
              Assistant Coach
            </label>
            <input
              type="text"
              value={team.assistantCoach || ''}
              onChange={(e) => onUpdateTeam(team.id, { assistantCoach: e.target.value })}
              placeholder="Last name only"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
            />
          </div>
        </div>
      ))}
    </div>
  );
}
