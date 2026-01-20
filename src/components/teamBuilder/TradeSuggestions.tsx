import { useState, useMemo } from 'react';
import {
  ArrowLeftRight,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  TrendingUp,
  Zap,
  Users,
  GraduationCap,
  User,
  Scale,
  Info,
} from 'lucide-react';
import { TradeCandidate, Player } from '../../types';

interface TradeSuggestionsProps {
  suggestedTrades: TradeCandidate[];
  players: Player[];  // Full player data for trade evaluation
  onApplyTrade: (trade: TradeCandidate) => void;
  onApplyAll: () => void;
  onDismissTrade: (tradeId: string) => void;
  appliedTradeIds: Set<string>;
  dismissedTradeIds: Set<string>;
}

/**
 * Trade Suggestions component for balancing teams after requests-first assignment.
 * Shows suggested player swaps that improve balance without breaking satisfied requests.
 */
export const TradeSuggestions = ({
  suggestedTrades,
  players,
  onApplyTrade,
  onApplyAll,
  onDismissTrade,
  appliedTradeIds,
  dismissedTradeIds,
}: TradeSuggestionsProps) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [expandedTradeId, setExpandedTradeId] = useState<string | null>(null);

  // Create player lookup map
  const playerMap = useMemo(() => new Map(players.map(p => [p.id, p])), [players]);

  // Filter to pending trades only
  const pendingTrades = suggestedTrades.filter(
    t => !appliedTradeIds.has(t.id) && !dismissedTradeIds.has(t.id)
  );
  const appliedTrades = suggestedTrades.filter(t => appliedTradeIds.has(t.id));
  const dismissedTrades = suggestedTrades.filter(t => dismissedTradeIds.has(t.id));

  if (suggestedTrades.length === 0) {
    return (
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-start gap-3">
        <Check className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-green-800 dark:text-green-200">
            Teams are well balanced
          </h3>
          <p className="text-sm text-green-700 dark:text-green-300 mt-1">
            No trades needed to improve balance. All tradeable players are optimally placed.
          </p>
        </div>
      </div>
    );
  }

  // Calculate total potential improvement
  const totalPotentialImprovement = pendingTrades.reduce(
    (sum, t) => sum + t.balanceImprovement,
    0
  );

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <ArrowLeftRight className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-blue-800 dark:text-blue-200">
              Suggested Trades for Balance
            </h3>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              {pendingTrades.length} trade{pendingTrades.length !== 1 ? 's' : ''} available
              {appliedTrades.length > 0 && ` (${appliedTrades.length} applied)`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {pendingTrades.length > 0 && (
            <div className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400">
              <TrendingUp className="w-4 h-4" />
              <span>+{totalPotentialImprovement.toFixed(1)} balance improvement</span>
            </div>
          )}
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          )}
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Info box */}
          <div className="flex items-start gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm">
            <AlertCircle className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0 mt-0.5" />
            <p className="text-gray-600 dark:text-gray-400">
              These trades swap tradeable players (those with no requests or all requests satisfied)
              to improve team balance without affecting anyone's happiness.
            </p>
          </div>

          {/* Quick apply all button */}
          {pendingTrades.length > 1 && (
            <button
              onClick={onApplyAll}
              className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4" />
              Apply All {pendingTrades.length} Trades
            </button>
          )}

          {/* Pending trades */}
          {pendingTrades.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Pending ({pendingTrades.length})
              </h4>
              {pendingTrades.map(trade => (
                <TradeCard
                  key={trade.id}
                  trade={trade}
                  status="pending"
                  isExpanded={expandedTradeId === trade.id}
                  onToggleExpand={() => setExpandedTradeId(expandedTradeId === trade.id ? null : trade.id)}
                  player1={playerMap.get(trade.player1Id)}
                  player2={playerMap.get(trade.player2Id)}
                  onApply={() => onApplyTrade(trade)}
                  onDismiss={() => onDismissTrade(trade.id)}
                />
              ))}
            </div>
          )}

          {/* Applied trades */}
          {appliedTrades.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-green-700 dark:text-green-300">
                Applied ({appliedTrades.length})
              </h4>
              {appliedTrades.map(trade => (
                <TradeCard
                  key={trade.id}
                  trade={trade}
                  status="applied"
                  isExpanded={expandedTradeId === trade.id}
                  onToggleExpand={() => setExpandedTradeId(expandedTradeId === trade.id ? null : trade.id)}
                  player1={playerMap.get(trade.player1Id)}
                  player2={playerMap.get(trade.player2Id)}
                />
              ))}
            </div>
          )}

          {/* Dismissed trades */}
          {dismissedTrades.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Skipped ({dismissedTrades.length})
              </h4>
              {dismissedTrades.map(trade => (
                <TradeCard
                  key={trade.id}
                  trade={trade}
                  status="dismissed"
                  isExpanded={expandedTradeId === trade.id}
                  onToggleExpand={() => setExpandedTradeId(expandedTradeId === trade.id ? null : trade.id)}
                  player1={playerMap.get(trade.player1Id)}
                  player2={playerMap.get(trade.player2Id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Trade card component with expandable evaluator
const TradeCard = ({
  trade,
  status,
  isExpanded,
  onToggleExpand,
  player1,
  player2,
  onApply,
  onDismiss,
}: {
  trade: TradeCandidate;
  status: 'pending' | 'applied' | 'dismissed';
  isExpanded: boolean;
  onToggleExpand: () => void;
  player1?: Player;
  player2?: Player;
  onApply?: () => void;
  onDismiss?: () => void;
}) => {
  const statusStyles = {
    pending: 'border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-800',
    applied: 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20',
    dismissed: 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 opacity-60',
  };

  return (
    <div className={`border rounded-lg overflow-hidden ${statusStyles[status]}`}>
      {/* Main trade row */}
      <div className="p-3 flex items-center justify-between">
        {/* Trade visualization */}
        <div className="flex items-center gap-3 flex-1">
          {/* Evaluate button */}
          <button
            onClick={onToggleExpand}
            className={`p-1.5 rounded-lg transition-colors ${
              isExpanded
                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
            title="Evaluate trade"
          >
            <Info className="w-4 h-4" />
          </button>

          {/* From team & player */}
          <div className="flex-1 text-right">
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {trade.player1Name}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {trade.fromTeamName}
            </div>
          </div>

          {/* Arrow */}
          <div className="flex items-center gap-1 px-2">
            <ArrowLeftRight className={`w-5 h-5 ${
              status === 'applied'
                ? 'text-green-500 dark:text-green-400'
                : status === 'dismissed'
                  ? 'text-gray-400'
                  : 'text-blue-500 dark:text-blue-400'
            }`} />
          </div>

          {/* To team & player */}
          <div className="flex-1 text-left">
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {trade.player2Name}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {trade.toTeamName}
            </div>
          </div>
        </div>

        {/* Balance improvement & actions */}
        <div className="flex items-center gap-3 ml-4">
          <div className={`text-sm font-medium ${
            status === 'applied'
              ? 'text-green-600 dark:text-green-400'
              : status === 'dismissed'
                ? 'text-gray-400'
                : 'text-blue-600 dark:text-blue-400'
          }`}>
            +{trade.balanceImprovement.toFixed(1)}
          </div>

          {status === 'pending' && (
            <div className="flex items-center gap-1">
              <button
                onClick={onApply}
                className="p-1.5 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                title="Apply trade"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={onDismiss}
                className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                title="Skip trade"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {status === 'applied' && (
            <div className="p-1.5 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
              <Check className="w-4 h-4" />
            </div>
          )}

          {status === 'dismissed' && (
            <div className="p-1.5 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-400">
              <X className="w-4 h-4" />
            </div>
          )}
        </div>
      </div>

      {/* Expanded trade evaluator */}
      {isExpanded && (
        <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <Scale className="w-4 h-4" />
            Trade Evaluation
          </h4>

          <div className="grid grid-cols-2 gap-4">
            {/* Player 1 details */}
            <PlayerTradeDetails
              player={player1}
              playerName={trade.player1Name}
              currentTeam={trade.fromTeamName}
              movingTo={trade.toTeamName}
              direction="leaving"
            />

            {/* Player 2 details */}
            <PlayerTradeDetails
              player={player2}
              playerName={trade.player2Name}
              currentTeam={trade.toTeamName}
              movingTo={trade.fromTeamName}
              direction="leaving"
            />
          </div>

          {/* Trade benefit summary */}
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="text-sm font-medium text-blue-800 dark:text-blue-200 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Trade Benefit
            </div>
            <div className="text-xs text-blue-700 dark:text-blue-300 mt-1 space-y-1">
              <p>• Balance improvement: <span className="font-semibold">+{trade.balanceImprovement.toFixed(1)}</span> points</p>
              <p>• Both players have no requests or all requests already satisfied</p>
              <p>• This trade will not affect anyone's happiness score</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Player details for trade evaluation
const PlayerTradeDetails = ({
  player,
  playerName,
  currentTeam,
  movingTo,
  direction: _direction,
}: {
  player?: Player;
  playerName: string;
  currentTeam: string;
  movingTo: string;
  direction: 'leaving' | 'joining';
}) => {
  const hasRequests = player && (
    (player.teammateRequests && player.teammateRequests.length > 0) ||
    player.coachRequest
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
      <div className="font-medium text-gray-900 dark:text-white text-sm mb-2">
        {playerName}
      </div>

      <div className="space-y-2 text-xs">
        {/* Score */}
        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
          <span className="font-medium">Score:</span>
          <span className="font-semibold text-gray-900 dark:text-white">
            {player?.totalScore?.toFixed(1) ?? 'N/A'}
          </span>
        </div>

        {/* School */}
        <div className="flex items-start gap-2 text-gray-600 dark:text-gray-400">
          <GraduationCap className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>{player?.school || 'No school listed'}</span>
        </div>

        {/* Coach Request */}
        {player?.coachRequest && (
          <div className="flex items-start gap-2 text-gray-600 dark:text-gray-400">
            <User className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>Coach: {player.coachRequest}</span>
          </div>
        )}

        {/* Teammate Requests */}
        {player?.teammateRequests && player.teammateRequests.length > 0 && (
          <div className="flex items-start gap-2 text-gray-600 dark:text-gray-400">
            <Users className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>Teammates: {player.teammateRequests.join(', ')}</span>
          </div>
        )}

        {/* No requests indicator */}
        {!hasRequests && (
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <Check className="w-3.5 h-3.5" />
            <span>No requests (tradeable)</span>
          </div>
        )}

        {/* Movement info */}
        <div className="pt-2 mt-2 border-t border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400">
          <span className="text-gray-400">→</span> Moving from <span className="font-medium">{currentTeam}</span> to <span className="font-medium">{movingTo}</span>
        </div>
      </div>
    </div>
  );
};

export default TradeSuggestions;
