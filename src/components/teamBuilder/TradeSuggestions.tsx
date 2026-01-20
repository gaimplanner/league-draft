import { useState } from 'react';
import {
  ArrowLeftRight,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { TradeCandidate } from '../../types';

interface TradeSuggestionsProps {
  suggestedTrades: TradeCandidate[];
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
  onApplyTrade,
  onApplyAll,
  onDismissTrade,
  appliedTradeIds,
  dismissedTradeIds,
}: TradeSuggestionsProps) => {
  const [isExpanded, setIsExpanded] = useState(true);

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
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Trade card component
const TradeCard = ({
  trade,
  status,
  onApply,
  onDismiss,
}: {
  trade: TradeCandidate;
  status: 'pending' | 'applied' | 'dismissed';
  onApply?: () => void;
  onDismiss?: () => void;
}) => {
  const statusStyles = {
    pending: 'border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-800',
    applied: 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20',
    dismissed: 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 opacity-60',
  };

  return (
    <div className={`border rounded-lg p-3 ${statusStyles[status]}`}>
      <div className="flex items-center justify-between">
        {/* Trade visualization */}
        <div className="flex items-center gap-3 flex-1">
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
    </div>
  );
};

export default TradeSuggestions;
