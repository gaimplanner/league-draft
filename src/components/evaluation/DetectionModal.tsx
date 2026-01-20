import { Wand2, Users, Link, ChevronRight, CheckCircle2 } from 'lucide-react';
import { EvaluationPlayer } from '../../types/evaluation';
import { CoachKidMatch, SiblingMatch } from '../../hooks/useEvaluationImport';

interface DetectionModalProps {
  coachKidMatches: CoachKidMatch[];
  siblingMatches: SiblingMatch[];
  selectedCoachKids: Set<string>;
  selectedSiblings: Set<string>;
  players: EvaluationPlayer[];
  onToggleCoachKid: (bib: string) => void;
  onToggleSibling: (pairKey: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onApply: () => void;
  onCancel: () => void;
}

export function DetectionModal({
  coachKidMatches,
  siblingMatches,
  selectedCoachKids,
  selectedSiblings,
  players,
  onToggleCoachKid,
  onToggleSibling,
  onSelectAll,
  onDeselectAll,
  onApply,
  onCancel,
}: DetectionModalProps) {
  const getPlayer = (bib: string) => players.find(p => p.bib === bib);

  const totalSelected = selectedCoachKids.size + selectedSiblings.size;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Wand2 className="w-6 h-6 text-purple-500" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Auto-Detection Results
            </h2>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            Found {coachKidMatches.length} coach's kid match{coachKidMatches.length !== 1 ? 'es' : ''} and{' '}
            {siblingMatches.length} sibling pair{siblingMatches.length !== 1 ? 's' : ''} based on last name matching.
          </p>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[50vh]">
          {coachKidMatches.length === 0 && siblingMatches.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No matches found. Make sure team names match player last names for coaches.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Coach's Kids Section */}
              {coachKidMatches.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-500" />
                    Coach's Kids ({coachKidMatches.length})
                  </h3>
                  <div className="space-y-3">
                    {coachKidMatches.map((match) => {
                      const player = getPlayer(match.bib);
                      const isSelected = selectedCoachKids.has(match.bib);

                      return (
                        <label
                          key={match.bib}
                          className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                            isSelected
                              ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => onToggleCoachKid(match.bib)}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-1 w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                          />
                          <div className="flex-1">
                            <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                              {match.playerName}
                              <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded font-mono">
                                {match.bib}
                              </span>
                              {match.alreadyMarked && (
                                <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                                  Previously assigned
                                </span>
                              )}
                              {isSelected && (
                                <CheckCircle2 className="w-5 h-5 text-purple-600" />
                              )}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              → Team {match.teamName}
                            </div>
                            {player && (
                              <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                Rank #{player.rank} • Round {player.projectedRound} • Age {player.age || '?'}
                              </div>
                            )}
                            <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                              {match.reason}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Siblings Section */}
              {siblingMatches.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <Link className="w-5 h-5 text-purple-500" />
                    Siblings ({siblingMatches.length} pair{siblingMatches.length !== 1 ? 's' : ''})
                  </h3>
                  <div className="space-y-3">
                    {siblingMatches.map((match) => {
                      const player1 = getPlayer(match.bib1);
                      const player2 = getPlayer(match.bib2);
                      const pairKey = `${match.bib1}-${match.bib2}`;
                      const isSelected = selectedSiblings.has(pairKey);

                      return (
                        <label
                          key={pairKey}
                          className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                            isSelected
                              ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => onToggleSibling(pairKey)}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-1 w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                          />
                          <div className="flex-1">
                            <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 flex-wrap">
                              <span>{match.player1Name}</span>
                              <span className="text-gray-400">↔</span>
                              <span>{match.player2Name}</span>
                              {match.alreadyLinked && (
                                <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                                  Previously linked
                                </span>
                              )}
                              {isSelected && (
                                <CheckCircle2 className="w-5 h-5 text-purple-600" />
                              )}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              Shared last name: {match.sharedLastName}
                            </div>
                            {player1 && player2 && (
                              <div className="text-xs text-gray-500 dark:text-gray-500 mt-1 flex gap-4 flex-wrap">
                                <span>
                                  {match.player1Name.split(' ')[0]} - Rank #{player1.rank}, R{player1.projectedRound}
                                </span>
                                <span>
                                  {match.player2Name.split(' ')[0]} - Rank #{player2.rank}, R{player2.projectedRound}
                                </span>
                              </div>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center gap-3">
          <div className="flex gap-2">
            <button
              onClick={onSelectAll}
              className="px-3 py-2 text-sm text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg font-medium"
            >
              Select All
            </button>
            <button
              onClick={onDeselectAll}
              className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium"
            >
              Deselect All
            </button>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium"
            >
              Cancel
            </button>
            <button
              onClick={onApply}
              disabled={totalSelected === 0}
              className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              Apply {totalSelected > 0 && `(${totalSelected})`}
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
