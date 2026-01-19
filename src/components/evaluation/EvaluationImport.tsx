import { ArrowLeft } from 'lucide-react';
import { Player } from '../../types';
import { RegistrationRecord } from '../../types/evaluation';
import { useEvaluationImport } from '../../hooks/useEvaluationImport';
import { WorkbookUpload } from './WorkbookUpload';
import { TabOverview } from './TabOverview';
import { PlayerSummaryTable } from './PlayerSummaryTable';
import { ExportControls } from './ExportControls';
import { DetectionModal } from './DetectionModal';

interface EvaluationImportProps {
  teamCount: number;
  onComplete: (players: Player[], teamNames: string[], assistantCoaches: string[], registrationData?: RegistrationRecord[]) => void;
  onCancel: () => void;
}

export function EvaluationImport({ teamCount, onComplete, onCancel }: EvaluationImportProps) {
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
  } = useEvaluationImport(teamCount);

  const handleContinueToDraft = () => {
    const players = getPlayers();
    onComplete(players, teamNames, assistantCoaches, registrationData || undefined);
  };

  const handleBack = () => {
    reset();
    onCancel();
  };

  // Simplified steps - weights are now inline on summary
  const steps = ['upload', 'overview', 'summary'] as const;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      {/* Header */}
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
          {steps.map((step, index) => (
            <div key={step} className="flex items-center">
              {index > 0 && (
                <div className="w-8 h-px bg-gray-300 dark:bg-gray-600 mx-2" />
              )}
              <div
                className={`px-3 py-1 rounded-full ${
                  state.step === step || (state.step === 'weights' && step === 'summary')
                    ? 'bg-green-500 text-white'
                    : steps.indexOf(state.step as typeof steps[number]) > steps.indexOf(step)
                    ? 'bg-green-200 dark:bg-green-900 text-green-800 dark:text-green-200'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}
              >
                {step === 'upload' && 'Upload'}
                {step === 'overview' && 'Overview'}
                {step === 'summary' && 'Summary'}
              </div>
            </div>
          ))}
        </div>
      </div>

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
            onContinue={() => goToStep('summary')}
            onBack={() => {
              reset();
            }}
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
              onBack={() => goToStep('overview')}
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
