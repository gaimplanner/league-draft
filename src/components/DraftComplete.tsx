import { Download, RotateCcw } from 'lucide-react';
import { DraftState } from '../types';
import { exportToCSV, downloadCSV } from '../utils/csvParser';

interface DraftCompleteProps {
  draftState: DraftState;
  onReset: () => void;
}

export const DraftComplete = ({ draftState, onReset }: DraftCompleteProps) => {
  const handleExport = () => {
    const csvContent = exportToCSV(draftState.teams);
    const timestamp = new Date().toISOString().split('T')[0];
    downloadCSV(csvContent, `draft-results-${timestamp}.csv`);
  };

  // Sort teams by total score (descending)
  const sortedTeams = [...draftState.teams].sort((a, b) => b.totalScore - a.totalScore);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-500 to-blue-500 rounded-lg p-6 sm:p-8 mb-6 text-white">
          <div className="text-center">
            <h1 className="text-3xl sm:text-4xl font-bold mb-2">Draft Complete!</h1>
            <p className="text-lg opacity-90">
              All {draftState.players.length} players have been drafted
            </p>
          </div>

          <div className="flex justify-center gap-3 mt-6">
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-white text-blue-600 hover:bg-gray-100 rounded-lg font-medium flex items-center gap-2"
            >
              <Download className="w-5 h-5" />
              Export to CSV
            </button>
            <button
              onClick={onReset}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg font-medium flex items-center gap-2"
            >
              <RotateCcw className="w-5 h-5" />
              Start New Draft
            </button>
          </div>
        </div>

        {/* Team Rankings */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 mb-6">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
            Team Rankings by Total Score
          </h2>
          <div className="space-y-2">
            {sortedTeams.map((team, index) => (
              <div
                key={team.id}
                className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <div className="text-2xl font-bold text-gray-400 dark:text-gray-500 w-8">
                  #{index + 1}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-lg text-gray-900 dark:text-white">
                    {team.name}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {team.roster.length} players
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {team.totalScore.toFixed(1)}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Total Score</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Full Rosters */}
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
          Complete Rosters
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {sortedTeams.map((team) => (
            <div
              key={team.id}
              className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700"
            >
              <div className="mb-4">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {team.name}
                </h3>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Total Score: <span className="font-bold">{team.totalScore.toFixed(1)}</span>
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
                            {player.isCoachKid && (
                              <span className="ml-1 text-blue-600 dark:text-blue-400">★</span>
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
      </div>
    </div>
  );
};
