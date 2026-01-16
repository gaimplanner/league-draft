import { useState, useRef } from 'react';
import { RefreshCw, X, Upload, CheckCircle, AlertCircle } from 'lucide-react';
import { Player, ParsedCSVData, ColumnMapping, ScoringMode, ScoringWeights, AppField } from '../types';
import { parseCSVFile, parseCSVWithMapping } from '../utils/csvParser';
import { mergePlayersByBib, getMergeSummary, MergeResult } from '../utils/playerMerge';

interface ReImportButtonProps {
  existingPlayers: Player[];
  teamCount: number;
  scoringMode: ScoringMode;
  scoringWeights: ScoringWeights;
  onMergeComplete: (mergedPlayers: Player[]) => void;
}

export const ReImportButton = ({
  existingPlayers,
  teamCount,
  scoringMode,
  scoringWeights,
  onMergeComplete,
}: ReImportButtonProps) => {
  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mergeResult, setMergeResult] = useState<MergeResult | null>(null);
  const [pendingMerge, setPendingMerge] = useState<Player[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);
    setMergeResult(null);
    setPendingMerge(null);

    try {
      // Parse the CSV file
      const csvData: ParsedCSVData = await parseCSVFile(file);

      if (csvData.rows.length === 0) {
        setError('No data found in CSV');
        setIsLoading(false);
        return;
      }

      // Auto-detect column mapping based on header names
      const mapping = autoDetectMapping(csvData.headers);

      // Parse players from CSV
      const { players: importedPlayers } = parseCSVWithMapping(
        csvData,
        mapping,
        teamCount,
        scoringMode,
        scoringWeights
      );

      // Merge with existing players
      const result = mergePlayersByBib(existingPlayers, importedPlayers);
      setMergeResult(result);
      setPendingMerge(result.merged);
      setIsLoading(false);
    } catch (err) {
      setError('Failed to parse CSV file. Please check the format.');
      setIsLoading(false);
    }

    // Reset file input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleConfirmMerge = () => {
    if (pendingMerge) {
      onMergeComplete(pendingMerge);
      setShowModal(false);
      setMergeResult(null);
      setPendingMerge(null);
    }
  };

  const handleCancel = () => {
    setShowModal(false);
    setMergeResult(null);
    setPendingMerge(null);
    setError(null);
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium flex items-center gap-2 transition-colors text-sm"
        title="Re-import players from CSV"
      >
        <RefreshCw className="w-4 h-4" />
        Re-Import
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Re-Import Players
              </h2>
              <button
                onClick={handleCancel}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4">
              {!mergeResult && !isLoading && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Upload a CSV file to update player scores. Existing coach's kid and sibling
                    assignments will be preserved.
                  </p>

                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-800 dark:text-blue-200">
                    <strong>Note:</strong> Players are matched by their Bib number. Players with
                    matching bib numbers will have their scores updated.
                  </div>

                  <label className="block">
                    <div className="flex items-center justify-center w-full h-32 px-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-colors">
                      <div className="text-center">
                        <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Click to select CSV file
                        </span>
                      </div>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </label>
                </div>
              )}

              {isLoading && (
                <div className="text-center py-8">
                  <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">Processing...</p>
                </div>
              )}

              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-red-800 dark:text-red-200">{error}</p>
                </div>
              )}

              {mergeResult && (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-green-800 dark:text-green-200">
                        Ready to merge
                      </p>
                      <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                        {getMergeSummary(mergeResult)}
                      </p>
                    </div>
                  </div>

                  {mergeResult.newPlayers.length > 0 && (
                    <div className="text-sm">
                      <p className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                        New players to add:
                      </p>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {mergeResult.newPlayers.map(p => (
                          <div key={p.id} className="text-gray-600 dark:text-gray-400">
                            {p.name} (Bib: {p.bib || 'N/A'})
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium"
              >
                Cancel
              </button>
              {mergeResult && (
                <button
                  onClick={handleConfirmMerge}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Apply Changes
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

/**
 * Auto-detect column mapping based on common header names
 */
function autoDetectMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const headerLower = headers.map(h => h.toLowerCase().trim());

  const mappings: Record<string, string[]> = {
    bib: ['bib', 'bib number', 'bib#', 'number'],
    firstName: ['first name', 'firstname', 'first'],
    lastName: ['last name', 'lastname', 'last'],
    fieldingSubtotal: ['fielding subtotal', 'fielding', 'field'],
    hittingSubtotal: ['hitting subtotal', 'hitting', 'hit'],
    pitchingSubtotal: ['pitching subtotal', 'pitching', 'pitch'],
    catchScore: ['catch score', 'catch', 'catching'],
    runningScore: ['running score', 'running', 'run'],
    officialAdjust: ['official adjust', 'official adjustment', 'adjust'],
    littleLeagueAge: ['little league age', 'age', 'll age'],
    birthday: ['birthday', 'birthdate', 'birth date', 'dob'],
    isAllStar: ['all-star', 'allstar', 'all star'],
    isDNE: ['dne', 'did not evaluate'],
    isCoachKid: ['coach kid', 'coach\'s kid', 'coach'],
    sibling: ['sibling', 'siblings'],
  };

  for (const [field, patterns] of Object.entries(mappings)) {
    for (let i = 0; i < headers.length; i++) {
      if (patterns.some(p => headerLower[i].includes(p))) {
        mapping[headers[i]] = field as AppField;
        break;
      }
    }
  }

  return mapping;
}
