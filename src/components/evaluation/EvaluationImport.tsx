import { ArrowLeft } from 'lucide-react';
import { Player } from '../../types';
import { RegistrationRecord } from '../../types/evaluation';
import { useEvaluationImport } from '../../hooks/useEvaluationImport';
import { WorkbookUpload } from './WorkbookUpload';
import { TabOverview } from './TabOverview';
import { PlayerSummaryTable } from './PlayerSummaryTable';
import { ExportControls } from './ExportControls';
import { DetectionModal } from './DetectionModal';
import { RegistrationMatchStep } from './RegistrationMatchStep';

interface EvaluationImportProps {
  teamCount: number;
  initialTeamNames?: string[];
  initialAssistantCoaches?: string[];
  onComplete: (players: Player[], teamNames: string[], assistantCoaches: string[], registrationData?: RegistrationRecord[]) => void;
  onCancel: () => void;
  /** Hide the internal navigation (back button and step indicator) when embedded in another flow */
  hideNavigation?: boolean;
}

export function EvaluationImport({ teamCount, initialTeamNames, initialAssistantCoaches, onComplete, onCancel, hideNavigation = false }: EvaluationImportProps) {
  const {
    state,
    totalWeight,
    teamCount: currentTeamCount,
    teamNames,
    assistantCoaches,
    showDetectionModal,
    coachKidMatches,
    siblingMatches,
    selectedCoachKids,
    selectedSiblings,
    // Registration matching state
    hasRegistrationData,
    registrationMatches,
    evaluatedNotRegistered,
    registrationStats,
    reset,
    goToStep,
    uploadWorkbook,
    updateFieldWeight,
    toggleField,
    resetWeights,
    updatePlayerAdjustment,
    updateTeamCount,
    updateTeamName,
    updateAssistantCoaches,
    toggleCoachKid,
    setCoachKidTeam,
    runAutoDetection,
    toggleCoachKidSelection,
    toggleSiblingSelection,
    applyDetections,
    cancelDetection,
    selectAllDetections,
    deselectAllDetections,
    clearCoachKids,
    clearSiblings,
    toggleAllStar,
    getPlayers,
    exportCSV,
    registrationData,
    // Registration matching actions
    runRegistrationMatching,
    resolveRegistrationMatch,
    markRegistrationAsDNE,
    toggleExcludeNotRegistered,
    applyRegistrationResolutions,
    skipRegistrationStep,
  } = useEvaluationImport(teamCount, initialTeamNames, initialAssistantCoaches);

  const handleContinueToDraft = () => {
    const players = getPlayers();
    onComplete(players, teamNames, assistantCoaches, registrationData || undefined);
  };

  const handleBack = () => {
    reset();
    onCancel();
  };

  // Handle overview continue - go to registration if data exists, otherwise summary
  const handleOverviewContinue = () => {
    if (hasRegistrationData) {
      runRegistrationMatching();
    } else {
      goToStep('summary');
    }
  };

  // Steps include registration only if registration data exists
  const steps = hasRegistrationData
    ? (['upload', 'overview', 'registration', 'summary'] as const)
    : (['upload', 'overview', 'summary'] as const);

  // Get current step index for progress indicator
  const getCurrentStepIndex = () => {
    if (state.step === 'weights') return steps.indexOf('summary' as never);
    return steps.indexOf(state.step as never);
  };

  return (
    <div className={hideNavigation ? '' : 'min-h-screen bg-gray-50 dark:bg-gray-900 p-4'}>
      {/* Header - hidden when embedded in another flow */}
      {!hideNavigation && (
        <div className="max-w-6xl mx-auto mb-6">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Import Selection
          </button>

          {/* Step Indicator */}
          <div className="flex items-center gap-2 text-sm">
            {steps.map((step, index) => {
              const currentIndex = getCurrentStepIndex();
              const isActive = state.step === step || (state.step === 'weights' && step === 'summary');
              const isComplete = currentIndex > index;

              return (
                <div key={step} className="flex items-center">
                  {index > 0 && (
                    <div className="w-8 h-px bg-gray-300 dark:bg-gray-600 mx-2" />
                  )}
                  <div
                    className={`px-3 py-1 rounded-full ${
                      isActive
                        ? 'bg-green-500 text-white'
                        : isComplete
                        ? 'bg-green-200 dark:bg-green-900 text-green-800 dark:text-green-200'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {step === 'upload' && 'Upload'}
                    {step === 'overview' && 'Overview'}
                    {step === 'registration' && 'Verify'}
                    {step === 'summary' && 'Summary'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-6xl mx-auto">
        {/* Upload Step */}
        {state.step === 'upload' && (
          <WorkbookUpload
            onFileSelect={uploadWorkbook}
            isProcessing={state.isProcessing}
            error={state.errors[0]?.message}
          />
        )}

        {/* Overview Step */}
        {state.step === 'overview' && state.workbook && (
          <TabOverview
            workbook={state.workbook}
            errors={state.errors}
            warnings={state.warnings}
            onContinue={handleOverviewContinue}
            onBack={() => {
              reset();
            }}
          />
        )}

        {/* Registration Verification Step */}
        {state.step === 'registration' && (
          <RegistrationMatchStep
            registrationMatches={registrationMatches}
            evaluatedNotRegistered={evaluatedNotRegistered}
            evalPlayers={state.players}
            stats={registrationStats}
            onResolveMatch={resolveRegistrationMatch}
            onMarkAsDNE={markRegistrationAsDNE}
            onToggleExclude={toggleExcludeNotRegistered}
            onApply={applyRegistrationResolutions}
            onSkip={skipRegistrationStep}
            onBack={() => goToStep('overview')}
          />
        )}

        {/* Summary Step (includes weights panel) */}
        {(state.step === 'summary' || state.step === 'weights') && (
          <div className="space-y-6 pb-24">
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Player Summary
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Review and adjust player scores. Expand the Weights panel to fine-tune scoring.
              </p>
            </div>

            <PlayerSummaryTable
              players={state.players}
              fieldWeights={state.fieldWeights}
              totalWeight={totalWeight}
              teamCount={currentTeamCount}
              teamNames={teamNames}
              assistantCoaches={assistantCoaches}
              onAdjustChange={updatePlayerAdjustment}
              onWeightChange={updateFieldWeight}
              onToggleField={toggleField}
              onResetWeights={resetWeights}
              onTeamCountChange={updateTeamCount}
              onTeamNameChange={updateTeamName}
              onAssistantCoachesChange={updateAssistantCoaches}
              onToggleCoachKid={toggleCoachKid}
              onSetCoachKidTeam={setCoachKidTeam}
              onRunAutoDetection={runAutoDetection}
              onClearCoachKids={clearCoachKids}
              onClearSiblings={clearSiblings}
              onToggleAllStar={toggleAllStar}
            />

            <ExportControls
              playerCount={state.players.length}
              onExportCSV={exportCSV}
              onContinueToDraft={handleContinueToDraft}
              onBack={() => goToStep(hasRegistrationData ? 'registration' : 'overview')}
            />
          </div>
        )}
      </div>

      {/* Detection Confirmation Modal */}
      {showDetectionModal && (
        <DetectionModal
          coachKidMatches={coachKidMatches}
          siblingMatches={siblingMatches}
          selectedCoachKids={selectedCoachKids}
          selectedSiblings={selectedSiblings}
          players={state.players}
          onToggleCoachKid={toggleCoachKidSelection}
          onToggleSibling={toggleSiblingSelection}
          onSelectAll={selectAllDetections}
          onDeselectAll={deselectAllDetections}
          onApply={applyDetections}
          onCancel={cancelDetection}
        />
      )}
    </div>
  );
}
