import { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSeasons } from '../../hooks/useSeasons';
import { useCoachRatings } from '../../hooks/useCoachRatings';
import { api } from '../../api/client';
import type { CoachRating, CoachCategoryDefinition, Season } from '../../types';
import { CoachRosterList } from './CoachRosterList';
import { PlayerRatingForm } from './PlayerRatingForm';
import { AdminRatingDashboard } from './AdminRatingDashboard';

type RatingTab = 'my-ratings' | 'progress';
type PageView = 'list' | 'form';

interface CoachRatingPageProps {
  onBack: () => void;
}

/**
 * Top-level page for coach ratings.
 * Orchestrates season selection, tab navigation, roster list, rating form,
 * and admin progress dashboard.
 */
export function CoachRatingPage({ onBack }: CoachRatingPageProps) {
  const { user } = useAuth();
  const { seasons, fetchSeasons } = useSeasons();
  const {
    ratings,
    progress,
    isLoading,
    error,
    fetchRatings,
    createRating,
    updateRating,
    submitRating,
    fetchProgress,
  } = useCoachRatings();

  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);
  const [coachCategories, setCoachCategories] = useState<CoachCategoryDefinition[]>([]);
  const [activeTab, setActiveTab] = useState<RatingTab>('my-ratings');
  const [pageView, setPageView] = useState<PageView>('list');
  const [selectedRating, setSelectedRating] = useState<CoachRating | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Check if user is admin in any organization
  const isAdmin = useMemo(() => {
    if (!user) return false;
    return user.organizations.some(org => org.role === 'admin');
  }, [user]);

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

  // Load template coach categories when season changes
  useEffect(() => {
    if (!selectedSeason) return;

    const loadTemplate = async () => {
      try {
        const template = await api.getEvaluationTemplate(selectedSeason.templateId);
        setCoachCategories(template.coachCategories || []);
      } catch (err) {
        console.error('Failed to load template:', err);
        setCoachCategories([]);
      }
    };
    loadTemplate();
  }, [selectedSeason]);

  // Load ratings when season changes
  useEffect(() => {
    if (selectedSeasonId) {
      fetchRatings(selectedSeasonId);
    }
  }, [selectedSeasonId, fetchRatings]);

  // Handle selecting a player to rate
  const handleSelectPlayer = useCallback((rating: CoachRating) => {
    setSelectedRating(rating);
    setPageView('form');
  }, []);

  // Handle adding a new player
  const handleAddPlayer = useCallback(async (firstName: string, lastName: string) => {
    if (!selectedSeasonId) return;
    await createRating(selectedSeasonId, {
      playerFirstName: firstName,
      playerLastName: lastName,
      scores: {},
    });
  }, [selectedSeasonId, createRating]);

  // Handle saving draft scores
  const handleSaveDraft = useCallback(async (scores: Record<string, number>) => {
    if (!selectedRating) return;
    setIsSaving(true);
    try {
      const updated = await updateRating(selectedRating.id, { scores });
      if (updated) {
        setSelectedRating(updated);
      }
    } finally {
      setIsSaving(false);
    }
  }, [selectedRating, updateRating]);

  // Handle submitting a rating
  const handleSubmitRating = useCallback(async (ratingId: string) => {
    setIsSaving(true);
    try {
      const submitted = await submitRating(ratingId);
      if (submitted) {
        setSelectedRating(submitted);
      }
    } finally {
      setIsSaving(false);
    }
  }, [submitRating]);

  // Handle going back from form to list
  const handleBackToList = useCallback(() => {
    setSelectedRating(null);
    setPageView('list');
  }, []);

  // Handle season change
  const handleSeasonChange = useCallback((seasonId: string) => {
    setSelectedSeasonId(seasonId);
    setSelectedRating(null);
    setPageView('list');
    setActiveTab('my-ratings');
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Top bar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <button
            onClick={pageView === 'form' ? handleBackToList : onBack}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Coach Ratings
          </h1>
        </div>
      </div>

      {/* Season selector + Tab navigation */}
      {pageView !== 'form' && (
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-5xl mx-auto px-4">
            <div className="flex items-center justify-between py-3">
              {/* Season dropdown */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Season:
                </label>
                <select
                  value={selectedSeasonId || ''}
                  onChange={(e) => handleSeasonChange(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {seasons.length === 0 && (
                    <option value="">No seasons available</option>
                  )}
                  {seasons.map(season => (
                    <option key={season.id} value={season.id}>
                      {season.name} ({season.year})
                    </option>
                  ))}
                </select>
              </div>

              {/* Tab navigation */}
              <nav className="flex gap-6" aria-label="Coach ratings tabs">
                <button
                  onClick={() => setActiveTab('my-ratings')}
                  className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'my-ratings'
                      ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  My Ratings
                </button>
                {isAdmin && (
                  <button
                    onClick={() => setActiveTab('progress')}
                    className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'progress'
                        ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    Progress Dashboard
                  </button>
                )}
              </nav>
            </div>
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="max-w-5xl mx-auto px-4 mt-4">
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        </div>
      )}

      {/* Content area */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        {!selectedSeasonId ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">
              No seasons available. Create a season in Evaluation Setup first.
            </p>
          </div>
        ) : pageView === 'form' && selectedRating ? (
          <PlayerRatingForm
            rating={selectedRating}
            coachCategories={coachCategories}
            onSaveDraft={handleSaveDraft}
            onSubmit={handleSubmitRating}
            onBack={handleBackToList}
            isSaving={isSaving}
          />
        ) : activeTab === 'my-ratings' ? (
          <CoachRosterList
            ratings={ratings}
            onSelectPlayer={handleSelectPlayer}
            onAddPlayer={handleAddPlayer}
            isLoading={isLoading}
          />
        ) : activeTab === 'progress' && isAdmin && selectedSeason ? (
          <AdminRatingDashboard
            progress={progress}
            seasonId={selectedSeasonId}
            seasonName={`${selectedSeason.name} (${selectedSeason.year})`}
            onFetchProgress={fetchProgress}
            isLoading={isLoading}
          />
        ) : null}
      </div>
    </div>
  );
}
