import { useState, useEffect, useCallback } from 'react';
import { useDivisions } from './hooks/useDivisions';
import { useDraft } from './hooks/useDraft';
import { usePlayerScoring } from './hooks/usePlayerScoring';
import { useViewMode } from './contexts/ViewContext';
import { DivisionSelector } from './components/DivisionSelector';
import { DivisionCreator } from './components/DivisionCreator';
import { FileUpload } from './components/FileUpload';
import { ColumnMapper } from './components/ColumnMapper';
import { PlayerReview } from './components/PlayerReview';
import { DraftConfig } from './components/DraftConfig';
import { DraftBoard } from './components/DraftBoard';
import { DraftComplete } from './components/DraftComplete';
import {
  Player,
  Team,
  DraftFormat,
  ParsedCSVData,
  ColumnMapping,
  DivisionPreset,
  DivisionAgeRange,
  ScoringMode,
} from './types';
import { parseCSVWithMapping } from './utils/csvParser';

type AppMode = 'selector' | 'creator' | 'draft';

function App() {
  const viewMode = useViewMode();
  const isPublicView = viewMode === 'public';

  const [mode, setMode] = useState<AppMode>('selector');
  const [csvData, setCSVData] = useState<ParsedCSVData | null>(null);

  const {
    summaries,
    activeDivision,
    createDivision,
    selectDivision,
    updateActiveDivision,
    deleteDivision,
    clearActiveDivision,
    refreshDivisions,
  } = useDivisions();

  const {
    phase,
    setPhase,
    draftState,
    setPlayers,
    setTeams,
    startDraft,
    draftPlayer,
    undoLastPick,
    resetDraft,
    loadDivisionState,
  } = useDraft(activeDivision?.id);

  const { players, updatePlayer, updatePlayerField, linkSiblings, unlinkSibling, setAllPlayers } = usePlayerScoring(
    draftState.players,
    activeDivision?.teamCount ?? 8
  );

  // Local teams state for the review phase (before draft starts)
  const [teams, setTeamsState] = useState<Team[]>([]);

  // Sync teams from active division when it changes
  useEffect(() => {
    if (activeDivision && activeDivision.teams.length > 0) {
      setTeamsState(activeDivision.teams);
    }
  }, [activeDivision?.id]); // Only trigger when division changes

  // Load division state when activeDivision changes
  useEffect(() => {
    if (activeDivision) {
      setMode('draft');
      loadDivisionState(activeDivision);
    }
  }, [activeDivision?.id]); // Only trigger when division changes

  // Auto-refresh for public view - listen for localStorage changes from admin view
  useEffect(() => {
    if (!isPublicView) return;

    const handleStorageChange = (e: StorageEvent) => {
      // Only refresh if the change is to a division key
      if (e.key?.startsWith('little-league-division-')) {
        console.log('🔄 Public view: Storage change detected, refreshing...');
        refreshDivisions();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [isPublicView, refreshDivisions]);

  // Save phase changes back to division
  useEffect(() => {
    if (activeDivision && phase !== activeDivision.phase) {
      // When draft completes, also save the completion timestamp and final state
      if (phase === 'complete') {
        updateActiveDivision({
          phase,
          completedAt: new Date().toISOString(),
          draftState,
          teams: draftState.teams,
          players: draftState.players,
        });
      } else {
        updateActiveDivision({ phase });
      }
    }
  }, [phase, activeDivision?.id]);

  // Handle selecting an existing division
  const handleSelectDivision = useCallback((divisionId: string) => {
    selectDivision(divisionId);
  }, [selectDivision]);

  // Handle creating a new division
  const handleCreateDivision = useCallback((config: {
    name: string;
    preset: DivisionPreset;
    teamCount: number;
    ageRange: DivisionAgeRange;
    enforceAgeLimit: boolean;
    maxPerAge: number;
  }) => {
    createDivision(config);
    setMode('draft');
  }, [createDivision]);

  // Handle CSV parsing
  const handleCSVParsed = (parsedData: ParsedCSVData) => {
    setCSVData(parsedData);
  };

  // Handle column mapping completion
  const handleMappingComplete = (mapping: ColumnMapping) => {
    if (!csvData || !activeDivision) return;

    const loadedPlayers = parseCSVWithMapping(
      csvData,
      mapping,
      activeDivision.teamCount,
      activeDivision.scoringMode,
      activeDivision.scoringWeights
    );
    setAllPlayers(loadedPlayers);
    setPlayers(loadedPlayers);

    // Update division with players
    updateActiveDivision({
      players: loadedPlayers,
      rosterSize: Math.ceil(loadedPlayers.length / activeDivision.teamCount),
    });

    // Teams are already initialized from division creation
    setTeamsState(activeDivision.teams);

    setPhase('review');
  };

  // Handle scoring mode change
  const handleScoringModeChange = (mode: ScoringMode) => {
    if (!activeDivision) return;
    updateActiveDivision({ scoringMode: mode });
  };

  // Handle player score updates
  const handlePlayerUpdate = (
    playerId: string,
    field: keyof Pick<Player, 'fieldingSubtotal' | 'hittingSubtotal' | 'pitchingSubtotal' | 'catchScore' | 'runningScore' | 'officialAdjust'>,
    value: number
  ) => {
    updatePlayer(playerId, field, value);
  };

  // Handle review phase completion
  const handleReviewComplete = (updatedPlayers?: Player[]) => {
    // TRACE 5: Log what we received
    console.log('=== TRACE 5: handleReviewComplete received ===');
    console.log('updatedPlayers param exists:', !!updatedPlayers);
    if (updatedPlayers) {
      console.log('Coach kids in updatedPlayers:', updatedPlayers.filter(p => p.isCoachKid).map(p => ({
        name: `${p.firstName} ${p.lastName}`,
        projected: p.projectedRound,
        locked: p.lockedToRound
      })));
    }

    // Use passed players if available, otherwise use current state
    const playersToSave = updatedPlayers ?? players;

    // TRACE 6: Log playersToSave
    console.log('=== TRACE 6: playersToSave ===');
    console.log('Coach kids:', playersToSave.filter(p => p.isCoachKid).map(p => ({
      name: `${p.firstName} ${p.lastName}`,
      projected: p.projectedRound,
      locked: p.lockedToRound
    })));

    // Update draft state with modified players and teams
    setPlayers(playersToSave);
    setTeams(teams);

    // Save to division
    if (activeDivision) {
      updateActiveDivision({
        players: playersToSave,
        teams,
      });
      // TRACE 7: After updateActiveDivision
      console.log('=== TRACE 7: After updateActiveDivision ===');
    }

    setPhase('config');
  };

  // Handle draft config completion
  const handleConfigComplete = (format: DraftFormat, order: string[], resolvedPlayers: Player[]) => {
    console.log('📋 handleConfigComplete called');
    console.log('📋 format:', format);
    console.log('📋 order:', order);
    console.log('📋 resolvedPlayers coach kids:', resolvedPlayers.filter(p => p.isCoachKid).map(p => ({
      name: `${p.firstName} ${p.lastName}`,
      projected: p.projectedRound,
      locked: p.lockedToRound
    })));

    // Update players with resolved lockedToRound values before starting draft
    setPlayers(resolvedPlayers);

    // Pass format and order directly to startDraft to avoid race conditions
    startDraft(format, order, resolvedPlayers);
  };

  // Handle going back to division selector
  const handleBackToSelector = () => {
    // Save current state to division before leaving
    if (activeDivision) {
      updateActiveDivision({
        players: draftState.players.length > 0 ? draftState.players : activeDivision.players,
        teams: draftState.teams.length > 0 ? draftState.teams : activeDivision.teams,
        draftState: draftState.picks.length > 0 ? draftState : activeDivision.draftState,
        phase,
      });
    }
    clearActiveDivision();
    setMode('selector');
    setCSVData(null);
  };

  // Handle reset - this resets within current division
  const handleReset = () => {
    if (!activeDivision) return;

    if (window.confirm('Are you sure you want to reset this division? This will clear all draft progress.')) {
      // Reset to upload phase with fresh teams
      updateActiveDivision({
        players: [],
        teams: activeDivision.teams.map(t => ({
          ...t,
          roster: [],
          totalScore: 0,
          coachKids: [],
          assistantCoaches: [],
          ageBreakdown: {},
        })),
        draftState: null,
        phase: 'upload',
        completedAt: undefined,
      });

      setCSVData(null);
      resetDraft();
    }
  };

  // Render division selector or creator
  if (mode === 'selector') {
    return (
      <DivisionSelector
        divisions={summaries}
        onSelectDivision={handleSelectDivision}
        onCreateNew={() => setMode('creator')}
        onDeleteDivision={deleteDivision}
      />
    );
  }

  if (mode === 'creator') {
    return (
      <DivisionCreator
        onCancel={() => setMode('selector')}
        onCreate={handleCreateDivision}
      />
    );
  }

  // Render draft flow for active division
  if (!activeDivision) {
    // Loading state or error - shouldn't happen
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Loading...
          </h2>
          <button
            onClick={() => setMode('selector')}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
          >
            Back to Divisions
          </button>
        </div>
      </div>
    );
  }

  // Division header shown during draft flow
  const DivisionHeader = () => (
    <div className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          onClick={handleBackToSelector}
          className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors text-sm"
        >
          ← Divisions
        </button>
        <span className="text-gray-300 dark:text-gray-600">|</span>
        <span className="font-semibold text-gray-900 dark:text-white">
          {activeDivision.name}
        </span>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          ({activeDivision.teamCount} teams)
        </span>
      </div>
    </div>
  );

  return (
    <>
      {phase !== 'upload' && phase !== 'complete' && <DivisionHeader />}

      <div className={phase !== 'upload' && phase !== 'complete' ? 'pt-12' : ''}>
        {phase === 'upload' && (
          <div className="relative">
            <div className="absolute top-4 left-4 z-10">
              <button
                onClick={handleBackToSelector}
                className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                ← Back to Divisions
              </button>
            </div>
            <FileUpload
              onCSVParsed={handleCSVParsed}
              onNext={() => setPhase('mapping')}
            />
          </div>
        )}

        {phase === 'mapping' && csvData && (
          <ColumnMapper csvData={csvData} onMappingComplete={handleMappingComplete} />
        )}

        {phase === 'review' && (
          <PlayerReview
            players={players}
            teams={teams}
            scoringMode={activeDivision.scoringMode}
            onScoringModeChange={handleScoringModeChange}
            onUpdatePlayer={handlePlayerUpdate}
            onUpdatePlayerField={updatePlayerField}
            onSetAllPlayers={setAllPlayers}
            onTeamsUpdate={setTeamsState}
            onLinkSiblings={linkSiblings}
            onUnlinkSibling={unlinkSibling}
            onNext={handleReviewComplete}
          />
        )}

        {phase === 'config' && (
          <DraftConfig
            teams={teams}
            players={players}
            onConfigComplete={handleConfigComplete}
          />
        )}

        {phase === 'draft' && draftState.currentTeamId && (
          <DraftBoard
            draftState={draftState}
            onDraftPlayer={draftPlayer}
            onUndo={undoLastPick}
            onReset={handleReset}
            enforceAgeLimit={activeDivision?.enforceAgeLimit ?? false}
            maxPerAge={activeDivision?.maxPerAge ?? 0}
          />
        )}

        {phase === 'draft' && !draftState.currentTeamId && (
          <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                Initializing Draft...
              </h2>
              <button
                onClick={() => setPhase('config')}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
              >
                Back to Configuration
              </button>
            </div>
          </div>
        )}

        {phase === 'complete' && (
          <div className="relative">
            <div className="absolute top-4 left-4 z-10">
              <button
                onClick={handleBackToSelector}
                className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                ← Back to Divisions
              </button>
            </div>
            <DraftComplete
              draftState={draftState}
              onReset={handleReset}
            />
          </div>
        )}
      </div>
    </>
  );
}

export default App;
