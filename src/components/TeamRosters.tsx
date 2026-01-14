import { Team } from '../types';

interface TeamRostersProps {
  teams: Team[];
  currentTeamId: string | null;
}

export const TeamRosters = ({ teams, currentTeamId }: TeamRostersProps) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {teams.map((team) => (
        <div
          key={team.id}
          className={`
            rounded-lg p-4 border-2 transition-all
            ${
              team.id === currentTeamId
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
            }
          `}
        >
          <div className="flex justify-between items-start mb-3">
            <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
              {team.name}
            </h3>
            {team.id === currentTeamId && (
              <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded">
                Picking
              </span>
            )}
          </div>

          <div className="mb-3">
            <div className="text-sm text-gray-600 dark:text-gray-400">Total Score</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {team.totalScore.toFixed(1)}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
              Roster ({team.roster.length})
            </div>
            {team.roster.length === 0 ? (
              <div className="text-sm text-gray-500 dark:text-gray-500 italic">
                No players yet
              </div>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {team.roster.map((player) => (
                  <div
                    key={player.id}
                    className="text-sm p-2 bg-gray-50 dark:bg-gray-700 rounded flex justify-between items-center"
                  >
                    <span className="text-gray-900 dark:text-white truncate">
                      {player.name}
                      {player.isCoachKid && (
                        <span className="ml-1 text-xs text-blue-600 dark:text-blue-400">★</span>
                      )}
                    </span>
                    <span className="text-gray-600 dark:text-gray-400 text-xs ml-2">
                      {player.totalScore.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
