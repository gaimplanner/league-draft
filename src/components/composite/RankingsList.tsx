import { ArrowUp, ArrowDown, Minus, ChevronDown, ChevronUp, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import type { CompositeScoresResponse, CompositeDataTier, EvaluationTemplate } from '../../types';
import { PlayerEvaluationBreakdown } from './PlayerEvaluationBreakdown';

interface RankingsListProps {
  scores: CompositeScoresResponse;
  previousRanks: Map<string, number>;
  template: EvaluationTemplate;
  onPlayerClick: (playerKey: string) => void;
  onPromote: (playerKey: string, targetTier: CompositeDataTier) => void;
  expandedPlayerKey: string | null;
  expandedPlayerDetail: any;
  detailLoading: boolean;
}

/**
 * Ranked player table with expandable rows, tier sections, and rank deltas.
 * Shows three-tier structure: full-data, coach-only, tryout-only.
 */
export function RankingsList({
  scores,
  previousRanks,
  template,
  onPlayerClick,
  onPromote,
  expandedPlayerKey,
  expandedPlayerDetail,
  detailLoading,
}: RankingsListProps) {
  const fullPlayers = scores.players.filter(p => p.tier === 'full');
  const coachOnlyPlayers = scores.players.filter(p => p.tier === 'coach_only');
  const tryoutOnlyPlayers = scores.players.filter(p => p.tier === 'tryout_only');

  const renderDelta = (playerKey: string, currentIndex: number) => {
    if (previousRanks.size === 0) return null;

    const prevIndex = previousRanks.get(playerKey);
    if (prevIndex === undefined) return null;

    const delta = prevIndex - currentIndex;
    if (delta === 0) {
      return (
        <span className="text-gray-400 dark:text-gray-600" title="No change">
          <Minus className="w-4 h-4" />
        </span>
      );
    }

    if (delta > 0) {
      return (
        <span className="flex items-center gap-1 text-green-600 dark:text-green-400" title={`Up ${delta} positions`}>
          <ArrowUp className="w-4 h-4" />
          <span className="text-xs font-medium">{delta}</span>
        </span>
      );
    }

    return (
      <span className="flex items-center gap-1 text-red-600 dark:text-red-400" title={`Down ${Math.abs(delta)} positions`}>
        <ArrowDown className="w-4 h-4" />
        <span className="text-xs font-medium">{Math.abs(delta)}</span>
      </span>
    );
  };

  const renderPlayerRow = (player: any, index: number, tier: CompositeDataTier) => {
    const isExpanded = expandedPlayerKey === player.playerKey;
    const dataSources = player.dataSources.join(' + ').replace('coach', 'Coach').replace('tryout', 'Tryout');
    const hasPartialData = player.isPartialTryout;

    return (
      <div key={player.playerKey}>
        <div
          className={`flex items-center px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors ${
            isExpanded ? 'bg-blue-50 dark:bg-blue-900/20' : ''
          }`}
          onClick={() => onPlayerClick(player.playerKey)}
        >
          {/* Rank */}
          <div className="w-12 text-center font-medium text-gray-700 dark:text-gray-300">
            {player.rank}
          </div>

          {/* Expand indicator */}
          <div className="w-8 flex justify-center">
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </div>

          {/* Name */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-gray-900 dark:text-white font-medium">
                {player.firstName} {player.lastName}
              </span>
              {player.bibNumber && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  (#{player.bibNumber})
                </span>
              )}
              {hasPartialData && (
                <span
                  className="text-yellow-600 dark:text-yellow-400"
                  title="Missing some tryout stations"
                >
                  *
                </span>
              )}
              {player.tierOverride && (
                <span
                  className="text-purple-600 dark:text-purple-400"
                  title="Admin promoted/demoted"
                >
                  {tier === 'full' ? (
                    <ArrowDownRight className="w-3.5 h-3.5" />
                  ) : (
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  )}
                </span>
              )}
            </div>
          </div>

          {/* Composite Score */}
          <div className="w-24 text-right font-semibold text-gray-900 dark:text-white">
            {player.compositeScore.toFixed(1)}
          </div>

          {/* Data Sources */}
          <div className="w-32 text-right text-sm text-gray-600 dark:text-gray-400">
            {dataSources}
          </div>

          {/* Delta */}
          <div className="w-16 flex justify-center">
            {renderDelta(player.playerKey, index)}
          </div>

          {/* Promote/Demote */}
          <div className="w-32 flex justify-end">
            <select
              value=""
              onChange={(e) => {
                e.stopPropagation();
                if (e.target.value) {
                  onPromote(player.playerKey, e.target.value as CompositeDataTier);
                }
              }}
              className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              onClick={(e) => e.stopPropagation()}
            >
              <option value="">Move to...</option>
              {tier !== 'full' && <option value="full">Full Evaluation</option>}
              {tier !== 'coach_only' && <option value="coach_only">Coach Only</option>}
              {tier !== 'tryout_only' && <option value="tryout_only">Tryout Only</option>}
            </select>
          </div>
        </div>

        {/* Expanded detail */}
        {isExpanded && (
          <PlayerEvaluationBreakdown
            detail={expandedPlayerDetail}
            template={template}
            loading={detailLoading}
          />
        )}
      </div>
    );
  };

  const renderTierSection = (
    title: string,
    count: number,
    players: any[],
    tier: CompositeDataTier
  ) => {
    if (players.length === 0) {
      return (
        <div className="mb-6">
          <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2 font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
            {title} ({count} players)
          </div>
          <div className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
            No players in this tier
          </div>
        </div>
      );
    }

    return (
      <div className="mb-6">
        <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2 font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
          {title} ({count} players)
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {players.map((player, index) => renderPlayerRow(player, index, tier))}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* Table Header */}
      <div className="flex items-center px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300">
        <div className="w-12 text-center">Rank</div>
        <div className="w-8"></div>
        <div className="flex-1">Name</div>
        <div className="w-24 text-right">Score</div>
        <div className="w-32 text-right">Data Sources</div>
        <div className="w-16 text-center">Delta</div>
        <div className="w-32"></div>
      </div>

      {/* Tier Sections */}
      {renderTierSection('Full Evaluation', scores.tierCounts.full, fullPlayers, 'full')}
      {renderTierSection('Coach Rating Only', scores.tierCounts.coachOnly, coachOnlyPlayers, 'coach_only')}
      {renderTierSection('Tryout Score Only', scores.tierCounts.tryoutOnly, tryoutOnlyPlayers, 'tryout_only')}
    </div>
  );
}
