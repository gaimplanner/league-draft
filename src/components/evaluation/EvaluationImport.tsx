import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Player } from '../../types';
import { EvaluationPlayer } from '../../types/evaluation';
import { useEvaluationImport } from '../../hooks/useEvaluationImport';
import { WorkbookUpload } from './WorkbookUpload';
import { TabOverview } from './TabOverview';
import { FieldWeightSliders } from './FieldWeightSliders';
import { PlayerSummaryTable } from './PlayerSummaryTable';
import { PlayerDetailModal } from './PlayerDetailModal';
import { ExportControls } from './ExportControls';

interface EvaluationImportProps {
  teamCount: number;
  onComplete: (players: Player[]) => void;
  onCancel: () => void;
}

export function EvaluationImport({ teamCount, onComplete, onCancel }: EvaluationImportProps) {
  const {
    state,
    // weightsValid is available but not currently used in this component
    totalWeight,
    reset,
    goToStep,
    uploadWorkbook,
    updateFieldWeight,
    toggleField,
    resetWeights,
    updatePlayerAdjustment,
    getPlayers,
    exportCSV,
  } = useEvaluationImport(teamCount);

  const [selectedPlayer, setSelectedPlayer] = useState<EvaluationPlayer | null>(null);

  const handleContinueToDraft = () => {
    const players = getPlayers();
    onComplete(players);
  };

  const handleBack = () => {
    reset();
    onCancel();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-6">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Import Selection
        </button>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 text-sm">
          {['upload', 'overview', 'weights', 'summary'].map((step, index) => (
            <div key={step} className="flex items-center">
              {index > 0 && (
                <div className="w-8 h-px bg-gray-300 dark:bg-gray-600 mx-2" />
              )}
              <div
                className={`px-3 py-1 rounded-full ${
                  state.step === step
                    ? 'bg-green-500 text-white'
                    : ['upload', 'overview', 'weights', 'summary'].indexOf(state.step) >
                      ['upload', 'overview', 'weights', 'summary'].indexOf(step)
                    ? 'bg-green-200 dark:bg-green-900 text-green-800 dark:text-green-200'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}
              >
                {step === 'upload' && 'Upload'}
                {step === 'overview' && 'Overview'}
                {step === 'weights' && 'Weights'}
                {step === 'summary' && 'Summary'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto">
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
            onContinue={() => goToStep('weights')}
            onBack={() => {
              reset();
            }}
          />
        )}

        {/* Weights Step */}
        {state.step === 'weights' && (
          <FieldWeightSliders
            weights={state.fieldWeights}
            totalWeight={totalWeight}
            onWeightChange={updateFieldWeight}
            onToggleField={toggleField}
            onReset={resetWeights}
            onContinue={() => goToStep('summary')}
            onBack={() => goToStep('overview')}
          />
        )}

        {/* Summary Step */}
        {state.step === 'summary' && (
          <div className="space-y-6">
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Player Summary
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Review processed players. Click any row to view details and adjust scores.
              </p>
            </div>

            <PlayerSummaryTable
              players={state.players}
              onPlayerClick={setSelectedPlayer}
            />

            <ExportControls
              playerCount={state.players.length}
              onExportCSV={exportCSV}
              onContinueToDraft={handleContinueToDraft}
              onBack={() => goToStep('weights')}
            />
          </div>
        )}
      </div>

      {/* Player Detail Modal */}
      {selectedPlayer && (
        <PlayerDetailModal
          player={selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
          onSaveAdjustment={updatePlayerAdjustment}
        />
      )}
    </div>
  );
}
