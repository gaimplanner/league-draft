import { ChevronRight, ChevronDown, Edit2, Link, X } from 'lucide-react';
import { Player, Team } from '../types';
import { getTeamDisplayName } from '../utils/teamUtils';

interface PlayerCardProps {
  player: Player;
  teams: Team[];
  players: Player[];
  isExpanded: boolean;
  editingPlayer: string | null;
  linkingSiblingFor: string | null;
  onToggleExpand: (playerId: string | null) => void;
  onToggleEditing: (playerId: string | null) => void;
  onToggleLinkingSibling: (playerId: string | null) => void;
  onCoachKidToggle: (playerId: string, isCoach: boolean) => void;
  onCoachTeamAssignment: (playerId: string, teamId: string) => void;
  onSiblingLink: (playerId: string, siblingId: string) => void;
  onSiblingUnlink: (playerId: string) => void;
  onEdit: (playerId: string, field: 'fieldingSubtotal' | 'hittingSubtotal' | 'pitchingSubtotal' | 'catchScore' | 'runningScore' | 'officialAdjust', value: string) => void;
}

export const PlayerCard = ({
  player,
  teams,
  players,
  isExpanded,
  editingPlayer,
  linkingSiblingFor,
  onToggleExpand,
  onToggleEditing,
  onToggleLinkingSibling,
  onCoachKidToggle,
  onCoachTeamAssignment,
  onSiblingLink,
  onSiblingUnlink,
  onEdit,
}: PlayerCardProps) => {
  const assignedTeam = teams.find(t => t.id === player.coachTeamId);
  const availableSiblings = players.filter(p => p.id !== player.id && !p.siblingId);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Condensed Header Row - Always visible */}
      <button
        onClick={() => onToggleExpand(isExpanded ? null : player.id)}
        className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
      >
        {/* Expand/Collapse Icon */}
        <div className="flex-shrink-0">
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-400" />
          )}
        </div>

        {/* Rank */}
        <div className="w-12 flex-shrink-0">
          <span className="text-sm font-bold text-gray-900 dark:text-white">#{player.rank}</span>
        </div>

        {/* Name and badges */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-gray-900 dark:text-white truncate">{player.name}</span>
            <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded font-mono">
              {player.bib}
            </span>
            {player.isCoachKid && (
              <span className={`text-xs px-1.5 py-0.5 rounded ${
                player.coachTeamId
                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                  : 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200'
              }`}>
                Coach{player.coachTeamId ? `: ${assignedTeam ? getTeamDisplayName(assignedTeam) : 'Unknown'}` : ' (unassigned)'}
              </span>
            )}
            {player.siblingId && (
              <span className="text-xs bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 px-1.5 py-0.5 rounded">
                Sibling: {player.sibling}
              </span>
            )}
            {player.isDNE && (
              <span className="text-xs bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 px-1.5 py-0.5 rounded">
                DNE
              </span>
            )}
            {player.isAllStar && (
              <span className="text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-1.5 py-0.5 rounded">
                All-Star
              </span>
            )}
          </div>
        </div>

        {/* Age */}
        <div className="w-12 flex-shrink-0 text-center">
          <span className="text-sm text-gray-600 dark:text-gray-400">{player.littleLeagueAge}</span>
        </div>

        {/* Round */}
        <div className="w-12 flex-shrink-0 text-center">
          <span className={`text-sm ${player.lockedToRound && player.lockedToRound !== player.projectedRound ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-600 dark:text-gray-400'}`}>
            R{player.lockedToRound ?? player.projectedRound}
            {player.lockedToRound && player.lockedToRound !== player.projectedRound && '*'}
          </span>
        </div>

        {/* Score */}
        <div className="w-16 flex-shrink-0 text-right">
          <span className="font-bold text-gray-900 dark:text-white">{player.totalScore.toFixed(1)}</span>
        </div>
      </button>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="p-4 pt-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          {/* Scores breakdown */}
          <div className="mb-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Score Breakdown:</p>
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="text-gray-600 dark:text-gray-400">F: <strong className="text-gray-900 dark:text-white">{player.fieldingSubtotal.toFixed(1)}</strong></span>
              <span className="text-gray-600 dark:text-gray-400">H: <strong className="text-gray-900 dark:text-white">{player.hittingSubtotal.toFixed(1)}</strong></span>
              <span className="text-gray-600 dark:text-gray-400">P: <strong className="text-gray-900 dark:text-white">{player.pitchingSubtotal.toFixed(1)}</strong></span>
              <span className="text-gray-600 dark:text-gray-400">C: <strong className="text-gray-900 dark:text-white">{player.catchScore.toFixed(1)}</strong></span>
              <span className="text-gray-600 dark:text-gray-400">R: <strong className="text-gray-900 dark:text-white">{player.runningScore.toFixed(1)}</strong></span>
              {player.officialAdjust !== 0 && (
                <span className="text-gray-600 dark:text-gray-400">
                  Adj: <strong className={player.officialAdjust > 0 ? 'text-green-600' : 'text-red-600'}>
                    {player.officialAdjust > 0 ? '+' : ''}{player.officialAdjust.toFixed(1)}
                  </strong>
                </span>
              )}
            </div>
            {player.birthday && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Birthday: {player.birthday}</p>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Coach's Kid Controls */}
            <div className="p-3 bg-white dark:bg-gray-700/50 rounded border border-gray-200 dark:border-gray-600">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={player.isCoachKid}
                  onChange={(e) => onCoachKidToggle(player.id, e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  Coach's Kid
                </span>
              </label>

              {player.isCoachKid && (
                <div className="mt-2">
                  <select
                    value={player.coachTeamId || ''}
                    onChange={(e) => onCoachTeamAssignment(player.id, e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Select team...</option>
                    {teams.map(team => (
                      <option key={team.id} value={team.id}>{getTeamDisplayName(team)}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Sibling Linking */}
            <div className="p-3 bg-white dark:bg-gray-700/50 rounded border border-gray-200 dark:border-gray-600">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900 dark:text-white">Sibling</span>
                {!player.siblingId && (
                  <button
                    onClick={() => onToggleLinkingSibling(linkingSiblingFor === player.id ? null : player.id)}
                    className="text-xs px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded flex items-center gap-1"
                  >
                    <Link className="w-3 h-3" />
                    Link
                  </button>
                )}
              </div>

              {player.siblingId ? (
                <div className="flex items-center justify-between p-2 bg-purple-50 dark:bg-purple-900/20 rounded border border-purple-200 dark:border-purple-800">
                  <span className="text-sm text-purple-800 dark:text-purple-200">
                    {player.sibling}
                  </span>
                  <button
                    onClick={() => onSiblingUnlink(player.id)}
                    className="p-1 hover:bg-purple-100 dark:hover:bg-purple-900/40 rounded"
                    title="Unlink sibling"
                  >
                    <X className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  </button>
                </div>
              ) : linkingSiblingFor === player.id ? (
                <select
                  onChange={(e) => e.target.value && onSiblingLink(player.id, e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  defaultValue=""
                >
                  <option value="">Select sibling...</option>
                  {availableSiblings.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Rank #{p.rank}, Age {p.littleLeagueAge})
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400">No sibling linked</p>
              )}
            </div>
          </div>

          {/* Score Editing */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-900 dark:text-white">Edit Scores</span>
              <button
                onClick={() => onToggleEditing(editingPlayer === player.id ? null : player.id)}
                className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 rounded flex items-center gap-1"
              >
                <Edit2 className="w-3 h-3" />
                {editingPlayer === player.id ? 'Done' : 'Edit'}
              </button>
            </div>
            {editingPlayer === player.id && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {(['fieldingSubtotal', 'hittingSubtotal', 'pitchingSubtotal', 'catchScore', 'runningScore', 'officialAdjust'] as const).map((field) => (
                  <div key={field}>
                    <label className="text-xs text-gray-600 dark:text-gray-400 capitalize block mb-1">
                      {field === 'fieldingSubtotal' ? 'Fielding' :
                       field === 'hittingSubtotal' ? 'Hitting' :
                       field === 'pitchingSubtotal' ? 'Pitching' :
                       field === 'catchScore' ? 'Catch' :
                       field === 'runningScore' ? 'Running' :
                       field === 'officialAdjust' ? 'Adjustment' : field}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={player[field]}
                      onChange={(e) => onEdit(player.id, field, e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
