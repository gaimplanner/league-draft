import { useState, useMemo } from 'react';
import { X, ArrowLeftRight, AlertTriangle, AlertCircle } from 'lucide-react';
import { Team, Player } from '../types';
import { getTeamDisplayName } from '../utils/teamUtils';
import { ApiError } from '../api/client';

interface TradeModalProps {
  teams: Team[];
  players: Player[];
  onExecuteTrade: (
    team1Id: string,
    team2Id: string,
    player1Id: string,
    player2Id: string,
    reason: string
  ) => void;
  onClose: () => void;
}

export const TradeModal = ({ teams, players, onExecuteTrade, onClose }: TradeModalProps) => {
  const [team1Id, setTeam1Id] = useState<string>('');
  const [team2Id, setTeam2Id] = useState<string>('');
  const [player1Id, setPlayer1Id] = useState<string>('');
  const [player2Id, setPlayer2Id] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  // Prevent double-submit (Issue #11)
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Error state for displaying trade failures to user
  const [error, setError] = useState<string | null>(null);

  // Get rosters for selected teams
  const team1 = teams.find(t => t.id === team1Id);
  const team2 = teams.find(t => t.id === team2Id);

  const team1Roster = useMemo(() => {
    if (!team1) return [];
    return team1.roster.slice().sort((a, b) => {
      // Primary: Round drafted (ascending)
      const roundDiff = (a.draftedInRound ?? 99) - (b.draftedInRound ?? 99);
      if (roundDiff !== 0) return roundDiff;
      // Secondary: Overall rank (ascending)
      return (a.rank ?? 99) - (b.rank ?? 99);
    });
  }, [team1]);

  const team2Roster = useMemo(() => {
    if (!team2) return [];
    return team2.roster.slice().sort((a, b) => {
      // Primary: Round drafted (ascending)
      const roundDiff = (a.draftedInRound ?? 99) - (b.draftedInRound ?? 99);
      if (roundDiff !== 0) return roundDiff;
      // Secondary: Overall rank (ascending)
      return (a.rank ?? 99) - (b.rank ?? 99);
    });
  }, [team2]);

  // Get selected players for comparison
  const player1 = players.find(p => p.id === player1Id);
  const player2 = players.find(p => p.id === player2Id);

  // Calculate score impact
  const scoreImpact = useMemo(() => {
    if (!player1 || !player2 || !team1 || !team2) return null;
    const scoreDiff = player2.totalScore - player1.totalScore;
    return {
      team1: scoreDiff, // Team1 gains player2's score, loses player1's
      team2: -scoreDiff, // Team2 gains player1's score, loses player2's
      team1NewTotal: team1.totalScore + scoreDiff,
      team2NewTotal: team2.totalScore - scoreDiff,
    };
  }, [player1, player2, team1, team2]);

  const canTrade = team1Id && team2Id && player1Id && player2Id && reason.trim() && !isSubmitting;

  const handleTrade = async () => {
    if (!canTrade) return;
    // Prevent double-submit (Issue #11)
    setIsSubmitting(true);
    setError(null);
    try {
      await onExecuteTrade(team1Id, team2Id, player1Id, player2Id, reason.trim());
      onClose();
    } catch (err) {
      // Display error to user and allow retry
      let errorMessage = 'Failed to execute trade. Please try again.';
      if (err instanceof ApiError) {
        if (err.status === 401) {
          errorMessage = 'Your session has expired. Please log in again to continue.';
        } else if (err.details?.error && typeof err.details.error === 'string') {
          errorMessage = err.details.error;
        } else if (err.details?.detail && typeof err.details.detail === 'string') {
          errorMessage = err.details.detail;
        }
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      setError(errorMessage);
      setIsSubmitting(false);
    }
  };

  // When team selection changes, clear player selection
  const handleTeam1Change = (id: string) => {
    setTeam1Id(id);
    setPlayer1Id('');
    if (id === team2Id) {
      setTeam2Id('');
      setPlayer2Id('');
    }
  };

  const handleTeam2Change = (id: string) => {
    setTeam2Id(id);
    setPlayer2Id('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <ArrowLeftRight className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Execute Trade
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Team Selection */}
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            {/* Team 1 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Team 1
              </label>
              <select
                value={team1Id}
                onChange={(e) => handleTeam1Change(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select a team...</option>
                {teams.map(team => (
                  <option key={team.id} value={team.id}>
                    {getTeamDisplayName(team)} ({team.roster.length} players)
                  </option>
                ))}
              </select>
            </div>

            {/* Team 2 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Team 2
              </label>
              <select
                value={team2Id}
                onChange={(e) => handleTeam2Change(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                disabled={!team1Id}
              >
                <option value="">Select a team...</option>
                {teams
                  .filter(t => t.id !== team1Id)
                  .map(team => (
                    <option key={team.id} value={team.id}>
                      {getTeamDisplayName(team)} ({team.roster.length} players)
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Player Selection */}
          {team1Id && team2Id && (
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              {/* Team 1 Player */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Player from {getTeamDisplayName(team1!)}
                </label>
                <div className="border border-gray-300 dark:border-gray-600 rounded-lg max-h-48 overflow-y-auto">
                  {team1Roster.map(player => (
                    <button
                      key={player.id}
                      onClick={() => setPlayer1Id(player.id)}
                      className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 ${
                        player1Id === player.id ? 'bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500' : ''
                      }`}
                    >
                      <div>
                        <span className="text-xs text-purple-600 dark:text-purple-400 font-medium mr-2">
                          R{player.draftedInRound}
                        </span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {player.lastName}, {player.firstName}
                        </span>
                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                          Age {player.littleLeagueAge}
                        </span>
                        {player.isAllStar && <span className="ml-1" title="All-Star">⭐</span>}
                        {player.isCoachKid && <span className="ml-1 text-blue-600" title="Coach's Kid">🔵</span>}
                      </div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        {player.totalScore.toFixed(1)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Team 2 Player */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Player from {getTeamDisplayName(team2!)}
                </label>
                <div className="border border-gray-300 dark:border-gray-600 rounded-lg max-h-48 overflow-y-auto">
                  {team2Roster.map(player => (
                    <button
                      key={player.id}
                      onClick={() => setPlayer2Id(player.id)}
                      className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 ${
                        player2Id === player.id ? 'bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500' : ''
                      }`}
                    >
                      <div>
                        <span className="text-xs text-purple-600 dark:text-purple-400 font-medium mr-2">
                          R{player.draftedInRound}
                        </span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {player.lastName}, {player.firstName}
                        </span>
                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                          Age {player.littleLeagueAge}
                        </span>
                        {player.isAllStar && <span className="ml-1" title="All-Star">⭐</span>}
                        {player.isCoachKid && <span className="ml-1 text-blue-600" title="Coach's Kid">🔵</span>}
                      </div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        {player.totalScore.toFixed(1)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Trade Comparison */}
          {player1 && player2 && scoreImpact && (
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-6">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Trade Impact
              </h3>
              <div className="grid md:grid-cols-3 gap-4">
                {/* Player 1 */}
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    {getTeamDisplayName(team1!)} sends:
                  </div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {player1.firstName} {player1.lastName}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Age {player1.littleLeagueAge}
                  </div>
                  <div className="text-sm text-purple-600 dark:text-purple-400">
                    Drafted: Round {player1.draftedInRound}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Score: {player1.totalScore.toFixed(1)}
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex items-center justify-center">
                  <ArrowLeftRight className="w-8 h-8 text-blue-500" />
                </div>

                {/* Player 2 */}
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    {getTeamDisplayName(team2!)} sends:
                  </div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {player2.firstName} {player2.lastName}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Age {player2.littleLeagueAge}
                  </div>
                  <div className="text-sm text-purple-600 dark:text-purple-400">
                    Drafted: Round {player2.draftedInRound}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Score: {player2.totalScore.toFixed(1)}
                  </div>
                </div>
              </div>

              {/* Score Impact Summary */}
              <div className="mt-4 grid md:grid-cols-2 gap-4">
                <div className={`p-3 rounded-lg ${scoreImpact.team1 >= 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {getTeamDisplayName(team1!)}
                  </div>
                  <div className={`text-lg font-bold ${scoreImpact.team1 >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {scoreImpact.team1 >= 0 ? '+' : ''}{scoreImpact.team1.toFixed(1)} pts
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    New total: {scoreImpact.team1NewTotal.toFixed(1)}
                  </div>
                </div>

                <div className={`p-3 rounded-lg ${scoreImpact.team2 >= 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {getTeamDisplayName(team2!)}
                  </div>
                  <div className={`text-lg font-bold ${scoreImpact.team2 >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {scoreImpact.team2 >= 0 ? '+' : ''}{scoreImpact.team2.toFixed(1)} pts
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    New total: {scoreImpact.team2NewTotal.toFixed(1)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Reason */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Reason for Trade <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Carpool arrangement, balancing ages, etc."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* Warning */}
          <div className="flex items-start gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg mb-6">
            <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>Note:</strong> Trades are recorded in the official draft record. This action cannot be undone, but another trade can be made to reverse it.
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg mb-6">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-800 dark:text-red-200">
                <strong>Error:</strong> {error}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleTrade}
            disabled={!canTrade}
            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${
              canTrade
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
            }`}
          >
            <ArrowLeftRight className="w-4 h-4" />
            {isSubmitting ? 'Executing...' : 'Execute Trade'}
          </button>
        </div>
      </div>
    </div>
  );
};
