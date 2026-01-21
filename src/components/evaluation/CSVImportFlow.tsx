import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { ParsedCSVData } from '../../types';
import { DualCSVUpload, ParsedRegistrationData, RegistrationCSVRecord } from './DualCSVUpload';
import { CSVVerificationStep, VerificationResult } from './CSVVerificationStep';

type CSVImportStep = 'upload' | 'verify';

export interface DualCSVImportResult {
  /** The raw evaluation CSV data (to be passed to column mapper) */
  evalCSVData: ParsedCSVData;
  /** Row indices to exclude from import */
  excludedRowIndices: Set<number>;
  /** DNE players to add after column mapping */
  dnePlayers: RegistrationCSVRecord[];
}

interface CSVImportFlowProps {
  /**
   * Called when both upload and verification are complete.
   * Returns the eval CSV data for column mapping, plus exclusion/DNE info.
   */
  onComplete: (result: DualCSVImportResult) => void;
  onCancel: () => void;
}

/**
 * Complete flow for importing players from two CSVs:
 * 1. Upload evaluation CSV and registration CSV
 * 2. Verify matches and handle exclusions/DNE
 * 3. Return CSV data for column mapping (does NOT create Players directly)
 */
export function CSVImportFlow({ onComplete, onCancel }: CSVImportFlowProps) {
  const [step, setStep] = useState<CSVImportStep>('upload');
  const [evalCSVData, setEvalCSVData] = useState<ParsedCSVData | null>(null);
  const [regData, setRegData] = useState<ParsedRegistrationData | null>(null);

  const handleUploadComplete = (
    evalData: ParsedCSVData,
    reg: ParsedRegistrationData
  ) => {
    setEvalCSVData(evalData);
    setRegData(reg);
    setStep('verify');
  };

  const handleVerificationComplete = (result: VerificationResult) => {
    if (!evalCSVData) return;

    onComplete({
      evalCSVData,
      excludedRowIndices: result.excludedRowIndices,
      dnePlayers: result.dnePlayers,
    });
  };

  const steps = ['upload', 'verify'] as const;
  const currentStepIndex = steps.indexOf(step);

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

        {step === 'verify' && evalCSVData && regData && (
          <CSVVerificationStep
            evalCSVData={evalCSVData}
            regData={regData}
            onComplete={handleVerificationComplete}
            onBack={() => setStep('upload')}
          />
        )}
      </div>
    </div>
  );
}
