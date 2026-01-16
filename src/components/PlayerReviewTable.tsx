import { useState, useCallback } from 'react';
import { Search, X, ChevronDown, ChevronUp, Users, Wand2 } from 'lucide-react';
import { Player, Team, ScoringMode, ScoringWeights } from '../types';
import { getTeamDisplayName } from '../utils/teamUtils';
import { ScoringWeightsConfig } from './ScoringWeightsConfig';

interface PlayerReviewTableProps {
  players: Player[];
  teams: Team[];
  scoringMode: ScoringMode;
  weights: ScoringWeights;
  weightsValidation: { isValid: boolean; total: number };
  onScoringModeChange: (mode: ScoringMode) => void;
  onUpdateWeight: (category: keyof ScoringWeights, field: string, value: number) => void;
  onResetWeights: () => void;
  onUpdatePlayer: (playerId: string, field: keyof Pick<Player, 'fieldingSubtotal' | 'hittingSubtotal' | 'pitchingSubtotal' | 'catchScore' | 'runningScore' | 'officialAdjust'>, value: number) => void;
  onCoachKidToggle: (playerId: string, isCoachKid: boolean) => void;
  onCoachTeamAssignment: (playerId: string, teamId: string) => void;
  onSiblingLink: (playerId: string, siblingId: string) => void;
  onSiblingUnlink: (playerId: string) => void;
  onTeamNameUpdate: (teamId: string, name: string) => void;
  onAssistantCoachesUpdate: (teamId: string, assistantCoaches: string) => void;
  onRunAutoDetection: () => void;
}

type SortField = 'rank' | 'proj' | 'bib' | 'name' | 'age' | 'allstar' | 'coach' | 'sibling' | 'fielding' | 'hitting' | 'pitching' | 'catch' | 'running' | 'adjust' | 'total';
type SortDirection = 'asc' | 'desc';

// Editable score fields
type EditableField = 'fieldingSubtotal' | 'hittingSubtotal' | 'pitchingSubtotal' | 'catchScore' | 'runningScore' | 'officialAdjust';

export function PlayerReviewTable({
  players,
  teams,
  scoringMode,
  weights,
  weightsValidation,
  onScoringModeChange,
  onUpdateWeight,
  onResetWeights,
  onUpdatePlayer,
  onCoachKidToggle,
  onCoachTeamAssignment,
  onSiblingLink,
  onSiblingUnlink,
  onTeamNameUpdate,
  onAssistantCoachesUpdate,
  onRunAutoDetection,
}: PlayerReviewTableProps) {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('rank');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [teamsExpanded, setTeamsExpanded] = useState(false);
  const [weightsExpanded, setWeightsExpanded] = useState(false);
  const [editingCell, setEditingCell] = useState<{ playerId: string; field: EditableField } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [linkingSiblingFor, setLinkingSiblingFor] = useState<string | null>(null);

  // Filter players by search
  const filteredPlayers = players.filter((player) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      player.bib.toLowerCase().includes(searchLower) ||
      player.name.toLowerCase().includes(searchLower) ||
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
        aVal = a.lockedToRound ?? a.projectedRound;
        bVal = b.lockedToRound ?? b.projectedRound;
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
        aVal = a.littleLeagueAge;
        bVal = b.littleLeagueAge;
        break;
      case 'allstar':
        aVal = a.isAllStar ? 1 : 0;
        bVal = b.isAllStar ? 1 : 0;
        break;
      case 'coach':
        aVal = a.isCoachKid ? 1 : 0;
        bVal = b.isCoachKid ? 1 : 0;
        break;
      case 'sibling':
        aVal = a.siblingId || 'zzz';
        bVal = b.siblingId || 'zzz';
        break;
      case 'fielding':
        aVal = a.fieldingSubtotal;
        bVal = b.fieldingSubtotal;
        break;
      case 'hitting':
        aVal = a.hittingSubtotal;
        bVal = b.hittingSubtotal;
        break;
      case 'pitching':
        aVal = a.pitchingSubtotal;
        bVal = b.pitchingSubtotal;
        break;
      case 'catch':
        aVal = a.catchScore;
        bVal = b.catchScore;
        break;
      case 'running':
        aVal = a.runningScore;
        bVal = b.runningScore;
        break;
      case 'adjust':
        aVal = a.officialAdjust;
        bVal = b.officialAdjust;
        break;
      case 'total':
        aVal = a.totalScore;
        bVal = b.totalScore;
        break;
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

  // Inline editing handlers
  const handleCellClick = useCallback((playerId: string, field: EditableField, currentValue: number) => {
    setEditingCell({ playerId, field });
    setEditValue(currentValue.toString());
  }, []);

  const handleCellSave = useCallback(() => {
    if (editingCell) {
      const numValue = parseFloat(editValue) || 0;
      onUpdatePlayer(editingCell.playerId, editingCell.field, numValue);
      setEditingCell(null);
      setEditValue('');
    }
  }, [editingCell, editValue, onUpdatePlayer]);

  const handleCellCancel = useCallback(() => {
    setEditingCell(null);
    setEditValue('');
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCellSave();
    } else if (e.key === 'Escape') {
      handleCellCancel();
    }
  }, [handleCellSave, handleCellCancel]);

  // Get sibling name for display
  const getSiblingName = (player: Player): string => {
    if (!player.siblingId) return '';
    const sibling = players.find(p => p.id === player.siblingId);
    return sibling ? sibling.name : '';
  };

  // Count coach's kids and siblings
  const coachKidCount = players.filter(p => p.isCoachKid).length;
  const siblingCount = players.filter(p => p.siblingId).length;

  return (
    <div className="space-y-4">
      {/* Teams & Detection Panel */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <button
          onClick={() => setTeamsExpanded(!teamsExpanded)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <div className="flex items-center gap-4">
            <span className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
              {teamsExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              <Users className="w-4 h-4 text-gray-500" />
              Teams & Detection
            </span>
            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
              <span>{teams.length} teams</span>
              {coachKidCount > 0 && (
                <span className="text-blue-600 dark:text-blue-400">
                  <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-1"></span>
                  {coachKidCount} coach kids
                </span>
              )}
              {siblingCount > 0 && (
                <span className="text-green-600 dark:text-green-400">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1"></span>
                  {siblingCount} siblings
                </span>
              )}
            </div>
          </div>
        </button>

        {teamsExpanded && (
          <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700">
            <div className="mt-4 space-y-4">
              {/* Team Names & Coaches Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {teams.map(team => {
                  const teamCoachKids = players.filter(p => p.coachTeamId === team.id);
                  return (
                    <div key={team.id} className="space-y-2">
                      <div>
                        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                          Head Coach (Team Name)
                        </label>
                        <input
                          type="text"
                          value={team.name}
                          onChange={(e) => onTeamNameUpdate(team.id, e.target.value)}
                          placeholder={`Coach Name (e.g., Smith)`}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                          Assistant Coaches (comma-separated)
                        </label>
                        <input
                          type="text"
                          value={team.assistantCoaches.join(', ')}
                          onChange={(e) => onAssistantCoachesUpdate(team.id, e.target.value)}
                          placeholder="Smith, Jones"
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                        />
                      </div>
                      {teamCoachKids.length > 0 && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Coach's Kids: {teamCoachKids.map(p => p.name).join(', ')}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Detection Button */}
              <div className="flex items-center gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={onRunAutoDetection}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-medium"
                  title="Auto-detect coach's kids and siblings by matching last names"
                >
                  <Wand2 className="w-4 h-4" />
                  Find Coach Kids & Siblings
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Scoring Mode & Weights Panel (only shown in raw mode) */}
      {scoringMode === 'raw' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <button
            onClick={() => setWeightsExpanded(!weightsExpanded)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center gap-4">
              <span className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                {weightsExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                Scoring Weights
              </span>
              <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                <span>F: {weights.fielding.field + weights.fielding.throw}%</span>
                <span>H: {weights.hitting.power + weights.hitting.form + weights.hitting.contact}%</span>
                <span>P: {weights.pitching.strength + weights.pitching.form}%</span>
                <span>C: {weights.catching}%</span>
                <span>R: {weights.running}%</span>
              </div>
            </div>
            <span className={`text-sm font-medium ${weightsValidation.isValid ? 'text-green-600' : 'text-red-600'}`}>
              Total: {weightsValidation.total}%
            </span>
          </button>

          {weightsExpanded && (
            <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700">
              <ScoringWeightsConfig
                weights={weights}
                onUpdateWeight={onUpdateWeight}
                onReset={onResetWeights}
                validation={weightsValidation}
              />
            </div>
          )}
        </div>
      )}

      {/* Scoring Mode Toggle (compact) */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-gray-600 dark:text-gray-400">Scoring Mode:</span>
        <label className={`px-3 py-1.5 rounded-lg cursor-pointer transition-all ${
          scoringMode === 'pre-weighted'
            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-600'
        }`}>
          <input
            type="radio"
            name="scoringMode"
            value="pre-weighted"
            checked={scoringMode === 'pre-weighted'}
            onChange={() => onScoringModeChange('pre-weighted')}
            className="sr-only"
          />
          Pre-weighted
        </label>
        <label className={`px-3 py-1.5 rounded-lg cursor-pointer transition-all ${
          scoringMode === 'raw'
            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-600'
        }`}>
          <input
            type="radio"
            name="scoringMode"
            value="raw"
            checked={scoringMode === 'raw'}
            onChange={() => onScoringModeChange('raw')}
            className="sr-only"
          />
          Raw Scores
        </label>
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
              <tr className="bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                <th
                  className="sticky left-0 z-20 bg-gray-100 dark:bg-gray-700 px-2 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 w-12"
                  onClick={() => handleSort('rank')}
                >
                  Rank<SortIndicator field="rank" />
                </th>
                <th
                  className="sticky left-12 z-20 bg-gray-100 dark:bg-gray-700 px-2 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 w-10"
                  onClick={() => handleSort('proj')}
                >
                  Proj<SortIndicator field="proj" />
                </th>
                <th
                  className="sticky left-[88px] z-20 bg-gray-100 dark:bg-gray-700 px-2 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 w-12"
                  onClick={() => handleSort('bib')}
                >
                  BIB<SortIndicator field="bib" />
                </th>
                <th
                  className="sticky left-[136px] z-20 bg-gray-100 dark:bg-gray-700 px-2 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 min-w-[140px]"
                  onClick={() => handleSort('name')}
                >
                  Name<SortIndicator field="name" />
                </th>
                <th
                  className="px-2 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 w-10"
                  onClick={() => handleSort('age')}
                >
                  Age<SortIndicator field="age" />
                </th>
                <th
                  className="px-1 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 w-8"
                  onClick={() => handleSort('allstar')}
                >
                  <span title="All-Star">⭐</span><SortIndicator field="allstar" />
                </th>
                <th
                  className="px-1 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 w-20"
                  onClick={() => handleSort('coach')}
                >
                  Coach<SortIndicator field="coach" />
                </th>
                <th
                  className="px-1 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 w-16"
                  onClick={() => handleSort('sibling')}
                >
                  Sib<SortIndicator field="sibling" />
                </th>
                <th
                  className="px-2 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 w-12 border-l border-gray-300 dark:border-gray-600"
                  onClick={() => handleSort('fielding')}
                  title="Fielding"
                >
                  F<SortIndicator field="fielding" />
                </th>
                <th
                  className="px-2 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 w-12"
                  onClick={() => handleSort('hitting')}
                  title="Hitting"
                >
                  H<SortIndicator field="hitting" />
                </th>
                <th
                  className="px-2 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 w-12"
                  onClick={() => handleSort('pitching')}
                  title="Pitching"
                >
                  P<SortIndicator field="pitching" />
                </th>
                <th
                  className="px-2 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 w-12"
                  onClick={() => handleSort('catch')}
                  title="Catching"
                >
                  C<SortIndicator field="catch" />
                </th>
                <th
                  className="px-2 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 w-12"
                  onClick={() => handleSort('running')}
                  title="Running"
                >
                  R<SortIndicator field="running" />
                </th>
                <th
                  className="px-2 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 w-12 border-l border-gray-300 dark:border-gray-600"
                  onClick={() => handleSort('adjust')}
                  title="Adjustment"
                >
                  Adj<SortIndicator field="adjust" />
                </th>
                <th
                  className="sticky right-0 z-20 bg-gray-100 dark:bg-gray-700 px-2 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 w-14 border-l border-gray-300 dark:border-gray-600"
                  onClick={() => handleSort('total')}
                >
                  Total<SortIndicator field="total" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {sortedPlayers.map((player) => (
                <tr
                  key={player.id}
                  className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${
                    player.isDNE ? 'bg-gray-100 dark:bg-gray-800/50 opacity-60' : ''
                  } ${
                    player.isCoachKid && !player.isDNE ? 'bg-blue-50 dark:bg-blue-900/10' : ''
                  } ${
                    player.siblingId && !player.isCoachKid && !player.isDNE ? 'bg-green-50 dark:bg-green-900/10' : ''
                  }`}
                >
                  {/* Rank */}
                  <td className="sticky left-0 z-10 bg-inherit px-2 py-1.5 text-gray-900 dark:text-white font-medium text-center">
                    {player.rank}
                  </td>
                  {/* Projected Round */}
                  <td className="sticky left-12 z-10 bg-inherit px-2 py-1.5 text-center text-xs">
                    <span className={player.lockedToRound && player.lockedToRound !== player.projectedRound
                      ? 'text-blue-600 dark:text-blue-400 font-medium'
                      : 'text-gray-500 dark:text-gray-400'
                    }>
                      R{player.lockedToRound ?? player.projectedRound}
                      {player.lockedToRound && player.lockedToRound !== player.projectedRound && '*'}
                    </span>
                  </td>
                  {/* BIB */}
                  <td className="sticky left-[88px] z-10 bg-inherit px-2 py-1.5 text-gray-900 dark:text-white font-mono text-center">
                    {player.bib}
                  </td>
                  {/* Name */}
                  <td className="sticky left-[136px] z-10 bg-inherit px-2 py-1.5 text-gray-900 dark:text-white">
                    <span className="truncate">{player.lastName}, {player.firstName}</span>
                  </td>
                  {/* Age */}
                  <td className="px-2 py-1.5 text-gray-600 dark:text-gray-400 text-center">
                    {player.littleLeagueAge}
                  </td>
                  {/* All-Star */}
                  <td className="px-1 py-1 text-center">
                    {player.isAllStar && <span title="All-Star">⭐</span>}
                  </td>
                  {/* Coach's Kid */}
                  <td className="px-1 py-1 text-center">
                    {player.isCoachKid ? (
                      <div className="flex items-center justify-center gap-1">
                        <select
                          value={player.coachTeamId || ''}
                          onChange={(e) => {
                            if (e.target.value) {
                              onCoachTeamAssignment(player.id, e.target.value);
                            }
                          }}
                          className="text-xs px-1 py-0.5 border border-blue-300 dark:border-blue-700 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <option value="">Unassigned</option>
                          {teams.map(team => (
                            <option key={team.id} value={team.id}>{getTeamDisplayName(team)}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => onCoachKidToggle(player.id, false)}
                          className="text-gray-400 hover:text-red-500 p-0.5"
                          title="Remove coach's kid status"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => onCoachKidToggle(player.id, true)}
                        className="text-xs text-gray-400 hover:text-blue-500 px-1"
                        title="Mark as coach's kid"
                      >
                        +
                      </button>
                    )}
                  </td>
                  {/* Sibling */}
                  <td className="px-1 py-1 text-center">
                    {player.siblingId ? (
                      <div className="flex items-center justify-center gap-1">
                        <span className="text-xs text-green-600 dark:text-green-400 font-medium truncate max-w-[60px]" title={getSiblingName(player)}>
                          {players.find(p => p.id === player.siblingId)?.bib || '?'}
                        </span>
                        <button
                          onClick={() => onSiblingUnlink(player.id)}
                          className="text-gray-400 hover:text-red-500 p-0.5"
                          title="Unlink sibling"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : linkingSiblingFor === player.id ? (
                      <select
                        autoFocus
                        onChange={(e) => {
                          if (e.target.value) {
                            onSiblingLink(player.id, e.target.value);
                          }
                          setLinkingSiblingFor(null);
                        }}
                        onBlur={() => setLinkingSiblingFor(null)}
                        className="text-xs w-16 px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                      >
                        <option value="">Cancel</option>
                        {players.filter(p => p.id !== player.id && !p.siblingId).map(p => (
                          <option key={p.id} value={p.id}>{p.bib}</option>
                        ))}
                      </select>
                    ) : (
                      <button
                        onClick={() => setLinkingSiblingFor(player.id)}
                        className="text-xs text-gray-400 hover:text-green-500 px-1"
                        title="Link sibling"
                      >
                        +
                      </button>
                    )}
                  </td>
                  {/* Fielding */}
                  <td className="px-1 py-1 text-center border-l border-gray-200 dark:border-gray-700">
                    {editingCell?.playerId === player.id && editingCell?.field === 'fieldingSubtotal' ? (
                      <input
                        type="number"
                        step="0.1"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleCellSave}
                        onKeyDown={handleKeyDown}
                        autoFocus
                        className="w-12 px-1 py-0.5 text-center text-sm border border-blue-400 rounded bg-white dark:bg-gray-700"
                      />
                    ) : (
                      <span
                        onClick={() => handleCellClick(player.id, 'fieldingSubtotal', player.fieldingSubtotal)}
                        className="cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 px-1 py-0.5 rounded tabular-nums text-gray-700 dark:text-gray-300"
                      >
                        {player.fieldingSubtotal.toFixed(1)}
                      </span>
                    )}
                  </td>
                  {/* Hitting */}
                  <td className="px-1 py-1 text-center">
                    {editingCell?.playerId === player.id && editingCell?.field === 'hittingSubtotal' ? (
                      <input
                        type="number"
                        step="0.1"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleCellSave}
                        onKeyDown={handleKeyDown}
                        autoFocus
                        className="w-12 px-1 py-0.5 text-center text-sm border border-blue-400 rounded bg-white dark:bg-gray-700"
                      />
                    ) : (
                      <span
                        onClick={() => handleCellClick(player.id, 'hittingSubtotal', player.hittingSubtotal)}
                        className="cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 px-1 py-0.5 rounded tabular-nums text-gray-700 dark:text-gray-300"
                      >
                        {player.hittingSubtotal.toFixed(1)}
                      </span>
                    )}
                  </td>
                  {/* Pitching */}
                  <td className="px-1 py-1 text-center">
                    {editingCell?.playerId === player.id && editingCell?.field === 'pitchingSubtotal' ? (
                      <input
                        type="number"
                        step="0.1"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleCellSave}
                        onKeyDown={handleKeyDown}
                        autoFocus
                        className="w-12 px-1 py-0.5 text-center text-sm border border-blue-400 rounded bg-white dark:bg-gray-700"
                      />
                    ) : (
                      <span
                        onClick={() => handleCellClick(player.id, 'pitchingSubtotal', player.pitchingSubtotal)}
                        className="cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 px-1 py-0.5 rounded tabular-nums text-gray-700 dark:text-gray-300"
                      >
                        {player.pitchingSubtotal.toFixed(1)}
                      </span>
                    )}
                  </td>
                  {/* Catch */}
                  <td className="px-1 py-1 text-center">
                    {editingCell?.playerId === player.id && editingCell?.field === 'catchScore' ? (
                      <input
                        type="number"
                        step="0.1"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleCellSave}
                        onKeyDown={handleKeyDown}
                        autoFocus
                        className="w-12 px-1 py-0.5 text-center text-sm border border-blue-400 rounded bg-white dark:bg-gray-700"
                      />
                    ) : (
                      <span
                        onClick={() => handleCellClick(player.id, 'catchScore', player.catchScore)}
                        className="cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 px-1 py-0.5 rounded tabular-nums text-gray-700 dark:text-gray-300"
                      >
                        {player.catchScore.toFixed(1)}
                      </span>
                    )}
                  </td>
                  {/* Running */}
                  <td className="px-1 py-1 text-center">
                    {editingCell?.playerId === player.id && editingCell?.field === 'runningScore' ? (
                      <input
                        type="number"
                        step="0.1"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleCellSave}
                        onKeyDown={handleKeyDown}
                        autoFocus
                        className="w-12 px-1 py-0.5 text-center text-sm border border-blue-400 rounded bg-white dark:bg-gray-700"
                      />
                    ) : (
                      <span
                        onClick={() => handleCellClick(player.id, 'runningScore', player.runningScore)}
                        className="cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 px-1 py-0.5 rounded tabular-nums text-gray-700 dark:text-gray-300"
                      >
                        {player.runningScore.toFixed(1)}
                      </span>
                    )}
                  </td>
                  {/* Adjustment */}
                  <td className="px-1 py-1 text-center border-l border-gray-200 dark:border-gray-700">
                    {editingCell?.playerId === player.id && editingCell?.field === 'officialAdjust' ? (
                      <input
                        type="number"
                        step="0.1"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleCellSave}
                        onKeyDown={handleKeyDown}
                        autoFocus
                        className="w-12 px-1 py-0.5 text-center text-sm border border-blue-400 rounded bg-white dark:bg-gray-700"
                      />
                    ) : (
                      <span
                        onClick={() => handleCellClick(player.id, 'officialAdjust', player.officialAdjust)}
                        className={`cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 px-1 py-0.5 rounded tabular-nums ${
                          player.officialAdjust !== 0
                            ? player.officialAdjust > 0
                              ? 'text-green-600 dark:text-green-400 font-medium'
                              : 'text-red-600 dark:text-red-400 font-medium'
                            : 'text-gray-400 dark:text-gray-500'
                        }`}
                      >
                        {player.officialAdjust !== 0
                          ? (player.officialAdjust > 0 ? '+' : '') + player.officialAdjust.toFixed(1)
                          : '-'}
                      </span>
                    )}
                  </td>
                  {/* Total */}
                  <td className="sticky right-0 z-10 bg-inherit px-2 py-1.5 text-gray-900 dark:text-white font-bold text-center border-l border-gray-200 dark:border-gray-700 tabular-nums">
                    {player.totalScore.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 text-xs text-gray-500 dark:text-gray-500">
        <span><span className="inline-block w-3 h-3 bg-blue-100 dark:bg-blue-900/30 rounded mr-1"></span>Coach's Kid</span>
        <span><span className="inline-block w-3 h-3 bg-green-100 dark:bg-green-900/30 rounded mr-1"></span>Has Sibling</span>
        <span>Click any score cell to edit. Click headers to sort.</span>
      </div>
    </div>
  );
}
