import { useState } from 'react';
import { AlertTriangle, Check, X, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { PlayerMatch } from '../../utils/teamBuilderParser';

interface UnmatchedPlayer {
  registrationIndex: number;
  firstName: string;
  lastName: string;
  fullName: string;
  match: PlayerMatch;
}

interface EvalPlayer {
  bib: string;
  firstName: string;
  lastName: string;
  fullName: string;
}

interface NameMatchResolverProps {
  unmatchedPlayers: UnmatchedPlayer[];
  availableEvalPlayers: EvalPlayer[];
  onResolve: (registrationIndex: number, evalBib: string | null) => void;
  onResolveAll: (resolutions: Map<number, string | null>) => void;
  onCreateWithoutEval: (registrationIndex: number) => void;
}

/**
 * UI component for resolving unmatched player names.
 * Shows registration data players that couldn't be automatically matched
 * to evaluation data, and allows manual resolution.
 */
export const NameMatchResolver = ({
  unmatchedPlayers,
  availableEvalPlayers,
  onResolve,
  onResolveAll,
  onCreateWithoutEval,
}: NameMatchResolverProps) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [searchTerms, setSearchTerms] = useState<Map<number, string>>(new Map());
  const [selectedMatches, setSelectedMatches] = useState<Map<number, string | null>>(new Map());

  const toggleExpanded = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  const handleSearchChange = (registrationIndex: number, term: string) => {
    setSearchTerms(new Map(searchTerms).set(registrationIndex, term));
  };

  const handleSelect = (registrationIndex: number, evalBib: string | null) => {
    setSelectedMatches(new Map(selectedMatches).set(registrationIndex, evalBib));
    onResolve(registrationIndex, evalBib);
  };

  const getFilteredEvalPlayers = (registrationIndex: number): EvalPlayer[] => {
    const searchTerm = (searchTerms.get(registrationIndex) || '').toLowerCase();
    if (!searchTerm) return availableEvalPlayers;

    return availableEvalPlayers.filter(p =>
      p.fullName.toLowerCase().includes(searchTerm) ||
      p.bib.toLowerCase().includes(searchTerm)
    );
  };

  const handleResolveAll = () => {
    onResolveAll(selectedMatches);
  };

  if (unmatchedPlayers.length === 0) {
    return (
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
          <span className="text-green-800 dark:text-green-200 font-medium">
            All players matched successfully
          </span>
        </div>
      </div>
    );
  }

  const resolvedCount = selectedMatches.size;
  const totalUnmatched = unmatchedPlayers.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Unmatched Players ({totalUnmatched - resolvedCount} remaining)
          </h3>
        </div>
        {resolvedCount > 0 && (
          <button
            onClick={handleResolveAll}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
          >
            Apply {resolvedCount} Resolution{resolvedCount !== 1 ? 's' : ''}
          </button>
        )}
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400">
        These players from the Registration Data tab couldn't be automatically matched
        to evaluation data. Select the correct match or create them without eval scores.
      </p>

      {/* Unmatched player list */}
      <div className="space-y-3">
        {unmatchedPlayers.map((player) => {
          const isExpanded = expandedIndex === player.registrationIndex;
          const isResolved = selectedMatches.has(player.registrationIndex);
          const resolvedBib = selectedMatches.get(player.registrationIndex);
          const filteredPlayers = getFilteredEvalPlayers(player.registrationIndex);

          return (
            <div
              key={player.registrationIndex}
              className={`border rounded-lg overflow-hidden ${
                isResolved
                  ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
              }`}
            >
              {/* Player header row */}
              <button
                onClick={() => toggleExpanded(player.registrationIndex)}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700/50"
              >
                <div className="flex items-center gap-3">
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {player.fullName}
                    </span>
                    {isResolved && (
                      <span className="ml-2 text-sm text-green-600 dark:text-green-400">
                        {resolvedBib
                          ? `→ BIB ${resolvedBib}`
                          : '→ No eval data'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {player.match.matchType !== 'none' && (
                    <span className="text-xs px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded">
                      {Math.round(player.match.matchScore * 100)}% match
                    </span>
                  )}
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700">
                  {/* Search */}
                  <div className="mt-3 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search by name or BIB..."
                      value={searchTerms.get(player.registrationIndex) || ''}
                      onChange={(e) => handleSearchChange(player.registrationIndex, e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Suggestions */}
                  {player.match.suggestedMatches && player.match.suggestedMatches.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                        Suggested matches:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {player.match.suggestedMatches.map((suggestion) => (
                          <button
                            key={suggestion.bib}
                            onClick={() => handleSelect(player.registrationIndex, suggestion.bib)}
                            className="px-3 py-1 text-sm border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50"
                          >
                            {suggestion.firstName} {suggestion.lastName} (BIB {suggestion.bib})
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* All eval players */}
                  <div className="mt-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      All evaluation players ({filteredPlayers.length}):
                    </p>
                    <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg">
                      {filteredPlayers.length === 0 ? (
                        <p className="p-3 text-sm text-gray-500 dark:text-gray-400">
                          No players found
                        </p>
                      ) : (
                        filteredPlayers.map((evalPlayer) => (
                          <button
                            key={evalPlayer.bib}
                            onClick={() => handleSelect(player.registrationIndex, evalPlayer.bib)}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0 flex items-center justify-between"
                          >
                            <span className="text-gray-900 dark:text-white">
                              {evalPlayer.fullName}
                            </span>
                            <span className="text-gray-500 dark:text-gray-400">
                              BIB {evalPlayer.bib}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Create without eval option */}
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                    <button
                      onClick={() => {
                        handleSelect(player.registrationIndex, null);
                        onCreateWithoutEval(player.registrationIndex);
                      }}
                      className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                    >
                      <X className="w-4 h-4" />
                      Create player without evaluation data (will be marked DNE)
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
