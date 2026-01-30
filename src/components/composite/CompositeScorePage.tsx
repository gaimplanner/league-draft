import { useState, useEffect, useMemo, useCallback } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useSeasons } from '../../hooks/useSeasons';
import { useCompositeScores } from '../../hooks/useCompositeScores';
import { api } from '../../api/client';
import type { CompositeWeights, EvaluationTemplate, CompositePlayerDetail, Season, CompositeDataTier } from '../../types';
import { WeightConfigPanel } from './WeightConfigPanel';
import { RankingsList } from './RankingsList';

interface CompositeScorePageProps {
  onBack: () => void;
}

/**
 * Main composite scoring page.
 * Shows weight configuration panel and ranked player list with live preview.
 */
export function CompositeScorePage({ onBack }: CompositeScorePageProps) {
  const { seasons, fetchSeasons } = useSeasons();
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);
  const [template, setTemplate] = useState<EvaluationTemplate | null>(null);
  const [weights, setWeights] = useState<CompositeWeights | null>(null);
  const [expandedPlayerKey, setExpandedPlayerKey] = useState<string | null>(null);
  const [expandedPlayerDetail, setExpandedPlayerDetail] = useState<CompositePlayerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const { scores, loading, error, previousRanks, calculate, getPlayerDetail, promotePlayer } =
    useCompositeScores(selectedSeasonId);

  // Load seasons on mount
  useEffect(() => {
    fetchSeasons();
  }, [fetchSeasons]);

  // Auto-select the first active season
  useEffect(() => {
    if (seasons.length > 0 && !selectedSeasonId) {
      const activeSeason = seasons.find(s => s.isActive) || seasons[0];
      setSelectedSeasonId(activeSeason.id);
    }
  }, [seasons, selectedSeasonId]);

  // Get the selected season object
  const selectedSeason: Season | undefined = useMemo(
    () => seasons.find(s => s.id === selectedSeasonId),
    [seasons, selectedSeasonId]
  );

  // Load template when season changes
  useEffect(() => {
    if (!selectedSeason) return;

    const loadTemplate = async () => {
      try {
        const tmpl = await api.getEvaluationTemplate(selectedSeason.templateId);
        setTemplate(tmpl);
        // Initialize weights from template
        setWeights({
          coachRating: tmpl.blendWeights.coachRating,
          tryoutScore: tmpl.blendWeights.tryoutScore,
        });
      } catch (err) {
        console.error('Failed to load template:', err);
      }
    };

    loadTemplate();
  }, [selectedSeason]);

  // Calculate composite scores on mount (with template default weights)
  useEffect(() => {
    if (selectedSeasonId && weights) {
      calculate(weights);
    }
  }, [selectedSeasonId, weights, calculate]);

  // Handle weight changes (live preview)
  const handleWeightsChange = useCallback((newWeights: CompositeWeights) => {
    setWeights(newWeights);
    if (selectedSeasonId) {
      calculate(newWeights);
    }
  }, [selectedSeasonId, calculate]);

  // Handle player row click (expand detail)
  const handlePlayerClick = useCallback(async (playerKey: string) => {
    if (expandedPlayerKey === playerKey) {
      // Collapse
      setExpandedPlayerKey(null);
      setExpandedPlayerDetail(null);
    } else {
      // Expand
      setExpandedPlayerKey(playerKey);
      setDetailLoading(true);
      const detail = await getPlayerDetail(playerKey, weights || undefined);
      setExpandedPlayerDetail(detail);
      setDetailLoading(false);
    }
  }, [expandedPlayerKey, getPlayerDetail, weights]);

  // Handle promote/demote
  const handlePromote = useCallback(async (playerKey: string, targetTier: CompositeDataTier) => {
    if (!weights) return;
    await promotePlayer(playerKey, targetTier, weights);
    // Clear expanded state
    setExpandedPlayerKey(null);
    setExpandedPlayerDetail(null);
  }, [weights, promotePlayer]);

  if (!selectedSeason || !template || !weights) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
        >
          <ChevronLeft className="w-5 h-5" />
          Back
        </button>
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
          >
            <ChevronLeft className="w-5 h-5" />
            Back
          </button>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Composite Scores
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Season: {selectedSeason.name}
          </p>
        </div>

        {/* Season Selector */}
        {seasons.length > 1 && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Season
            </label>
            <select
              value={selectedSeasonId || ''}
              onChange={(e) => setSelectedSeasonId(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              {seasons.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.name} {season.isActive ? '(Active)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Weight Config Panel */}
        <WeightConfigPanel
          weights={weights}
          template={template}
          onChange={handleWeightsChange}
        />

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading && !scores && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Calculating composite scores...</p>
          </div>
        )}

        {/* Rankings List */}
        {scores && (
          <RankingsList
            scores={scores}
            previousRanks={previousRanks}
            template={template}
            onPlayerClick={handlePlayerClick}
            onPromote={handlePromote}
            expandedPlayerKey={expandedPlayerKey}
            expandedPlayerDetail={expandedPlayerDetail}
            detailLoading={detailLoading}
          />
        )}
      </div>
    </div>
  );
}
