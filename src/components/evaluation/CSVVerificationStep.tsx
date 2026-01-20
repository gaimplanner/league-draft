import { useState, useMemo } from 'react';
import {
  AlertTriangle,
  Check,
  Ban,
  UserX,
  UserCheck,
  ArrowRight,
  Search,
} from 'lucide-react';
import { EvaluationCSVRecord, RegistrationCSVRecord } from './DualCSVUpload';

interface MatchResult {
  evalIndex: number;
  regIndex: number | null;
  evalPlayer: EvaluationCSVRecord;
  regPlayer: RegistrationCSVRecord | null;
  matchType: 'exact' | 'fuzzy' | 'none';
  matchScore: number;
}

interface CSVVerificationStepProps {
  evalData: EvaluationCSVRecord[];
  regData: RegistrationCSVRecord[];
  onComplete: (
    verifiedEval: EvaluationCSVRecord[],
    excludedBibs: Set<string>,
    dnePlayers: RegistrationCSVRecord[]
  ) => void;
  onBack: () => void;
}

// Simple name similarity (Levenshtein-based)
function nameSimilarity(a: string, b: string): number {
  const s1 = a.toLowerCase();
  const s2 = b.toLowerCase();

  if (s1 === s2) return 1;

  const len1 = s1.length;
  const len2 = s2.length;

  if (len1 === 0 || len2 === 0) return 0;

  const matrix: number[][] = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const distance = matrix[len1][len2];
  return 1 - distance / Math.max(len1, len2);
}

/**
 * Verification step for CSV-based import.
 * Shows matches, unmatched evaluations (to exclude), and unmatched registrations (DNE).
 */
export function CSVVerificationStep({
  evalData,
  regData,
  onComplete,
  onBack,
}: CSVVerificationStepProps) {
  // Track excluded eval players and DNE reg players
  const [excludedBibs, setExcludedBibs] = useState<Set<string>>(new Set());
  const [dneRegIndices, setDneRegIndices] = useState<Set<number>>(new Set());
  const [manualMatches] = useState<Map<number, number>>(new Map()); // evalIndex -> regIndex
  const [searchTerm, setSearchTerm] = useState('');

  // Perform matching
  const matchResults = useMemo(() => {
    const results: MatchResult[] = [];
    const matchedRegIndices = new Set<number>();

    // Add manual matches first
    manualMatches.forEach((regIndex) => {
      matchedRegIndices.add(regIndex);
    });

    evalData.forEach((evalPlayer, evalIndex) => {
      // Check for manual match
      if (manualMatches.has(evalIndex)) {
        const regIndex = manualMatches.get(evalIndex)!;
        results.push({
          evalIndex,
          regIndex,
          evalPlayer,
          regPlayer: regData[regIndex],
          matchType: 'exact',
          matchScore: 1,
        });
        return;
      }

      const evalFullName = `${evalPlayer.firstName} ${evalPlayer.lastName}`.toLowerCase();

      // Try to find match in registration
      let bestMatch: { regIndex: number; score: number; regPlayer: RegistrationCSVRecord } | null = null;

      for (let regIndex = 0; regIndex < regData.length; regIndex++) {
        if (matchedRegIndices.has(regIndex)) continue;

        const regPlayer = regData[regIndex];
        const regFullName = `${regPlayer.firstName} ${regPlayer.lastName}`.toLowerCase();

        // Exact match
        if (evalFullName === regFullName) {
          bestMatch = { regIndex, score: 1, regPlayer };
          break;
        }

        // Fuzzy match
        const score = nameSimilarity(evalFullName, regFullName);
        if (score >= 0.8 && (!bestMatch || score > bestMatch.score)) {
          bestMatch = { regIndex, score, regPlayer };
        }
      }

      if (bestMatch && bestMatch.score >= 0.8) {
        matchedRegIndices.add(bestMatch.regIndex);
        results.push({
          evalIndex,
          regIndex: bestMatch.regIndex,
          evalPlayer,
          regPlayer: bestMatch.regPlayer,
          matchType: bestMatch.score === 1 ? 'exact' : 'fuzzy',
          matchScore: bestMatch.score,
        });
      } else {
        results.push({
          evalIndex,
          regIndex: null,
          evalPlayer,
          regPlayer: null,
          matchType: 'none',
          matchScore: 0,
        });
      }
    });

    return { results, matchedRegIndices };
  }, [evalData, regData, manualMatches]);

  // Unmatched registrations (potential DNE players)
  const unmatchedReg = useMemo(() => {
    return regData
      .map((player, index) => ({ player, index }))
      .filter(({ index }) => !matchResults.matchedRegIndices.has(index));
  }, [regData, matchResults.matchedRegIndices]);

  // Stats
  const stats = useMemo(() => {
    const matched = matchResults.results.filter(r => r.regIndex !== null).length;
    const unmatched = matchResults.results.filter(r => r.regIndex === null).length;
    const excluded = excludedBibs.size;
    const dne = dneRegIndices.size;

    return { matched, unmatched, excluded, dne, unmatchedReg: unmatchedReg.length };
  }, [matchResults, excludedBibs, dneRegIndices, unmatchedReg]);

  // Initialize excluded bibs for unmatched eval players
  useMemo(() => {
    const newExcluded = new Set<string>();
    matchResults.results.forEach(r => {
      if (r.regIndex === null) {
        newExcluded.add(r.evalPlayer.bib);
      }
    });
    setExcludedBibs(newExcluded);
  }, [matchResults.results]);

  const toggleExclude = (bib: string) => {
    setExcludedBibs(prev => {
      const next = new Set(prev);
      if (next.has(bib)) {
        next.delete(bib);
      } else {
        next.add(bib);
      }
      return next;
    });
  };

  const toggleDNE = (regIndex: number) => {
    setDneRegIndices(prev => {
      const next = new Set(prev);
      if (next.has(regIndex)) {
        next.delete(regIndex);
      } else {
        next.add(regIndex);
      }
      return next;
    });
  };

  const handleComplete = () => {
    const dnePlayers = Array.from(dneRegIndices).map(i => regData[i]);
    onComplete(evalData, excludedBibs, dnePlayers);
  };

  // Filter for search
  const filteredUnmatchedEval = matchResults.results
    .filter(r => r.regIndex === null)
    .filter(r => {
      if (!searchTerm) return true;
      const name = `${r.evalPlayer.firstName} ${r.evalPlayer.lastName}`.toLowerCase();
      return name.includes(searchTerm.toLowerCase());
    });

  const filteredUnmatchedReg = unmatchedReg.filter(({ player }) => {
    if (!searchTerm) return true;
    const name = `${player.firstName} ${player.lastName}`.toLowerCase();
    return name.includes(searchTerm.toLowerCase());
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Verify Draft Eligibility
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Review matches between evaluation data and registration list
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
          <div className="text-2xl font-bold text-green-700 dark:text-green-400">{stats.matched}</div>
          <div className="text-sm text-green-600 dark:text-green-400">Matched Players</div>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
          <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">{stats.unmatched}</div>
          <div className="text-sm text-amber-600 dark:text-amber-400">Eval Only (No Reg)</div>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
          <div className="text-2xl font-bold text-red-700 dark:text-red-400">{stats.excluded}</div>
          <div className="text-sm text-red-600 dark:text-red-400">Will Be Excluded</div>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
          <div className="text-2xl font-bold text-purple-700 dark:text-purple-400">{stats.unmatchedReg}</div>
          <div className="text-sm text-purple-600 dark:text-purple-400">Reg Only (No Eval)</div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        />
      </div>

      {/* All Matched - Success */}
      {stats.unmatched === 0 && stats.unmatchedReg === 0 && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <UserCheck className="w-6 h-6 text-green-600 dark:text-green-400" />
            <div>
              <h3 className="font-semibold text-green-800 dark:text-green-200">
                All Players Matched
              </h3>
              <p className="text-sm text-green-700 dark:text-green-300">
                {stats.matched} evaluation players matched to registration list.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Evaluated but Not Registered */}
      {filteredUnmatchedEval.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <h3 className="font-semibold text-amber-800 dark:text-amber-200">
                Evaluated But Not Registered ({filteredUnmatchedEval.length})
              </h3>
            </div>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
              These players have evaluation scores but are not in the registration list.
              They will be excluded from the draft by default.
            </p>
          </div>

          <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-64 overflow-y-auto">
            {filteredUnmatchedEval.map(({ evalPlayer }) => (
              <div
                key={evalPlayer.bib}
                className={`px-4 py-3 flex items-center justify-between ${
                  excludedBibs.has(evalPlayer.bib)
                    ? 'bg-red-50/30 dark:bg-red-900/10'
                    : 'bg-green-50/30 dark:bg-green-900/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={excludedBibs.has(evalPlayer.bib)}
                    onChange={() => toggleExclude(evalPlayer.bib)}
                    className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                  />
                  <div>
                    <span className={`font-medium ${
                      excludedBibs.has(evalPlayer.bib)
                        ? 'text-red-700 dark:text-red-400 line-through'
                        : 'text-gray-900 dark:text-white'
                    }`}>
                      {evalPlayer.firstName} {evalPlayer.lastName}
                    </span>
                    <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                      BIB {evalPlayer.bib}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Score: {evalPlayer.totalScore}
                  </span>
                  {excludedBibs.has(evalPlayer.bib) ? (
                    <span className="text-xs px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded">
                      Excluded
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                      Included
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Registered but Not Evaluated */}
      {filteredUnmatchedReg.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-4 py-3 bg-purple-50 dark:bg-purple-900/20 border-b border-purple-200 dark:border-purple-800">
            <div className="flex items-center gap-2">
              <UserX className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <h3 className="font-semibold text-purple-800 dark:text-purple-200">
                Registered But Not Evaluated ({filteredUnmatchedReg.length})
              </h3>
            </div>
            <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
              These players are registered but have no evaluation data.
              Check "Add as DNE" to include them in the draft with 0 scores.
            </p>
          </div>

          <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-64 overflow-y-auto">
            {filteredUnmatchedReg.map(({ player, index }) => (
              <div
                key={index}
                className={`px-4 py-3 flex items-center justify-between ${
                  dneRegIndices.has(index)
                    ? 'bg-purple-50/30 dark:bg-purple-900/10'
                    : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={dneRegIndices.has(index)}
                    onChange={() => toggleDNE(index)}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                  <span className="font-medium text-gray-900 dark:text-white">
                    {player.firstName} {player.lastName}
                  </span>
                  {player.division && (
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      ({player.division})
                    </span>
                  )}
                </div>
                {dneRegIndices.has(index) ? (
                  <span className="text-xs px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded flex items-center gap-1">
                    <Ban className="w-3 h-3" />
                    Will be added as DNE
                  </span>
                ) : (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Not in draft
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={onBack}
          className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
        >
          Back to Upload
        </button>

        <button
          onClick={handleComplete}
          className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium flex items-center gap-2"
        >
          <Check className="w-4 h-4" />
          Continue with {evalData.length - excludedBibs.size + dneRegIndices.size} Players
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
