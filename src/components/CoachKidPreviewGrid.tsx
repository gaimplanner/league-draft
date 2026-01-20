import { useMemo } from 'react';
import { Lock } from 'lucide-react';
import { Player, Team } from '../types';
import { getTeamDisplayName } from '../utils/teamUtils';

interface CoachKidPreviewGridProps {
  teams: Team[];
  players: Player[];
  draftOrder: string[];
  rosterSize: number;
}

interface CellData {
  type: 'empty' | 'prefilled';
  player?: Player;
  reason?: 'coach-kid' | 'sibling';
}

/**
 * Pre-draft preview grid showing where coach's kids will be placed.
 * Used as a sanity check before starting the draft.
 */
export const CoachKidPreviewGrid = ({
  teams,
  players,
  draftOrder,
  rosterSize,
}: CoachKidPreviewGridProps) => {
  // Get teams in draft order
  const sortedTeams = useMemo(() => {
    if (draftOrder.length > 0) {
      return [...teams].sort((a, b) => {
        const aIndex = draftOrder.indexOf(a.id);
        const bIndex = draftOrder.indexOf(b.id);
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      });
    }
    return teams;
  }, [teams, draftOrder]);

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
    const prefilled = getPrefilledPlayer(teamId, round);
    if (prefilled) {
      return {
        type: 'prefilled',
        player: prefilled.player,
        reason: prefilled.reason,
      };
    }
    return { type: 'empty' };
  };

  // Generate round numbers based on roster size
  const rounds = useMemo(() => {
    return Array.from({ length: rosterSize }, (_, i) => i + 1);
  }, [rosterSize]);

  // Count total locked picks for summary
  const lockedPickCount = useMemo(() => {
    return players.filter(p =>
      !p.isDrafted && (
        (p.isCoachKid && p.coachTeamId) ||
        p.lockedToTeamId
      )
    ).length;
  }, [players]);

  if (lockedPickCount === 0) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Coach's Kid Draft Preview
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {lockedPickCount} locked pick{lockedPickCount !== 1 ? 's' : ''} will be auto-assigned in these positions
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
              <th className="sticky left-0 z-20 bg-gray-50 dark:bg-gray-700/50 px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 w-16 border-r border-gray-200 dark:border-gray-600">
                Rd
              </th>
              {sortedTeams.map((team, idx) => (
                <th
                  key={team.id}
                  className="px-2 py-2 text-center text-xs font-semibold min-w-[120px] text-gray-600 dark:text-gray-300"
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[10px] text-gray-400 dark:text-gray-500">
                      #{idx + 1}
                    </span>
                    <span className="truncate max-w-[110px]">
                      {getTeamDisplayName(team)}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {rounds.map((round) => {
              // Check if this round has any locked picks
              const hasLockedPicks = sortedTeams.some(team =>
                getCellData(team.id, round).type === 'prefilled'
              );

              return (
                <tr
                  key={round}
                  className={hasLockedPicks ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}
                >
                  <td className="sticky left-0 z-10 bg-white dark:bg-gray-800 px-3 py-1.5 text-center font-bold text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-600 text-xs">
                    {round}
                  </td>
                  {sortedTeams.map((team) => {
                    const cellData = getCellData(team.id, round);

                    return (
                      <td key={team.id} className="px-1 py-1 text-center">
                        {cellData.type === 'prefilled' && cellData.player && (
                          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded px-1.5 py-1">
                            <div className="font-medium text-blue-700 dark:text-blue-300 text-xs truncate">
                              {cellData.player.name}
                            </div>
                            <div className="flex items-center justify-center gap-1 mt-0.5">
                              <span className="text-[10px] text-blue-500 dark:text-blue-400">
                                {cellData.player.totalScore.toFixed(1)}
                              </span>
                              <span className="inline-flex items-center px-1 py-0.5 text-[8px] font-semibold bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 rounded">
                                <Lock className="w-2 h-2 mr-0.5" />
                                {cellData.reason === 'coach-kid' ? 'CK' : 'SIB'}
                              </span>
                            </div>
                          </div>
                        )}
                        {cellData.type === 'empty' && (
                          <div className="h-8" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
        <div className="flex items-center gap-4 text-[10px] text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded"></div>
            <span>Locked Pick</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="px-1 py-0.5 text-[8px] font-semibold bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 rounded">CK</span>
            <span>= Coach's Kid</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="px-1 py-0.5 text-[8px] font-semibold bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 rounded">SIB</span>
            <span>= Sibling</span>
          </div>
        </div>
      </div>
    </div>
  );
};
