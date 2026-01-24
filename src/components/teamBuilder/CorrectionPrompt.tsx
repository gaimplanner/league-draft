import { useState } from 'react';
import { MessageCircle, ChevronDown } from 'lucide-react';
import { CorrectionReason } from '../../types';

interface CorrectionPromptProps {
  playerName: string;
  fromTeamName: string;
  toTeamName: string;
  onSave: (reason: CorrectionReason, notes?: string) => void;
  onSkip: () => void;
}

const CORRECTION_REASONS: Array<{ value: CorrectionReason; label: string; description: string }> = [
  {
    value: 'coach-request-priority',
    label: 'Coach Request Priority',
    description: 'The coach request should have been honored over other factors',
  },
  {
    value: 'friend-request-priority',
    label: 'Friend Request Priority',
    description: 'A friend/teammate request should have been honored over other factors',
  },
  {
    value: 'balance-override',
    label: 'Balance Override',
    description: 'Team balance was more important than honoring requests here',
  },
  {
    value: 'sibling-issue',
    label: 'Sibling Issue',
    description: 'Siblings needed to be on the same team',
  },
  {
    value: 'other',
    label: 'Other',
    description: 'A different reason (please explain in notes)',
  },
];

/**
 * Inline prompt shown after a player move to capture correction reasoning.
 * This teaches the algorithm what the user prefers.
 */
export const CorrectionPrompt = ({
  playerName,
  fromTeamName,
  toTeamName,
  onSave,
  onSkip,
}: CorrectionPromptProps) => {
  const [selectedReason, setSelectedReason] = useState<CorrectionReason | null>(null);
  const [notes, setNotes] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const selectedReasonData = CORRECTION_REASONS.find(r => r.value === selectedReason);
  const isOther = selectedReason === 'other';
  const canSave = selectedReason && (!isOther || notes.trim().length > 0);

  const handleSave = () => {
    if (selectedReason) {
      onSave(selectedReason, notes.trim() || undefined);
    }
  };

  return (
    <div className="mt-4 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-800">
          <MessageCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-amber-900 dark:text-amber-100 mb-1">
            Help Improve the Algorithm
          </h4>
          <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
            You moved <strong>{playerName}</strong> from{' '}
            <span className="font-medium">{fromTeamName}</span> to{' '}
            <span className="font-medium">{toTeamName}</span>.
            Why was this move necessary?
          </p>

          {/* Dropdown */}
          <div className="relative mb-3">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="w-full flex items-center justify-between px-3 py-2 bg-white dark:bg-gray-800 border border-amber-300 dark:border-amber-700 rounded-lg text-left text-sm"
            >
              <span className={selectedReason ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}>
                {selectedReasonData?.label || 'Select a reason...'}
              </span>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
              <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border border-amber-300 dark:border-amber-700 rounded-lg shadow-lg overflow-hidden">
                {CORRECTION_REASONS.map(reason => (
                  <button
                    key={reason.value}
                    onClick={() => {
                      setSelectedReason(reason.value);
                      setIsOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left hover:bg-amber-50 dark:hover:bg-amber-900/30 ${
                      selectedReason === reason.value ? 'bg-amber-100 dark:bg-amber-900/40' : ''
                    }`}
                  >
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {reason.label}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {reason.description}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Notes field (required for "other", optional otherwise) */}
          {selectedReason && (
            <div className="mb-3">
              <label className="block text-xs text-amber-700 dark:text-amber-300 mb-1">
                {isOther ? 'Notes (required)' : 'Additional notes (optional)'}
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={isOther ? 'Please explain the reason for this move...' : 'Any additional context...'}
                rows={2}
                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-amber-300 dark:border-amber-700 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2">
            <button
              onClick={onSkip}
              className="flex-1 px-3 py-1.5 text-sm text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-800 rounded-lg"
            >
              Skip
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave}
              className={`flex-1 px-3 py-1.5 text-sm rounded-lg font-medium ${
                canSave
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
              }`}
            >
              Save Feedback
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
