/**
 * TryoutScoringPage Component
 *
 * Top-level orchestrator for tryout scoring. Provides tabbed navigation between:
 * - Score: Mobile station scoring (for volunteers)
 * - Groups: Group management (admin only)
 * - Bulk Entry: Spreadsheet grid for paper score entry (admin only)
 * - Progress: Completion dashboard (admin only)
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../api/client';
import type { Season, EvaluationTemplate, TryoutGroup } from '../../types';
import { MobileStationScoring } from './MobileStationScoring';
import { GroupManagement } from './GroupManagement';
import { BulkStationEntry } from './BulkStationEntry';
import { TryoutProgressDashboard } from './TryoutProgressDashboard';

interface TryoutScoringPageProps {
  onBack: () => void;
}

type TabId = 'score' | 'groups' | 'bulk-entry' | 'progress';

interface Tab {
  id: TabId;
  label: string;
  adminOnly: boolean;
}

export const TryoutScoringPage: React.FC<TryoutScoringPageProps> = ({ onBack }) => {
  const { user } = useAuth();
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');
  const [template, setTemplate] = useState<EvaluationTemplate | null>(null);
  const [groups, setGroups] = useState<TryoutGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('score');

  // Check if user is admin
  const isAdmin = user?.organizations.some(org => org.role === 'admin') ?? false;

  // Define tabs
  const allTabs: Tab[] = [
    { id: 'score', label: 'Score', adminOnly: false },
    { id: 'groups', label: 'Groups', adminOnly: true },
    { id: 'bulk-entry', label: 'Bulk Entry', adminOnly: true },
    { id: 'progress', label: 'Progress', adminOnly: true },
  ];

  // Filter tabs based on user role
  const visibleTabs = allTabs.filter(tab => !tab.adminOnly || isAdmin);

  // Load seasons on mount
  useEffect(() => {
    const loadSeasons = async () => {
      try {
        setLoading(true);
        setError(null);
        const fetchedSeasons = await api.listSeasons();
        setSeasons(fetchedSeasons);

        // Auto-select first season if available
        if (fetchedSeasons.length > 0) {
          setSelectedSeasonId(fetchedSeasons[0].id);
        }
      } catch (err) {
        console.error('Failed to load seasons:', err);
        setError('Failed to load seasons. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadSeasons();
  }, []);

  // Load template and groups when season changes
  useEffect(() => {
    if (!selectedSeasonId) {
      setTemplate(null);
      setGroups([]);
      return;
    }

    const loadSeasonData = async () => {
      try {
        setError(null);
        const season = seasons.find(s => s.id === selectedSeasonId);
        if (!season) return;

        // Fetch template
        const fetchedTemplate = await api.getEvaluationTemplate(season.templateId);
        setTemplate(fetchedTemplate);

        // Fetch groups
        const fetchedGroups = await api.listTryoutGroups(selectedSeasonId);
        setGroups(fetchedGroups);
      } catch (err) {
        console.error('Failed to load season data:', err);
        setError('Failed to load season data. Please try again.');
      }
    };

    loadSeasonData();
  }, [selectedSeasonId, seasons]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={onBack}
                className="mr-4 p-2 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <svg className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Tryout Scoring</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Season Selector */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <label htmlFor="season-select" className="block text-sm font-medium text-gray-700 mb-2">
            Select Season
          </label>
          <select
            id="season-select"
            value={selectedSeasonId}
            onChange={(e) => setSelectedSeasonId(e.target.value)}
            className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- Select a season --</option>
            {seasons.map(season => (
              <option key={season.id} value={season.id}>
                {season.name} ({season.year})
              </option>
            ))}
          </select>

          {seasons.length === 0 && (
            <p className="mt-2 text-sm text-gray-500">
              No seasons found. Create a season first to begin tryout scoring.
            </p>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {selectedSeasonId && template && (
          <>
            {/* Tab Navigation */}
            <div className="bg-white rounded-lg shadow mb-6">
              <nav className="flex border-b border-gray-200" aria-label="Tabs">
                {visibleTabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 py-4 px-6 text-center border-b-2 font-medium text-sm transition-colors ${
                      activeTab === tab.id
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            {/* Tab Content */}
            <div>
              {activeTab === 'score' && (
                <MobileStationScoring
                  seasonId={selectedSeasonId}
                  template={template}
                />
              )}

              {activeTab === 'groups' && isAdmin && (
                <GroupManagement
                  seasonId={selectedSeasonId}
                  template={template}
                />
              )}

              {activeTab === 'bulk-entry' && isAdmin && (
                <BulkStationEntry
                  seasonId={selectedSeasonId}
                  template={template}
                  groups={groups}
                />
              )}

              {activeTab === 'progress' && isAdmin && (
                <TryoutProgressDashboard
                  seasonId={selectedSeasonId}
                  template={template}
                />
              )}
            </div>
          </>
        )}

        {!selectedSeasonId && (
          <div className="text-center py-12 text-gray-500">
            Please select a season to begin.
          </div>
        )}
      </div>
    </div>
  );
};
