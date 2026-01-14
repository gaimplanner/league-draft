import { useState, useEffect } from 'react';
import { ChevronRight, ChevronUp, ChevronDown, CheckCircle, AlertCircle } from 'lucide-react';
import { Team, Player, DraftFormat } from '../types';

interface DraftConfigProps {
  teams: Team[];
  players: Player[];
  onConfigComplete: (draftFormat: DraftFormat, draftOrder: string[]) => void;
}

export const DraftConfig = ({ teams, players, onConfigComplete }: DraftConfigProps) => {
  const [draftFormat, setDraftFormat] = useState<DraftFormat>('snake');
  const [draftOrder, setDraftOrder] = useState<string[]>([]);

  // Initialize draft order from teams
  useEffect(() => {
    setDraftOrder(teams.map((t) => t.id));
  }, [teams]);

  const coachKids = players.filter((p) => p.isCoachKid);

  const moveTeam = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...draftOrder];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= newOrder.length) return;

    [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
    setDraftOrder(newOrder);
  };

  const handleStart = () => {
    // Validate all coach kids are assigned
    const unassignedCoachKids = coachKids.filter(p => !p.coachTeamId);

    if (unassignedCoachKids.length > 0) {
      alert(`Please go back and assign all coach's kids to teams before starting the draft.\n\nUnassigned: ${unassignedCoachKids.map(p => p.name).join(', ')}`);
      return;
    }

    onConfigComplete(draftFormat, draftOrder);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Draft Configuration</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Set up teams, draft order, and format
            </p>
          </div>

          <button
            onClick={handleStart}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium flex items-center gap-2"
          >
            Start Draft
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Coach's Kids Summary */}
        {coachKids.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Coach's Kids Assignments
            </h2>
            {coachKids.every(p => p.coachTeamId) ? (
              <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-medium text-green-800 dark:text-green-200 mb-2">
                    All coach's kids assigned
                  </div>
                  <div className="space-y-1">
                    {coachKids.map(player => {
                      const team = teams.find(t => t.id === player.coachTeamId);
                      return (
                        <div key={player.id} className="text-sm text-green-700 dark:text-green-300">
                          • {player.name} → {team?.name} (Round {player.projectedRound})
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-medium text-orange-800 dark:text-orange-200 mb-2">
                    Coach's kids need assignment
                  </div>
                  <div className="text-sm text-orange-700 dark:text-orange-300 mb-2">
                    Please go back to the Review phase to assign these players to their teams:
                  </div>
                  <div className="space-y-1">
                    {coachKids.filter(p => !p.coachTeamId).map(player => (
                      <div key={player.id} className="text-sm text-orange-700 dark:text-orange-300">
                        • {player.name} (Rank #{player.rank}, Round {player.projectedRound})
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Draft Format */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Draft Format
            </h2>
            <div className="space-y-3">
              {[
                { value: 'straight', label: 'Straight', desc: '1-8, 1-8, 1-8...' },
                { value: 'snake', label: 'Snake', desc: '1-8, 8-1, 1-8, 8-1...' },
                { value: 'recalculated', label: 'Recalculated', desc: 'Lowest score picks first each round' },
              ].map((format) => (
                <label
                  key={format.value}
                  className="flex items-start gap-3 p-3 border border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <input
                    type="radio"
                    name="format"
                    value={format.value}
                    checked={draftFormat === format.value}
                    onChange={(e) => setDraftFormat(e.target.value as DraftFormat)}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{format.label}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">{format.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Draft Order */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Draft Order
            </h2>
            <div className="space-y-2">
              {draftOrder.map((teamId, index) => {
                const team = teams.find((t) => t.id === teamId);
                if (!team) return null;

                const teamCoachKids = players.filter(p => p.coachTeamId === teamId);

                return (
                  <div
                    key={teamId}
                    className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded"
                  >
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400 w-8">
                      #{index + 1}
                    </span>
                    <div className="flex-1">
                      <span className="text-gray-900 dark:text-white">{team.name}</span>
                      {teamCoachKids.length > 0 && (
                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                          (Coach: {teamCoachKids.map(p => p.name).join(', ')})
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => moveTeam(index, 'up')}
                        disabled={index === 0}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded disabled:opacity-30"
                        title="Move up"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => moveTeam(index, 'down')}
                        disabled={index === draftOrder.length - 1}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded disabled:opacity-30"
                        title="Move down"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
