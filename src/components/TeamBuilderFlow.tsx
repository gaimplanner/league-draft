import { useState, useCallback } from 'react';
import {
  ArrowLeft,
  Wand2,
  Upload,
  Users,
  BarChart3,
  Check,
  Settings,
  Play,
  ArrowLeftRight,
} from 'lucide-react';
import { Division, Player, Team } from '../types';
import { EvaluationImport } from './evaluation';
import { NameMatchResolver, TeamBuilderResults } from './teamBuilder';
import { TradeModal } from './TradeModal';
import {
  runTeamBuilderAlgorithm,
  TeamBuilderConfig,
  TeamBuilderResult,
  TeamBuilderPlayer,
  DEFAULT_TEAM_BUILDER_CONFIG,
  applyAssignments,
} from '../utils/teamBuilderAlgorithm';
import {
  RegistrationData,
  parseRegistrationDataTab,
  matchRegistrationToEval,
  detectTwoWayRequests,
  detectSiblingsByAddress,
  resolveCoachRequest,
  CoachInfo,
  PlayerMatch,
} from '../utils/teamBuilderParser';
import * as XLSX from 'xlsx';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type TeamBuilderStep = 'import' | 'resolution' | 'configure' | 'generate' | 'results';

interface TeamBuilderFlowProps {
  division: Division;
  onBack: () => void;
  onComplete?: (players: Player[], teams: Team[]) => void;
}

interface RegistrationPlayer {
  registrationIndex: number;
  firstName: string;
  lastName: string;
  fullName: string;
  coachRequest: string;
  teammateRequests: string[];
  school: string;
  grade: number | null;
  address: string;
  match: PlayerMatch;
  evalBib: string | null;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const TeamBuilderFlow = ({ division, onBack, onComplete }: TeamBuilderFlowProps) => {
  // Step state
  const [step, setStep] = useState<TeamBuilderStep>('import');

  // Import data
  const [evalPlayers, setEvalPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>(division.teams);
  const [registrationData, setRegistrationData] = useState<RegistrationData | null>(null);
  const [registrationPlayers, setRegistrationPlayers] = useState<RegistrationPlayer[]>([]);

  // Resolution state
  const [unmatchedPlayers, setUnmatchedPlayers] = useState<RegistrationPlayer[]>([]);

  // Algorithm config
  const [config, setConfig] = useState<TeamBuilderConfig>(DEFAULT_TEAM_BUILDER_CONFIG);

  // Results
  const [algorithmResult, setAlgorithmResult] = useState<TeamBuilderResult | null>(null);
  const [finalPlayers, setFinalPlayers] = useState<Player[]>([]);
  const [finalTeams, setFinalTeams] = useState<Team[]>([]);

  // Swap modal
  const [showSwapModal, setShowSwapModal] = useState(false);

  // -----------------------------------------------------------------------------
  // Step 1: Import
  // -----------------------------------------------------------------------------

  const handleEvalImportComplete = useCallback((
    players: Player[],
    teamNames: string[],
    assistantCoaches: string[]
  ) => {
    setEvalPlayers(players);

    // Update teams with names and coaches
    const updatedTeams = division.teams.map((team, index) => ({
      ...team,
      name: teamNames[index] || team.name,
      headCoach: teamNames[index] || team.headCoach,
      assistantCoach: assistantCoaches[index] || team.assistantCoach,
    }));
    setTeams(updatedTeams);

    // Move to resolution step
    setStep('resolution');
  }, [division.teams]);

  // Handle Registration Data file upload (separate from eval)
  const handleRegistrationFileUpload = useCallback(async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });

      // Find Registration Data tab
      const regTabName = workbook.SheetNames.find(name =>
        name.toLowerCase().includes('registration')
      );

      if (!regTabName) {
        alert('No "Registration Data" tab found in the Excel file');
        return;
      }

      const sheet = workbook.Sheets[regTabName];
      const parsed = parseRegistrationDataTab(sheet, regTabName);

      if (!parsed) {
        alert('Failed to parse Registration Data tab');
        return;
      }

      setRegistrationData(parsed);

      // Match registration to eval data
      const evalPlayerList = evalPlayers.map(p => ({
        bib: p.bib,
        firstName: p.firstName,
        lastName: p.lastName,
      }));

      const matched: RegistrationPlayer[] = parsed.rows.map((row, index) => {
        const match = matchRegistrationToEval(
          { ...row, fullName: `${row.firstName} ${row.lastName}` },
          evalPlayerList
        );
        match.registrationIndex = index;

        return {
          registrationIndex: index,
          firstName: row.firstName,
          lastName: row.lastName,
          fullName: row.fullName,
          coachRequest: row.coachRequest,
          teammateRequests: row.teammateRequests,
          school: row.school,
          grade: row.grade,
          address: row.address,
          match,
          evalBib: match.evalBib,
        };
      });

      setRegistrationPlayers(matched);
      setUnmatchedPlayers(matched.filter(p => p.match.matchType === 'none'));

    } catch (error) {
      console.error('Failed to parse registration file:', error);
      alert('Failed to parse the Excel file');
    }
  }, [evalPlayers]);

  // -----------------------------------------------------------------------------
  // Step 2: Resolution
  // -----------------------------------------------------------------------------

  const handleNameResolve = useCallback((registrationIndex: number, evalBib: string | null) => {
    setRegistrationPlayers(prev => prev.map(p => {
      if (p.registrationIndex === registrationIndex) {
        return { ...p, evalBib, match: { ...p.match, evalBib, matchType: evalBib ? 'exact' : 'none' } };
      }
      return p;
    }));

    // Update unmatched list
    setUnmatchedPlayers(prev => prev.filter(p => p.registrationIndex !== registrationIndex));
  }, []);

  const handleProceedToConfigure = useCallback(() => {
    // Detect siblings by address before proceeding
    if (registrationData) {
      const siblingGroups = detectSiblingsByAddress(registrationData.rows);
      // Store sibling info for algorithm (would be added to player data)
      console.log('Detected sibling groups:', siblingGroups);
    }

    setStep('configure');
  }, [registrationData]);

  // -----------------------------------------------------------------------------
  // Step 3: Configure
  // -----------------------------------------------------------------------------

  const handleUpdateTeam = useCallback((teamId: string, updates: Partial<Team>) => {
    setTeams(prev => prev.map(t =>
      t.id === teamId ? { ...t, ...updates } : t
    ));
  }, []);

  const handleProceedToGenerate = useCallback(() => {
    setStep('generate');
  }, []);

  // -----------------------------------------------------------------------------
  // Step 4: Generate
  // -----------------------------------------------------------------------------

  const handleRunAlgorithm = useCallback(() => {
    // Build TeamBuilderPlayer array by merging eval and registration data
    const coachInfos: CoachInfo[] = teams.map(t => ({
      teamId: t.id,
      teamName: t.name || t.headCoach,
      coachName: t.headCoach,
      assistantCoach: t.assistantCoach,
    }));

    // Create player map for teammate resolution
    const playerIdByBib = new Map(evalPlayers.map(p => [p.bib, p.id]));

    // Build enhanced players
    const teamBuilderPlayers: TeamBuilderPlayer[] = evalPlayers.map(evalPlayer => {
      // Find matching registration data
      const regPlayer = registrationPlayers.find(r => r.evalBib === evalPlayer.bib);

      // Resolve coach request
      let resolvedCoachTeamId: string | null = null;
      if (regPlayer?.coachRequest) {
        const coachMatch = resolveCoachRequest(regPlayer.coachRequest, coachInfos);
        resolvedCoachTeamId = coachMatch.matchedTeamId;
      }

      // Resolve teammate requests
      const resolvedTeammateIds: string[] = [];
      if (regPlayer?.teammateRequests) {
        for (const request of regPlayer.teammateRequests) {
          // Try to find player by name
          const matchedReg = registrationPlayers.find(r =>
            r.fullName.toLowerCase() === request.toLowerCase() ||
            r.lastName.toLowerCase() === request.toLowerCase()
          );
          if (matchedReg?.evalBib) {
            const playerId = playerIdByBib.get(matchedReg.evalBib);
            if (playerId) {
              resolvedTeammateIds.push(playerId);
            }
          }
        }
      }

      return {
        ...evalPlayer,
        coachRequest: regPlayer?.coachRequest,
        teammateRequests: regPlayer?.teammateRequests,
        school: regPlayer?.school,
        grade: regPlayer?.grade ?? undefined,
        resolvedCoachTeamId,
        resolvedTeammateIds,
        twoWayTeammateIds: [], // Will be calculated below
        oneWayTeammateIds: resolvedTeammateIds,
      };
    });

    // Detect two-way requests
    const twoWayMap = detectTwoWayRequests(
      teamBuilderPlayers.map(p => ({
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        fullName: `${p.firstName} ${p.lastName}`,
        teammateRequests: p.teammateRequests || [],
      }))
    );

    // Update players with two-way info
    for (const player of teamBuilderPlayers) {
      const twoWayIds = twoWayMap.get(player.id);
      if (twoWayIds) {
        player.twoWayTeammateIds = Array.from(twoWayIds);
        player.oneWayTeammateIds = (player.resolvedTeammateIds || [])
          .filter(id => !twoWayIds.has(id));
      }
    }

    // Run algorithm
    const result = runTeamBuilderAlgorithm(teamBuilderPlayers, teams, config);
    setAlgorithmResult(result);

    // Apply assignments to get final state
    const { players: updatedPlayers, teams: updatedTeams } = applyAssignments(
      teamBuilderPlayers,
      teams,
      result.assignments
    );

    setFinalPlayers(updatedPlayers);
    setFinalTeams(updatedTeams);
    setStep('results');
  }, [evalPlayers, teams, registrationPlayers, config]);

  // -----------------------------------------------------------------------------
  // Step 5: Results
  // -----------------------------------------------------------------------------

  const handleRerun = useCallback(() => {
    setStep('generate');
    setAlgorithmResult(null);
  }, []);

  const handleFinalize = useCallback(() => {
    if (onComplete && algorithmResult) {
      onComplete(finalPlayers, finalTeams);
    }
  }, [onComplete, algorithmResult, finalPlayers, finalTeams]);

  // Handle player swap (local, no API)
  const handleSwap = useCallback((
    team1Id: string,
    team2Id: string,
    player1Id: string,
    player2Id: string,
    _reason: string
  ) => {
    // Find the players
    const player1 = finalPlayers.find(p => p.id === player1Id);
    const player2 = finalPlayers.find(p => p.id === player2Id);

    if (!player1 || !player2) return;

    // Update player assignments
    const updatedPlayers = finalPlayers.map(p => {
      if (p.id === player1Id) {
        return { ...p, draftedByTeamId: team2Id };
      }
      if (p.id === player2Id) {
        return { ...p, draftedByTeamId: team1Id };
      }
      return p;
    });

    // Update team rosters
    const updatedTeams = finalTeams.map(team => {
      if (team.id === team1Id) {
        // Remove player1, add player2
        const newRoster = team.roster.filter(p => p.id !== player1Id);
        newRoster.push({ ...player2, draftedByTeamId: team1Id });
        const newTotalScore = newRoster.reduce((sum, p) => sum + p.totalScore, 0);
        return { ...team, roster: newRoster, totalScore: newTotalScore };
      }
      if (team.id === team2Id) {
        // Remove player2, add player1
        const newRoster = team.roster.filter(p => p.id !== player2Id);
        newRoster.push({ ...player1, draftedByTeamId: team2Id });
        const newTotalScore = newRoster.reduce((sum, p) => sum + p.totalScore, 0);
        return { ...team, roster: newRoster, totalScore: newTotalScore };
      }
      return team;
    });

    setFinalPlayers(updatedPlayers);
    setFinalTeams(updatedTeams);
    setShowSwapModal(false);
  }, [finalPlayers, finalTeams]);

  // -----------------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------------

  const steps: { key: TeamBuilderStep; label: string; icon: typeof Upload }[] = [
    { key: 'import', label: 'Import', icon: Upload },
    { key: 'resolution', label: 'Resolution', icon: Users },
    { key: 'configure', label: 'Configure', icon: Settings },
    { key: 'generate', label: 'Generate', icon: Wand2 },
    { key: 'results', label: 'Results', icon: BarChart3 },
  ];

  const currentStepIndex = steps.findIndex(s => s.key === step);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Divisions
          </button>

          <div className="flex items-center gap-2">
            <div className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 rounded-full">
              <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                {division.name}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Step indicator */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center gap-2">
            {steps.map((s, index) => (
              <div key={s.key} className="flex items-center">
                {index > 0 && (
                  <div className={`w-12 h-0.5 mx-2 ${
                    index <= currentStepIndex
                      ? 'bg-purple-500'
                      : 'bg-gray-300 dark:bg-gray-600'
                  }`} />
                )}
                <div
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                    s.key === step
                      ? 'bg-purple-600 text-white'
                      : index < currentStepIndex
                      ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {index < currentStepIndex ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <s.icon className="w-4 h-4" />
                  )}
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto p-6">
        {/* Step 1: Import */}
        {step === 'import' && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Import Player Data
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                First, import evaluation data (skills), then registration data (requests).
              </p>
            </div>

            {evalPlayers.length === 0 ? (
              <EvaluationImport
                teamCount={division.teamCount}
                onComplete={handleEvalImportComplete}
                onCancel={onBack}
              />
            ) : (
              <div className="space-y-6">
                {/* Eval data loaded */}
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <div>
                      <h3 className="font-semibold text-green-800 dark:text-green-200">
                        Evaluation Data Loaded
                      </h3>
                      <p className="text-sm text-green-700 dark:text-green-300">
                        {evalPlayers.length} players with skill scores
                      </p>
                    </div>
                  </div>
                </div>

                {/* Registration data upload */}
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Upload Registration Data (Optional)
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Upload an Excel file with a "Registration Data" tab containing friend requests,
                    coach preferences, and school information.
                  </p>

                  {registrationData ? (
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                      <div className="flex items-center gap-3">
                        <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
                        <div>
                          <h4 className="font-semibold text-green-800 dark:text-green-200">
                            Registration Data Loaded
                          </h4>
                          <p className="text-sm text-green-700 dark:text-green-300">
                            {registrationData.rows.length} players with request data
                          </p>
                          {unmatchedPlayers.length > 0 && (
                            <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                              {unmatchedPlayers.length} players need name resolution
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleRegistrationFileUpload(file);
                        }}
                        className="hidden"
                        id="registration-upload"
                      />
                      <label
                        htmlFor="registration-upload"
                        className="cursor-pointer"
                      >
                        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600 dark:text-gray-400">
                          Click to upload or drag and drop
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                          Excel file with Registration Data tab
                        </p>
                      </label>
                    </div>
                  )}
                </div>

                {/* Continue button */}
                <div className="flex justify-end">
                  <button
                    onClick={() => setStep('resolution')}
                    className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium"
                  >
                    Continue to Resolution
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Resolution */}
        {step === 'resolution' && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Resolve Player Data
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Match registration names to evaluation data and resolve teammate requests.
              </p>
            </div>

            {/* Name matching */}
            {unmatchedPlayers.length > 0 && (
              <NameMatchResolver
                unmatchedPlayers={unmatchedPlayers.map(p => ({
                  registrationIndex: p.registrationIndex,
                  firstName: p.firstName,
                  lastName: p.lastName,
                  fullName: p.fullName,
                  match: p.match,
                }))}
                availableEvalPlayers={evalPlayers.map(p => ({
                  bib: p.bib,
                  firstName: p.firstName,
                  lastName: p.lastName,
                  fullName: `${p.firstName} ${p.lastName}`,
                }))}
                onResolve={handleNameResolve}
                onResolveAll={(resolutions) => {
                  resolutions.forEach((bib, index) => {
                    handleNameResolve(index, bib);
                  });
                }}
                onCreateWithoutEval={(index) => {
                  handleNameResolve(index, null);
                }}
              />
            )}

            {/* Teammate request resolution would go here */}
            {registrationData && unmatchedPlayers.length === 0 && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <span className="text-green-800 dark:text-green-200 font-medium">
                    All players matched successfully
                  </span>
                </div>
              </div>
            )}

            {!registrationData && (
              <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <p className="text-gray-600 dark:text-gray-400">
                  No registration data uploaded. Friend requests and coach preferences will not be available.
                </p>
              </div>
            )}

            {/* Continue button */}
            <div className="flex justify-between">
              <button
                onClick={() => setStep('import')}
                className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Back
              </button>
              <button
                onClick={handleProceedToConfigure}
                className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium"
              >
                Continue to Configure
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Configure */}
        {step === 'configure' && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Configure Teams
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Review team coaches and algorithm settings.
              </p>
            </div>

            {/* Teams */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Teams ({teams.length})
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {teams.map((team, index) => (
                  <div
                    key={team.id}
                    className="border border-gray-200 dark:border-gray-600 rounded-lg p-4"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <span className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center text-purple-700 dark:text-purple-300 font-medium">
                        {index + 1}
                      </span>
                      <input
                        type="text"
                        value={team.headCoach}
                        onChange={(e) => handleUpdateTeam(team.id, { headCoach: e.target.value, name: e.target.value })}
                        placeholder="Coach name"
                        className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    {team.coachKids.length > 0 && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 ml-11">
                        {team.coachKids.length} coach kid{team.coachKids.length !== 1 ? 's' : ''} locked
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Algorithm config */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Algorithm Settings
              </h3>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Balance Tolerance: ±{Math.round(config.balanceTolerance * 100)}%
                  </label>
                  <input
                    type="range"
                    min="5"
                    max="20"
                    value={config.balanceTolerance * 100}
                    onChange={(e) => setConfig({ ...config, balanceTolerance: parseInt(e.target.value) / 100 })}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Top Talent Rounds: {config.topTalentRounds}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="4"
                    value={config.topTalentRounds}
                    onChange={(e) => setConfig({ ...config, topTalentRounds: parseInt(e.target.value) })}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Max Roster Size: {config.maxRosterSize}
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="15"
                    value={config.maxRosterSize}
                    onChange={(e) => setConfig({ ...config, maxRosterSize: parseInt(e.target.value) })}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={config.prioritizeBalance}
                      onChange={(e) => setConfig({ ...config, prioritizeBalance: e.target.checked })}
                      className="w-4 h-4 rounded"
                    />
                    Prioritize Balance over Happiness
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-7">
                    When enabled, balance is maintained even if it means not honoring some requests.
                  </p>
                </div>
              </div>
            </div>

            {/* Continue button */}
            <div className="flex justify-between">
              <button
                onClick={() => setStep('resolution')}
                className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Back
              </button>
              <button
                onClick={handleProceedToGenerate}
                className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium"
              >
                Continue to Generate
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Generate */}
        {step === 'generate' && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Generate Teams
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Run the auto-assignment algorithm to create balanced teams.
              </p>
            </div>

            {/* Summary before running */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Ready to Generate
              </h3>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {evalPlayers.length}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Players</div>
                </div>
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {teams.length}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Teams</div>
                </div>
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {registrationPlayers.filter(p => p.teammateRequests.length > 0).length}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">With Requests</div>
                </div>
              </div>

              <button
                onClick={handleRunAlgorithm}
                className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2"
              >
                <Play className="w-5 h-5" />
                Run Auto-Assignment
              </button>
            </div>

            {/* Back button */}
            <div className="flex justify-start">
              <button
                onClick={() => setStep('configure')}
                className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Back to Configure
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Results */}
        {step === 'results' && algorithmResult && (
          <div className="space-y-6">
            <TeamBuilderResults
              result={algorithmResult}
              players={finalPlayers}
              onRerun={handleRerun}
            />

            {/* Action buttons */}
            <div className="flex justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="flex gap-3">
                <button
                  onClick={handleRerun}
                  className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Adjust & Re-run
                </button>
                <button
                  onClick={() => setShowSwapModal(true)}
                  className="px-6 py-2 border border-blue-500 text-blue-600 dark:text-blue-400 rounded-lg font-medium hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center gap-2"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  Swap Players
                </button>
              </div>
              <button
                onClick={handleFinalize}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold flex items-center gap-2"
              >
                <Check className="w-5 h-5" />
                Finalize Teams
              </button>
            </div>

            {/* Swap Modal */}
            {showSwapModal && (
              <TradeModal
                teams={finalTeams}
                players={finalPlayers}
                onExecuteTrade={handleSwap}
                onClose={() => setShowSwapModal(false)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};
