import { useState, useMemo } from 'react';
import { X, Play, RotateCcw, GitCompare, Download } from 'lucide-react';
import { Player, Team, DraftFormat } from '../types';
import {
  SimulationOptions,
  SimulationResult,
  runSimulation,
  getSimulationStats,
} from '../utils/simulation';
import { CompleteRosters } from './CompleteRosters';
import { generateSimulationDraftBoard, downloadTextFile } from '../utils/exports';

interface SimulationModalProps {
  players: Player[];
  teams: Team[];
  draftOrder: string[];
  draftFormat: DraftFormat;
  onClose: () => void;
}

// Format comparison results
interface FormatComparison {
  format: DraftFormat;
  label: string;
  result: SimulationResult;
  stats: { highest: number; lowest: number; spread: number; average: number };
}

type ModalPhase = 'options' | 'results' | 'comparison';

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
  const [comparisonResults, setComparisonResults] = useState<FormatComparison[]>([]);
  const [selectedComparisonIndex, setSelectedComparisonIndex] = useState<number>(0);

  const handleRunSimulation = () => {
    const simResult = runSimulation(players, teams, draftOrder, draftFormat, options);
    setResult(simResult);
    setPhase('results');
  };

  const handleRunAgain = () => {
    const simResult = runSimulation(players, teams, draftOrder, draftFormat, options);
    setResult(simResult);
  };

  const handleCompareFormats = () => {
    const formats: { format: DraftFormat; label: string }[] = [
      { format: 'straight', label: 'Straight' },
      { format: 'snake', label: 'Snake' },
      { format: 'recalculated', label: 'Recalculated' },
    ];

    const comparisons: FormatComparison[] = formats.map(({ format, label }) => {
      const result = runSimulation(players, teams, draftOrder, format, options);
      const stats = getSimulationStats(result);
      return { format, label, result, stats };
    });

    // Sort by spread (lowest first = most balanced)
    comparisons.sort((a, b) => a.stats.spread - b.stats.spread);
    setComparisonResults(comparisons);
    setPhase('comparison');
  };

  const handleBackToOptions = () => {
    setPhase('options');
    setComparisonResults([]);
    setSelectedComparisonIndex(0);
  };

  // Export handlers - exports draft board grid (Rounds x Teams)
  const handleExportDraftBoard = (teamsToExport: Team[], formatLabel: string) => {
    const content = generateSimulationDraftBoard(teamsToExport, draftOrder);
    const filename = `simulation_${formatLabel.toLowerCase()}_draft_board.csv`;
    downloadTextFile(content, filename);
  };

  const stats = useMemo(() => {
    if (!result) return null;
    return getSimulationStats(result);
  }, [result]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔮</span>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {phase === 'options' && 'Draft Simulation Options'}
              {phase === 'results' && 'Simulation Results'}
              {phase === 'comparison' && 'Format Comparison'}
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
          {phase === 'options' && (
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
                  <strong>Current format:</strong> {draftFormat}
                </div>
              </div>
            </div>
          )}

          {phase === 'results' && result && (
            /* Results Phase - Uses same component as real draft */
            <div className="space-y-6">
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

              {/* Same roster display as real draft */}
              <CompleteRosters teams={result.teams} isSimulation={true} />
            </div>
          )}

          {phase === 'comparison' && comparisonResults.length > 0 && (
            /* Format Comparison Phase - Tabbed View */
            <div className="space-y-4">
              {/* Tab Bar */}
              <div className="flex border-b border-gray-200 dark:border-gray-700">
                {comparisonResults.map((comparison, index) => {
                  const isSelected = index === selectedComparisonIndex;
                  const isRecommended = index === 0;
                  const isCurrent = comparison.format === draftFormat;

                  return (
                    <button
                      key={comparison.format}
                      onClick={() => setSelectedComparisonIndex(index)}
                      className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                        isSelected
                          ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                          : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-300'
                      }`}
                    >
                      {comparison.label}
                      {isRecommended && (
                        <span className="px-1.5 py-0.5 bg-green-600 text-white text-xs font-medium rounded">
                          Best
                        </span>
                      )}
                      {isCurrent && (
                        <span className="px-1.5 py-0.5 bg-blue-600 text-white text-xs font-medium rounded">
                          Current
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Stats Summary for Selected Format */}
              {(() => {
                const selected = comparisonResults[selectedComparisonIndex];
                return (
                  <div className="grid grid-cols-4 gap-3">
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
                      <div className="text-xl font-bold text-gray-900 dark:text-white">
                        {selected.stats.highest.toFixed(1)}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Highest</div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
                      <div className="text-xl font-bold text-gray-900 dark:text-white">
                        {selected.stats.lowest.toFixed(1)}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Lowest</div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
                      <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                        {selected.stats.spread.toFixed(1)}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Spread</div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
                      <div className="text-xl font-bold text-gray-900 dark:text-white">
                        {selected.stats.average.toFixed(1)}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Average</div>
                    </div>
                  </div>
                );
              })()}

              {/* Rosters for Selected Format */}
              <CompleteRosters
                teams={comparisonResults[selectedComparisonIndex].result.teams}
                isSimulation={true}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between gap-3 p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex-shrink-0">
          {phase === 'options' && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Cancel
              </button>
              <div className="flex gap-2">
                <button
                  onClick={handleCompareFormats}
                  className="px-4 py-2 bg-purple-600 text-white hover:bg-purple-700 rounded-lg font-medium flex items-center gap-2"
                >
                  <GitCompare className="w-4 h-4" />
                  Compare All Formats
                </button>
                <button
                  onClick={handleRunSimulation}
                  className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-medium flex items-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  Run Simulation
                </button>
              </div>
            </>
          )}

          {phase === 'results' && result && (
            <>
              <button
                onClick={handleBackToOptions}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                ← Back to Options
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => handleExportDraftBoard(result.teams, draftFormat)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg font-medium flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export Rosters
                </button>
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

          {phase === 'comparison' && comparisonResults.length > 0 && (
            <>
              <button
                onClick={handleBackToOptions}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                ← Back to Options
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const selected = comparisonResults[selectedComparisonIndex];
                    handleExportDraftBoard(selected.result.teams, selected.label);
                  }}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg font-medium flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export Rosters
                </button>
                <button
                  onClick={handleCompareFormats}
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
