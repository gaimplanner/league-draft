import { useState, useMemo, useCallback } from 'react';
import {
  Check,
  X,
  Search,
  AlertTriangle,
  Users,
  User,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { ResolvedRequest, Team } from '../../types';
import { getConfirmationStats } from '../../utils/teamBuilderParser';

interface RequestConfirmationProps {
  requests: ResolvedRequest[];
  players: Array<{ id: string; firstName: string; lastName: string; bib: string }>;
  teams: Team[];
  onUpdateRequest: (requestId: string, targetId: string | null, targetName: string | null) => void;
  onContinue: () => void;
  onBack: () => void;
}

type FilterMode = 'all' | 'needs-review' | 'coach' | 'teammate' | 'two-way';

/**
 * Request Confirmation component for the Team Builder.
 * Allows users to review and confirm/edit auto-resolved requests.
 */
export const RequestConfirmation = ({
  requests,
  players,
  teams,
  onUpdateRequest,
  onContinue,
  onBack,
}: RequestConfirmationProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);

  // Get player and team lookup maps
  const playerMap = useMemo(() => new Map(players.map(p => [p.id, p])), [players]);
  const teamMap = useMemo(() => new Map(teams.map(t => [t.id, t])), [teams]);

  // Get confirmation stats
  const stats = useMemo(() => getConfirmationStats(requests), [requests]);


  // Filter requests based on current filter and search
  const filteredRequests = useMemo(() => {
    let filtered = requests;

    // Apply filter mode
    switch (filterMode) {
      case 'needs-review':
        filtered = filtered.filter(r => r.status === 'needs-review');
        break;
      case 'coach':
        filtered = filtered.filter(r => r.requestType === 'coach');
        break;
      case 'teammate':
        filtered = filtered.filter(r => r.requestType === 'teammate');
        break;
      case 'two-way':
        filtered = filtered.filter(r => r.isTwoWay);
        break;
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(req => {
        const player = playerMap.get(req.playerId);
        const playerName = player ? `${player.firstName} ${player.lastName}`.toLowerCase() : '';
        const targetName = req.resolvedTargetName?.toLowerCase() || '';
        const rawRequest = req.rawRequestString.toLowerCase();

        return (
          playerName.includes(query) ||
          targetName.includes(query) ||
          rawRequest.includes(query)
        );
      });
    }

    return filtered;
  }, [requests, filterMode, searchQuery, playerMap]);

  // Get unique players from filtered requests
  const filteredPlayers = useMemo(() => {
    const playerIds = new Set(filteredRequests.map(r => r.playerId));
    return Array.from(playerIds).map(id => ({
      player: playerMap.get(id)!,
      requests: filteredRequests.filter(r => r.playerId === id),
    })).filter(({ player }) => player).sort((a, b) => {
      // Sort by needs-review count (descending), then by name
      const aReview = a.requests.filter(r => r.status === 'needs-review').length;
      const bReview = b.requests.filter(r => r.status === 'needs-review').length;
      if (bReview !== aReview) return bReview - aReview;
      return `${a.player.firstName} ${a.player.lastName}`.localeCompare(
        `${b.player.firstName} ${b.player.lastName}`
      );
    });
  }, [filteredRequests, playerMap]);

  // Handle selecting a match for a request
  const handleSelectMatch = useCallback((requestId: string, targetId: string | null, targetName: string | null) => {
    onUpdateRequest(requestId, targetId, targetName);
    setExpandedRequestId(null);
  }, [onUpdateRequest]);

  // Get status indicator styling
  const getStatusStyle = (status: ResolvedRequest['status']) => {
    switch (status) {
      case 'auto-confirmed':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800';
      case 'user-confirmed':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      case 'needs-review':
        return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      case 'unresolvable':
        return 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600';
    }
  };

  const getStatusLabel = (status: ResolvedRequest['status']) => {
    switch (status) {
      case 'auto-confirmed': return 'Auto';
      case 'user-confirmed': return 'Confirmed';
      case 'needs-review': return 'Review';
      case 'unresolvable': return 'Unresolvable';
    }
  };

  // Render a single request row
  const renderRequestRow = (req: ResolvedRequest) => {
    const isExpanded = expandedRequestId === req.id;
    const player = playerMap.get(req.playerId);

    return (
      <div
        key={req.id}
        className={`border rounded-lg overflow-hidden ${
          req.status === 'needs-review'
            ? 'border-amber-300 dark:border-amber-700'
            : 'border-gray-200 dark:border-gray-700'
        }`}
      >
        {/* Request header */}
        <div
          className={`px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
            req.status === 'needs-review' ? 'bg-amber-50 dark:bg-amber-900/10' : ''
          }`}
          onClick={() => setExpandedRequestId(isExpanded ? null : req.id)}
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Request type icon */}
            <div className={`p-1.5 rounded-lg ${
              req.requestType === 'coach'
                ? 'bg-purple-100 dark:bg-purple-900/30'
                : 'bg-blue-100 dark:bg-blue-900/30'
            }`}>
              {req.requestType === 'coach' ? (
                <User className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              ) : (
                <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              )}
            </div>

            {/* Player name and request */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900 dark:text-white">
                  {player?.firstName} {player?.lastName}
                </span>
                {req.isTwoWay && (
                  <span className="px-1.5 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                    TWO-WAY
                  </span>
                )}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                <span className="text-gray-400 dark:text-gray-500">
                  {req.requestType === 'coach' ? 'Coach: ' : 'Teammate: '}
                </span>
                "{req.rawRequestString}"
              </div>
            </div>

            {/* Current resolution */}
            <div className="flex items-center gap-2">
              {req.resolvedTargetId ? (
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {req.resolvedTargetName}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {Math.round(req.confidenceScore * 100)}% match
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-400 dark:text-gray-500 italic">
                  No match
                </div>
              )}

              {/* Status badge */}
              <span className={`px-2 py-0.5 text-xs font-medium rounded border ${getStatusStyle(req.status)}`}>
                {getStatusLabel(req.status)}
              </span>

              {/* Expand/collapse icon */}
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </div>
          </div>
        </div>

        {/* Expanded section with suggestions */}
        {isExpanded && (
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Select the correct match or mark as unresolvable:
            </div>

            {/* Suggested matches */}
            <div className="space-y-2">
              {/* Current match (if any) */}
              {req.resolvedTargetId && (
                <button
                  onClick={() => handleSelectMatch(req.id, req.resolvedTargetId, req.resolvedTargetName)}
                  className={`w-full px-3 py-2 text-left rounded-lg border flex items-center justify-between ${
                    req.status === 'auto-confirmed' || req.status === 'user-confirmed'
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                      : 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {(req.status === 'auto-confirmed' || req.status === 'user-confirmed') && (
                      <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                    )}
                    <span className="font-medium text-gray-900 dark:text-white">
                      {req.resolvedTargetName}
                    </span>
                    {req.requestType === 'teammate' && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        (current match)
                      </span>
                    )}
                    {req.requestType === 'coach' && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        ({teamMap.get(req.resolvedTargetId)?.headCoach || 'Team'})
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {Math.round(req.confidenceScore * 100)}%
                  </span>
                </button>
              )}

              {/* Alternative suggestions */}
              {req.suggestedMatches?.filter(m => m.id !== req.resolvedTargetId).map(match => (
                <button
                  key={match.id}
                  onClick={() => handleSelectMatch(req.id, match.id, match.name)}
                  className="w-full px-3 py-2 text-left rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between"
                >
                  <span className="font-medium text-gray-900 dark:text-white">
                    {match.name}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {Math.round(match.score * 100)}%
                  </span>
                </button>
              ))}

              {/* For coach requests, show all teams as options */}
              {req.requestType === 'coach' && (
                <div className="pt-2 border-t border-gray-200 dark:border-gray-700 mt-2">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    Or select a team:
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {teams.map(team => (
                      <button
                        key={team.id}
                        onClick={() => handleSelectMatch(req.id, team.id, team.headCoach || team.teamName || '')}
                        className={`px-3 py-2 text-left rounded-lg border text-sm ${
                          req.resolvedTargetId === team.id
                            ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                            : 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        <div className="font-medium text-gray-900 dark:text-white">
                          {team.headCoach || team.teamName || `Team ${team.draftPosition}`}
                        </div>
                        {team.assistantCoach && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Asst: {team.assistantCoach}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* For teammate requests, allow searching for any player */}
              {req.requestType === 'teammate' && (
                <div className="pt-2 border-t border-gray-200 dark:border-gray-700 mt-2">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    Or search for a player:
                  </div>
                  <PlayerSearchSelect
                    players={players.filter(p => p.id !== req.playerId)}
                    currentValue={req.resolvedTargetId}
                    onSelect={(id, name) => handleSelectMatch(req.id, id, name)}
                  />
                </div>
              )}

              {/* Mark as unresolvable */}
              <button
                onClick={() => handleSelectMatch(req.id, null, null)}
                className={`w-full px-3 py-2 text-left rounded-lg border flex items-center gap-2 ${
                  req.status === 'unresolvable'
                    ? 'border-gray-500 bg-gray-100 dark:bg-gray-700'
                    : 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <X className="w-4 h-4 text-gray-500" />
                <span className="text-gray-600 dark:text-gray-400">
                  Mark as unresolvable (person not in system)
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Confirm Requests
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Review and confirm coach/teammate request matches. High-confidence matches are pre-selected.
        </p>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {stats.total}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Total Requests</div>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {stats.autoConfirmed + stats.userConfirmed}
          </div>
          <div className="text-sm text-green-700 dark:text-green-300">Confirmed</div>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {stats.needsReview}
          </div>
          <div className="text-sm text-amber-700 dark:text-amber-300">Needs Review</div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-gray-500 dark:text-gray-400">
            {stats.unresolvable}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Unresolvable</div>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {Math.round(stats.twoWayRequests / 2)}
          </div>
          <div className="text-sm text-blue-700 dark:text-blue-300">Two-Way Pairs</div>
        </div>
      </div>

      {/* Needs review alert */}
      {stats.needsReview > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-amber-800 dark:text-amber-200">
              {stats.needsReview} request{stats.needsReview !== 1 ? 's' : ''} need{stats.needsReview === 1 ? 's' : ''} review
            </h3>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
              These requests have lower confidence matches. Please verify they are correct or select an alternative.
            </p>
          </div>
        </div>
      )}

      {/* Search and filter */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by player name or request..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
            />
          </div>

          {/* Filter buttons */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <FilterButton
              active={filterMode === 'all'}
              onClick={() => setFilterMode('all')}
              label="All"
            />
            <FilterButton
              active={filterMode === 'needs-review'}
              onClick={() => setFilterMode('needs-review')}
              label="Needs Review"
              count={stats.needsReview}
              highlight
            />
            <FilterButton
              active={filterMode === 'coach'}
              onClick={() => setFilterMode('coach')}
              label="Coach"
              count={stats.coachRequests}
            />
            <FilterButton
              active={filterMode === 'teammate'}
              onClick={() => setFilterMode('teammate')}
              label="Teammate"
              count={stats.teammateRequests}
            />
            <FilterButton
              active={filterMode === 'two-way'}
              onClick={() => setFilterMode('two-way')}
              label="Two-Way"
              count={Math.round(stats.twoWayRequests / 2)}
            />
          </div>
        </div>
      </div>

      {/* Request list */}
      <div className="space-y-3">
        {filteredPlayers.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            {searchQuery ? 'No requests match your search.' : 'No requests to display.'}
          </div>
        ) : (
          filteredPlayers.map(({ player, requests: playerRequests }) => (
            <div key={player.id} className="space-y-2">
              {playerRequests.map(req => renderRequestRow(req))}
            </div>
          ))
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={onBack}
          className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          Back
        </button>
        <button
          onClick={onContinue}
          className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium flex items-center gap-2"
        >
          Continue to Configure
          <Check className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// Filter button component
const FilterButton = ({
  active,
  onClick,
  label,
  count,
  highlight,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
  highlight?: boolean;
}) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 ${
      active
        ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
    }`}
  >
    {label}
    {count !== undefined && count > 0 && (
      <span className={`px-1.5 py-0.5 text-xs rounded-full ${
        highlight && !active
          ? 'bg-amber-500 text-white'
          : active
            ? 'bg-gray-200 dark:bg-gray-500 text-gray-700 dark:text-gray-200'
            : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
      }`}>
        {count}
      </span>
    )}
  </button>
);

// Player search/select component
const PlayerSearchSelect = ({
  players,
  currentValue,
  onSelect,
}: {
  players: Array<{ id: string; firstName: string; lastName: string; bib: string }>;
  currentValue: string | null;
  onSelect: (id: string, name: string) => void;
}) => {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const filteredPlayers = useMemo(() => {
    if (!search.trim()) return players.slice(0, 10);
    const query = search.toLowerCase().trim();
    return players
      .filter(p =>
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(query) ||
        p.firstName.toLowerCase().includes(query) ||
        p.lastName.toLowerCase().includes(query)
      )
      .slice(0, 10);
  }, [players, search]);

  return (
    <div className="relative">
      <input
        type="text"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder="Type to search players..."
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 text-sm"
      />
      {isOpen && filteredPlayers.length > 0 && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
            {filteredPlayers.map(player => (
              <button
                key={player.id}
                onClick={() => {
                  onSelect(player.id, `${player.firstName} ${player.lastName}`);
                  setSearch('');
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-sm flex items-center justify-between ${
                  player.id === currentValue ? 'bg-green-50 dark:bg-green-900/20' : ''
                }`}
              >
                <span className="text-gray-900 dark:text-white">
                  {player.firstName} {player.lastName}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  BIB {player.bib}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
