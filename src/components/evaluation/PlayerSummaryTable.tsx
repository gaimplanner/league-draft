import { useState, useCallback } from 'react';
import { Search, X, AlertTriangle, ChevronDown, ChevronUp, RotateCcw, Users, UserCheck } from 'lucide-react';
import { EvaluationPlayer, FieldWeight, EvaluationCategory, getCategoryDisplayName } from '../../types/evaluation';
import { getFieldScore } from '../../utils/evaluationProcessor';

interface PlayerSummaryTableProps {
  players: EvaluationPlayer[];
  fieldWeights: FieldWeight[];
  totalWeight: number;
  teamCount: number;
  teamNames: string[];
  onAdjustChange: (bib: string, adjustment: number) => void;
  onWeightChange: (fieldId: string, weight: number) => void;
  onToggleField: (fieldId: string, enabled: boolean) => void;
  onResetWeights: () => void;
  onTeamCountChange: (count: number) => void;
  onTeamNameChange: (index: number, name: string) => void;
  onToggleCoachKid: (bib: string, isCoachKid: boolean, teamIndex: number | null) => void;
  onSetCoachKidTeam: (bib: string, teamIndex: number | null) => void;
  onAutoDetectCoachKids: () => void;
  onAutoDetectSiblings: () => void;
  onClearCoachKids: () => void;
  onClearSiblings: () => void;
}

// Field definitions for table columns
const FIELD_COLUMNS: { fieldId: string; shortName: string; category: EvaluationCategory }[] = [
  { fieldId: 'pitchingForm', shortName: 'Form', category: 'pitching' },
  { fieldId: 'armStrength', shortName: 'Arm', category: 'pitching' },
  { fieldId: 'hittingForm', shortName: 'Form', category: 'hitting' },
  { fieldId: 'contactPower', shortName: 'Pwr', category: 'hitting' },
  { fieldId: 'hits', shortName: 'Hits', category: 'hitting' },
  { fieldId: 'field', shortName: 'Fld', category: 'fielding' },
  { fieldId: 'throw', shortName: 'Thr', category: 'fielding' },
  { fieldId: 'catches', shortName: 'Cat', category: 'flyBalls' },
  { fieldId: 'flyBallForm', shortName: 'Form', category: 'flyBalls' },
  { fieldId: 'bestTime', shortName: 'Time', category: 'baserunning' },
  { fieldId: 'baserunningForm', shortName: 'Form', category: 'baserunning' },
];

// Category grouping for headers
const CATEGORY_GROUPS: { category: EvaluationCategory; shortName: string; colSpan: number }[] = [
  { category: 'pitching', shortName: 'PITCH', colSpan: 2 },
  { category: 'hitting', shortName: 'HIT', colSpan: 3 },
  { category: 'fielding', shortName: 'FIELD', colSpan: 2 },
  { category: 'flyBalls', shortName: 'FLY', colSpan: 2 },
  { category: 'baserunning', shortName: 'RUN', colSpan: 2 },
];

type SortField = 'rank' | 'proj' | 'bib' | 'name' | 'age' | 'coach' | 'sibling' | 'adjust' | 'total' | string;
type SortDirection = 'asc' | 'desc';

export function PlayerSummaryTable({
  players,
  fieldWeights,
  totalWeight,
  teamCount,
  teamNames,
  onAdjustChange,
  onWeightChange,
  onToggleField,
  onResetWeights,
  onTeamCountChange,
  onTeamNameChange,
  onToggleCoachKid,
  // onSetCoachKidTeam is available via props but not used directly in this component
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onSetCoachKidTeam: _onSetCoachKidTeam,
  onAutoDetectCoachKids,
  onAutoDetectSiblings,
  onClearCoachKids,
  onClearSiblings,
}: PlayerSummaryTableProps) {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('rank');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [weightsExpanded, setWeightsExpanded] = useState(false);
  const [teamsExpanded, setTeamsExpanded] = useState(false);

  // Get weight for a field
  const getWeight = useCallback((fieldId: string) => {
    const fw = fieldWeights.find(w => w.fieldId === fieldId);
    return fw?.enabled ? fw.weight : 0;
  }, [fieldWeights]);

  // Get category total weight
  const getCategoryWeight = useCallback((category: EvaluationCategory) => {
    return fieldWeights
      .filter(w => w.category === category && w.enabled)
      .reduce((sum, w) => sum + w.weight, 0);
  }, [fieldWeights]);

  // Filter players
  const filteredPlayers = players.filter((player) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      player.bib.toLowerCase().includes(searchLower) ||
      player.fullName.toLowerCase().includes(searchLower) ||
      player.firstName.toLowerCase().includes(searchLower) ||
      player.lastName.toLowerCase().includes(searchLower)
    );
  });

  // Sort players
  const sortedPlayers = [...filteredPlayers].sort((a, b) => {
    let aVal: number | string = 0;
    let bVal: number | string = 0;

    switch (sortField) {
      case 'rank':
        aVal = a.rank;
        bVal = b.rank;
        break;
      case 'proj':
        aVal = a.projectedRound;
        bVal = b.projectedRound;
        break;
      case 'bib':
        aVal = parseInt(a.bib) || 0;
        bVal = parseInt(b.bib) || 0;
        break;
      case 'name':
        aVal = `${a.lastName}, ${a.firstName}`;
        bVal = `${b.lastName}, ${b.firstName}`;
        break;
      case 'age':
        aVal = a.age;
        bVal = b.age;
        break;
      case 'coach':
        aVal = a.isCoachKid ? 1 : 0;
        bVal = b.isCoachKid ? 1 : 0;
        break;
      case 'sibling':
        aVal = a.siblingGroupId || 'zzz';
        bVal = b.siblingGroupId || 'zzz';
        break;
      case 'adjust':
        aVal = a.manualAdjust;
        bVal = b.manualAdjust;
        break;
      case 'total':
        aVal = a.weightedTotal;
        bVal = b.weightedTotal;
        break;
      default:
        // Field scores
        aVal = getFieldScore(a, sortField) ?? 0;
        bVal = getFieldScore(b, sortField) ?? 0;
    }

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDirection === 'asc'
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }

    return sortDirection === 'asc'
      ? (aVal as number) - (bVal as number)
      : (bVal as number) - (aVal as number);
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'rank' ? 'asc' : 'desc');
    }
  };

  const SortIndicator = ({ field }: { field: SortField }) => (
    sortField === field ? (
      <span className="text-green-500 ml-0.5">{sortDirection === 'asc' ? '↑' : '↓'}</span>
    ) : null
  );

  const isWeightsValid = totalWeight === 100;

  // Count coach's kids and siblings
  const coachKidCount = players.filter(p => p.isCoachKid).length;
  const siblingCount = players.filter(p => p.siblingGroupId).length;

  return (
    <div className="space-y-4">
      {/* Team Configuration Panel */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <button
          onClick={() => setTeamsExpanded(!teamsExpanded)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <div className="flex items-center gap-4">
            <span className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
              {teamsExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              Teams & Detection
            </span>
            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
              <span>{teamCount} teams</span>
              {coachKidCount > 0 && (
                <span className="text-blue-600 dark:text-blue-400">🔵 {coachKidCount} coach kids</span>
              )}
              {siblingCount > 0 && (
                <span className="text-green-600 dark:text-green-400">🟢 {siblingCount} siblings</span>
              )}
            </div>
          </div>
        </button>

        {teamsExpanded && (
          <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700">
            <div className="mt-4 space-y-4">
              {/* Team Count */}
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Number of Teams:
                </label>
                <input
                  type="number"
                  value={teamCount}
                  onChange={(e) => onTeamCountChange(parseInt(e.target.value) || 8)}
                  min={1}
                  max={20}
                  className="w-20 px-2 py-1 text-center border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Team Names Grid */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  Team Names (enter coach last names for auto-detection):
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {teamNames.map((name, index) => (
                    <input
                      key={index}
                      type="text"
                      value={name}
                      onChange={(e) => onTeamNameChange(index, e.target.value)}
                      placeholder={`Team ${index + 1}`}
                      className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                    />
                  ))}
                </div>
              </div>

              {/* Detection Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={onAutoDetectCoachKids}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50"
                >
                  <UserCheck className="w-4 h-4" />
                  Find Coach Kids
                </button>
                <button
                  onClick={onAutoDetectSiblings}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50"
                >
                  <Users className="w-4 h-4" />
                  Find Siblings
                </button>
                {(coachKidCount > 0 || siblingCount > 0) && (
                  <>
                    <div className="h-4 border-l border-gray-300 dark:border-gray-600" />
                    {coachKidCount > 0 && (
                      <button
                        onClick={onClearCoachKids}
                        className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                      >
                        Clear Coach Kids
                      </button>
                    )}
                    {siblingCount > 0 && (
                      <button
                        onClick={onClearSiblings}
                        className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                      >
                        Clear Siblings
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Collapsible Weight Panel */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Collapsed Header */}
        <button
          onClick={() => setWeightsExpanded(!weightsExpanded)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <div className="flex items-center gap-4">
            <span className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
              {weightsExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              Weights
            </span>
            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
              {CATEGORY_GROUPS.map(({ category, shortName }) => (
                <span key={category}>
                  {shortName} {getCategoryWeight(category)}%
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${isWeightsValid ? 'text-green-600' : 'text-red-600'}`}>
              Total: {totalWeight}%
            </span>
            {!isWeightsValid && (
              <span className="text-xs text-red-500">(must be 100%)</span>
            )}
          </div>
        </button>

        {/* Expanded Weight Sliders */}
        {weightsExpanded && (
          <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-5 gap-4 mt-4">
              {CATEGORY_GROUPS.map(({ category }) => {
                const categoryFields = fieldWeights.filter(w => w.category === category);
                return (
                  <div key={category} className="space-y-2">
                    <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
                      {getCategoryDisplayName(category)}
                    </h4>
                    {categoryFields.map(field => (
                      <div key={field.fieldId} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={field.enabled}
                          onChange={(e) => onToggleField(field.fieldId, e.target.checked)}
                          className="w-3 h-3 rounded border-gray-300 text-green-500 focus:ring-green-500"
                        />
                        <label className={`text-xs flex-1 ${field.enabled ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400'}`}>
                          {field.displayName.replace(getCategoryDisplayName(category) + ' ', '').replace('# ', '')}
                        </label>
                        <input
                          type="number"
                          value={field.weight}
                          onChange={(e) => onWeightChange(field.fieldId, Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                          disabled={!field.enabled}
                          className="w-12 px-1 py-0.5 text-xs text-right border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 disabled:opacity-50"
                        />
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex justify-end">
              <button
                onClick={onResetWeights}
                className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Search and Count */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or BIB..."
            className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2"
            >
              <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>
        <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
          {sortedPlayers.length} of {players.length} players
        </span>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              {/* Category Header Row */}
              <tr className="bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                <th rowSpan={2} className="sticky left-0 z-20 bg-gray-100 dark:bg-gray-700 px-2 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 w-12" onClick={() => handleSort('rank')}>
                  Rank<SortIndicator field="rank" />
                </th>
                <th rowSpan={2} className="sticky left-12 z-20 bg-gray-100 dark:bg-gray-700 px-2 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 w-10" onClick={() => handleSort('proj')}>
                  Proj<SortIndicator field="proj" />
                </th>
                <th rowSpan={2} className="sticky left-[88px] z-20 bg-gray-100 dark:bg-gray-700 px-2 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 w-12" onClick={() => handleSort('bib')}>
                  BIB<SortIndicator field="bib" />
                </th>
                <th rowSpan={2} className="sticky left-[136px] z-20 bg-gray-100 dark:bg-gray-700 px-2 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 min-w-[120px]" onClick={() => handleSort('name')}>
                  Name<SortIndicator field="name" />
                </th>
                <th rowSpan={2} className="px-2 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 w-10" onClick={() => handleSort('age')}>
                  Age<SortIndicator field="age" />
                </th>
                <th rowSpan={2} className="px-1 py-2 text-center text-xs font-semibold text-blue-600 dark:text-blue-400 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 w-10" onClick={() => handleSort('coach')}>
                  🔵<SortIndicator field="coach" />
                </th>
                <th rowSpan={2} className="px-1 py-2 text-center text-xs font-semibold text-green-600 dark:text-green-400 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 w-10" onClick={() => handleSort('sibling')}>
                  🟢<SortIndicator field="sibling" />
                </th>
                {CATEGORY_GROUPS.map(({ category, shortName, colSpan }) => (
                  <th
                    key={category}
                    colSpan={colSpan}
                    className="px-1 py-1 text-center text-xs font-semibold text-gray-700 dark:text-gray-200 border-l border-gray-300 dark:border-gray-600"
                  >
                    {shortName}
                    <span className="ml-1 text-gray-500 font-normal">({getCategoryWeight(category)}%)</span>
                  </th>
                ))}
                <th rowSpan={2} className="px-2 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 w-16 border-l border-gray-300 dark:border-gray-600" onClick={() => handleSort('adjust')}>
                  Adj<SortIndicator field="adjust" />
                </th>
                <th rowSpan={2} className="sticky right-0 z-20 bg-gray-100 dark:bg-gray-700 px-2 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 w-14 border-l border-gray-300 dark:border-gray-600" onClick={() => handleSort('total')}>
                  Total<SortIndicator field="total" />
                </th>
              </tr>
              {/* Field Header Row */}
              <tr className="bg-gray-50 dark:bg-gray-750 border-b border-gray-200 dark:border-gray-600">
                {FIELD_COLUMNS.map((col, idx) => {
                  const weight = getWeight(col.fieldId);
                  const isFirstInGroup = idx === 0 || FIELD_COLUMNS[idx - 1].category !== col.category;
                  return (
                    <th
                      key={col.fieldId}
                      onClick={() => handleSort(col.fieldId)}
                      className={`px-1 py-1 text-center text-xs font-medium text-gray-500 dark:text-gray-400 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 w-11 ${isFirstInGroup ? 'border-l border-gray-300 dark:border-gray-600' : ''}`}
                    >
                      <div className="leading-tight">
                        {col.shortName}<SortIndicator field={col.fieldId} />
                        <br />
                        <span className="text-[10px] text-gray-400">({weight}%)</span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {sortedPlayers.map((player) => (
                <tr
                  key={player.bib}
                  className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${
                    player.isCoachKid ? 'bg-blue-50 dark:bg-blue-900/10' : ''
                  } ${
                    player.siblingGroupId && !player.isCoachKid ? 'bg-green-50 dark:bg-green-900/10' : ''
                  }`}
                >
                  <td className="sticky left-0 z-10 bg-inherit px-2 py-1.5 text-gray-900 dark:text-white font-medium text-center">
                    {player.rank}
                  </td>
                  <td className="sticky left-12 z-10 bg-inherit px-2 py-1.5 text-gray-500 dark:text-gray-400 text-center text-xs">
                    R{player.projectedRound}
                  </td>
                  <td className="sticky left-[88px] z-10 bg-inherit px-2 py-1.5 text-gray-900 dark:text-white font-mono text-center">
                    {player.bib}
                  </td>
                  <td className="sticky left-[136px] z-10 bg-inherit px-2 py-1.5 text-gray-900 dark:text-white">
                    <div className="flex items-center gap-1">
                      <span className="truncate">{player.lastName}, {player.firstName}</span>
                      {player.isPartial && (
                        <span title="Incomplete data">
                          <AlertTriangle className="w-3 h-3 text-yellow-500 flex-shrink-0" />
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-gray-600 dark:text-gray-400 text-center">
                    {player.age || '-'}
                  </td>
                  {/* Coach's Kid */}
                  <td className="px-1 py-1 text-center">
                    <input
                      type="checkbox"
                      checked={player.isCoachKid}
                      onChange={(e) => onToggleCoachKid(player.bib, e.target.checked, null)}
                      className="w-3.5 h-3.5 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                    />
                  </td>
                  {/* Sibling Group */}
                  <td className="px-1 py-1 text-center">
                    {player.siblingGroupId ? (
                      <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 rounded-full">
                        {player.siblingGroupId}
                      </span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  {FIELD_COLUMNS.map((col, idx) => {
                    const score = getFieldScore(player, col.fieldId);
                    const isFirstInGroup = idx === 0 || FIELD_COLUMNS[idx - 1].category !== col.category;
                    return (
                      <td
                        key={col.fieldId}
                        className={`px-1 py-1.5 text-center tabular-nums ${isFirstInGroup ? 'border-l border-gray-200 dark:border-gray-700' : ''} ${
                          score === null
                            ? 'text-gray-300 dark:text-gray-600'
                            : 'text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {score !== null ? Math.round(score) : '-'}
                      </td>
                    );
                  })}
                  <td className="px-1 py-1 text-center border-l border-gray-200 dark:border-gray-700">
                    <input
                      type="number"
                      value={player.manualAdjust}
                      onChange={(e) => onAdjustChange(player.bib, parseInt(e.target.value) || 0)}
                      className={`w-12 px-1 py-0.5 text-center text-sm border rounded bg-white dark:bg-gray-700 ${
                        player.manualAdjust !== 0
                          ? 'border-green-400 text-green-700 dark:text-green-400 font-medium'
                          : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                      }`}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td className="sticky right-0 z-10 bg-inherit px-2 py-1.5 text-gray-900 dark:text-white font-bold text-center border-l border-gray-200 dark:border-gray-700">
                    {player.weightedTotal.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Hint */}
      <p className="text-xs text-gray-500 dark:text-gray-500 text-center">
        🔵 = Coach's Kid &nbsp; 🟢 = Sibling Group &nbsp; Click headers to sort. Edit Adj column to add/subtract points.
      </p>
    </div>
  );
}
