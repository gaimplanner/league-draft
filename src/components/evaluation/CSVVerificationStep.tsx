import { useState, useMemo, useEffect } from 'react';
import {
  AlertTriangle,
  Check,
  Ban,
  UserX,
  UserCheck,
  ArrowRight,
  Search,
} from 'lucide-react';
import { ParsedCSVData } from '../../types';
import { RegistrationCSVRecord, ParsedRegistrationData } from './DualCSVUpload';

// Result of verification - which rows to exclude and which DNE players to add
export interface VerificationResult {
  /** Row indices (0-based) in the eval CSV to exclude from import */
  excludedRowIndices: Set<number>;
  /** Registration records that have no matching eval record - will be added as DNE */
  dnePlayers: RegistrationCSVRecord[];
}

interface CSVVerificationStepProps {
  /** Raw evaluation CSV data (headers + rows) */
  evalCSVData: ParsedCSVData;
  /** Parsed registration data for matching */
  regData: ParsedRegistrationData;
  /** Called when verification is complete with exclusions and DNE players */
  onComplete: (result: VerificationResult) => void;
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

interface EvalRowInfo {
  rowIndex: number;
  firstName: string;
  lastName: string;
  bib: string;
  row: Record<string, string>;
}

interface MatchResult {
  evalRowIndex: number;
  regIndex: number | null;
  evalInfo: EvalRowInfo;
  regPlayer: RegistrationCSVRecord | null;
  matchType: 'exact' | 'fuzzy' | 'none';
  matchScore: number;
}

/**
 * Verification step for CSV-based import.
 * Shows matches, unmatched evaluations (to exclude), and unmatched registrations (DNE).
 */
export function CSVVerificationStep({
  evalCSVData,
  regData,
  onComplete,
  onBack,
}: CSVVerificationStepProps) {
  // Extract eval row info (firstName, lastName, bib) from raw CSV
  const evalRows = useMemo(() => {
    const headers = evalCSVData.headers;
    const firstCol = headers.find(h => h.toLowerCase().includes('first')) || '';
    const lastCol = headers.find(h => h.toLowerCase().includes('last')) || '';
    const bibCol = headers.find(h => h.toLowerCase().includes('bib')) || '';

    return evalCSVData.rows.map((row, index): EvalRowInfo => ({
      rowIndex: index,
      firstName: row[firstCol] || '',
      lastName: row[lastCol] || '',
      bib: row[bibCol] || '',
      row,
    }));
  }, [evalCSVData]);

  // Track excluded eval rows and DNE reg players
  const [excludedRowIndices, setExcludedRowIndices] = useState<Set<number>>(new Set());
  const [dneRegIndices, setDneRegIndices] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  // Perform matching
  const matchResults = useMemo(() => {
    const results: MatchResult[] = [];
    const matchedRegIndices = new Set<number>();

    evalRows.forEach((evalInfo) => {
      const evalFullName = `${evalInfo.firstName} ${evalInfo.lastName}`.toLowerCase();

      // Try to find match in registration
      let bestMatch: { regIndex: number; score: number; regPlayer: RegistrationCSVRecord } | null = null;

      for (let regIndex = 0; regIndex < regData.records.length; regIndex++) {
        if (matchedRegIndices.has(regIndex)) continue;

        const regPlayer = regData.records[regIndex];
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
          evalRowIndex: evalInfo.rowIndex,
          regIndex: bestMatch.regIndex,
          evalInfo,
          regPlayer: bestMatch.regPlayer,
          matchType: bestMatch.score === 1 ? 'exact' : 'fuzzy',
          matchScore: bestMatch.score,
        });
      } else {
        results.push({
          evalRowIndex: evalInfo.rowIndex,
          regIndex: null,
          evalInfo,
          regPlayer: null,
          matchType: 'none',
          matchScore: 0,
        });
      }
    });

    return { results, matchedRegIndices };
  }, [evalRows, regData.records]);

  // Unmatched registrations (potential DNE players)
  const unmatchedReg = useMemo(() => {
    return regData.records
      .map((player, index) => ({ player, index }))
      .filter(({ index }) => !matchResults.matchedRegIndices.has(index));
  }, [regData.records, matchResults.matchedRegIndices]);

  // Stats
  const stats = useMemo(() => {
    const matched = matchResults.results.filter(r => r.regIndex !== null).length;
    const unmatched = matchResults.results.filter(r => r.regIndex === null).length;
    const excluded = excludedRowIndices.size;
    const dne = dneRegIndices.size;

    return { matched, unmatched, excluded, dne, unmatchedReg: unmatchedReg.length };
  }, [matchResults, excludedRowIndices, dneRegIndices, unmatchedReg]);

  // Initialize excluded rows for unmatched eval players (on first render)
  useEffect(() => {
    const newExcluded = new Set<number>();
    matchResults.results.forEach(r => {
      if (r.regIndex === null) {
        newExcluded.add(r.evalRowIndex);
      }
    });
    setExcludedRowIndices(newExcluded);
  }, [matchResults.results]);

  const toggleExclude = (rowIndex: number) => {
    setExcludedRowIndices(prev => {
      const next = new Set(prev);
      if (next.has(rowIndex)) {
        next.delete(rowIndex);
      } else {
        next.add(rowIndex);
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
    const dnePlayers = Array.from(dneRegIndices).map(i => regData.records[i]);
    onComplete({
      excludedRowIndices,
      dnePlayers,
    });
  };

  // Filter for search
  const filteredUnmatchedEval = matchResults.results
    .filter(r => r.regIndex === null)
    .filter(r => {
      if (!searchTerm) return true;
      const name = `${r.evalInfo.firstName} ${r.evalInfo.lastName}`.toLowerCase();
      return name.includes(searchTerm.toLowerCase());
    });

  const filteredUnmatchedReg = unmatchedReg.filter(({ player }) => {
    if (!searchTerm) return true;
    const name = `${player.firstName} ${player.lastName}`.toLowerCase();
    return name.includes(searchTerm.toLowerCase());
  });

  const totalPlayersAfterVerification = evalRows.length - excludedRowIndices.size + dneRegIndices.size;

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
            {filteredUnmatchedEval.map(({ evalInfo }) => (
              <div
                key={evalInfo.rowIndex}
                className={`px-4 py-3 flex items-center justify-between ${
                  excludedRowIndices.has(evalInfo.rowIndex)
                    ? 'bg-red-50/30 dark:bg-red-900/10'
                    : 'bg-green-50/30 dark:bg-green-900/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={excludedRowIndices.has(evalInfo.rowIndex)}
                    onChange={() => toggleExclude(evalInfo.rowIndex)}
                    className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                  />
                  <div>
                    <span className={`font-medium ${
                      excludedRowIndices.has(evalInfo.rowIndex)
                        ? 'text-red-700 dark:text-red-400 line-through'
                        : 'text-gray-900 dark:text-white'
                    }`}>
                      {evalInfo.firstName} {evalInfo.lastName}
                    </span>
                    <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                      BIB {evalInfo.bib}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {excludedRowIndices.has(evalInfo.rowIndex) ? (
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
          Continue with {totalPlayersAfterVerification} Players
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
