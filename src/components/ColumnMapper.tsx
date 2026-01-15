import { useState, useEffect } from 'react';
import { ChevronRight, AlertCircle, CheckCircle } from 'lucide-react';
import { ParsedCSVData, ColumnMapping, AppField } from '../types';

interface ColumnMapperProps {
  csvData: ParsedCSVData;
  onMappingComplete: (mapping: ColumnMapping) => void;
}

const REQUIRED_FIELDS: { field: AppField; label: string }[] = [
  { field: 'firstName', label: 'First Name' },
  { field: 'lastName', label: 'Last Name' },
  { field: 'littleLeagueAge', label: 'Little League Age' },
  { field: 'isAllStar', label: 'All-Star' },
  { field: 'isDNE', label: 'DNE (Did Not Evaluate)' },
];

const OPTIONAL_FIELDS: { field: AppField; label: string }[] = [
  { field: 'bib', label: 'Bib Number' },
  { field: 'birthday', label: 'Birthday' },
  // Raw component scores (preferred)
  { field: 'fieldScore', label: 'Field Score' },
  { field: 'throwScore', label: 'Throw Score' },
  { field: 'hitPower', label: 'Hit Power' },
  { field: 'hitForm', label: 'Hit Form' },
  { field: 'hitContact', label: 'Hit Contact' },
  { field: 'pitchingStrength', label: 'Pitching Strength' },
  { field: 'pitchingForm', label: 'Pitching Form' },
  // Pre-calculated subtotals (for validation or legacy data)
  { field: 'fieldingSubtotal', label: 'Fielding Subtotal' },
  { field: 'hittingSubtotal', label: 'Hitting Subtotal' },
  { field: 'pitchingSubtotal', label: 'Pitching Subtotal' },
  // Other scores
  { field: 'catchScore', label: 'Catch Score' },
  { field: 'runningScore', label: 'Running Score' },
  { field: 'officialAdjust', label: 'Official Adjust' },
  // Draft rules
  { field: 'isCoachKid', label: "Coach's Kid" },
  { field: 'sibling', label: 'Sibling' },
  // Team assignments from CSV
  { field: 'teamColumn', label: 'Team (Manager, Assistant)' },
  { field: 'managerTeam', label: 'Manager Team (legacy)' },
  { field: 'assistantTeam', label: 'Assistant Team (legacy)' },
];

export const ColumnMapper = ({ csvData, onMappingComplete }: ColumnMapperProps) => {
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [showOptional, setShowOptional] = useState(false);

  // Auto-suggest mappings based on column names
  useEffect(() => {
    const autoMapping: ColumnMapping = {};

    csvData.headers.forEach((header) => {
      const lowerHeader = header.toLowerCase().trim();

      // Try to match common variations
      if (lowerHeader === 'bib' || lowerHeader.includes('bib number')) {
        autoMapping[header] = 'bib';
      } else if (lowerHeader.includes('first') && lowerHeader.includes('name')) {
        autoMapping[header] = 'firstName';
      } else if (lowerHeader.includes('last') && lowerHeader.includes('name')) {
        autoMapping[header] = 'lastName';
      } else if (lowerHeader.includes('field') && lowerHeader.includes('score')) {
        autoMapping[header] = 'fieldScore';
      } else if (lowerHeader.includes('throw') && lowerHeader.includes('score')) {
        autoMapping[header] = 'throwScore';
      } else if (lowerHeader.includes('hit') && lowerHeader.includes('power')) {
        autoMapping[header] = 'hitPower';
      } else if (lowerHeader.includes('hit') && lowerHeader.includes('form')) {
        autoMapping[header] = 'hitForm';
      } else if (lowerHeader.includes('hit') && lowerHeader.includes('contact')) {
        autoMapping[header] = 'hitContact';
      } else if (lowerHeader.includes('pitching') && lowerHeader.includes('strength')) {
        autoMapping[header] = 'pitchingStrength';
      } else if (lowerHeader.includes('pitching') && lowerHeader.includes('form')) {
        autoMapping[header] = 'pitchingForm';
      } else if (lowerHeader.includes('fielding') && lowerHeader.includes('subtotal')) {
        autoMapping[header] = 'fieldingSubtotal';
      } else if (lowerHeader.includes('hitting') && lowerHeader.includes('subtotal')) {
        autoMapping[header] = 'hittingSubtotal';
      } else if (lowerHeader.includes('pitching') && lowerHeader.includes('subtotal')) {
        autoMapping[header] = 'pitchingSubtotal';
      } else if (lowerHeader.includes('catch')) {
        autoMapping[header] = 'catchScore';
      } else if (lowerHeader.includes('running') || lowerHeader.includes('base')) {
        autoMapping[header] = 'runningScore';
      } else if (lowerHeader.includes('adjust') || lowerHeader.includes('official')) {
        autoMapping[header] = 'officialAdjust';
      } else if (lowerHeader.includes('age')) {
        autoMapping[header] = 'littleLeagueAge';
      } else if (lowerHeader.includes('birthday') || lowerHeader.includes('birth')) {
        autoMapping[header] = 'birthday';
      } else if (lowerHeader.includes('all') && lowerHeader.includes('star')) {
        autoMapping[header] = 'isAllStar';
      } else if (lowerHeader === 'dne') {
        autoMapping[header] = 'isDNE';
      } else if (lowerHeader.includes('coach') && !lowerHeader.includes('manager') && !lowerHeader.includes('assistant')) {
        autoMapping[header] = 'isCoachKid';
      } else if (lowerHeader.includes('sibling')) {
        autoMapping[header] = 'sibling';
      } else if (lowerHeader === 'team') {
        // Exact match for "Team" column - new format
        autoMapping[header] = 'teamColumn';
      } else if (lowerHeader.includes('manager') && lowerHeader.includes('team')) {
        autoMapping[header] = 'managerTeam';
      } else if (lowerHeader.includes('assistant') && lowerHeader.includes('team')) {
        autoMapping[header] = 'assistantTeam';
      }
    });

    setMapping(autoMapping);
  }, [csvData.headers]);

  const handleMappingChange = (csvColumn: string, appField: AppField | '') => {
    setMapping((prev) => ({
      ...prev,
      [csvColumn]: appField === '' ? null : appField,
    }));
  };

  const getReverseMappingForField = (field: AppField): string | null => {
    for (const [csvCol, mappedField] of Object.entries(mapping)) {
      if (mappedField === field) return csvCol;
    }
    return null;
  };

  const isFieldMapped = (field: AppField): boolean => {
    return Object.values(mapping).includes(field);
  };

  const allRequiredFieldsMapped = REQUIRED_FIELDS.every((field) =>
    isFieldMapped(field.field)
  );

  // Check if we have scoring data (either raw scores OR subtotals)
  const hasRawScores =
    isFieldMapped('fieldScore') || isFieldMapped('throwScore') ||
    isFieldMapped('hitPower') || isFieldMapped('hitForm') || isFieldMapped('hitContact') ||
    isFieldMapped('pitchingStrength') || isFieldMapped('pitchingForm');

  const hasSubtotals =
    isFieldMapped('fieldingSubtotal') || isFieldMapped('hittingSubtotal') ||
    isFieldMapped('pitchingSubtotal');

  const hasScoringData = hasRawScores || hasSubtotals;

  const canContinue = allRequiredFieldsMapped && hasScoringData;

  const handleContinue = () => {
    if (!allRequiredFieldsMapped) {
      alert('Please map all required fields before continuing.');
      return;
    }
    if (!hasScoringData) {
      alert('Please map at least one scoring field.\n\nYou need either:\n- Raw component scores (Field Score, Throw Score, Hit Power, etc.)\nOR\n- Pre-calculated subtotals (Fielding Subtotal, Hitting Subtotal, Pitching Subtotal)');
      return;
    }
    onMappingComplete(mapping);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Map CSV Columns
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Match your CSV columns to the expected fields. Required fields are marked with *.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 mb-6">
          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-2">
              {allRequiredFieldsMapped ? (
                <>
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-green-600 dark:text-green-400 font-medium">
                    All required fields mapped
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 text-orange-600" />
                  <span className="text-orange-600 dark:text-orange-400 font-medium">
                    {REQUIRED_FIELDS.filter((f) => !isFieldMapped(f.field)).length} required fields
                    remaining
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              {hasScoringData ? (
                <>
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-green-600 dark:text-green-400 font-medium">
                    Scoring data mapped {hasRawScores ? '(raw scores)' : '(subtotals)'}
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 text-orange-600" />
                  <span className="text-orange-600 dark:text-orange-400 font-medium">
                    No scoring data mapped - need raw scores OR subtotals
                  </span>
                </>
              )}
            </div>
          </div>

          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Required Fields *
          </h2>

          <div className="space-y-3 mb-6">
            {REQUIRED_FIELDS.map(({ field, label }) => {
              const mappedColumn = getReverseMappingForField(field);
              return (
                <div
                  key={field}
                  className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-900 dark:text-white">
                      {label} *
                    </label>
                  </div>
                  <div className="flex-1">
                    {mappedColumn ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">→</span>
                        <span className="text-sm font-mono bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                          {mappedColumn}
                        </span>
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      </div>
                    ) : (
                      <span className="text-sm text-red-600 dark:text-red-400">Not mapped</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={() => setShowOptional(!showOptional)}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-4"
          >
            {showOptional ? 'Hide' : 'Show'} Optional Fields ({OPTIONAL_FIELDS.length})
          </button>

          {showOptional && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Optional Fields
              </h2>
              {OPTIONAL_FIELDS.map(({ field, label }) => {
                const mappedColumn = getReverseMappingForField(field);
                return (
                  <div
                    key={field}
                    className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <div className="flex-1">
                      <label className="text-sm font-medium text-gray-900 dark:text-white">
                        {label}
                      </label>
                    </div>
                    <div className="flex-1">
                      {mappedColumn ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600 dark:text-gray-400">→</span>
                          <span className="text-sm font-mono bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                            {mappedColumn}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500 dark:text-gray-500">
                          Not mapped (optional)
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Your CSV Columns ({csvData.headers.length})
          </h2>
          <div className="space-y-3">
            {csvData.headers.map((header) => (
              <div
                key={header}
                className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <div className="flex-1">
                  <span className="text-sm font-mono text-gray-900 dark:text-white">
                    {header}
                  </span>
                </div>
                <div className="flex-1">
                  <select
                    value={mapping[header] || ''}
                    onChange={(e) => handleMappingChange(header, e.target.value as AppField | '')}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    <option value="">-- Skip this column --</option>
                    <optgroup label="Required Fields">
                      {REQUIRED_FIELDS.map(({ field, label }) => (
                        <option key={field} value={field}>
                          {label}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Optional Fields">
                      {OPTIONAL_FIELDS.map(({ field, label }) => (
                        <option key={field} value={field}>
                          {label}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleContinue}
            disabled={!canContinue}
            className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue to Review
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
