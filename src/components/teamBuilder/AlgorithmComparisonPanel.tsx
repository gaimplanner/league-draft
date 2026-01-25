import { useState, useMemo } from 'react';
import { Check, Sparkles, Users, BarChart3 } from 'lucide-react';
import {
  Team,
  ResolvedRequest,
  SimplifiedAlgorithmMode,
  RequestsFirstConfig,
} from '../../types';
import {
  TeamBuilderPlayer,
  TeamBuilderResult,
  runAllAlgorithms,
  AllAlgorithmsResult,
} from '../../utils/teamBuilderAlgorithm';

interface AlgorithmComparisonPanelProps {
  players: TeamBuilderPlayer[];
  teams: Team[];
  resolvedRequests: ResolvedRequest[];
  config?: Partial<RequestsFirstConfig>;
  onSelectResult: (mode: SimplifiedAlgorithmMode, result: TeamBuilderResult) => void;
}

/**
 * Algorithm comparison panel for the simplified Team Builder.
 * Shows three algorithms side-by-side with stats, allowing the user to pick one.
 */
export const AlgorithmComparisonPanel = ({
  players,
  teams,
  resolvedRequests,
  config = {},
  onSelectResult,
}: AlgorithmComparisonPanelProps) => {
  const [selectedTab, setSelectedTab] = useState<number>(0);

  // Run all algorithms and get comparison results
  const { comparisons, results } = useMemo<AllAlgorithmsResult>(() => {
    return runAllAlgorithms(players, teams, resolvedRequests, config);
  }, [players, teams, resolvedRequests, config]);

  const selectedComparison = comparisons[selectedTab];
  const selectedResult = results.get(selectedComparison?.mode);

  // Get icon for algorithm mode
  const getModeIcon = (mode: SimplifiedAlgorithmMode) => {
    switch (mode) {
      case 'skill-priority': return BarChart3;
      case 'request-priority': return Users;
      case 'balance-priority': return Sparkles;
    }
  };

  // Format happiness indicator
  const getHappinessColor = (percent: number) => {
    if (percent >= 80) return 'text-green-600 dark:text-green-400';
    if (percent >= 50) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  // Build team roster preview from result
  const getTeamRosters = (mode: SimplifiedAlgorithmMode) => {
    const result = results.get(mode);
    if (!result) return [];

    return teams.map(team => {
      const teamPlayers = result.assignments
        .filter(a => a.teamId === team.id)
        .map(a => players.find(p => p.id === a.playerId))
        .filter(Boolean) as TeamBuilderPlayer[];

      const totalScore = teamPlayers.reduce((sum, p) => sum + p.totalScore, 0);
      const top6 = [...teamPlayers].sort((a, b) => b.totalScore - a.totalScore).slice(0, 6);
      const top6Score = top6.reduce((sum, p) => sum + p.totalScore, 0);

      // Count happiness for this team
      const teamHappiness = result.playerHappiness.filter(h => {
        const assignment = result.assignments.find(a => a.playerId === h.playerId);
        return assignment?.teamId === team.id;
      });
      const happyCount = teamHappiness.filter(h => h.score === 'all' || h.score === 'some').length;
      const withRequests = teamHappiness.filter(h => h.score !== 'no-requests').length;
      const happyPercent = withRequests > 0 ? Math.round((happyCount / withRequests) * 100) : 100;

      return {
        team,
        players: teamPlayers,
        totalScore,
        top6Score,
        rosterCount: teamPlayers.length,
        happyPercent,
      };
    });
  };

  if (comparisons.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center">
        <p className="text-gray-500 dark:text-gray-400">
          Running algorithms...
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Compare Algorithms
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Select an algorithm to use for team assignments
        </p>
      </div>

      {/* Tab Bar */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {comparisons.map((comparison, index) => {
          const isSelected = index === selectedTab;
          const Icon = getModeIcon(comparison.mode);

          return (
            <button
              key={comparison.mode}
              onClick={() => setSelectedTab(index)}
              className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${
                isSelected
                  ? 'border-purple-600 text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{comparison.label}</span>
              {comparison.isRecommended && (
                <span className="px-1.5 py-0.5 bg-green-600 text-white text-xs font-medium rounded">
                  Best
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Stats Panel */}
      {selectedComparison && (
        <div className="p-6">
          {/* Description */}
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {selectedComparison.description}
          </p>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {/* Top 6 Average */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {selectedComparison.stats.top6Average.toFixed(1)}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Top 6 Average
              </div>
            </div>

            {/* Spread */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {selectedComparison.stats.top6Spread.toFixed(1)}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Top 6 Spread
              </div>
            </div>

            {/* Happiness */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center">
              <div className={`text-2xl font-bold ${getHappinessColor(selectedComparison.stats.happinessPercent)}`}>
                {selectedComparison.stats.happinessPercent}%
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Happiness
              </div>
            </div>

            {/* Happiness Breakdown */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center">
              <div className="flex items-center justify-center gap-2 text-sm">
                <span className="text-green-600 dark:text-green-400">
                  {selectedComparison.stats.happinessBreakdown.all}
                </span>
                <span className="text-gray-400">/</span>
                <span className="text-yellow-600 dark:text-yellow-400">
                  {selectedComparison.stats.happinessBreakdown.some}
                </span>
                <span className="text-gray-400">/</span>
                <span className="text-red-600 dark:text-red-400">
                  {selectedComparison.stats.happinessBreakdown.none}
                </span>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                All / Some / None
              </div>
            </div>
          </div>

          {/* Team Summary Grid */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Team Breakdown
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {getTeamRosters(selectedComparison.mode).map(({ team, top6Score, rosterCount, happyPercent }) => (
                <div
                  key={team.id}
                  className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3"
                >
                  <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {team.headCoach || `Team ${team.draftPosition}`}
                  </div>
                  <div className="flex items-center justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
                    <span>Top 6: {top6Score.toFixed(0)}</span>
                    <span>{rosterCount} players</span>
                  </div>
                  <div className="mt-1">
                    <div className={`text-xs ${getHappinessColor(happyPercent)}`}>
                      {happyPercent}% happy
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Select Button */}
          <div className="mt-6 flex justify-end">
            <button
              onClick={() => {
                if (selectedResult) {
                  onSelectResult(selectedComparison.mode, selectedResult);
                }
              }}
              disabled={!selectedResult}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
            >
              <Check className="w-4 h-4" />
              Use {selectedComparison.label}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
