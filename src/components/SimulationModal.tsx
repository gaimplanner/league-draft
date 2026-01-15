import { useState, useMemo } from 'react';
import { X, Play, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { Player, Team, DraftFormat } from '../types';
import {
  SimulationOptions,
  SimulationResult,
  runSimulation,
  getSimulationStats,
} from '../utils/simulation';

interface SimulationModalProps {
  players: Player[];
  teams: Team[];
  draftOrder: string[];
  draftFormat: DraftFormat;
  onClose: () => void;
}

// Helper to get display name for a team
const getTeamDisplayName = (team: Team) => team.name || `Team ${team.draftPosition}`;

type ModalPhase = 'options' | 'results';

export const SimulationModal = ({
  players,
  teams,
  draftOrder,
  draftFormat,
  onClose,
}: SimulationModalProps) => {
  const [phase, setPhase] = useState<ModalPhase>('options');
  const [options, setOptions] = useState<SimulationOptions>({
    includeCoachKids: true,
    includeSiblings: true,
  });
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);

  const handleRunSimulation = () => {
    const simResult = runSimulation(players, teams, draftOrder, draftFormat, options);
    setResult(simResult);
    setPhase('results');
  };

  const handleRunAgain = () => {
    const simResult = runSimulation(players, teams, draftOrder, draftFormat, options);
    setResult(simResult);
  };

  const handleBackToOptions = () => {
    setPhase('options');
    setExpandedTeamId(null);
  };

  // Sort teams by total score for display
  const sortedTeams = useMemo(() => {
    if (!result) return [];
    return [...result.teams].sort((a, b) => b.totalScore - a.totalScore);
  }, [result]);

  const stats = useMemo(() => {
    if (!result) return null;
    return getSimulationStats(result);
  }, [result]);

  // Calculate max score for bar width
  const maxScore = useMemo(() => {
    if (!result) return 100;
    return Math.max(...result.teams.map(t => t.totalScore));
  }, [result]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔮</span>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {phase === 'options' ? 'Draft Simulation Options' : 'Simulation Results'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {phase === 'options' ? (
            /* Options Phase */
            <div className="space-y-6">
              <p className="text-gray-600 dark:text-gray-400">
                Run a mock draft to preview projected team compositions. This does not affect the real draft.
              </p>

              <div className="space-y-4">
                <label className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600">
                  <input
                    type="checkbox"
                    checked={options.includeCoachKids}
                    onChange={(e) => setOptions(prev => ({ ...prev, includeCoachKids: e.target.checked }))}
                    className="mt-1 w-5 h-5 accent-blue-600"
                  />
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      Include coach's kids
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Coach's kids will be drafted by their assigned teams in their projected rounds
                    </div>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600">
                  <input
                    type="checkbox"
                    checked={options.includeSiblings}
                    onChange={(e) => setOptions(prev => ({ ...prev, includeSiblings: e.target.checked }))}
                    className="mt-1 w-5 h-5 accent-blue-600"
                  />
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      Include siblings
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Siblings will follow each other to the same team
                    </div>
                  </div>
                </label>
              </div>

              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Draft logic:</strong> Best available player by score (after mandatory picks)
                </div>
                <div className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  <strong>Format:</strong> {draftFormat}
                </div>
              </div>
            </div>
          ) : (
            /* Results Phase */
            <div className="space-y-6">
              {/* Warning Banner */}
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-center gap-2">
                <span className="text-yellow-600">⚠️</span>
                <span className="text-sm text-yellow-800 dark:text-yellow-200">
                  This is a projection only. Actual draft results may vary.
                </span>
              </div>

              {/* Stats Summary */}
              {stats && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {stats.highest.toFixed(1)}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Highest</div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {stats.lowest.toFixed(1)}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Lowest</div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {stats.spread.toFixed(1)}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Spread</div>
                  </div>
                </div>
              )}

              {/* Team Balance Chart */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Projected Team Balance
                </h3>
                <div className="space-y-2">
                  {sortedTeams.map((team, index) => {
                    const barWidth = (team.totalScore / maxScore) * 100;
                    const isExpanded = expandedTeamId === team.id;

                    return (
                      <div key={team.id}>
                        <button
                          onClick={() => setExpandedTeamId(isExpanded ? null : team.id)}
                          className="w-full text-left"
                        >
                          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                            <div className="w-6 text-center font-bold text-gray-500 dark:text-gray-400">
                              {index + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium text-gray-900 dark:text-white truncate">
                                  {getTeamDisplayName(team)}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-gray-600 dark:text-gray-400">
                                    {team.roster.length} players
                                  </span>
                                  <span className="font-bold text-gray-900 dark:text-white">
                                    {team.totalScore.toFixed(1)}
                                  </span>
                                  {isExpanded ? (
                                    <ChevronUp className="w-4 h-4 text-gray-500" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4 text-gray-500" />
                                  )}
                                </div>
                              </div>
                              <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                                  style={{ width: `${barWidth}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </button>

                        {/* Expanded Roster View */}
                        {isExpanded && (
                          <div className="mt-2 ml-9 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg">
                            <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                              Projected Roster
                            </div>
                            <div className="space-y-1">
                              {team.roster
                                .sort((a, b) => (a.draftedInRound ?? 99) - (b.draftedInRound ?? 99))
                                .map(player => (
                                  <div
                                    key={player.id}
                                    className="flex items-center justify-between text-sm py-1"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="text-gray-500 dark:text-gray-400 w-8">
                                        R{player.draftedInRound}:
                                      </span>
                                      <span className="text-gray-900 dark:text-white">
                                        {player.firstName} {player.lastName}
                                      </span>
                                      {player.isCoachKid && (
                                        <span className="text-blue-600" title="Coach's Kid">🔵</span>
                                      )}
                                      {player.isAllStar && (
                                        <span className="text-yellow-500" title="All-Star">⭐</span>
                                      )}
                                      {player.siblingId && (
                                        <span className="text-purple-600" title="Sibling">👥</span>
                                      )}
                                    </div>
                                    <span className="text-gray-600 dark:text-gray-400">
                                      {player.totalScore.toFixed(1)}
                                    </span>
                                  </div>
                                ))}
                            </div>
                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 flex justify-between text-sm">
                              <div className="text-gray-600 dark:text-gray-400">
                                Ages: {Object.entries(team.ageBreakdown)
                                  .sort(([a], [b]) => Number(a) - Number(b))
                                  .map(([age, count]) => `${age}(${count})`)
                                  .join(' ')}
                              </div>
                              <div className="font-semibold text-gray-900 dark:text-white">
                                Total: {team.totalScore.toFixed(1)}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between gap-3 p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex-shrink-0">
          {phase === 'options' ? (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleRunSimulation}
                className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-medium flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                Run Simulation
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleBackToOptions}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                ← Back to Options
              </button>
              <div className="flex gap-2">
                <button
                  onClick={handleRunAgain}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg font-medium flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Run Again
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-medium"
                >
                  Close
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
