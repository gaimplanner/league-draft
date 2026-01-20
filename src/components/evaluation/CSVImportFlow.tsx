import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Player } from '../../types';
import { DualCSVUpload, EvaluationCSVRecord, RegistrationCSVRecord } from './DualCSVUpload';
import { CSVVerificationStep } from './CSVVerificationStep';

type CSVImportStep = 'upload' | 'verify' | 'complete';

interface CSVImportFlowProps {
  teamCount: number;
  onComplete: (players: Player[]) => void;
  onCancel: () => void;
}

/**
 * Complete flow for importing players from two CSVs:
 * 1. Upload evaluation CSV and registration CSV
 * 2. Verify matches and handle exclusions/DNE
 * 3. Convert to Player[] and return
 */
export function CSVImportFlow({ teamCount, onComplete, onCancel }: CSVImportFlowProps) {
  const [step, setStep] = useState<CSVImportStep>('upload');
  const [evalData, setEvalData] = useState<EvaluationCSVRecord[]>([]);
  const [regData, setRegData] = useState<RegistrationCSVRecord[]>([]);

  const handleUploadComplete = (
    eval_: EvaluationCSVRecord[],
    reg: RegistrationCSVRecord[]
  ) => {
    setEvalData(eval_);
    setRegData(reg);
    setStep('verify');
  };

  const handleVerificationComplete = (
    verifiedEval: EvaluationCSVRecord[],
    excludedBibs: Set<string>,
    dnePlayers: RegistrationCSVRecord[]
  ) => {
    // Filter out excluded players
    const includedEval = verifiedEval.filter(p => !excludedBibs.has(p.bib));

    // Convert to Player[] format
    const players: Player[] = [];

    // Helper to create a player with all required fields
    const createPlayer = (
      id: string,
      bib: string,
      firstName: string,
      lastName: string,
      totalScore: number,
      rank: number,
      projectedRound: number,
      isDNE: boolean = false
    ): Player => ({
      id,
      bib,
      firstName,
      lastName,
      name: `${firstName} ${lastName}`,
      // Raw scores - default to 0
      fieldScore: 0,
      throwScore: 0,
      hitPower: 0,
      hitForm: 0,
      hitContact: 0,
      pitchingStrength: 0,
      pitchingForm: 0,
      catchScore: 0,
      runningScore: 0,
      // Subtotals - default to 0
      fieldingSubtotal: 0,
      hittingSubtotal: 0,
      pitchingSubtotal: 0,
      subjectiveTotal: 0,
      objectiveTotal: 0,
      officialAdjust: 0,
      // Calculated
      totalScore,
      rank,
      projectedRound,
      // Player Info
      littleLeagueAge: 0,
      birthday: '',
      isAllStar: false,
      isDNE,
      // Draft Rules
      isCoachKid: false,
      // Draft Status
      isDrafted: false,
    });

    // Add evaluated players
    includedEval.forEach((evalPlayer, index) => {
      players.push(createPlayer(
        `player-${evalPlayer.bib}`,
        evalPlayer.bib,
        evalPlayer.firstName,
        evalPlayer.lastName,
        evalPlayer.totalScore,
        index + 1,
        Math.ceil((index + 1) / teamCount)
      ));
    });

    // Sort by score and re-rank
    players.sort((a, b) => b.totalScore - a.totalScore);
    players.forEach((p, i) => {
      p.rank = i + 1;
      p.projectedRound = Math.ceil((i + 1) / teamCount);
    });

    // Add DNE players at the end
    dnePlayers.forEach((dnePlayer, index) => {
      const nextBib = Math.max(...players.map(p => parseInt(p.bib) || 0), 0) + index + 1;
      players.push(createPlayer(
        `player-dne-${nextBib}`,
        String(nextBib),
        dnePlayer.firstName,
        dnePlayer.lastName,
        0, // DNE players have 0 score
        players.length + index + 1,
        Math.ceil((players.length + index + 1) / teamCount),
        true // isDNE
      ));
    });

    onComplete(players);
  };

  const steps = ['upload', 'verify'] as const;
  const currentStepIndex = steps.indexOf(step as 'upload' | 'verify');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-6">
        <button
          onClick={step === 'upload' ? onCancel : () => setStep('upload')}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          {step === 'upload' ? 'Back to Import Selection' : 'Back to Upload'}
        </button>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 text-sm">
          {steps.map((s, index) => (
            <div key={s} className="flex items-center">
              {index > 0 && (
                <div className="w-8 h-px bg-gray-300 dark:bg-gray-600 mx-2" />
              )}
              <div
                className={`px-3 py-1 rounded-full ${
                  currentStepIndex === index
                    ? 'bg-blue-500 text-white'
                    : currentStepIndex > index
                    ? 'bg-green-200 dark:bg-green-900 text-green-800 dark:text-green-200'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}
              >
                {s === 'upload' && 'Upload CSVs'}
                {s === 'verify' && 'Verify'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto">
        {step === 'upload' && (
          <DualCSVUpload
            onComplete={handleUploadComplete}
            onCancel={onCancel}
          />
        )}

        {step === 'verify' && (
          <CSVVerificationStep
            evalData={evalData}
            regData={regData}
            onComplete={handleVerificationComplete}
            onBack={() => setStep('upload')}
          />
        )}
      </div>
    </div>
  );
}
