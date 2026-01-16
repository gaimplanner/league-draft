import { Team } from '../types';
import { getTeamDisplayName } from '../utils/teamUtils';

interface CompleteRostersProps {
  teams: Team[];
  isSimulation?: boolean;
}

export const CompleteRosters = ({ teams, isSimulation = false }: CompleteRostersProps) => {
  // Sort teams by total score (descending)
  const sortedTeams = [...teams].sort((a, b) => b.totalScore - a.totalScore);

  return (
    <div>
      {/* Simulation Banner */}
      {isSimulation && (
        <div className="bg-yellow-500/20 border border-yellow-500 text-yellow-700 dark:text-yellow-300 px-4 py-2 rounded-lg mb-4 text-center font-medium">
          ⚠️ SIMULATION - These are projected results only
        </div>
      )}

      {/* Title */}
      <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
        {isSimulation ? 'Projected Rosters' : 'Complete Rosters'}
      </h2>

      {/* Team Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {sortedTeams.map((team) => (
          <div
            key={team.id}
            className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700"
          >
            <div className="mb-4">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                {getTeamDisplayName(team)}
              </h3>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Total: <span className="font-bold">{team.totalScore.toFixed(1)}</span> pts
                {' | '}
                Avg: <span className="font-bold">{team.roster.length > 0 ? (team.totalScore / team.roster.length).toFixed(1) : '0.0'}</span> pts
                {' | '}
                {team.roster.length} players
              </div>
            </div>

            <div className="space-y-2">
              {team.roster
                .sort((a, b) => (a.draftedAtPick || 0) - (b.draftedAtPick || 0))
                .map((player, index) => (
                  <div
                    key={player.id}
                    className="p-2 bg-gray-50 dark:bg-gray-700 rounded text-sm"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 dark:text-white truncate">
                          {index + 1}. {player.name}
                          {player.isAllStar && (
                            <span className="ml-1 text-yellow-500" title="All-Star">⭐</span>
                          )}
                          {player.isCoachKid && (
                            <span className="ml-1 text-blue-600 dark:text-blue-400" title="Coach's Kid">🔵</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          Pick #{player.draftedAtPick} • Round {player.draftedInRound}
                        </div>
                      </div>
                      <div className="ml-2 font-medium text-gray-900 dark:text-white">
                        {player.totalScore.toFixed(1)}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-6 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-6 text-sm text-gray-600 dark:text-gray-400">
          <span className="font-medium text-gray-900 dark:text-white">Legend:</span>
          <span className="flex items-center gap-1">
            <span className="text-yellow-500">⭐</span> All-Star
          </span>
          <span className="flex items-center gap-1">
            <span className="text-blue-600 dark:text-blue-400">🔵</span> Coach's Kid
          </span>
        </div>
      </div>
    </div>
  );
};
