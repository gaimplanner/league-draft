import { useState, useEffect, useMemo } from 'react';
import { ChevronRight, GripVertical, X, Check, AlertTriangle } from 'lucide-react';
import { ParsedCSVData, ColumnMapping, AppField } from '../types';
import { parseCSVWithMapping } from '../utils/csvParser';

interface VisualColumnMapperProps {
  csvData: ParsedCSVData;
  onMappingComplete: (mapping: ColumnMapping) => void;
  teamCount?: number;
}

// Target field definitions grouped by category
const TARGET_FIELD_GROUPS: {
  name: string;
  description: string;
  fields: { field: AppField; label: string; required?: boolean }[];
}[] = [
  {
    name: 'Identity',
    description: 'Required player identification',
    fields: [
      { field: 'bib', label: 'Bib #', required: true },
      { field: 'firstName', label: 'First Name', required: true },
      { field: 'lastName', label: 'Last Name', required: true },
    ],
  },
  {
    name: 'Overall Score',
    description: 'Total/overall player score',
    fields: [
      { field: 'totalScore', label: 'Total Score', required: true },
    ],
  },
  {
    name: 'Player Info',
    description: 'Optional player details',
    fields: [
      { field: 'littleLeagueAge', label: 'Age' },
      { field: 'birthday', label: 'Birthday' },
      { field: 'isAllStar', label: 'All-Star' },
      { field: 'isDNE', label: 'DNE' },
    ],
  },
  {
    name: 'Fielding & Throwing',
    description: 'Raw evaluation scores',
    fields: [
      { field: 'fieldScore', label: 'Field Score' },
      { field: 'throwScore', label: 'Throw Score' },
      { field: 'fieldingSubtotal', label: 'Fielding Subtotal' },
    ],
  },
  {
    name: 'Hitting',
    description: 'Raw evaluation scores',
    fields: [
      { field: 'hitPower', label: 'Hit Power' },
      { field: 'hitForm', label: 'Hit Form' },
      { field: 'hitContact', label: 'Hit Contact' },
      { field: 'hittingSubtotal', label: 'Hitting Subtotal' },
    ],
  },
  {
    name: 'Pitching',
    description: 'Raw evaluation scores',
    fields: [
      { field: 'pitchingStrength', label: 'Pitch Strength' },
      { field: 'pitchingForm', label: 'Pitch Form' },
      { field: 'pitchingSubtotal', label: 'Pitching Subtotal' },
    ],
  },
  {
    name: 'Other Scores',
    description: 'Additional evaluation scores',
    fields: [
      { field: 'catchScore', label: 'Catch' },
      { field: 'runningScore', label: 'Running' },
      { field: 'officialAdjust', label: 'Adjustment' },
    ],
  },
  {
    name: 'Draft Rules',
    description: 'Coach assignments and siblings',
    fields: [
      { field: 'isCoachKid', label: "Coach's Kid" },
      { field: 'sibling', label: 'Sibling' },
      { field: 'teamColumn', label: 'Team' },
    ],
  },
];

// Columns that look like calculated fields (should default to skip)
const CALCULATED_PATTERNS = [
  'subtotal', 'sub total', 'sub-total',
  'total score', 'totalscore', 'total points',
  'overall', 'sum', 'calculated', 'final'
];

function looksCalculated(header: string): boolean {
  const lower = header.toLowerCase();
  return CALCULATED_PATTERNS.some(pattern => lower.includes(pattern));
}

// Auto-suggest mapping for a header
function suggestMapping(header: string): AppField | null {
  const lower = header.toLowerCase().trim();

  // Identity
  if (lower === 'bib' || lower.includes('bib') || lower === '#') return 'bib';
  if (lower.includes('first') && lower.includes('name')) return 'firstName';
  if (lower === 'first' || lower === 'firstname') return 'firstName';
  if (lower.includes('last') && lower.includes('name')) return 'lastName';
  if (lower === 'last' || lower === 'lastname') return 'lastName';

  // Total Score
  if (
    lower === 'total' || lower === 'total score' || lower === 'overall' ||
    lower === 'overall score' || lower === 'score' || lower === 'points' ||
    lower === 'total points' ||
    (lower.includes('total') && (lower.includes('score') || lower.includes('point'))) ||
    (lower.includes('overall') && (lower.includes('score') || lower.includes('point')))
  ) return 'totalScore';

  // Player Info
  if (lower.includes('age') || lower === 'll age' || lower.includes('league age')) return 'littleLeagueAge';
  if (lower.includes('birthday') || lower.includes('birth') || lower.includes('dob') || lower === 'birthdate') return 'birthday';
  if (lower.includes('all') && lower.includes('star')) return 'isAllStar';
  if (lower === 'allstar' || lower === 'all-star') return 'isAllStar';
  if (lower === 'dne' || lower.includes('did not') || lower.includes('not evaluate') || lower.includes('no eval')) return 'isDNE';

  // Fielding & Throwing
  if (lower.includes('field') && lower.includes('score') && !lower.includes('subtotal')) return 'fieldScore';
  if (lower.includes('throw') && lower.includes('score')) return 'throwScore';
  if (lower.includes('field') && lower.includes('subtotal')) return 'fieldingSubtotal';

  // Hitting
  if (lower.includes('hit') && lower.includes('power')) return 'hitPower';
  if (lower.includes('hit') && lower.includes('form')) return 'hitForm';
  if (lower.includes('hit') && lower.includes('contact')) return 'hitContact';
  if (lower.includes('hit') && lower.includes('subtotal')) return 'hittingSubtotal';

  // Pitching
  if (lower.includes('pitch') && (lower.includes('strength') || lower.includes('str'))) return 'pitchingStrength';
  if (lower.includes('pitch') && lower.includes('form')) return 'pitchingForm';
  if (lower.includes('pitch') && lower.includes('subtotal')) return 'pitchingSubtotal';

  // Other Scores
  if (lower.includes('catch') && !lower.includes('catcher')) return 'catchScore';
  if (lower.includes('running') || lower.includes('run score') || lower.includes('base')) return 'runningScore';
  if (lower.includes('adjust') || lower.includes('official') || lower.includes('bonus')) return 'officialAdjust';

  // Draft Rules
  if ((lower.includes('coach') && !lower.includes('manager') && !lower.includes('assistant')) ||
      lower === 'coaches kid' || lower === 'coach kid' || lower === 'coachkid') return 'isCoachKid';
  if (lower.includes('sibling') || lower.includes('brother') || lower.includes('sister')) return 'sibling';
  if (lower === 'team' || lower === 'teams') return 'teamColumn';

  return null;
}

export const VisualColumnMapper = ({
  csvData,
  onMappingComplete,
  teamCount = 8,
}: VisualColumnMapperProps) => {
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);

  // Initialize with auto-suggested mappings
  useEffect(() => {
    const autoMapping: ColumnMapping = {};
    csvData.headers.forEach((header) => {
      const suggested = suggestMapping(header);
      if (suggested) {
        autoMapping[header] = suggested;
      }
    });
    setMapping(autoMapping);
  }, [csvData.headers]);

  // Get sample rows (first 5)
  const sampleRows = useMemo(() => csvData.rows.slice(0, 5), [csvData.rows]);

  // Calculate preview data using the current mapping
  const previewData = useMemo(() => {
    if (Object.keys(mapping).length === 0) return null;
    try {
      const result = parseCSVWithMapping(
        { headers: csvData.headers, rows: sampleRows },
        mapping,
        teamCount
      );
      return result.players;
    } catch {
      return null;
    }
  }, [mapping, csvData.headers, sampleRows, teamCount]);

  // Get mapped and unmapped columns
  const mappedColumns = useMemo(() => {
    return csvData.headers.filter(h => mapping[h]);
  }, [csvData.headers, mapping]);

  const unmappedColumns = useMemo(() => {
    return csvData.headers.filter(h => !mapping[h]);
  }, [csvData.headers, mapping]);

  // Check if required fields are mapped
  const requiredFields: AppField[] = ['bib', 'firstName', 'lastName', 'totalScore'];
  const missingRequired = requiredFields.filter(
    field => !Object.values(mapping).includes(field)
  );

  // Get the column mapped to a specific field
  const getColumnForField = (field: AppField): string | null => {
    return Object.keys(mapping).find(col => mapping[col] === field) || null;
  };

  // Handle drag start
  const handleDragStart = (column: string) => {
    setDraggedColumn(column);
  };

  // Handle drop on a field slot
  const handleDrop = (field: AppField) => {
    if (!draggedColumn) return;

    setMapping(prev => {
      const newMapping = { ...prev };

      // Remove any existing mapping to this field
      Object.keys(newMapping).forEach(col => {
        if (newMapping[col] === field) {
          delete newMapping[col];
        }
      });

      // Remove previous mapping for this column
      delete newMapping[draggedColumn];

      // Add new mapping
      newMapping[draggedColumn] = field;

      return newMapping;
    });
    setDraggedColumn(null);
  };

  // Handle removing a mapping
  const handleRemoveMapping = (column: string) => {
    setMapping(prev => {
      const newMapping = { ...prev };
      delete newMapping[column];
      return newMapping;
    });
  };

  const canContinue = missingRequired.length === 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Map Your Data
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Drag columns from your CSV to the target fields, or click to assign. Preview updates live.
          </p>
        </div>

        {/* Status Bar */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {canContinue ? (
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <Check className="w-5 h-5" />
                  <span className="font-medium">Ready to import</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="font-medium">
                    Missing: {missingRequired.map(f => {
                      const group = TARGET_FIELD_GROUPS.find(g => g.fields.some(ff => ff.field === f));
                      const field = group?.fields.find(ff => ff.field === f);
                      return field?.label || f;
                    }).join(', ')}
                  </span>
                </div>
              )}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {mappedColumns.length} of {csvData.headers.length} columns mapped
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Source CSV Data */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="bg-gray-100 dark:bg-gray-700 px-4 py-2 border-b border-gray-200 dark:border-gray-600">
                <h2 className="font-semibold text-gray-900 dark:text-white">
                  Your CSV Columns
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Drag to target fields or click column then click target
                </p>
              </div>

              {/* CSV Preview Table */}
              <div className="overflow-x-auto max-h-64">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-750 sticky top-0">
                    <tr>
                      {csvData.headers.map((header) => {
                        const isMapped = !!mapping[header];
                        const isCalculated = looksCalculated(header);
                        return (
                          <th
                            key={header}
                            draggable
                            onDragStart={() => handleDragStart(header)}
                            className={`
                              px-4 py-3 text-left text-sm font-semibold cursor-grab active:cursor-grabbing
                              border-b-2 whitespace-nowrap
                              ${isMapped
                                ? 'bg-blue-100 dark:bg-blue-800 text-blue-900 dark:text-white border-blue-300 dark:border-blue-600'
                                : isCalculated
                                ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200 border-yellow-300 dark:border-yellow-700'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
                              }
                            `}
                          >
                            <div className="flex items-center gap-2">
                              <GripVertical className="w-4 h-4 opacity-60" />
                              <span className="truncate max-w-32">{header}</span>
                              {isMapped && <Check className="w-4 h-4 text-blue-600 dark:text-blue-300" />}
                              {isCalculated && !isMapped && (
                                <span title="Looks like a calculated field">
                                  <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                                </span>
                              )}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {sampleRows.map((row, rowIdx) => (
                      <tr key={rowIdx} className={`border-b border-gray-200 dark:border-gray-700 ${rowIdx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-850'}`}>
                        {csvData.headers.map((header) => (
                          <td
                            key={header}
                            className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap truncate max-w-40"
                          >
                            {row[header] || '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Unmapped Columns */}
            {unmappedColumns.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                  Unmapped Columns ({unmappedColumns.length})
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  These columns will be skipped. Drag to a target field to include them.
                </p>
                <div className="flex flex-wrap gap-2">
                  {unmappedColumns.map((col) => {
                    const isCalculated = looksCalculated(col);
                    return (
                      <div
                        key={col}
                        draggable
                        onDragStart={() => handleDragStart(col)}
                        className={`
                          px-3 py-1.5 rounded-full text-sm cursor-grab active:cursor-grabbing
                          flex items-center gap-1
                          ${isCalculated
                            ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 border border-yellow-300 dark:border-yellow-700'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600'
                          }
                        `}
                      >
                        <GripVertical className="w-3 h-3 opacity-50" />
                        {col}
                        {isCalculated && (
                          <span title="Looks calculated - usually skip">
                            <AlertTriangle className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right: Target Fields & Preview */}
          <div className="space-y-4">
            {/* Target Field Groups */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="bg-gray-100 dark:bg-gray-700 px-4 py-2 border-b border-gray-200 dark:border-gray-600">
                <h2 className="font-semibold text-gray-900 dark:text-white">
                  Target Fields
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Drop columns here to map them
                </p>
              </div>

              <div className="p-4 space-y-4 max-h-80 overflow-y-auto">
                {TARGET_FIELD_GROUPS.map((group) => (
                  <div key={group.name}>
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                      {group.name}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {group.fields.map(({ field, label, required }) => {
                        const mappedColumn = getColumnForField(field);
                        return (
                          <div
                            key={field}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => handleDrop(field)}
                            className={`
                              min-w-24 px-3 py-2 rounded-lg border-2 border-dashed transition-all
                              ${mappedColumn
                                ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                                : required
                                ? 'border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/10'
                                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                              }
                              ${draggedColumn ? 'hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30' : ''}
                            `}
                          >
                            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                              {label}
                              {required && <span className="text-red-500 ml-1">*</span>}
                            </div>
                            {mappedColumn ? (
                              <div className="flex items-center gap-1">
                                <span className="text-sm font-medium text-blue-700 dark:text-blue-300 truncate">
                                  {mappedColumn}
                                </span>
                                <button
                                  onClick={() => handleRemoveMapping(mappedColumn)}
                                  className="text-gray-400 hover:text-red-500"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <div className="text-sm text-gray-400 dark:text-gray-500 italic">
                                Drop here
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Live Preview */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="bg-green-100 dark:bg-green-900/30 px-4 py-2 border-b border-gray-200 dark:border-gray-600">
                <h2 className="font-semibold text-green-800 dark:text-green-200">
                  Live Preview
                </h2>
                <p className="text-xs text-green-600 dark:text-green-400">
                  How your data will look after import
                </p>
              </div>

              <div className="overflow-x-auto max-h-48">
                {previewData && previewData.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-750 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600">
                          Bib
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600">
                          Name
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600">
                          Age
                        </th>
                        <th className="px-3 py-2 text-right font-medium text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600">
                          Total
                        </th>
                        <th className="px-3 py-2 text-center font-medium text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600">
                          Rank
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.map((player, idx) => (
                        <tr key={idx} className="border-b border-gray-100 dark:border-gray-700">
                          <td className="px-3 py-1.5 text-gray-600 dark:text-gray-400">
                            {player.bib}
                          </td>
                          <td className="px-3 py-1.5 text-gray-900 dark:text-white font-medium">
                            {player.name}
                          </td>
                          <td className="px-3 py-1.5 text-gray-600 dark:text-gray-400">
                            {player.littleLeagueAge || '-'}
                          </td>
                          <td className="px-3 py-1.5 text-right font-bold text-gray-900 dark:text-white">
                            {player.totalScore.toFixed(1)}
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-bold">
                              {player.rank}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                    Map required fields to see preview
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Continue Button */}
        <div className="flex justify-end mt-6">
          <button
            onClick={() => onMappingComplete(mapping)}
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
