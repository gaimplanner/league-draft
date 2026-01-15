import { useState } from 'react';
import { Search, X, AlertTriangle } from 'lucide-react';
import { EvaluationPlayer, getCategoryDisplayName, EvaluationCategory } from '../../types/evaluation';

interface PlayerSummaryTableProps {
  players: EvaluationPlayer[];
  onPlayerClick: (player: EvaluationPlayer) => void;
}

type SortField = 'rank' | 'bib' | 'name' | 'age' | EvaluationCategory | 'total';
type SortDirection = 'asc' | 'desc';

export function PlayerSummaryTable({ players, onPlayerClick }: PlayerSummaryTableProps) {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('rank');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

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
      case 'bib':
        aVal = parseInt(a.bib) || 0;
        bVal = parseInt(b.bib) || 0;
        break;
      case 'name':
        aVal = a.fullName;
        bVal = b.fullName;
        break;
      case 'age':
        aVal = a.age;
        bVal = b.age;
        break;
      case 'total':
        aVal = a.weightedTotal;
        bVal = b.weightedTotal;
        break;
      default:
        // Category scores
        aVal = a.categoryScores[sortField as EvaluationCategory] ?? 0;
        bVal = b.categoryScores[sortField as EvaluationCategory] ?? 0;
    }

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDirection === 'asc'
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }

    return sortDirection === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'rank' ? 'asc' : 'desc');
    }
  };

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <th
      onClick={() => handleSort(field)}
      className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field && (
          <span className="text-green-500">{sortDirection === 'asc' ? '↑' : '↓'}</span>
        )}
      </div>
    </th>
  );

  const categories: EvaluationCategory[] = ['fielding', 'pitching', 'hitting', 'flyBalls', 'baserunning'];

  return (
    <div>
      {/* Search */}
      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or BIB..."
          className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 transform -translate-y-1/2"
          >
            <X className="w-5 h-5 text-gray-400 hover:text-gray-600" />
          </button>
        )}
      </div>

      {/* Results count */}
      <div className="mb-2 text-sm text-gray-600 dark:text-gray-400">
        Showing {sortedPlayers.length} of {players.length} players
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <SortHeader field="rank">Rank</SortHeader>
                <SortHeader field="bib">BIB</SortHeader>
                <SortHeader field="name">Name</SortHeader>
                <SortHeader field="age">Age</SortHeader>
                {categories.map((cat) => (
                  <SortHeader key={cat} field={cat}>
                    {getCategoryDisplayName(cat).slice(0, 5)}
                  </SortHeader>
                ))}
                <SortHeader field="total">Total</SortHeader>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {sortedPlayers.map((player) => (
                <tr
                  key={player.bib}
                  onClick={() => onPlayerClick(player)}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                >
                  <td className="px-3 py-2 text-sm text-gray-900 dark:text-white font-medium">
                    {player.rank}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-900 dark:text-white font-mono">
                    {player.bib}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">
                    <div className="flex items-center gap-2">
                      {player.fullName || player.bib}
                      {player.isPartial && (
                        <span title="Incomplete data">
                          <AlertTriangle className="w-4 h-4 text-yellow-500" />
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
                    {player.age || '-'}
                  </td>
                  {categories.map((cat) => (
                    <td
                      key={cat}
                      className={`px-3 py-2 text-sm text-center ${
                        player.categoryScores[cat] === null
                          ? 'text-gray-400 dark:text-gray-500'
                          : 'text-gray-900 dark:text-white'
                      }`}
                    >
                      {player.categoryScores[cat]?.toFixed(1) ?? '-'}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-sm text-gray-900 dark:text-white font-bold">
                    {player.weightedTotal.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Hint */}
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-500 text-center">
        Click a player row to view details and add manual adjustment
      </p>
    </div>
  );
}
