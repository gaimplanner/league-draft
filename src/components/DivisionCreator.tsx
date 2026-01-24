import { useState, useMemo } from 'react';
import { ArrowLeft, Check, AlertCircle, AlertTriangle, Users, Wand2, ChevronDown, ChevronUp } from 'lucide-react';
import { DivisionPreset, DIVISION_PRESETS, DivisionAgeRange, DivisionMode, Coach } from '../types';
import { CoachSelector } from './CoachSelector';

export interface CoachConfig {
  headCoach: string;      // Manager's last name (legacy, auto-filled from Coach registry)
  assistantCoach: string; // Assistant's last name (legacy, auto-filled from Coach registry)
  teamName: string;       // Optional team name (e.g., "Guardians") - defaults to headCoach if empty
  headCoachId?: string | null;       // FK to Coach registry
  assistantCoachId?: string | null;  // FK to Coach registry
}

interface DivisionCreatorProps {
  onCancel: () => void;
  onCreate: (config: {
    name: string;
    preset: DivisionPreset;
    mode: DivisionMode;
    teamCount: number;
    ageRange: DivisionAgeRange;
    enforceAgeLimit: boolean;
    maxPerAge: number;
    coaches: CoachConfig[];
  }) => void;
  existingNames?: string[];
}

const presetOptions: { id: DivisionPreset; label: string; description: string }[] = [
  { id: 'majors', label: 'Majors', description: 'Ages 10-12, max 8 per age' },
  { id: 'aaa', label: 'AAA', description: 'Ages 8-10, max 8 per age' },
  { id: 'aa', label: 'AA', description: 'Ages 7-10, no age limit' },
  { id: 'custom', label: 'Custom', description: 'Configure your own settings' },
];

export const DivisionCreator = ({ onCancel, onCreate, existingNames = [] }: DivisionCreatorProps) => {
  const [step, setStep] = useState<'preset' | 'mode' | 'configure'>('preset');
  const [selectedPreset, setSelectedPreset] = useState<DivisionPreset | null>(null);
  const [selectedMode, setSelectedMode] = useState<DivisionMode | null>(null);
  const [name, setName] = useState('');
  const [teamCount, setTeamCount] = useState(8);
  const [ageMin, setAgeMin] = useState(7);
  const [ageMax, setAgeMax] = useState(12);
  const [enforceAgeLimit, setEnforceAgeLimit] = useState(true);
  const [maxPerAge, setMaxPerAge] = useState(8);
  const [showCoaches, setShowCoaches] = useState(false);
  const [coaches, setCoaches] = useState<CoachConfig[]>(() =>
    Array.from({ length: 10 }, () => ({
      headCoach: '',
      assistantCoach: '',
      teamName: '',
      headCoachId: null,
      assistantCoachId: null,
    }))
  );

  // Collect all assigned coach IDs to prevent duplicates
  const assignedCoachIds = useMemo(() => {
    const ids: string[] = [];
    coaches.slice(0, teamCount).forEach(config => {
      if (config.headCoachId) ids.push(config.headCoachId);
      if (config.assistantCoachId) ids.push(config.assistantCoachId);
    });
    return ids;
  }, [coaches, teamCount]);

  // Check if name already exists (case-insensitive)
  const nameAlreadyExists = existingNames.some(
    n => n.trim().toLowerCase() === name.trim().toLowerCase()
  );

  const handlePresetSelect = (preset: DivisionPreset) => {
    setSelectedPreset(preset);

    if (preset !== 'custom') {
      const presetConfig = DIVISION_PRESETS[preset];
      setName(presetConfig.name);
      setAgeMin(presetConfig.ageRange.min);
      setAgeMax(presetConfig.ageRange.max);
      setEnforceAgeLimit(presetConfig.enforceAgeLimit);
      setMaxPerAge(presetConfig.maxPerAge);
    } else {
      setName('');
    }

    setStep('mode');
  };

  const handleModeSelect = (mode: DivisionMode) => {
    setSelectedMode(mode);
    setStep('configure');
  };

  const handleBackFromMode = () => {
    setSelectedMode(null);
    setStep('preset');
  };

  const handleBackFromConfigure = () => {
    setStep('mode');
  };

  const updateCoach = (index: number, field: 'headCoach' | 'assistantCoach' | 'teamName', value: string) => {
    setCoaches(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleCoachSelect = (
    index: number,
    role: 'head' | 'assistant',
    coachId: string | null,
    coach: Coach | null
  ) => {
    setCoaches(prev => {
      const updated = [...prev];
      if (role === 'head') {
        updated[index] = {
          ...updated[index],
          headCoachId: coachId,
          headCoach: coach?.lastName || '',
        };
      } else {
        updated[index] = {
          ...updated[index],
          assistantCoachId: coachId,
          assistantCoach: coach?.lastName || '',
        };
      }
      return updated;
    });
  };

  const handleCreate = () => {
    if (!name.trim() || !selectedPreset || !selectedMode) return;

    onCreate({
      name: name.trim(),
      preset: selectedPreset,
      mode: selectedMode,
      teamCount,
      ageRange: { min: ageMin, max: ageMax },
      enforceAgeLimit,
      maxPerAge: enforceAgeLimit ? maxPerAge : 0,
      coaches: coaches.slice(0, teamCount),
    });
  };

  const isValid = name.trim().length > 0 && teamCount >= 5 && teamCount <= 10 && !nameAlreadyExists;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="mb-8">
          <button
            onClick={
              step === 'configure' ? handleBackFromConfigure :
              step === 'mode' ? handleBackFromMode :
              onCancel
            }
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            {step === 'configure' ? 'Back to Mode Selection' :
             step === 'mode' ? 'Back to Presets' :
             'Back to Divisions'}
          </button>

          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Create New Division
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {step === 'preset'
              ? 'Choose a preset or configure your own'
              : step === 'mode'
              ? 'How will teams be formed?'
              : 'Configure your division settings'}
          </p>
        </div>

        {step === 'preset' && (
          <div className="grid grid-cols-2 gap-4">
            {presetOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => handlePresetSelect(option.id)}
                className="p-6 bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-colors text-left group"
              >
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {option.label}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {option.description}
                </p>
              </button>
            ))}
          </div>
        )}

        {step === 'mode' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              {/* Live Draft Option */}
              <button
                onClick={() => handleModeSelect('live-draft')}
                className="p-6 bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-colors text-left group"
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      Live Draft
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Teams take turns selecting players in real-time. Coaches participate
                      in the draft process, picking players round by round.
                    </p>
                  </div>
                </div>
              </button>

              {/* League Generated Teams Option */}
              <button
                onClick={() => handleModeSelect('league-generated')}
                className="p-6 bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-colors text-left group"
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <Wand2 className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                      League Generated Teams
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      System creates balanced teams automatically. Honors friend requests
                      and coach assignments while ensuring competitive balance.
                    </p>
                  </div>
                </div>
              </button>
            </div>

            {/* Warning about immutability */}
            <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                This choice cannot be changed later. Once a division is created, its team formation
                mode is locked to ensure data consistency.
              </p>
            </div>
          </div>
        )}

        {step === 'configure' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-6">
            {/* Division Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Division Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Majors 2024"
                className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  nameAlreadyExists
                    ? 'border-red-500 dark:border-red-500'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
              />
              {nameAlreadyExists && (
                <div className="mt-2 flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>A division with this name already exists. Delete the existing division to create a new one.</span>
                </div>
              )}
            </div>

            {/* Team Count */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Number of Teams: {teamCount}
              </label>
              <input
                type="range"
                min="5"
                max="10"
                value={teamCount}
                onChange={(e) => setTeamCount(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-500 mt-1">
                <span>5</span>
                <span>6</span>
                <span>7</span>
                <span>8</span>
                <span>9</span>
                <span>10</span>
              </div>
            </div>

            {/* Age Range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Minimum Age
                </label>
                <input
                  type="number"
                  min="5"
                  max={ageMax}
                  value={ageMin}
                  onChange={(e) => setAgeMin(parseInt(e.target.value) || 5)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Maximum Age
                </label>
                <input
                  type="number"
                  min={ageMin}
                  max="18"
                  value={ageMax}
                  onChange={(e) => setAgeMax(parseInt(e.target.value) || 12)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Age Limit Enforcement */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setEnforceAgeLimit(!enforceAgeLimit)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    enforceAgeLimit ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                      enforceAgeLimit ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Enforce age limits per team
                </span>
              </div>

              {enforceAgeLimit && (
                <div className="ml-14">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Maximum players per age group
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="15"
                    value={maxPerAge}
                    onChange={(e) => setMaxPerAge(parseInt(e.target.value) || 8)}
                    className="w-24 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}
            </div>

            {/* Coaches Section (Collapsible) */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setShowCoaches(!showCoaches)}
                className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-900/70 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Team Coaches
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-500">
                    (Optional)
                  </span>
                </div>
                {showCoaches ? (
                  <ChevronUp className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                )}
              </button>

              {showCoaches && (
                <div className="p-4 space-y-3 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    Select coaches from your organization's coach registry. Team name defaults to manager's last name if not specified.
                  </p>

                  {/* Column Headers */}
                  <div className="flex items-center gap-3 pb-2 border-b border-gray-200 dark:border-gray-700">
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 w-16"></span>
                    <span className="flex-1 text-xs font-semibold text-gray-600 dark:text-gray-400">Manager</span>
                    <span className="flex-1 text-xs font-semibold text-gray-600 dark:text-gray-400">Assistant</span>
                    <span className="flex-1 text-xs font-semibold text-gray-600 dark:text-gray-400">Team Name <span className="font-normal text-gray-400">(optional)</span></span>
                  </div>

                  <div className="grid gap-3">
                    {Array.from({ length: teamCount }).map((_, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400 w-16">
                          Team {index + 1}
                        </span>
                        <CoachSelector
                          value={coaches[index]?.headCoachId ?? null}
                          onChange={(coachId, coach) => handleCoachSelect(index, 'head', coachId, coach)}
                          role="manager"
                          placeholder="Select manager..."
                          excludeCoachIds={assignedCoachIds.filter(id => id !== coaches[index]?.headCoachId)}
                          className="flex-1"
                        />
                        <CoachSelector
                          value={coaches[index]?.assistantCoachId ?? null}
                          onChange={(coachId, coach) => handleCoachSelect(index, 'assistant', coachId, coach)}
                          role="assistant_coach"
                          placeholder="Select assistant..."
                          excludeCoachIds={assignedCoachIds.filter(id => id !== coaches[index]?.assistantCoachId)}
                          className="flex-1"
                        />
                        <input
                          type="text"
                          value={coaches[index]?.teamName || ''}
                          onChange={(e) => updateCoach(index, 'teamName', e.target.value)}
                          placeholder={coaches[index]?.headCoach || 'e.g., Guardians'}
                          className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Summary */}
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Division Summary
              </h4>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>• {teamCount} teams competing</li>
                <li>• Players ages {ageMin}-{ageMax}</li>
                <li>
                  {enforceAgeLimit
                    ? `• Max ${maxPerAge} players per age group per team`
                    : '• No age group limits'}
                </li>
                <li className="flex items-center gap-2">
                  • {selectedMode === 'live-draft' ? (
                    <>
                      <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span>Live Draft</span>
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      <span>League Generated Teams</span>
                    </>
                  )}
                </li>
              </ul>
            </div>

            {/* Create Button */}
            <button
              onClick={handleCreate}
              disabled={!isValid}
              className={`w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors ${
                isValid
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
              }`}
            >
              <Check className="w-5 h-5" />
              Create Division
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
