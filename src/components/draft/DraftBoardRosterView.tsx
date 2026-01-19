import { useMemo } from 'react';
import { Lock } from 'lucide-react';
import { Player, Team } from '../../types';
import { getTeamDisplayName } from '../../utils/teamUtils';

interface DraftBoardRosterViewProps {
  teams: Team[];
  players: Player[];
  draftOrder: string[];
  currentRound: number;
  currentPickInRound: number;
  currentRoundOrder: string[];
  showScores: boolean;
  totalRounds: number;
  isPublicView: boolean;
}

interface CellData {
  type: 'empty' | 'drafted' | 'prefilled';
  player?: Player;
  prefilledReason?: 'coach-kid' | 'sibling';
}

export const DraftBoardRosterView = ({
  teams,
  players,
  currentRound,
  currentPickInRound,
  currentRoundOrder,
  showScores,
  totalRounds,
  isPublicView,
}: DraftBoardRosterViewProps) => {
  // Get teams in current round order
  const sortedTeams = useMemo(() => {
    if (currentRoundOrder.length > 0) {
      return [...teams].sort((a, b) => {
        const aIndex = currentRoundOrder.indexOf(a.id);
        const bIndex = currentRoundOrder.indexOf(b.id);
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      });
    }
    return teams;
  }, [teams, currentRoundOrder]);

  // Get the player drafted in a specific round by a specific team
  const getDraftedPlayer = (teamId: string, round: number): Player | undefined => {
    return players.find(
      p => p.isDrafted && p.draftedByTeamId === teamId && p.draftedInRound === round
    );
  };

  // Get pre-filled player (coach's kid or sibling) for a team in a specific round
  const getPrefilledPlayer = (teamId: string, round: number): { player: Player; reason: 'coach-kid' | 'sibling' } | undefined => {
    const prefilled = players.find(p => {
      if (p.isDrafted) return false;
      const effectiveRound = p.lockedToRound ?? p.projectedRound;
      if (effectiveRound !== round) return false;

      // Coach's kid for this team
      if (p.isCoachKid && p.coachTeamId === teamId) {
        return true;
      }

      // Sibling locked to this team
      if (p.lockedToTeamId === teamId) {
        return true;
      }

      return false;
    });

    if (!prefilled) return undefined;

    const reason: 'coach-kid' | 'sibling' =
      prefilled.isCoachKid && prefilled.coachTeamId === teamId ? 'coach-kid' : 'sibling';

    return { player: prefilled, reason };
  };

  // Build cell data for each round x team combination
  const getCellData = (teamId: string, round: number): CellData => {
    // Check if there's a drafted player for this slot
    const draftedPlayer = getDraftedPlayer(teamId, round);
    if (draftedPlayer) {
      return { type: 'drafted', player: draftedPlayer };
    }

    // Check if there's a pre-filled player (undrafted coach's kid or locked sibling)
    const prefilled = getPrefilledPlayer(teamId, round);
    if (prefilled) {
      return {
        type: 'prefilled',
        player: prefilled.player,
        prefilledReason: prefilled.reason,
      };
    }

    return { type: 'empty' };
  };

  // Determine if a cell is the current pick
  const isCurrentPick = (teamId: string, round: number): boolean => {
    if (round !== currentRound) return false;
    const teamIndex = currentRoundOrder.indexOf(teamId);
    return teamIndex === currentPickInRound - 1;
  };

  // Determine if a round/pick has already happened
  const isPastPick = (teamId: string, round: number): boolean => {
    if (round < currentRound) return true;
    if (round === currentRound) {
      const teamIndex = currentRoundOrder.indexOf(teamId);
      return teamIndex < currentPickInRound - 1;
    }
    return false;
  };

  // Generate round numbers
  const rounds = useMemo(() => {
    return Array.from({ length: totalRounds }, (_, i) => i + 1);
  }, [totalRounds]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
              <th className="sticky left-0 z-20 bg-gray-50 dark:bg-gray-700/50 px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 w-16 border-r border-gray-200 dark:border-gray-600">
                Round
              </th>
              {sortedTeams.map((team, idx) => {
                const isCurrent = team.id === currentRoundOrder[currentPickInRound - 1];
                return (
                  <th
                    key={team.id}
                    className={`px-2 py-2 text-center text-xs font-semibold min-w-[140px] ${
                      isCurrent
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
                        : 'text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[10px] text-gray-400 dark:text-gray-500">
                        #{idx + 1}
                      </span>
                      <span className="truncate max-w-[130px]">
                        {getTeamDisplayName(team)}
                      </span>
                      {!isPublicView && showScores && (
                        <span className="text-[10px] font-normal text-gray-500 dark:text-gray-400">
                          {team.totalScore.toFixed(1)} pts
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {rounds.map((round) => (
              <tr key={round} className={round === currentRound ? 'bg-yellow-50/50 dark:bg-yellow-900/10' : ''}>
                <td className="sticky left-0 z-10 bg-white dark:bg-gray-800 px-3 py-2 text-center font-bold text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-600">
                  {round}
                </td>
                {sortedTeams.map((team) => {
                  const cellData = getCellData(team.id, round);
                  const isCurrent = isCurrentPick(team.id, round);
                  const isPast = isPastPick(team.id, round);

                  return (
                    <td
                      key={team.id}
                      className={`px-2 py-2 text-center ${
                        isCurrent
                          ? 'bg-yellow-100 dark:bg-yellow-900/30 ring-2 ring-inset ring-yellow-400'
                          : isPast
                          ? 'bg-gray-50 dark:bg-gray-700/30'
                          : ''
                      }`}
                    >
                      {cellData.type === 'drafted' && cellData.player && (
                        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded px-2 py-1">
                          <div className="font-medium text-gray-900 dark:text-white text-xs truncate">
                            {cellData.player.name}
                          </div>
                          {!isPublicView && showScores && (
                            <div className="text-[10px] text-gray-500 dark:text-gray-400">
                              {cellData.player.totalScore.toFixed(1)} pts
                            </div>
                          )}
                          {/* Show lock icon if player was locked to this team */}
                          {(cellData.player.isCoachKid || cellData.player.lockedToTeamId) && (
                            <span className="inline-flex items-center gap-0.5 mt-0.5 px-1 py-0.5 text-[8px] font-semibold bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                              <Lock className="w-2 h-2" />
                            </span>
                          )}
                        </div>
                      )}

                      {cellData.type === 'prefilled' && cellData.player && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-dashed border-blue-300 dark:border-blue-700 rounded px-2 py-1">
                          <div className="font-medium text-blue-700 dark:text-blue-300 text-xs truncate">
                            {cellData.player.name}
                          </div>
                          {!isPublicView && showScores && (
                            <div className="text-[10px] text-blue-500 dark:text-blue-400">
                              {cellData.player.totalScore.toFixed(1)} pts
                            </div>
                          )}
                          <span className="inline-flex items-center gap-0.5 mt-0.5 px-1 py-0.5 text-[8px] font-semibold bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 rounded">
                            <Lock className="w-2 h-2" />
                          </span>
                        </div>
                      )}

                      {cellData.type === 'empty' && (
                        <div className={`h-10 ${
                          isCurrent
                            ? 'border-2 border-dashed border-yellow-400 rounded flex items-center justify-center'
                            : ''
                        }`}>
                          {isCurrent && (
                            <span className="text-[10px] text-yellow-600 dark:text-yellow-400 font-medium">
                              PICKING
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
        <div className="flex items-center gap-4 text-[10px] text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded"></div>
            <span>Drafted</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-50 dark:bg-blue-900/20 border border-dashed border-blue-300 dark:border-blue-700 rounded"></div>
            <span>Pre-filled (Locked)</span>
          </div>
          <div className="flex items-center gap-1">
            <Lock className="w-3 h-3" />
            <span>= Locked to Team</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 border-2 border-dashed border-yellow-400 rounded"></div>
            <span>Current Pick</span>
          </div>
        </div>
      </div>
    </div>
  );
};
