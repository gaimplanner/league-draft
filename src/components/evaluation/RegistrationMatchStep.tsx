import { useState } from 'react';
import {
  AlertTriangle,
  Check,
  Search,
  ChevronDown,
  ChevronUp,
  Ban,
  UserX,
  UserCheck,
  SkipForward,
} from 'lucide-react';
import {
  RegistrationMatchResult,
  EvaluatedNotRegistered,
} from '../../hooks/useEvaluationImport';
import { EvaluationPlayer } from '../../types/evaluation';

interface RegistrationMatchStepProps {
  registrationMatches: RegistrationMatchResult[];
  evaluatedNotRegistered: EvaluatedNotRegistered[];
  evalPlayers: EvaluationPlayer[];
  stats: {
    total: number;
    matched: number;
    dne: number;
    unresolved: number;
    excludedCount: number;
  };
  onResolveMatch: (registrationIndex: number, evalBib: string | null) => void;
  onMarkAsDNE: (registrationIndex: number) => void;
  onToggleExclude: (bib: string) => void;
  onApply: () => void;
  onSkip: () => void;
  onBack: () => void;
}

/**
 * Step in EvaluationImport flow for matching registration data to evaluation data.
 * Shows:
 * 1. Summary of auto-matched players
 * 2. Unmatched registration players (need resolution or DNE marking)
 * 3. Evaluated players not in registration (to exclude from draft)
 */
export function RegistrationMatchStep({
  registrationMatches,
  evaluatedNotRegistered,
  evalPlayers,
  stats,
  onResolveMatch,
  onMarkAsDNE,
  onToggleExclude,
  onApply,
  onSkip,
  onBack,
}: RegistrationMatchStepProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [searchTerms, setSearchTerms] = useState<Map<number, string>>(new Map());
  const [showExcluded, setShowExcluded] = useState(true);

  const unresolvedMatches = registrationMatches.filter(m => m.resolution === 'unresolved');
  const canProceed = stats.unresolved === 0;

  const toggleExpanded = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  const handleSearchChange = (registrationIndex: number, term: string) => {
    setSearchTerms(new Map(searchTerms).set(registrationIndex, term));
  };

  const getFilteredEvalPlayers = (registrationIndex: number): EvaluationPlayer[] => {
    const searchTerm = (searchTerms.get(registrationIndex) || '').toLowerCase();

    // Get already matched bibs to exclude from suggestions
    const matchedBibs = new Set(
      registrationMatches
        .filter(m => m.resolvedBib)
        .map(m => m.resolvedBib!)
    );

    let filtered = evalPlayers.filter(p => !matchedBibs.has(p.bib));

    if (searchTerm) {
      filtered = filtered.filter(p =>
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchTerm) ||
        p.bib.toLowerCase().includes(searchTerm)
      );
    }

    return filtered;
  };

  const handleMarkAllUnresolvedAsDNE = () => {
    unresolvedMatches.forEach(match => {
      onMarkAsDNE(match.registrationIndex);
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Registration Verification
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Match registration data to evaluation data. Players not in registration will be excluded from draft.
        </p>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Registered Players</div>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
          <div className="text-2xl font-bold text-green-700 dark:text-green-400">{stats.matched}</div>
          <div className="text-sm text-green-600 dark:text-green-400">Auto-Matched</div>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
          <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">{stats.unresolved}</div>
          <div className="text-sm text-amber-600 dark:text-amber-400">Need Resolution</div>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
          <div className="text-2xl font-bold text-red-700 dark:text-red-400">{stats.excludedCount}</div>
          <div className="text-sm text-red-600 dark:text-red-400">To Be Excluded</div>
        </div>
      </div>

      {/* Unresolved Matches Section */}
      {unresolvedMatches.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <h3 className="font-semibold text-amber-800 dark:text-amber-200">
                  Registered But Not Found in Evaluations ({unresolvedMatches.length})
                </h3>
              </div>
              <button
                onClick={handleMarkAllUnresolvedAsDNE}
                className="px-3 py-1.5 text-sm border border-amber-300 dark:border-amber-700 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-900/50 flex items-center gap-2"
              >
                <Ban className="w-4 h-4" />
                Mark All as DNE
              </button>
            </div>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
              These players are registered but couldn't be matched to evaluation data.
              Match them manually or mark as "Did Not Evaluate" (DNE) with 0 scores.
            </p>
          </div>

          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {unresolvedMatches.map((match) => {
              const isExpanded = expandedIndex === match.registrationIndex;
              const filteredPlayers = getFilteredEvalPlayers(match.registrationIndex);

              return (
                <div key={match.registrationIndex} className="p-4">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => toggleExpanded(match.registrationIndex)}
                      className="flex-1 flex items-center gap-3 text-left"
                    >
                      <UserX className="w-5 h-5 text-amber-500" />
                      <span className="font-medium text-gray-900 dark:text-white">
                        {match.fullName}
                      </span>
                      {match.match.matchType === 'fuzzy' && (
                        <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                          {Math.round(match.match.matchScore * 100)}% similar to {match.match.evalFirstName} {match.match.evalLastName}
                        </span>
                      )}
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onMarkAsDNE(match.registrationIndex)}
                        className="px-2 py-1 text-xs border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded hover:bg-amber-100 dark:hover:bg-amber-900/50 flex items-center gap-1"
                      >
                        <Ban className="w-3 h-3" />
                        DNE
                      </button>
                      <button
                        onClick={() => toggleExpanded(match.registrationIndex)}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 pl-8 space-y-3">
                      {/* Fuzzy match suggestions */}
                      {match.match.suggestedMatches && match.match.suggestedMatches.length > 0 && (
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                            Suggested matches:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {match.match.suggestedMatches.map((suggestion) => (
                              <button
                                key={suggestion.bib}
                                onClick={() => onResolveMatch(match.registrationIndex, suggestion.bib)}
                                className="px-3 py-1.5 text-sm border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50"
                              >
                                {suggestion.firstName} {suggestion.lastName} (BIB {suggestion.bib})
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Search */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search by name or BIB..."
                          value={searchTerms.get(match.registrationIndex) || ''}
                          onChange={(e) => handleSearchChange(match.registrationIndex, e.target.value)}
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      {/* All available players */}
                      <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg">
                        {filteredPlayers.length === 0 ? (
                          <p className="p-3 text-sm text-gray-500 dark:text-gray-400">
                            No unmatched players found
                          </p>
                        ) : (
                          filteredPlayers.slice(0, 20).map((evalPlayer) => (
                            <button
                              key={evalPlayer.bib}
                              onClick={() => onResolveMatch(match.registrationIndex, evalPlayer.bib)}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0 flex items-center justify-between"
                            >
                              <span className="text-gray-900 dark:text-white">
                                {evalPlayer.firstName} {evalPlayer.lastName}
                              </span>
                              <span className="text-gray-500 dark:text-gray-400">
                                BIB {evalPlayer.bib} • Score: {evalPlayer.weightedTotal.toFixed(1)}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DNE Players Section (resolved as DNE) */}
      {stats.dne > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <Ban className="w-5 h-5 text-gray-500" />
              <h3 className="font-semibold text-gray-700 dark:text-gray-300">
                Marked as DNE ({stats.dne})
              </h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              These players will be added to the draft with 0 scores.
            </p>
          </div>
          <div className="p-4">
            <div className="flex flex-wrap gap-2">
              {registrationMatches
                .filter(m => m.resolution === 'dne')
                .map(match => (
                  <span
                    key={match.registrationIndex}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-sm"
                  >
                    <Ban className="w-3 h-3" />
                    {match.fullName}
                  </span>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Evaluated But Not Registered Section */}
      {evaluatedNotRegistered.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <button
            onClick={() => setShowExcluded(!showExcluded)}
            className="w-full px-4 py-3 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <UserX className="w-5 h-5 text-red-600 dark:text-red-400" />
              <h3 className="font-semibold text-red-800 dark:text-red-200">
                Evaluated But Not Registered ({evaluatedNotRegistered.length})
              </h3>
            </div>
            {showExcluded ? (
              <ChevronUp className="w-5 h-5 text-red-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-red-500" />
            )}
          </button>

          {showExcluded && (
            <>
              <div className="px-4 py-2 bg-red-50/50 dark:bg-red-900/10 border-b border-red-100 dark:border-red-900">
                <p className="text-sm text-red-700 dark:text-red-300">
                  These players have evaluation scores but are not in the registration data.
                  By default they will be <strong>excluded</strong> from the draft.
                  Uncheck to keep them in the draft.
                </p>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {evaluatedNotRegistered.map((player) => (
                  <div
                    key={player.bib}
                    className={`px-4 py-3 flex items-center justify-between ${
                      player.excluded
                        ? 'bg-red-50/30 dark:bg-red-900/10'
                        : 'bg-green-50/30 dark:bg-green-900/10'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={player.excluded}
                        onChange={() => onToggleExclude(player.bib)}
                        className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                      />
                      <div>
                        <span className={`font-medium ${
                          player.excluded
                            ? 'text-red-700 dark:text-red-400 line-through'
                            : 'text-gray-900 dark:text-white'
                        }`}>
                          {player.fullName}
                        </span>
                        <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                          BIB {player.bib}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Score: {player.totalScore.toFixed(1)}
                      </span>
                      {player.excluded ? (
                        <span className="text-xs px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded">
                          Will be excluded
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                          Will be included
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* All Matched (Success) */}
      {stats.matched > 0 && stats.unresolved === 0 && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <UserCheck className="w-6 h-6 text-green-600 dark:text-green-400" />
            <div>
              <h3 className="font-semibold text-green-800 dark:text-green-200">
                All Registered Players Matched
              </h3>
              <p className="text-sm text-green-700 dark:text-green-300">
                {stats.matched} players successfully matched to evaluation data.
                {stats.dne > 0 && ` ${stats.dne} marked as DNE.`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={onBack}
          className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
        >
          Back to Overview
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={onSkip}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 flex items-center gap-2"
          >
            <SkipForward className="w-4 h-4" />
            Skip Verification
          </button>

          <button
            onClick={onApply}
            disabled={!canProceed}
            className={`px-6 py-2 rounded-lg font-medium flex items-center gap-2 ${
              canProceed
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
            }`}
          >
            {canProceed ? (
              <>
                <Check className="w-4 h-4" />
                Apply & Continue
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4" />
                Resolve {stats.unresolved} Remaining
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
