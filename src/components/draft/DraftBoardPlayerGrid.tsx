import { useState, useMemo } from 'react';
import { Search, X, ChevronDown, ChevronUp, Lock } from 'lucide-react';
import { Player, Team } from '../../types';
import { getTeamDisplayName } from '../../utils/teamUtils';

interface DraftBoardPlayerGridProps {
  players: Player[];
  currentTeamId: string | null;
  teams: Team[];
  showScores: boolean;
  onDraftPlayer: (playerId: string) => void;
  mandatoryPick?: {
    playerId: string;
    reason: 'coach-kid' | 'sibling';
    siblingName?: string;
  } | null;
  isLoading: boolean;
  enforceAgeLimit: boolean;
  maxPerAge: number;
  currentTeamAgeBreakdown: Record<string, number>;
  isPublicView: boolean;
}

type SortField = 'rank' | 'bib' | 'name' | 'age' | 'school' | 'round' | 'fielding' | 'hitting' | 'pitching' | 'catch' | 'running' | 'total';
type SortDirection = 'asc' | 'desc';

export const DraftBoardPlayerGrid = ({
  players,
  currentTeamId,
  teams,
  showScores,
  onDraftPlayer,
  mandatoryPick,
  isLoading,
  enforceAgeLimit,
  maxPerAge,
  currentTeamAgeBreakdown,
  isPublicView,
}: DraftBoardPlayerGridProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('rank');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Filter available (undrafted) players
  const availablePlayers = useMemo(() => {
    return players
      .filter((p) => !p.isDrafted)
      .filter((p) =>
        searchTerm === '' ||
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.bib.toLowerCase().includes(searchTerm.toLowerCase())
      );
  }, [players, searchTerm]);

  // Sort players
  const sortedPlayers = useMemo(() => {
    return [...availablePlayers].sort((a, b) => {
      let aVal: number | string = 0;
      let bVal: number | string = 0;

      switch (sortField) {
        case 'rank':
          aVal = a.rank;
          bVal = b.rank;
          break;
        case 'bib':
          aVal = parseInt(a.bib) || 0;
          bVal = parseInt(b.bib) || 0;
          break;
        case 'name':
          aVal = a.name;
          bVal = b.name;
          break;
        case 'age':
          aVal = a.littleLeagueAge;
          bVal = b.littleLeagueAge;
          break;
        case 'school':
          aVal = a.school || '';
          bVal = b.school || '';
          break;
        case 'round':
          aVal = a.lockedToRound ?? a.projectedRound;
          bVal = b.lockedToRound ?? b.projectedRound;
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
  }, [availablePlayers, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      // Default to descending for score fields, ascending for others
      const scoreFields: SortField[] = ['fielding', 'hitting', 'pitching', 'catch', 'running', 'total'];
      setSortDirection(scoreFields.includes(field) ? 'desc' : 'asc');
    }
  };

  const SortIndicator = ({ field }: { field: SortField }) => (
    sortField === field ? (
      sortDirection === 'asc' ? (
        <ChevronUp className="w-3 h-3 inline ml-0.5" />
      ) : (
        <ChevronDown className="w-3 h-3 inline ml-0.5" />
      )
    ) : null
  );

  const isPlayerRestricted = (player: Player) => {
    // Coach's kid for another team
    const isCoachKidForOtherTeam = player.isCoachKid &&
      player.coachTeamId &&
      player.coachTeamId !== currentTeamId;

    // Sibling locked to another team
    const isSiblingLockedToOtherTeam = player.lockedToTeamId &&
      player.lockedToTeamId !== currentTeamId;

    return isCoachKidForOtherTeam || isSiblingLockedToOtherTeam;
  };

  const isPlayerAgeMaxed = (player: Player) => {
    if (!enforceAgeLimit || maxPerAge <= 0) return false;
    const currentCount = currentTeamAgeBreakdown[player.littleLeagueAge] || 0;
    return currentCount >= maxPerAge;
  };

  const handleDraft = (player: Player) => {
    if (isPlayerAgeMaxed(player)) {
      const currentCount = currentTeamAgeBreakdown[player.littleLeagueAge] || 0;
      if (!window.confirm(
        `Warning: Team already has ${currentCount} players age ${player.littleLeagueAge} (limit: ${maxPerAge}). Continue anyway?`
      )) {
        return;
      }
    }
    onDraftPlayer(player.id);
  };

  const getLockedTeamName = (player: Player): string | null => {
    if (player.isCoachKid && player.coachTeamId) {
      const team = teams.find(t => t.id === player.coachTeamId);
      return team ? getTeamDisplayName(team) : null;
    }
    if (player.lockedToTeamId) {
      const team = teams.find(t => t.id === player.lockedToTeamId);
      return team ? getTeamDisplayName(team) : null;
    }
    return null;
  };

  // Calculate column count for empty state
  const getColumnCount = () => {
    let count = 8; // rank, bib, name, age, school, round, flags, action
    if (showScores) count += 6; // F, H, P, C, R, Total
    if (isPublicView) count -= 1; // no action column
    return count;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Search Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or BIB..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2"
              >
                <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
              </button>
            )}
          </div>
          <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
            {sortedPlayers.length} available
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
              <th
                onClick={() => handleSort('round')}
                className="px-2 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 w-16"
                title="Projected Round"
              >
                Proj. Rnd<SortIndicator field="round" />
              </th>
              <th
                onClick={() => handleSort('rank')}
                className="px-2 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 w-14"
              >
                Rank<SortIndicator field="rank" />
              </th>
              <th
                onClick={() => handleSort('bib')}
                className="px-2 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 w-14"
              >
                BIB<SortIndicator field="bib" />
              </th>
              <th
                onClick={() => handleSort('name')}
                className="px-2 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
              >
                Name<SortIndicator field="name" />
              </th>
              <th
                onClick={() => handleSort('age')}
                className="px-2 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 w-12"
              >
                Age<SortIndicator field="age" />
              </th>
              <th
                onClick={() => handleSort('school')}
                className="px-2 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 w-24"
              >
                School<SortIndicator field="school" />
              </th>
              {showScores && (
                <>
                  <th
                    onClick={() => handleSort('fielding')}
                    className="px-2 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 w-12"
                    title="Fielding"
                  >
                    F<SortIndicator field="fielding" />
                  </th>
                  <th
                    onClick={() => handleSort('hitting')}
                    className="px-2 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 w-12"
                    title="Hitting"
                  >
                    H<SortIndicator field="hitting" />
                  </th>
                  <th
                    onClick={() => handleSort('pitching')}
                    className="px-2 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 w-12"
                    title="Pitching"
                  >
                    P<SortIndicator field="pitching" />
                  </th>
                  <th
                    onClick={() => handleSort('catch')}
                    className="px-2 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 w-12"
                    title="Catching"
                  >
                    C<SortIndicator field="catch" />
                  </th>
                  <th
                    onClick={() => handleSort('running')}
                    className="px-2 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 w-12"
                    title="Running"
                  >
                    R<SortIndicator field="running" />
                  </th>
                  <th
                    onClick={() => handleSort('total')}
                    className="px-2 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 w-14 border-l border-gray-200 dark:border-gray-600"
                  >
                    Total<SortIndicator field="total" />
                  </th>
                </>
              )}
              <th className="px-2 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 w-28">
                Flags
              </th>
              {!isPublicView && (
                <th className="px-2 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 w-16">
                  Action
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {sortedPlayers.map((player) => {
              const isMandatory = mandatoryPick?.playerId === player.id;
              const isRestricted = isPlayerRestricted(player);
              const isAgeMaxed = isPlayerAgeMaxed(player) && !isRestricted;
              const lockedTeamName = getLockedTeamName(player);
              const effectiveRound = player.lockedToRound ?? player.projectedRound;
              const hasRoundOverride = player.lockedToRound && player.lockedToRound !== player.projectedRound;

              return (
                <tr
                  key={player.id}
                  className={`
                    hover:bg-gray-50 dark:hover:bg-gray-700/50
                    ${isRestricted ? 'opacity-50 bg-red-50/50 dark:bg-red-900/10' : ''}
                    ${isMandatory && !isPublicView ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}
                  `}
                >
                  {/* Round */}
                  <td className="px-2 py-1.5 text-center">
                    <span className={`tabular-nums ${
                      hasRoundOverride
                        ? 'text-blue-600 dark:text-blue-400 font-medium'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}>
                      R{effectiveRound}
                      {hasRoundOverride && '*'}
                    </span>
                  </td>

                  {/* Rank */}
                  <td className="px-2 py-1.5 text-center text-gray-500 dark:text-gray-400 tabular-nums font-medium">
                    {player.rank}
                  </td>

                  {/* BIB */}
                  <td className="px-2 py-1.5 text-center">
                    <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded font-mono">
                      {player.bib}
                    </span>
                  </td>

                  {/* Name */}
                  <td className="px-2 py-1.5">
                    <span className={`font-medium ${
                      isRestricted
                        ? 'text-gray-400 dark:text-gray-500'
                        : 'text-gray-900 dark:text-white'
                    }`}>
                      {player.name}
                    </span>
                  </td>

                  {/* Age */}
                  <td className="px-2 py-1.5 text-center text-gray-600 dark:text-gray-400 tabular-nums">
                    {player.littleLeagueAge}
                  </td>

                  {/* School */}
                  <td className="px-2 py-1.5 text-left text-gray-500 dark:text-gray-400 text-xs truncate max-w-[6rem]" title={player.school || undefined}>
                    {player.school || '-'}
                  </td>

                  {/* Score Columns */}
                  {showScores && (
                    <>
                      <td className={`px-2 py-1.5 text-center tabular-nums ${
                        isRestricted ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-300'
                      }`}>
                        {player.fieldingSubtotal.toFixed(1)}
                      </td>
                      <td className={`px-2 py-1.5 text-center tabular-nums ${
                        isRestricted ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-300'
                      }`}>
                        {player.hittingSubtotal.toFixed(1)}
                      </td>
                      <td className={`px-2 py-1.5 text-center tabular-nums ${
                        isRestricted ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-300'
                      }`}>
                        {player.pitchingSubtotal.toFixed(1)}
                      </td>
                      <td className={`px-2 py-1.5 text-center tabular-nums ${
                        isRestricted ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-300'
                      }`}>
                        {player.catchScore.toFixed(1)}
                      </td>
                      <td className={`px-2 py-1.5 text-center tabular-nums ${
                        isRestricted ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-300'
                      }`}>
                        {player.runningScore.toFixed(1)}
                      </td>
                      <td className={`px-2 py-1.5 text-center tabular-nums font-bold border-l border-gray-200 dark:border-gray-700 ${
                        isRestricted ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'
                      }`}>
                        {player.totalScore.toFixed(1)}
                      </td>
                    </>
                  )}

                  {/* Flags */}
                  <td className="px-2 py-1.5">
                    <div className="flex items-center justify-center gap-1 flex-wrap">
                      {/* Locked to team (coach's kid or sibling) - unified lock treatment */}
                      {lockedTeamName ? (
                        <span
                          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold rounded ${
                            isRestricted
                              ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                              : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                          }`}
                          title={player.isCoachKid
                            ? `Coach's Kid (${lockedTeamName})`
                            : `Sibling locked to ${lockedTeamName}`}
                        >
                          <Lock className="w-2.5 h-2.5" />
                          <span className="max-w-[60px] truncate">{lockedTeamName}</span>
                        </span>
                      ) : (
                        <>
                          {/* Coach's Kid without team assignment */}
                          {player.isCoachKid && (
                            <span
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200"
                              title="Coach's Kid (unassigned)"
                            >
                              <Lock className="w-2.5 h-2.5" />
                            </span>
                          )}

                          {/* Sibling - only show if actually linked (siblingId set) */}
                          {player.siblingId && (
                            <span
                              className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200"
                              title={`Sibling: ${player.sibling || 'linked'}`}
                            >
                              SIB
                            </span>
                          )}
                        </>
                      )}

                      {/* All-Star */}
                      {player.isAllStar && (
                        <span
                          className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200"
                          title="All-Star"
                        >
                          AS
                        </span>
                      )}

                      {/* DNE */}
                      {player.isDNE && (
                        <span
                          className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200"
                          title="Did Not Evaluate"
                        >
                          DNE
                        </span>
                      )}

                      {/* Age limit warning */}
                      {isAgeMaxed && (
                        <span
                          className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200"
                          title={`Age ${player.littleLeagueAge} at limit`}
                        >
                          ⚠️
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Action */}
                  {!isPublicView && (
                    <td className="px-2 py-1.5 text-center">
                      {!isRestricted && (
                        <button
                          onClick={() => handleDraft(player)}
                          disabled={isLoading}
                          className={`px-2 py-1 rounded text-xs font-semibold transition-all disabled:opacity-50 ${
                            isMandatory
                              ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                              : 'bg-green-600 hover:bg-green-700 text-white'
                          }`}
                        >
                          Draft
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            {sortedPlayers.length === 0 && (
              <tr>
                <td
                  colSpan={getColumnCount()}
                  className="px-3 py-8 text-center text-gray-500 dark:text-gray-400"
                >
                  {searchTerm ? 'No players match your search' : 'No available players'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
        <div className="flex items-center gap-4 text-[10px] text-gray-500 dark:text-gray-400 flex-wrap">
          <div className="flex items-center gap-1">
            <Lock className="w-3 h-3" />
            <span>= Coach's Kid</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="px-1 py-0.5 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded font-semibold">SIB</span>
            <span>= Sibling</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="px-1 py-0.5 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded font-semibold">AS</span>
            <span>= All-Star</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="px-1 py-0.5 bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 rounded font-semibold">DNE</span>
            <span>= Did Not Evaluate</span>
          </div>
          {showScores && (
            <span className="ml-auto">F=Fielding H=Hitting P=Pitching C=Catch R=Running</span>
          )}
        </div>
      </div>
    </div>
  );
};
