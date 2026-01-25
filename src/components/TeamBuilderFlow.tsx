import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  ArrowLeft,
  Wand2,
  Upload,
  Users,
  BarChart3,
  Check,
  Settings,
  ArrowLeftRight,
  Search,
  ClipboardCheck,
  ChevronDown,
  ChevronUp,
  User,
  X,
  Edit3,
  RefreshCw,
} from 'lucide-react';
import { Division, Player, Team, ResolvedRequest, RequestsFirstConfig, DEFAULT_REQUESTS_FIRST_CONFIG, TradeCandidate, AppPhase, SimplifiedAlgorithmMode } from '../types';
import { RegistrationRecord } from '../types/evaluation';
import { EvaluationImport } from './evaluation';
import { NameMatchResolver, TeamBuilderResults, RequestConfirmation, TradeSuggestions, AlgorithmComparisonPanel } from './teamBuilder';
import { TradeModal } from './TradeModal';
import {
  TeamBuilderConfig,
  TeamBuilderResult,
  RequestsFirstResult,
  TeamBuilderPlayer,
  DEFAULT_TEAM_BUILDER_CONFIG,
  applyAssignments,
  recalculateHappiness,
  TeamSummary,
  PlayerHappiness,
  AssignmentResult,
} from '../utils/teamBuilderAlgorithm';
import {
  RegistrationData,
  parseRegistrationDataTab,
  matchRegistrationToEval,
  detectSiblingsByAddress,
  CoachInfo,
  PlayerMatch,
  normalizeRequestData,
  NormalizationResult,
  prepareRequestsForConfirmation,
} from '../utils/teamBuilderParser';
import {
  autoDetectCoachKids,
  autoDetectSiblings,
  CoachKidMatch,
  SiblingMatch,
} from '../utils/coachKidDetection';
import * as XLSX from 'xlsx';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

// Simplified flow: import → confirm-requests → confirm-locks → results
type TeamBuilderStep = 'setup' | 'import' | 'resolution' | 'confirm-requests' | 'confirm-locks' | 'results';

interface TeamBuilderFlowProps {
  division: Division;
  onBack: () => void;
  onComplete?: (players: Player[], teams: Team[]) => void;
  onUpdateTeams?: (teams: Team[]) => void;
  onUpdatePlayers?: (players: Player[]) => void;
  onUpdatePhase?: (phase: AppPhase) => void;
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
  littleLeagueAge: number | null;
  match: PlayerMatch;
  evalBib: string | null;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const TeamBuilderFlow = ({ division, onBack, onComplete, onUpdateTeams, onUpdatePlayers, onUpdatePhase: _onUpdatePhase }: TeamBuilderFlowProps) => {
  // Check for completed results (all players assigned)
  const hasCompletedResults = useMemo(() => {
    if (division.players.length === 0) return false;
    return division.players.every(p => p.draftedByTeamId);
  }, [division.players]);

  // Determine initial step based on division state
  const getInitialStep = (): TeamBuilderStep => {
    // If all players have team assignments (completed), go to results
    if (hasCompletedResults) {
      return 'results';
    }
    // If we have players but no assignments, go to confirm-locks (ready for comparison)
    if (division.players.length > 0) {
      return 'confirm-locks';
    }
    // If teams have coach names, go to import
    if (division.teams.some(t => t.headCoach)) {
      return 'import';
    }
    // Otherwise start fresh
    return 'setup';
  };

  const [step, setStep] = useState<TeamBuilderStep>(getInitialStep);

  // Import data - initialize from division if available
  const [evalPlayers, setEvalPlayers] = useState<Player[]>(division.players);
  const [teams, setTeams] = useState<Team[]>(division.teams);
  const [registrationData, setRegistrationData] = useState<RegistrationData | null>(null);
  const [registrationPlayers, setRegistrationPlayers] = useState<RegistrationPlayer[]>([]);

  // Resolution state
  const [unmatchedPlayers, setUnmatchedPlayers] = useState<RegistrationPlayer[]>([]);

  // Algorithm config
  const [config, _setConfig] = useState<TeamBuilderConfig>(DEFAULT_TEAM_BUILDER_CONFIG);

  // Normalization result (from request resolution step)
  const [normalizationResult, setNormalizationResult] = useState<NormalizationResult | null>(null);

  // Results - initialize from division if we have completed results (all players assigned)
  const [algorithmResult, setAlgorithmResult] = useState<TeamBuilderResult | null>(null);
  const [requestsFirstResult, setRequestsFirstResult] = useState<RequestsFirstResult | null>(null);
  const [finalPlayers, setFinalPlayers] = useState<Player[]>(hasCompletedResults ? division.players : []);
  const [finalTeams, setFinalTeams] = useState<Team[]>(hasCompletedResults ? division.teams : []);

  // Swap modal
  const [showSwapModal, setShowSwapModal] = useState(false);

  // Request confirmation state
  const [resolvedRequests, setResolvedRequests] = useState<ResolvedRequest[]>([]);
  const [requestsFirstConfig, _setRequestsFirstConfig] = useState<RequestsFirstConfig>(DEFAULT_REQUESTS_FIRST_CONFIG);

  // Trade suggestions state
  const [appliedTradeIds, setAppliedTradeIds] = useState<Set<string>>(new Set());
  const [dismissedTradeIds, setDismissedTradeIds] = useState<Set<string>>(new Set());

  // Algorithm comparison state (for simplified flow)
  const [selectedAlgorithmMode, setSelectedAlgorithmMode] = useState<SimplifiedAlgorithmMode | null>(null);

  // Player search for debugging request resolution
  const [playerSearchQuery, setPlayerSearchQuery] = useState('');

  // Category drill-down state for Request Resolution Summary
  type RequestCategory = 'coach' | 'buddy' | 'two-way' | null;
  const [expandedCategory, setExpandedCategory] = useState<RequestCategory>(null);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);

  // Teams panel expanded state
  const [teamsExpanded, setTeamsExpanded] = useState(false);

  // Auto-detection modal state
  const [showAutoDetectModal, setShowAutoDetectModal] = useState(false);
  const [autoDetectedMatches, setAutoDetectedMatches] = useState<CoachKidMatch[]>([]);
  const [siblingMatches, setSiblingMatches] = useState<SiblingMatch[]>([]);
  const [selectedMatches, setSelectedMatches] = useState<Set<string>>(new Set());
  const [selectedSiblingPairs, setSelectedSiblingPairs] = useState<Set<string>>(new Set());

  // Track if we initiated the last teams update to prevent sync loops
  const isLocalUpdate = useRef(false);

  // Sync teams state when division.teams changes from parent (not from us)
  // This ensures we always reflect the saved state when navigating back
  useEffect(() => {
    if (isLocalUpdate.current) {
      // We initiated this update, don't sync back
      isLocalUpdate.current = false;
      return;
    }
    // External update (e.g., navigating back) - sync from parent
    setTeams(division.teams);
  }, [division.teams]);

  // Reconstruct algorithm result when resuming with persisted results
  useEffect(() => {
    if (hasCompletedResults && !algorithmResult && finalPlayers.length > 0 && finalTeams.length > 0) {
      // Reconstruct assignments from player data
      const assignments: AssignmentResult[] = finalPlayers
        .filter(p => p.draftedByTeamId)
        .map(p => ({
          playerId: p.id,
          teamId: p.draftedByTeamId!,
          round: p.draftedInRound || 1,
          pick: p.draftedAtPick || 1,
          reason: p.isCoachKid ? 'coach-kid' as const : 'balance' as const,
        }));

      // Build team summaries
      const meanScore = finalPlayers.length > 0
        ? finalPlayers.reduce((sum, p) => sum + p.totalScore, 0) / finalTeams.length / (finalPlayers.length / finalTeams.length)
        : 0;

      const teamSummaries: TeamSummary[] = finalTeams.map(team => {
        const teamPlayers = finalPlayers.filter(p => p.draftedByTeamId === team.id);
        const totalScore = teamPlayers.reduce((sum, p) => sum + p.totalScore, 0);
        const avgScore = teamPlayers.length > 0 ? totalScore / teamPlayers.length : 0;
        return {
          teamId: team.id,
          teamName: team.teamName || '',
          coachName: team.headCoach || '',
          rosterCount: teamPlayers.length,
          totalScore,
          averageScore: avgScore,
          meanDelta: avgScore - meanScore,
          meanDeltaPercent: meanScore > 0 ? ((avgScore - meanScore) / meanScore) * 100 : 0,
        };
      });

      // Build player happiness (simplified - mark as no-requests since we don't have request data)
      const playerHappiness: PlayerHappiness[] = finalPlayers.map(p => ({
        playerId: p.id,
        score: 'no-requests' as const,
        coachRequestHonored: null,
        teammateRequestsHonored: 0,
        teammateRequestsTotal: 0,
        twoWayRequestsHonored: 0,
        twoWayRequestsTotal: 0,
      }));

      // Build reconstructed result
      const reconstructedResult: TeamBuilderResult = {
        assignments,
        teamSummaries,
        playerHappiness,
        warnings: ['Results restored from saved data. Re-run algorithm for full happiness analysis.'],
        stats: {
          totalPlayers: finalPlayers.length,
          lockedPlayers: finalPlayers.filter(p => p.isCoachKid || p.siblingId).length,
          topTalentPlayers: 0,
          requestBasedPlayers: 0,
          balanceBasedPlayers: assignments.length,
          twoWayRequestsHonored: 0,
          twoWayRequestsTotal: 0,
          oneWayRequestsHonored: 0,
          oneWayRequestsTotal: 0,
          coachRequestsHonored: 0,
          coachRequestsTotal: 0,
          averageHappiness: 1,
        },
      };

      setAlgorithmResult(reconstructedResult);
    }
  }, [hasCompletedResults, algorithmResult, finalPlayers, finalTeams]);

  // Rebuild resolvedRequests from persisted player data when starting at configure step
  // This handles the case where user navigated away and came back, or is doing a re-run
  useEffect(() => {
    // Only run if:
    // 1. We're at confirm-locks or results step (where we need resolvedRequests for algorithm)
    // 2. resolvedRequests is empty (not already built)
    // 3. Players have request data (from previous session)
    const hasPlayerRequestData = evalPlayers.some(p => p.coachRequest || (p.teammateRequests && p.teammateRequests.length > 0));

    if ((step === 'confirm-locks' || step === 'results') && resolvedRequests.length === 0 && hasPlayerRequestData) {
      console.log('Rebuilding resolvedRequests from persisted player data on mount...');

      // Build coach info from teams
      const coachInfos: CoachInfo[] = teams.map(t => ({
        teamId: t.id,
        teamName: t.teamName || t.headCoach,
        coachName: t.headCoach,
        assistantCoach: t.assistantCoach,
      }));

      // Build player data for normalization from stored evalPlayers
      const playersForNormalization = evalPlayers.map(p => ({
        id: p.id,
        bib: p.bib,
        firstName: p.firstName,
        lastName: p.lastName,
        coachRequest: p.coachRequest,
        teammateRequests: p.teammateRequests,
        school: p.school,
      }));

      const normResult = normalizeRequestData(playersForNormalization, coachInfos);
      setNormalizationResult(normResult);

      const preparedRequests = prepareRequestsForConfirmation(normResult, requestsFirstConfig);
      setResolvedRequests(preparedRequests);

      console.log(`Rebuilt ${preparedRequests.length} requests from persisted player data`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]); // Only run when step changes, not on every state update

  // -----------------------------------------------------------------------------
  // Step 1: Import
  // -----------------------------------------------------------------------------

  // Helper to convert RegistrationRecord to RegistrationData format
  const convertRegistrationRecords = useCallback((
    records: RegistrationRecord[],
    evalPlayerList: { bib: string; firstName: string; lastName: string }[]
  ) => {
    // Convert to RegistrationData format expected by teamBuilderParser
    const rows = records.map(r => ({
      firstName: r.firstName,
      lastName: r.lastName,
      fullName: `${r.firstName} ${r.lastName}`,
      coachRequest: r.coachRequest || '',
      teammateRequests: r.teammateRequests || [],
      school: r.school || '',
      grade: r.grade ?? null,
      address: r.address || '',
      littleLeagueAge: r.littleLeagueAge ?? null,
      rawTeammateRequestsString: (r.teammateRequests || []).join(', '),
    }));

    setRegistrationData({ rows, headers: [], warnings: [] });

    // Match registration to eval data
    const matched: RegistrationPlayer[] = rows.map((row, index) => {
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
        littleLeagueAge: row.littleLeagueAge,
        match,
        evalBib: match.evalBib,
      };
    });

    setRegistrationPlayers(matched);
    setUnmatchedPlayers(matched.filter(p => p.match.matchType === 'none'));

    console.log(`Converted ${records.length} registration records, ${matched.filter(p => p.match.matchType !== 'none').length} matched`);
  }, []);

  const handleEvalImportComplete = useCallback((
    players: Player[],
    teamNames: string[],
    assistantCoaches: string[],
    parsedRegistrationData?: RegistrationRecord[]
  ) => {
    setEvalPlayers(players);

    // Build coachKids arrays from players who have isCoachKid=true
    // Players have coachTeamId set as "team-0", "team-1", etc. from EvaluationImport
    const coachKidsByTeamIndex = new Map<number, string[]>();
    for (const player of players) {
      if (player.isCoachKid && player.coachTeamId) {
        // Extract team index from coachTeamId (e.g., "team-0" -> 0)
        const match = player.coachTeamId.match(/^team-(\d+)$/);
        if (match) {
          const teamIndex = parseInt(match[1], 10);
          if (!coachKidsByTeamIndex.has(teamIndex)) {
            coachKidsByTeamIndex.set(teamIndex, []);
          }
          coachKidsByTeamIndex.get(teamIndex)!.push(player.id);
        }
      }
    }

    // Update teams with coach info from eval import
    // IMPORTANT: Preserve existing coach names if they were already set in Setup step
    // Note: teamNames from evaluation actually contains head coach names, not actual team names
    const updatedTeams = teams.map((team, index) => {
      // Merge detected coach kids with existing, deduplicating
      const detectedKids = coachKidsByTeamIndex.get(index) || [];
      const existingKids = team.coachKids || [];
      const mergedKids = [...new Set([...existingKids, ...detectedKids])];

      return {
        ...team,
        // headCoach is the manager's last name - only update if not already set
        headCoach: team.headCoach || teamNames[index] || '',
        assistantCoach: team.assistantCoach || assistantCoaches[index] || '',
        // Populate coachKids array from detected coach kids (deduplicated)
        coachKids: mergedKids,
        // teamName stays empty until actual team name (e.g., "Guardians") is assigned
      };
    });
    setTeams(updatedTeams);

    // Also update players with the actual team IDs (not "team-0" format)
    let playersWithRealTeamIds = players.map(player => {
      if (player.isCoachKid && player.coachTeamId) {
        const match = player.coachTeamId.match(/^team-(\d+)$/);
        if (match) {
          const teamIndex = parseInt(match[1], 10);
          if (teamIndex < updatedTeams.length) {
            return { ...player, coachTeamId: updatedTeams[teamIndex].id };
          }
        }
      }
      return player;
    });

    // If registration data was parsed from the same Excel file, process it
    // AND merge it into players immediately so it persists
    if (parsedRegistrationData && parsedRegistrationData.length > 0) {
      console.log(`Processing ${parsedRegistrationData.length} registration records from Excel`);

      // Build a lookup map for registration data by normalized name
      const regDataByName = new Map<string, RegistrationRecord>();
      for (const reg of parsedRegistrationData) {
        const normalizedName = `${reg.firstName.toLowerCase().trim()} ${reg.lastName.toLowerCase().trim()}`;
        regDataByName.set(normalizedName, reg);
      }

      // Merge registration data into player objects
      playersWithRealTeamIds = playersWithRealTeamIds.map(player => {
        const normalizedName = `${player.firstName.toLowerCase().trim()} ${player.lastName.toLowerCase().trim()}`;
        const regData = regDataByName.get(normalizedName);

        if (regData) {
          return {
            ...player,
            coachRequest: regData.coachRequest || undefined,
            teammateRequests: regData.teammateRequests && regData.teammateRequests.length > 0
              ? regData.teammateRequests
              : undefined,
            school: regData.school || undefined,
            grade: regData.grade ?? undefined,
          };
        }
        return player;
      });

      const playersWithRequests = playersWithRealTeamIds.filter(
        p => p.coachRequest || (p.teammateRequests && p.teammateRequests.length > 0)
      );
      console.log(`Merged registration data: ${playersWithRequests.length} players now have request data`);

      // Also set up the registration state for the Resolution UI
      const evalPlayerList = playersWithRealTeamIds.map(p => ({
        bib: p.bib,
        firstName: p.firstName,
        lastName: p.lastName,
      }));
      convertRegistrationRecords(parsedRegistrationData, evalPlayerList);
    }

    setEvalPlayers(playersWithRealTeamIds);

    // Persist the updated teams and players (mark as local update to prevent sync loop)
    isLocalUpdate.current = true;
    if (onUpdateTeams) {
      onUpdateTeams(updatedTeams);
    }
    if (onUpdatePlayers) {
      console.log('Persisting players with registration data merged');
      onUpdatePlayers(playersWithRealTeamIds);
    }

    // Move to resolution step
    setStep('resolution');
  }, [teams, convertRegistrationRecords, onUpdateTeams, onUpdatePlayers]);

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
          littleLeagueAge: row.littleLeagueAge,
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

  // Create a DNE player with 0 scores from registration data
  const handleCreateDNEPlayer = useCallback((registrationIndex: number) => {
    const regPlayer = registrationPlayers.find(p => p.registrationIndex === registrationIndex);
    if (!regPlayer) return;

    // Create a new player with 0 scores and DNE flag
    const newPlayer: Player = {
      id: `dne-${registrationIndex}-${Date.now()}`,
      bib: `DNE-${registrationIndex}`,
      firstName: regPlayer.firstName,
      lastName: regPlayer.lastName,
      name: `${regPlayer.firstName} ${regPlayer.lastName}`,

      // All raw scores are 0 for DNE players
      fieldScore: 0,
      throwScore: 0,
      hitPower: 0,
      hitForm: 0,
      hitContact: 0,
      pitchingStrength: 0,
      pitchingForm: 0,
      catchScore: 0,
      runningScore: 0,

      // All subtotals are 0
      fieldingSubtotal: 0,
      hittingSubtotal: 0,
      pitchingSubtotal: 0,
      subjectiveTotal: 0,
      objectiveTotal: 0,
      officialAdjust: 0,

      totalScore: 0,
      rank: evalPlayers.length + 1, // Will be last
      projectedRound: Math.ceil((evalPlayers.length + 1) / teams.length),

      // Player info
      littleLeagueAge: regPlayer.littleLeagueAge ?? 0, // 0 indicates unknown age
      birthday: '',
      isAllStar: false,
      isDNE: true, // Mark as Did Not Evaluate

      // Draft rules
      isCoachKid: false,
      isDrafted: false,

      // Registration data
      coachRequest: regPlayer.coachRequest || undefined,
      teammateRequests: regPlayer.teammateRequests.length > 0 ? regPlayer.teammateRequests : undefined,
      school: regPlayer.school || undefined,
      grade: regPlayer.grade ?? undefined,
    };

    // Add to eval players
    setEvalPlayers(prev => [...prev, newPlayer]);

    // Update registration player to point to this new bib
    setRegistrationPlayers(prev => prev.map(p => {
      if (p.registrationIndex === registrationIndex) {
        return { ...p, evalBib: newPlayer.bib, match: { ...p.match, evalBib: newPlayer.bib, matchType: 'exact' } };
      }
      return p;
    }));

    // Remove from unmatched
    setUnmatchedPlayers(prev => prev.filter(p => p.registrationIndex !== registrationIndex));
  }, [registrationPlayers, evalPlayers.length, teams.length]);

  const handleProceedToConfirmRequests = useCallback(() => {
    console.log('=== handleProceedToConfirmRequests ===');
    console.log('registrationData:', registrationData ? `present with ${registrationData.rows?.length} rows` : 'null');
    console.log('registrationPlayers:', registrationPlayers.length);
    console.log('evalPlayers:', evalPlayers.length);

    // Debug: Check first few registration players
    if (registrationPlayers.length > 0) {
      console.log('Sample registration players:');
      registrationPlayers.slice(0, 3).forEach(rp => {
        console.log(`  ${rp.firstName} ${rp.lastName}: evalBib=${rp.evalBib}, coachReq=${rp.coachRequest}, teammates=${rp.teammateRequests?.join(',')}`);
      });
    } else {
      console.warn('No registration players! Data may not have been parsed.');
    }

    // Detect siblings by address before proceeding
    if (registrationData) {
      const siblingGroups = detectSiblingsByAddress(registrationData.rows);
      // Store sibling info for algorithm (would be added to player data)
      console.log('Detected sibling groups:', siblingGroups);
    }

    // Run normalization to resolve all requests
    const coachInfos: CoachInfo[] = teams.map(t => ({
      teamId: t.id,
      teamName: t.teamName || t.headCoach,
      coachName: t.headCoach,
      assistantCoach: t.assistantCoach,
    }));

    // Build player data for normalization by merging eval and registration
    // ALSO persist the registration data to player objects so it survives refresh/re-run
    const mergedPlayers = evalPlayers.map(evalPlayer => {
      const regPlayer = registrationPlayers.find(r => r.evalBib === evalPlayer.bib);
      if (regPlayer) {
        return {
          ...evalPlayer,
          coachRequest: regPlayer.coachRequest || undefined,
          teammateRequests: regPlayer.teammateRequests.length > 0 ? regPlayer.teammateRequests : undefined,
          school: regPlayer.school || undefined,
          grade: regPlayer.grade ?? undefined,
        };
      }
      return evalPlayer;
    });

    // Debug: Check how many players got merged data
    const playersWithRequests = mergedPlayers.filter(p => p.coachRequest || (p.teammateRequests && p.teammateRequests.length > 0));
    console.log('Players with request data after merge:', playersWithRequests.length);

    // Update local state with merged players
    setEvalPlayers(mergedPlayers);

    // Persist merged players to division so data survives navigation/refresh
    console.log('Calling onUpdatePlayers:', onUpdatePlayers ? 'defined' : 'NOT DEFINED');
    if (onUpdatePlayers) {
      onUpdatePlayers(mergedPlayers);
    }

    // Build player data for normalization
    const playersForNormalization = mergedPlayers.map(p => ({
      id: p.id,
      bib: p.bib,
      firstName: p.firstName,
      lastName: p.lastName,
      coachRequest: p.coachRequest,
      teammateRequests: p.teammateRequests,
      school: p.school,
    }));

    const normResult = normalizeRequestData(playersForNormalization, coachInfos);
    setNormalizationResult(normResult);

    console.log('Normalization result:', normResult.stats);
    if (normResult.warnings.length > 0) {
      console.log('Normalization warnings:', normResult.warnings);
    }

    // Prepare resolved requests for confirmation UI
    const preparedRequests = prepareRequestsForConfirmation(normResult, requestsFirstConfig);
    setResolvedRequests(preparedRequests);

    // Go to request confirmation step
    setStep('confirm-requests');
  }, [registrationData, evalPlayers, registrationPlayers, teams, requestsFirstConfig, onUpdatePlayers]);

  // Handle updating a request from the confirmation UI
  const handleUpdateRequest = useCallback((
    requestId: string,
    targetId: string | null,
    targetName: string | null
  ) => {
    setResolvedRequests(prev => prev.map(req => {
      if (req.id !== requestId) return req;

      if (targetId === null) {
        return {
          ...req,
          status: 'unresolvable' as const,
          resolvedTargetId: null,
          resolvedTargetName: null,
        };
      }

      return {
        ...req,
        status: 'user-confirmed' as const,
        resolvedTargetId: targetId,
        resolvedTargetName: targetName,
      };
    }));
  }, []);

  // Proceed from request confirmation to confirm-locks
  const handleProceedToConfirmLocks = useCallback(() => {
    setStep('confirm-locks');
  }, []);

  // -----------------------------------------------------------------------------
  // Step 3: Confirm Locks (Coach Kids & Siblings)
  // -----------------------------------------------------------------------------

  const handleUpdateTeam = useCallback((teamId: string, updates: Partial<Team>) => {
    setTeams(prev => {
      const updated = prev.map(t =>
        t.id === teamId ? { ...t, ...updates } : t
      );
      // Mark this as a local update so the useEffect doesn't sync back
      isLocalUpdate.current = true;
      // Persist to division immediately
      if (onUpdateTeams) {
        onUpdateTeams(updated);
      }
      return updated;
    });
  }, [onUpdateTeams]);

  const handleProceedToResults = useCallback(() => {
    // Save teams before proceeding (mark as local update to prevent sync loop)
    if (onUpdateTeams) {
      isLocalUpdate.current = true;
      onUpdateTeams(teams);
    }
    setStep('results');
  }, [onUpdateTeams, teams]);

  // -----------------------------------------------------------------------------
  // Auto-Detection Handlers
  // -----------------------------------------------------------------------------

  const handleRunAutoDetection = useCallback(() => {
    const coachMatches = autoDetectCoachKids(evalPlayers, teams);
    const siblingPairs = autoDetectSiblings(evalPlayers);

    setAutoDetectedMatches(coachMatches);
    setSiblingMatches(siblingPairs);

    if (coachMatches.length > 0 || siblingPairs.length > 0) {
      // Pre-select ALL matches including already marked/linked
      setSelectedMatches(new Set(coachMatches.map(m => m.playerId)));
      setSelectedSiblingPairs(new Set(siblingPairs.map(s => `${s.player1Id}-${s.player2Id}`)));
      setShowAutoDetectModal(true);
    }
  }, [evalPlayers, teams]);

  const handleToggleMatch = useCallback((playerId: string) => {
    setSelectedMatches(prev => {
      const newSet = new Set(prev);
      if (newSet.has(playerId)) {
        newSet.delete(playerId);
      } else {
        newSet.add(playerId);
      }
      return newSet;
    });
  }, []);

  const handleToggleSiblingPair = useCallback((pairKey: string) => {
    setSelectedSiblingPairs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pairKey)) {
        newSet.delete(pairKey);
      } else {
        newSet.add(pairKey);
      }
      return newSet;
    });
  }, []);

  const handleApplyDetection = useCallback(() => {
    // Apply coach kid assignments
    let updatedPlayers = [...evalPlayers];
    let updatedTeams = [...teams];

    autoDetectedMatches.forEach(match => {
      if (selectedMatches.has(match.playerId)) {
        // Mark player as coach kid
        updatedPlayers = updatedPlayers.map(p =>
          p.id === match.playerId
            ? { ...p, isCoachKid: true, coachTeamId: match.teamId }
            : p
        );
        // Add to team's coachKids array (ensure no duplicates)
        updatedTeams = updatedTeams.map(t => {
          if (t.id !== match.teamId) return t;
          // Dedupe the coachKids array to prevent any accumulation issues
          const existingIds = new Set(t.coachKids);
          if (existingIds.has(match.playerId)) return t;
          return { ...t, coachKids: [...t.coachKids, match.playerId] };
        });
      } else {
        // Not selected - clear coach kid status if previously set
        updatedPlayers = updatedPlayers.map(p =>
          p.id === match.playerId
            ? { ...p, isCoachKid: false, coachTeamId: undefined }
            : p
        );
        // Remove from team's coachKids array
        updatedTeams = updatedTeams.map(t => ({
          ...t,
          coachKids: t.coachKids.filter(id => id !== match.playerId),
        }));
      }
    });

    // Apply sibling links
    siblingMatches.forEach(match => {
      const pairKey = `${match.player1Id}-${match.player2Id}`;
      if (selectedSiblingPairs.has(pairKey)) {
        // Link siblings bidirectionally
        updatedPlayers = updatedPlayers.map(p => {
          if (p.id === match.player1Id) {
            return { ...p, siblingId: match.player2Id, sibling: match.player2Name };
          }
          if (p.id === match.player2Id) {
            return { ...p, siblingId: match.player1Id, sibling: match.player1Name };
          }
          return p;
        });
      } else {
        // Clear sibling links if previously set
        updatedPlayers = updatedPlayers.map(p => {
          if (p.id === match.player1Id || p.id === match.player2Id) {
            return { ...p, siblingId: undefined, sibling: undefined };
          }
          return p;
        });
      }
    });

    // Update state
    setEvalPlayers(updatedPlayers);
    setTeams(updatedTeams);

    // Persist changes
    if (onUpdatePlayers) {
      onUpdatePlayers(updatedPlayers);
    }
    if (onUpdateTeams) {
      isLocalUpdate.current = true;
      onUpdateTeams(updatedTeams);
    }

    // Close modal and reset
    setShowAutoDetectModal(false);
    setAutoDetectedMatches([]);
    setSiblingMatches([]);
    setSelectedMatches(new Set());
    setSelectedSiblingPairs(new Set());
  }, [evalPlayers, teams, autoDetectedMatches, siblingMatches, selectedMatches, selectedSiblingPairs, onUpdatePlayers, onUpdateTeams]);

  const handleSelectAllDetection = useCallback(() => {
    setSelectedMatches(new Set(autoDetectedMatches.map(m => m.playerId)));
    setSelectedSiblingPairs(new Set(siblingMatches.map(s => `${s.player1Id}-${s.player2Id}`)));
  }, [autoDetectedMatches, siblingMatches]);

  const handleDeselectAllDetection = useCallback(() => {
    setSelectedMatches(new Set());
    setSelectedSiblingPairs(new Set());
  }, []);

  // -----------------------------------------------------------------------------
  // Algorithm Selection (Simplified Flow)
  // -----------------------------------------------------------------------------

  // Build team builder players from eval players
  const buildTeamBuilderPlayers = useCallback((): TeamBuilderPlayer[] => {
    // Create mapping from evaluation team IDs (team-0, team-1, etc.) to actual division team IDs
    const evalTeamIdToRealId = new Map<string, string>();
    teams.forEach((team, index) => {
      evalTeamIdToRealId.set(`team-${index}`, team.id);
    });

    // Build normalized player map for quick lookup
    const normalizedPlayerMap = new Map(
      normalizationResult?.players.map(p => [p.id, p]) || []
    );

    // Build enhanced players using normalization results
    return evalPlayers.map(evalPlayer => {
      // Find matching registration data
      const regPlayer = registrationPlayers.find(r => r.evalBib === evalPlayer.bib);

      // Get normalized request data
      const normalized = normalizedPlayerMap.get(evalPlayer.id);

      // Extract two-way and one-way teammate IDs from normalization
      const twoWayTeammateIds: string[] = [];
      const oneWayTeammateIds: string[] = [];

      if (normalized) {
        for (const resolution of normalized.teammateResolutions) {
          if (resolution.resolvedPlayerId) {
            if (resolution.isTwoWay) {
              twoWayTeammateIds.push(resolution.resolvedPlayerId);
            } else {
              oneWayTeammateIds.push(resolution.resolvedPlayerId);
            }
          }
        }
      }

      // Remap coachTeamId from eval format (team-0, team-1) to actual division team ID
      const remappedCoachTeamId = evalPlayer.coachTeamId
        ? evalTeamIdToRealId.get(evalPlayer.coachTeamId) || evalPlayer.coachTeamId
        : undefined;

      return {
        ...evalPlayer,
        // Use registration Little League Age if available, otherwise keep eval age
        littleLeagueAge: regPlayer?.littleLeagueAge ?? evalPlayer.littleLeagueAge,
        // Remap coach team ID to actual division team ID
        coachTeamId: remappedCoachTeamId,
        coachRequest: normalized?.rawCoachRequest || regPlayer?.coachRequest,
        teammateRequests: normalized?.rawTeammateRequests || regPlayer?.teammateRequests,
        school: normalized?.normalizedSchool || regPlayer?.school,
        grade: regPlayer?.grade ?? undefined,
        // Use pre-resolved values from normalization
        resolvedCoachTeamId: normalized?.resolvedCoachTeamId || null,
        resolvedTeammateIds: normalized?.resolvedTeammateIds || [],
        twoWayTeammateIds,
        oneWayTeammateIds,
      };
    });
  }, [evalPlayers, teams, registrationPlayers, normalizationResult]);

  // Handle selecting an algorithm from comparison panel
  const handleSelectAlgorithm = useCallback((mode: SimplifiedAlgorithmMode, result: TeamBuilderResult) => {
    setSelectedAlgorithmMode(mode);
    setAlgorithmResult(result);

    // Check if this is a requests-first result (has suggestedTrades)
    if ('suggestedTrades' in result) {
      setRequestsFirstResult(result as RequestsFirstResult);
    } else {
      setRequestsFirstResult(null);
    }

    // Reset trade state
    setAppliedTradeIds(new Set());
    setDismissedTradeIds(new Set());

    // Apply assignments to get final state
    const teamBuilderPlayers = buildTeamBuilderPlayers();
    const { players: updatedPlayers, teams: updatedTeams } = applyAssignments(
      teamBuilderPlayers,
      teams,
      result.assignments
    );

    setFinalPlayers(updatedPlayers);
    setFinalTeams(updatedTeams);

    // Persist the results
    if (onUpdatePlayers) {
      onUpdatePlayers(updatedPlayers);
    }
    if (onUpdateTeams) {
      onUpdateTeams(updatedTeams);
    }
  }, [teams, buildTeamBuilderPlayers, onUpdatePlayers, onUpdateTeams]);

  // Handle applying a suggested trade
  const handleApplyTrade = useCallback((trade: TradeCandidate) => {
    if (!requestsFirstResult) return;

    // Mark trade as applied
    setAppliedTradeIds(prev => new Set([...prev, trade.id]));

    // Update final players and teams
    setFinalPlayers(prev => prev.map(p => {
      if (p.id === trade.player1Id) {
        return { ...p, draftedByTeamId: trade.toTeamId };
      }
      if (p.id === trade.player2Id) {
        return { ...p, draftedByTeamId: trade.fromTeamId };
      }
      return p;
    }));

    setFinalTeams(prev => prev.map(team => {
      if (team.id === trade.fromTeamId) {
        // Remove player1, add player2
        const player1 = finalPlayers.find(p => p.id === trade.player1Id);
        const player2 = finalPlayers.find(p => p.id === trade.player2Id);
        if (!player1 || !player2) return team;

        const newRoster = team.roster.filter(p => p.id !== trade.player1Id);
        newRoster.push({ ...player2, draftedByTeamId: trade.fromTeamId });
        const newTotalScore = newRoster.reduce((sum, p) => sum + p.totalScore, 0);
        return { ...team, roster: newRoster, totalScore: newTotalScore };
      }
      if (team.id === trade.toTeamId) {
        // Remove player2, add player1
        const player1 = finalPlayers.find(p => p.id === trade.player1Id);
        const player2 = finalPlayers.find(p => p.id === trade.player2Id);
        if (!player1 || !player2) return team;

        const newRoster = team.roster.filter(p => p.id !== trade.player2Id);
        newRoster.push({ ...player1, draftedByTeamId: trade.toTeamId });
        const newTotalScore = newRoster.reduce((sum, p) => sum + p.totalScore, 0);
        return { ...team, roster: newRoster, totalScore: newTotalScore };
      }
      return team;
    }));
  }, [requestsFirstResult, finalPlayers]);

  // Handle applying all suggested trades
  const handleApplyAllTrades = useCallback(() => {
    if (!requestsFirstResult) return;

    const pendingTrades = requestsFirstResult.suggestedTrades.filter(
      t => !appliedTradeIds.has(t.id) && !dismissedTradeIds.has(t.id)
    );

    for (const trade of pendingTrades) {
      handleApplyTrade(trade);
    }
  }, [requestsFirstResult, appliedTradeIds, dismissedTradeIds, handleApplyTrade]);

  // Handle dismissing a trade
  const handleDismissTrade = useCallback((tradeId: string) => {
    setDismissedTradeIds(prev => new Set([...prev, tradeId]));
  }, []);

  // -----------------------------------------------------------------------------
  // Step 4: Results
  // -----------------------------------------------------------------------------

  // Handle re-running with different settings - goes to confirm-locks to show comparison again
  const handleRerun = useCallback(() => {
    // Clear previous results
    setAlgorithmResult(null);
    setSelectedAlgorithmMode(null);
    // Clear comparison state
    setFinalPlayers([]);
    setFinalTeams([]);

    // If resolvedRequests is empty but players have request data, rebuild it
    if (resolvedRequests.length === 0 && evalPlayers.some(p => p.coachRequest || (p.teammateRequests && p.teammateRequests.length > 0))) {
      console.log('Rebuilding resolvedRequests from player data...');

      // Build coach info from teams
      const coachInfos: CoachInfo[] = teams.map(t => ({
        teamId: t.id,
        teamName: t.teamName || t.headCoach,
        coachName: t.headCoach,
        assistantCoach: t.assistantCoach,
      }));

      // Build player data for normalization from stored evalPlayers
      const playersForNormalization = evalPlayers.map(p => ({
        id: p.id,
        bib: p.bib,
        firstName: p.firstName,
        lastName: p.lastName,
        coachRequest: p.coachRequest,
        teammateRequests: p.teammateRequests,
        school: p.school,
      }));

      const normResult = normalizeRequestData(playersForNormalization, coachInfos);
      setNormalizationResult(normResult);

      const preparedRequests = prepareRequestsForConfirmation(normResult, requestsFirstConfig);
      setResolvedRequests(preparedRequests);

      console.log(`Rebuilt ${preparedRequests.length} requests from player data`);
    }

    setStep('confirm-locks');
  }, [resolvedRequests, evalPlayers, teams, requestsFirstConfig]);

  // Quick re-run that clears the selected algorithm and shows comparison again
  const handleQuickRerun = useCallback(() => {
    setAlgorithmResult(null);
    setSelectedAlgorithmMode(null);
    // Clear comparison state
    setFinalPlayers([]);
    setFinalTeams([]);
    // Stay on results step - the comparison panel will show again
  }, []);

  const handleFinalize = useCallback(() => {
    if (onComplete && algorithmResult) {
      onComplete(finalPlayers, finalTeams);
    }
  }, [onComplete, algorithmResult, finalPlayers, finalTeams]);

  // Helper to get all siblings of a player (including the player themselves)
  const getSiblingGroup = useCallback((playerId: string, players: Player[]): Player[] => {
    const player = players.find(p => p.id === playerId);
    if (!player || !player.siblingId) return [player].filter(Boolean) as Player[];

    // Find all players in the sibling group
    const siblingGroup: Player[] = [player];
    const visited = new Set<string>([playerId]);

    // Follow sibling links
    let current = player;
    while (current.siblingId && !visited.has(current.siblingId)) {
      const sibling = players.find(p => p.id === current.siblingId);
      if (sibling) {
        siblingGroup.push(sibling);
        visited.add(sibling.id);
        current = sibling;
      } else {
        break;
      }
    }

    // Also find players whose siblingId points to this player
    for (const p of players) {
      if (!visited.has(p.id) && p.siblingId && visited.has(p.siblingId)) {
        siblingGroup.push(p);
        visited.add(p.id);
      }
    }

    return siblingGroup;
  }, []);

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

    // Check for sibling constraints
    const player1Siblings = getSiblingGroup(player1Id, finalPlayers);
    const player2Siblings = getSiblingGroup(player2Id, finalPlayers);

    // If player1 has siblings on team1, swapping would separate them
    const player1SiblingsOnTeam1 = player1Siblings.filter(
      s => s.id !== player1Id && s.draftedByTeamId === team1Id
    );
    if (player1SiblingsOnTeam1.length > 0) {
      alert(`Cannot swap: ${player1.firstName} ${player1.lastName} has sibling(s) on this team (${player1SiblingsOnTeam1.map(s => `${s.firstName} ${s.lastName}`).join(', ')}). Move both siblings together instead.`);
      return;
    }

    // If player2 has siblings on team2, swapping would separate them
    const player2SiblingsOnTeam2 = player2Siblings.filter(
      s => s.id !== player2Id && s.draftedByTeamId === team2Id
    );
    if (player2SiblingsOnTeam2.length > 0) {
      alert(`Cannot swap: ${player2.firstName} ${player2.lastName} has sibling(s) on this team (${player2SiblingsOnTeam2.map(s => `${s.firstName} ${s.lastName}`).join(', ')}). Move both siblings together instead.`);
      return;
    }

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

    // Persist the changes to the database
    if (onUpdatePlayers) {
      onUpdatePlayers(updatedPlayers);
    }
    if (onUpdateTeams) {
      onUpdateTeams(updatedTeams);
    }

    // Update algorithm result to reflect the swap
    if (algorithmResult) {
      const meanScore = updatedPlayers.length > 0
        ? updatedPlayers.reduce((sum, p) => sum + p.totalScore, 0) / updatedTeams.length / (updatedPlayers.length / updatedTeams.length)
        : 0;

      // Update assignments
      const updatedAssignments = algorithmResult.assignments.map(a => {
        if (a.playerId === player1Id) {
          return { ...a, teamId: team2Id };
        }
        if (a.playerId === player2Id) {
          return { ...a, teamId: team1Id };
        }
        return a;
      });

      // Update team summaries
      const updatedTeamSummaries = algorithmResult.teamSummaries.map(ts => {
        const teamPlayers = updatedPlayers.filter(p => p.draftedByTeamId === ts.teamId);
        const totalScore = teamPlayers.reduce((sum, p) => sum + p.totalScore, 0);
        const avgScore = teamPlayers.length > 0 ? totalScore / teamPlayers.length : 0;
        return {
          ...ts,
          rosterCount: teamPlayers.length,
          totalScore,
          averageScore: avgScore,
          meanDelta: avgScore - meanScore,
          meanDeltaPercent: meanScore > 0 ? ((avgScore - meanScore) / meanScore) * 100 : 0,
        };
      });

      // Recalculate happiness scores
      const { playerHappiness, stats } = recalculateHappiness(
        updatedPlayers as TeamBuilderPlayer[],
        updatedAssignments,
        updatedTeamSummaries
      );

      setAlgorithmResult(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          assignments: updatedAssignments,
          teamSummaries: updatedTeamSummaries,
          playerHappiness,
          stats,
        };
      });
    }
  }, [finalPlayers, finalTeams, algorithmResult, onUpdatePlayers, onUpdateTeams]);

  // Handle moving a player to a different team (no swap)
  // Automatically moves siblings together
  const handleMovePlayer = useCallback((
    playerId: string,
    toTeamId: string
  ) => {
    const player = finalPlayers.find(p => p.id === playerId);
    if (!player) return;

    const fromTeamId = player.draftedByTeamId;
    if (!fromTeamId || fromTeamId === toTeamId) return;

    // Get all siblings that need to move together
    const siblingGroup = getSiblingGroup(playerId, finalPlayers);
    const playersToMove = siblingGroup.filter(p => p.draftedByTeamId === fromTeamId);
    const playerIdsToMove = new Set(playersToMove.map(p => p.id));

    // Update player assignments (move all siblings together)
    const updatedPlayers = finalPlayers.map(p => {
      if (playerIdsToMove.has(p.id)) {
        return { ...p, draftedByTeamId: toTeamId };
      }
      return p;
    });

    // Update team rosters
    const updatedTeams = finalTeams.map(team => {
      if (team.id === fromTeamId) {
        // Remove all moving players from source team
        const newRoster = team.roster.filter(p => !playerIdsToMove.has(p.id));
        const newTotalScore = newRoster.reduce((sum, p) => sum + p.totalScore, 0);
        return { ...team, roster: newRoster, totalScore: newTotalScore };
      }
      if (team.id === toTeamId) {
        // Add all moving players to destination team
        const newRoster = [
          ...team.roster,
          ...playersToMove.map(p => ({ ...p, draftedByTeamId: toTeamId }))
        ];
        const newTotalScore = newRoster.reduce((sum, p) => sum + p.totalScore, 0);
        return { ...team, roster: newRoster, totalScore: newTotalScore };
      }
      return team;
    });

    setFinalPlayers(updatedPlayers);
    setFinalTeams(updatedTeams);

    // Persist the changes to the database
    if (onUpdatePlayers) {
      onUpdatePlayers(updatedPlayers);
    }
    if (onUpdateTeams) {
      onUpdateTeams(updatedTeams);
    }

    // Update algorithm result to reflect the move
    if (algorithmResult) {
      const meanScore = updatedPlayers.length > 0
        ? updatedPlayers.reduce((sum, p) => sum + p.totalScore, 0) / updatedTeams.length / (updatedPlayers.length / updatedTeams.length)
        : 0;

      // Update assignments (move all siblings together)
      const updatedAssignments = algorithmResult.assignments.map(a => {
        if (playerIdsToMove.has(a.playerId)) {
          return { ...a, teamId: toTeamId };
        }
        return a;
      });

      // Update team summaries
      const updatedTeamSummaries = algorithmResult.teamSummaries.map(ts => {
        const teamPlayers = updatedPlayers.filter(p => p.draftedByTeamId === ts.teamId);
        const totalScore = teamPlayers.reduce((sum, p) => sum + p.totalScore, 0);
        const avgScore = teamPlayers.length > 0 ? totalScore / teamPlayers.length : 0;
        return {
          ...ts,
          rosterCount: teamPlayers.length,
          totalScore,
          averageScore: avgScore,
          meanDelta: avgScore - meanScore,
          meanDeltaPercent: meanScore > 0 ? ((avgScore - meanScore) / meanScore) * 100 : 0,
        };
      });

      // Recalculate happiness scores
      const { playerHappiness, stats } = recalculateHappiness(
        updatedPlayers as TeamBuilderPlayer[],
        updatedAssignments,
        updatedTeamSummaries
      );

      setAlgorithmResult(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          assignments: updatedAssignments,
          teamSummaries: updatedTeamSummaries,
          playerHappiness,
          stats,
        };
      });
    }
  }, [finalPlayers, finalTeams, algorithmResult, onUpdatePlayers, onUpdateTeams, getSiblingGroup]);

  // -----------------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------------

  // Simplified step progression
  const steps: { key: TeamBuilderStep; label: string; icon: typeof Upload }[] = [
    { key: 'setup', label: 'Setup', icon: Settings },
    { key: 'import', label: 'Import', icon: Upload },
    { key: 'resolution', label: 'Resolution', icon: Users },
    { key: 'confirm-requests', label: 'Confirm', icon: ClipboardCheck },
    { key: 'confirm-locks', label: 'Locks', icon: Wand2 },
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
        {/* Step 0: Setup */}
        {step === 'setup' && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Division Setup
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Review and configure teams and coaches before importing players.
              </p>
            </div>

            <div className="max-w-2xl mx-auto space-y-6">
              {/* Division Info */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Division Settings
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Name:</span>
                    <span className="ml-2 font-medium text-gray-900 dark:text-white">{division.name}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Age Range:</span>
                    <span className="ml-2 font-medium text-gray-900 dark:text-white">
                      {division.ageRange.min}-{division.ageRange.max}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Teams:</span>
                    <span className="ml-2 font-medium text-gray-900 dark:text-white">{teams.length}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Mode:</span>
                    <span className="ml-2 font-medium text-purple-600 dark:text-purple-400">
                      League Generated
                    </span>
                  </div>
                </div>
              </div>

              {/* Team Coaches */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Team Coaches
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Configure head coach and assistant coach for each team. These names are used for coach kid detection.
                </p>
                <div className="space-y-3">
                  {teams.map((team, index) => (
                    <div key={team.id} className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400 w-20">
                        Team {index + 1}
                      </span>
                      <input
                        type="text"
                        value={team.headCoach || ''}
                        onChange={(e) => handleUpdateTeam(team.id, { headCoach: e.target.value })}
                        placeholder="Last name only (e.g., Smith)"
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                      <input
                        type="text"
                        value={team.assistantCoach || ''}
                        onChange={(e) => handleUpdateTeam(team.id, { assistantCoach: e.target.value })}
                        placeholder="Last name only"
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Continue button */}
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    // Save coach names to division before proceeding (mark as local update)
                    if (onUpdateTeams) {
                      isLocalUpdate.current = true;
                      onUpdateTeams(teams);
                    }
                    setStep('import');
                  }}
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium flex items-center gap-2"
                >
                  Continue to Import
                  <Upload className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Import */}
        {step === 'import' && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Upload Evaluation Spreadsheet
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Upload your Excel file with evaluation data and registration info.
              </p>
            </div>

            {evalPlayers.length === 0 ? (
              <EvaluationImport
                teamCount={division.teamCount}
                initialTeamNames={teams.map(t => t.headCoach || '')}
                initialAssistantCoaches={teams.map(t => t.assistantCoach || '')}
                onComplete={handleEvalImportComplete}
                onCancel={onBack}
                hideNavigation={true}
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

            {/* Data Comparison Summary */}
            {registrationData && (
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Data Comparison
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  {/* Registration Data */}
                  <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                      {registrationPlayers.length}
                    </div>
                    <div className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                      Registration
                    </div>
                    <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      (from Registration Data tab)
                    </div>
                  </div>

                  {/* Eval Data */}
                  <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                      {evalPlayers.length}
                    </div>
                    <div className="text-sm text-green-700 dark:text-green-300 font-medium">
                      Evaluated
                    </div>
                    <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                      (from Summary/Eval tabs)
                    </div>
                  </div>

                  {/* Matched */}
                  <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                      {registrationPlayers.filter(p => p.evalBib).length}
                    </div>
                    <div className="text-sm text-purple-700 dark:text-purple-300 font-medium">
                      Linked
                    </div>
                    <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                      {(() => {
                        const exact = registrationPlayers.filter(p => p.match.matchType === 'exact').length;
                        const fuzzy = registrationPlayers.filter(p => p.match.matchType === 'fuzzy').length;
                        if (fuzzy > 0) {
                          return `(${exact} exact, ${fuzzy} fuzzy)`;
                        }
                        return '(auto-linked by name)';
                      })()}
                    </div>
                  </div>
                </div>

                {/* Delta Details - compute unmatched from both sides */}
                {(() => {
                  // Registration players without eval matches
                  const unmatchedReg = registrationPlayers.filter(p => !p.evalBib);
                  // Eval players without registration matches
                  const matchedBibs = new Set(registrationPlayers.filter(p => p.evalBib).map(p => p.evalBib));
                  const unmatchedEval = evalPlayers.filter(p => !matchedBibs.has(p.bib));

                  // Show delta section if there are any unmatched players
                  if (unmatchedReg.length === 0 && unmatchedEval.length === 0) return null;

                  return (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <div className="grid grid-cols-2 gap-4">
                        {/* In Registration but not Eval (DNE candidates) */}
                        {unmatchedReg.length > 0 && (
                          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                            <div className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
                              In Registration, Not Evaluated ({unmatchedReg.length})
                            </div>
                            <div className="text-xs text-amber-700 dark:text-amber-300 space-y-1 max-h-32 overflow-y-auto">
                              {unmatchedReg.map(p => (
                                <div key={p.registrationIndex}>• {p.fullName}</div>
                              ))}
                            </div>
                            <div className="text-xs text-amber-600 dark:text-amber-400 mt-2 italic">
                              These players can be marked as DNE below
                            </div>
                          </div>
                        )}

                        {/* In Eval but not Registration (orphaned eval records) */}
                        {unmatchedEval.length > 0 && (
                          <div className="p-3 bg-gray-100 dark:bg-gray-700/50 rounded-lg">
                            <div className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">
                              Evaluated, Not Registered ({unmatchedEval.length})
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1 max-h-32 overflow-y-auto">
                              {unmatchedEval.map(p => (
                                <div key={p.bib}>• {p.firstName} {p.lastName} (BIB {p.bib})</div>
                              ))}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-500 mt-2 italic">
                              May be name mismatches or withdrawn players
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

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
                  handleCreateDNEPlayer(index);
                }}
              />
            )}

            {/* Teammate request resolution would go here */}
            {registrationData && unmatchedPlayers.length === 0 && (() => {
              // Check if truly all players are matched
              const unmatchedRegCount = registrationPlayers.filter(p => !p.evalBib).length;
              const matchedBibs = new Set(registrationPlayers.filter(p => p.evalBib).map(p => p.evalBib));
              const unmatchedEvalCount = evalPlayers.filter(p => !matchedBibs.has(p.bib)).length;

              // Only show "all matched" if there are no unmatched on either side
              if (unmatchedRegCount > 0 || unmatchedEvalCount > 0) return null;

              return (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <span className="text-green-800 dark:text-green-200 font-medium">
                      All players matched successfully
                    </span>
                  </div>
                </div>
              );
            })()}

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
                onClick={handleProceedToConfirmRequests}
                className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium"
              >
                Continue to Confirm Requests
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Confirm Requests */}
        {step === 'confirm-requests' && (
          <RequestConfirmation
            requests={resolvedRequests}
            players={evalPlayers.map(p => ({
              id: p.id,
              firstName: p.firstName,
              lastName: p.lastName,
              bib: p.bib,
            }))}
            teams={teams}
            onUpdateRequest={handleUpdateRequest}
            onContinue={handleProceedToConfirmLocks}
            onBack={() => setStep('resolution')}
          />
        )}

        {/* Step 4: Confirm Locks (Coach Kids & Siblings) */}
        {step === 'confirm-locks' && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Confirm Team Locks
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Verify coach kids and siblings are assigned correctly before comparing algorithms.
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between">
                <button
                  onClick={() => setTeamsExpanded(!teamsExpanded)}
                  className="flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-700 -ml-2 px-2 py-1 rounded-lg transition-colors"
                >
                  <span className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                    {teamsExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    Teams & Detection
                  </span>
                  <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                    <span>{teams.length} teams</span>
                    {(() => {
                      const coachKidCount = teams.reduce((sum, t) => sum + t.coachKids.length, 0);
                      return coachKidCount > 0 ? (
                        <span className="text-blue-600 dark:text-blue-400">
                          <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-1"></span>
                          {coachKidCount} coach kids
                        </span>
                      ) : null;
                    })()}
                  </div>
                </button>
                {/* Detection Button */}
                <button
                  onClick={handleRunAutoDetection}
                  className="flex items-center gap-2 px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-medium text-sm"
                  title="Auto-detect coach's kids by matching last names"
                >
                  <Wand2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Find Coach Kids & Siblings</span>
                  <span className="sm:hidden">Detect</span>
                </button>
              </div>

              {teamsExpanded && (
                <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="mt-4 space-y-4">
                    {/* Team Names & Coaches Grid - 4 columns like the reference */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {teams.map((team) => {
                        const teamCoachKids = evalPlayers.filter(p =>
                          team.coachKids.includes(p.id) ||
                          (p.isCoachKid && p.coachTeamId === team.id)
                        );
                        return (
                          <div key={team.id} className="space-y-2">
                            <div>
                              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                Head Coach (Last Name)
                              </label>
                              <input
                                type="text"
                                value={team.headCoach}
                                onChange={(e) => handleUpdateTeam(team.id, { headCoach: e.target.value })}
                                placeholder="Last name only (e.g., Smith)"
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                Assistant Coach (Last Name)
                              </label>
                              <input
                                type="text"
                                value={team.assistantCoach || ''}
                                onChange={(e) => handleUpdateTeam(team.id, { assistantCoach: e.target.value })}
                                placeholder="Last name only"
                                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                              />
                            </div>
                            {teamCoachKids.length > 0 && (
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                Coach's Kids: {teamCoachKids.map(p => `${p.firstName} ${p.lastName}`).join(', ')}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Clear buttons */}
                    {(() => {
                      const coachKidCount = teams.reduce((sum, t) => sum + t.coachKids.length, 0);
                      return coachKidCount > 0 ? (
                        <div className="flex items-center gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                          <button
                            onClick={() => {
                              // Clear coach kids from all teams in one batch update
                              const clearedTeams = teams.map(t => ({ ...t, coachKids: [] }));
                              setTeams(clearedTeams);
                              // Also clear isCoachKid flag on players
                              const clearedPlayers = evalPlayers.map(p => ({
                                ...p,
                                isCoachKid: false,
                                coachTeamId: undefined,
                              }));
                              setEvalPlayers(clearedPlayers);
                              // Persist changes
                              if (onUpdateTeams) {
                                isLocalUpdate.current = true;
                                onUpdateTeams(clearedTeams);
                              }
                              if (onUpdatePlayers) {
                                onUpdatePlayers(clearedPlayers);
                              }
                            }}
                            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                          >
                            Clear Coach Kids
                          </button>
                        </div>
                      ) : null;
                    })()}
                  </div>
                </div>
              )}
            </div>

            {/* Request Resolution Summary - Interactive */}
            {normalizationResult && resolvedRequests.length > 0 && (
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Request Resolution Summary
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Click a category to view details and make changes.
                </p>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  {/* Coach Requests - Clickable */}
                  <button
                    onClick={() => {
                      setExpandedCategory(expandedCategory === 'coach' ? null : 'coach');
                      setCategorySearchQuery('');
                    }}
                    className={`p-4 rounded-lg text-left transition-all ${
                      expandedCategory === 'coach'
                        ? 'bg-purple-100 dark:bg-purple-900/40 ring-2 ring-purple-500'
                        : 'bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        {resolvedRequests.filter(r => r.requestType === 'coach' && r.resolvedTargetId).length}/{resolvedRequests.filter(r => r.requestType === 'coach').length}
                      </div>
                      {expandedCategory === 'coach' ? (
                        <ChevronUp className="w-5 h-5 text-purple-500" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-purple-400" />
                      )}
                    </div>
                    <div className="text-sm text-purple-700 dark:text-purple-300 font-medium">
                      Coach Requests
                    </div>
                    <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                      {(() => {
                        const coachReqs = resolvedRequests.filter(r => r.requestType === 'coach');
                        const resolved = coachReqs.filter(r => r.resolvedTargetId).length;
                        return coachReqs.length > 0
                          ? `${Math.round((resolved / coachReqs.length) * 100)}% matched`
                          : 'No requests';
                      })()}
                    </div>
                  </button>

                  {/* Buddy Requests - Clickable */}
                  <button
                    onClick={() => {
                      setExpandedCategory(expandedCategory === 'buddy' ? null : 'buddy');
                      setCategorySearchQuery('');
                    }}
                    className={`p-4 rounded-lg text-left transition-all ${
                      expandedCategory === 'buddy'
                        ? 'bg-blue-100 dark:bg-blue-900/40 ring-2 ring-blue-500'
                        : 'bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {resolvedRequests.filter(r => r.requestType === 'teammate' && !r.isTwoWay && r.resolvedTargetId).length}/{resolvedRequests.filter(r => r.requestType === 'teammate' && !r.isTwoWay).length}
                      </div>
                      {expandedCategory === 'buddy' ? (
                        <ChevronUp className="w-5 h-5 text-blue-500" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-blue-400" />
                      )}
                    </div>
                    <div className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                      Buddy Requests
                    </div>
                    <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      {(() => {
                        const buddyReqs = resolvedRequests.filter(r => r.requestType === 'teammate' && !r.isTwoWay);
                        const resolved = buddyReqs.filter(r => r.resolvedTargetId).length;
                        return buddyReqs.length > 0
                          ? `${Math.round((resolved / buddyReqs.length) * 100)}% matched`
                          : 'No requests';
                      })()}
                    </div>
                  </button>

                  {/* Two-Way Matches - Clickable */}
                  <button
                    onClick={() => {
                      setExpandedCategory(expandedCategory === 'two-way' ? null : 'two-way');
                      setCategorySearchQuery('');
                    }}
                    className={`p-4 rounded-lg text-left transition-all ${
                      expandedCategory === 'two-way'
                        ? 'bg-green-100 dark:bg-green-900/40 ring-2 ring-green-500'
                        : 'bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {Math.floor(resolvedRequests.filter(r => r.isTwoWay).length / 2)}
                      </div>
                      {expandedCategory === 'two-way' ? (
                        <ChevronUp className="w-5 h-5 text-green-500" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-green-400" />
                      )}
                    </div>
                    <div className="text-sm text-green-700 dark:text-green-300 font-medium">
                      Two-Way Matches
                    </div>
                    <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                      Both kids requested each other
                    </div>
                  </button>
                </div>

                {/* Expanded Category Detail View */}
                {expandedCategory && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    {/* Category Header & Search */}
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        {expandedCategory === 'coach' && <User className="w-4 h-4 text-purple-500" />}
                        {expandedCategory === 'buddy' && <Users className="w-4 h-4 text-blue-500" />}
                        {expandedCategory === 'two-way' && <Users className="w-4 h-4 text-green-500" />}
                        {expandedCategory === 'coach' && 'Coach Requests'}
                        {expandedCategory === 'buddy' && 'Buddy Requests (One-Way)'}
                        {expandedCategory === 'two-way' && 'Two-Way Matches'}
                      </h4>
                      <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          value={categorySearchQuery}
                          onChange={(e) => setCategorySearchQuery(e.target.value)}
                          placeholder="Search by name..."
                          className="w-full pl-9 pr-4 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                        />
                      </div>
                    </div>

                    {/* Request List */}
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {(() => {
                        // Filter requests by category
                        let categoryRequests = resolvedRequests.filter(r => {
                          if (expandedCategory === 'coach') return r.requestType === 'coach';
                          if (expandedCategory === 'buddy') return r.requestType === 'teammate' && !r.isTwoWay;
                          if (expandedCategory === 'two-way') return r.isTwoWay;
                          return false;
                        });

                        // Apply search filter
                        if (categorySearchQuery.trim()) {
                          const query = categorySearchQuery.toLowerCase().trim();
                          categoryRequests = categoryRequests.filter(r => {
                            const player = normalizationResult.players.find(p => p.id === r.playerId);
                            const playerName = player ? `${player.firstName} ${player.lastName}`.toLowerCase() : '';
                            const targetName = r.resolvedTargetName?.toLowerCase() || '';
                            const rawRequest = r.rawRequestString.toLowerCase();
                            return playerName.includes(query) || targetName.includes(query) || rawRequest.includes(query);
                          });
                        }

                        // For two-way, deduplicate (show each pair once)
                        if (expandedCategory === 'two-way') {
                          const seen = new Set<string>();
                          categoryRequests = categoryRequests.filter(r => {
                            const pairKey = [r.playerId, r.resolvedTargetId].sort().join('-');
                            if (seen.has(pairKey)) return false;
                            seen.add(pairKey);
                            return true;
                          });
                        }

                        if (categoryRequests.length === 0) {
                          return (
                            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                              {categorySearchQuery ? 'No matches found.' : 'No requests in this category.'}
                            </div>
                          );
                        }

                        return categoryRequests.map(req => {
                          const player = normalizationResult.players.find(p => p.id === req.playerId);
                          const targetTeam = req.requestType === 'coach' && req.resolvedTargetId
                            ? teams.find(t => t.id === req.resolvedTargetId)
                            : null;
                          const isEditing = editingRequestId === req.id;

                          return (
                            <div
                              key={req.id}
                              className={`p-3 rounded-lg border ${
                                req.status === 'needs-review'
                                  ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/10'
                                  : req.status === 'unresolvable'
                                  ? 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50'
                                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  {/* Player name */}
                                  <div className="flex-shrink-0">
                                    <span className="font-medium text-gray-900 dark:text-white">
                                      {player?.firstName} {player?.lastName}
                                    </span>
                                  </div>

                                  {/* Arrow and raw request */}
                                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 min-w-0">
                                    <span className="text-xs">requested</span>
                                    <span className="text-sm italic truncate">"{req.rawRequestString}"</span>
                                  </div>

                                  {/* Resolution */}
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className="text-gray-400">→</span>
                                    {req.resolvedTargetId ? (
                                      <span className={`font-medium ${
                                        expandedCategory === 'coach' ? 'text-purple-600 dark:text-purple-400' :
                                        expandedCategory === 'two-way' ? 'text-green-600 dark:text-green-400' :
                                        'text-blue-600 dark:text-blue-400'
                                      }`}>
                                        {req.resolvedTargetName}
                                        {targetTeam && ` (${targetTeam.headCoach})`}
                                      </span>
                                    ) : (
                                      <span className="text-red-500 dark:text-red-400 italic">Not matched</span>
                                    )}
                                  </div>

                                  {/* Two-way badge */}
                                  {req.isTwoWay && expandedCategory !== 'two-way' && (
                                    <span className="px-1.5 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded flex-shrink-0">
                                      TWO-WAY
                                    </span>
                                  )}

                                  {/* Confidence score */}
                                  {req.resolvedTargetId && (
                                    <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
                                      req.confidenceScore >= 0.9 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                                      req.confidenceScore >= 0.5 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' :
                                      'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                                    }`}>
                                      {Math.round(req.confidenceScore * 100)}%
                                    </span>
                                  )}
                                </div>

                                {/* Edit button */}
                                <button
                                  onClick={() => setEditingRequestId(isEditing ? null : req.id)}
                                  className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${
                                    isEditing
                                      ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                                      : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                                  }`}
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                              </div>

                              {/* Inline edit panel */}
                              {isEditing && (
                                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                    Select a match or mark as unresolvable:
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {/* Current match option */}
                                    {req.resolvedTargetId && (
                                      <button
                                        onClick={() => {
                                          // Already selected, do nothing
                                          setEditingRequestId(null);
                                        }}
                                        className="px-3 py-1.5 text-sm rounded-lg border-2 border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 flex items-center gap-1"
                                      >
                                        <Check className="w-3 h-3" />
                                        {req.resolvedTargetName}
                                      </button>
                                    )}

                                    {/* Suggested matches */}
                                    {req.suggestedMatches?.filter(m => m.id !== req.resolvedTargetId).slice(0, 3).map(match => (
                                      <button
                                        key={match.id}
                                        onClick={() => {
                                          handleUpdateRequest(req.id, match.id, match.name);
                                          setEditingRequestId(null);
                                        }}
                                        className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                                      >
                                        {match.name} ({Math.round(match.score * 100)}%)
                                      </button>
                                    ))}

                                    {/* Coach team options */}
                                    {req.requestType === 'coach' && teams.filter(t => t.id !== req.resolvedTargetId).slice(0, 4).map(team => (
                                      <button
                                        key={team.id}
                                        onClick={() => {
                                          handleUpdateRequest(req.id, team.id, team.headCoach || team.teamName || '');
                                          setEditingRequestId(null);
                                        }}
                                        className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                                      >
                                        {team.headCoach || team.teamName || `Team ${team.draftPosition}`}
                                      </button>
                                    ))}

                                    {/* Mark as unresolvable */}
                                    <button
                                      onClick={() => {
                                        handleUpdateRequest(req.id, null, null);
                                        setEditingRequestId(null);
                                      }}
                                      className={`px-3 py-1.5 text-sm rounded-lg border flex items-center gap-1 ${
                                        req.status === 'unresolvable'
                                          ? 'border-gray-500 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                                          : 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400'
                                      }`}
                                    >
                                      <X className="w-3 h-3" />
                                      Unresolvable
                                    </button>
                                  </div>

                                  {/* Teammate search for more options */}
                                  {req.requestType === 'teammate' && (
                                    <div className="mt-2">
                                      <input
                                        type="text"
                                        placeholder="Search for a player..."
                                        className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            const query = (e.target as HTMLInputElement).value.toLowerCase().trim();
                                            const match = normalizationResult.players.find(p =>
                                              p.id !== req.playerId &&
                                              (`${p.firstName} ${p.lastName}`.toLowerCase().includes(query) ||
                                               p.firstName.toLowerCase().includes(query) ||
                                               p.lastName.toLowerCase().includes(query))
                                            );
                                            if (match) {
                                              handleUpdateRequest(req.id, match.id, `${match.firstName} ${match.lastName}`);
                                              setEditingRequestId(null);
                                            }
                                          }
                                        }}
                                      />
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        });
                      })()}
                    </div>

                    {/* Close button */}
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                      <button
                        onClick={() => setExpandedCategory(null)}
                        className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                )}

                {/* Schools */}
                {normalizationResult.schools.length > 0 && !expandedCategory && (
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      <span className="font-medium">{normalizationResult.schools.length} schools</span> detected for clustering
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {normalizationResult.schools
                        .sort((a, b) => b.playerCount - a.playerCount)
                        .map((school) => (
                          <span
                            key={school.schoolId}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-full text-sm"
                          >
                            <span className="text-gray-700 dark:text-gray-300">{school.normalizedName}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">({school.playerCount})</span>
                          </span>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Player Request Lookup */}
            {normalizationResult && (
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Player Request Lookup
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Search for a player to see their request details and resolution status.
                </p>

                {/* Search input */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={playerSearchQuery}
                    onChange={(e) => setPlayerSearchQuery(e.target.value)}
                    placeholder="Type player name..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                  />
                </div>

                {/* Search results */}
                {playerSearchQuery.trim().length >= 2 && (() => {
                  const query = playerSearchQuery.toLowerCase().trim();
                  const matchingPlayers = normalizationResult.players.filter(p =>
                    p.firstName.toLowerCase().includes(query) ||
                    p.lastName.toLowerCase().includes(query) ||
                    `${p.firstName} ${p.lastName}`.toLowerCase().includes(query)
                  ).slice(0, 5);

                  if (matchingPlayers.length === 0) {
                    return (
                      <div className="text-sm text-gray-500 dark:text-gray-400 italic">
                        No players found matching "{playerSearchQuery}"
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-3">
                      {matchingPlayers.map(player => (
                        <div key={player.id} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                          <div className="font-medium text-gray-900 dark:text-white mb-3">
                            {player.firstName} {player.lastName}
                            <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                              (BIB: {player.bib})
                            </span>
                          </div>

                          {/* Coach Request */}
                          <div className="mb-3">
                            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">
                              Coach Request
                            </div>
                            {player.rawCoachRequest ? (
                              <div className="text-sm">
                                <span className="text-gray-700 dark:text-gray-300">
                                  Requested: "{player.rawCoachRequest}"
                                </span>
                                {player.resolvedCoachTeamId ? (
                                  <span className="ml-2 text-green-600 dark:text-green-400">
                                    → {player.resolvedCoachName} ({player.coachMatchType}, score: {player.coachMatchScore.toFixed(2)})
                                  </span>
                                ) : (
                                  <span className="ml-2 text-red-600 dark:text-red-400">
                                    → Not resolved ({player.coachRequestStatus})
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="text-sm text-gray-400 italic">No coach request</div>
                            )}
                          </div>

                          {/* Teammate Requests */}
                          <div>
                            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">
                              Teammate Requests
                            </div>
                            {player.teammateResolutions.length > 0 ? (
                              <div className="space-y-1">
                                {player.teammateResolutions.map((res, idx) => (
                                  <div key={idx} className="text-sm">
                                    <span className="text-gray-700 dark:text-gray-300">
                                      "{res.rawRequest}"
                                    </span>
                                    {res.resolvedPlayerId ? (
                                      <span className="ml-2 text-green-600 dark:text-green-400">
                                        → {res.resolvedPlayerName} ({res.matchType}, score: {res.matchScore.toFixed(2)})
                                        {res.isTwoWay && <span className="ml-1 text-blue-600 dark:text-blue-400">[TWO-WAY]</span>}
                                      </span>
                                    ) : (
                                      <span className="ml-2 text-red-600 dark:text-red-400">
                                        → Not resolved ({res.requestStatus})
                                        {res.suggestedMatches && res.suggestedMatches.length > 0 && (
                                          <span className="ml-1 text-gray-500">
                                            [Suggestions: {res.suggestedMatches.slice(0, 3).map(s => `${s.name} (${s.score.toFixed(2)})`).join(', ')}]
                                          </span>
                                        )}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-sm text-gray-400 italic">No teammate requests</div>
                            )}
                          </div>

                          {/* School */}
                          {player.normalizedSchool && (
                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                School: {player.normalizedSchool}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}
            {/* Continue button */}
            <div className="flex justify-between">
              <button
                onClick={() => setStep('confirm-requests')}
                className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Back
              </button>
              <button
                onClick={handleProceedToResults}
                className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium"
              >
                Compare Algorithms
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Results - shows comparison panel first, then results after selection */}
        {step === 'results' && !algorithmResult && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Compare Algorithms
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Review and select the best algorithm for your teams.
              </p>
            </div>

            <AlgorithmComparisonPanel
              players={buildTeamBuilderPlayers()}
              teams={teams}
              resolvedRequests={resolvedRequests}
              config={{
                ...requestsFirstConfig,
                maxRosterSize: config.maxRosterSize,
                minRosterSize: config.minRosterSize,
                forceEvenTeams: config.forceEvenTeams,
              }}
              onSelectResult={handleSelectAlgorithm}
            />

            {/* Back button */}
            <div className="flex justify-start">
              <button
                onClick={() => setStep('confirm-locks')}
                className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Back to Settings
              </button>
            </div>
          </div>
        )}

        {step === 'results' && algorithmResult && (
          <div className="space-y-6">
            {/* Show selected algorithm info */}
            {selectedAlgorithmMode && (
              <div className="flex items-center justify-between bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3">
                <div className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-500" />
                  <span className="text-gray-900 dark:text-white font-medium">
                    Selected: {selectedAlgorithmMode === 'skill-priority' ? 'Skill Priority' :
                              selectedAlgorithmMode === 'request-priority' ? 'Request Priority' : 'Balance Priority'}
                  </span>
                </div>
                <button
                  onClick={handleQuickRerun}
                  className="text-sm text-purple-600 dark:text-purple-400 hover:underline"
                >
                  Change Algorithm
                </button>
              </div>
            )}

            <TeamBuilderResults
              result={algorithmResult}
              players={finalPlayers}
              onRerun={handleRerun}
              onMovePlayer={handleMovePlayer}
            />

            {/* Trade Suggestions (only for requests-first algorithm) */}
            {requestsFirstResult && requestsFirstResult.suggestedTrades.length > 0 && (
              <TradeSuggestions
                suggestedTrades={requestsFirstResult.suggestedTrades}
                players={finalPlayers}
                onApplyTrade={handleApplyTrade}
                onApplyAll={handleApplyAllTrades}
                onDismissTrade={handleDismissTrade}
                appliedTradeIds={appliedTradeIds}
                dismissedTradeIds={dismissedTradeIds}
              />
            )}

            {/* Action buttons */}
            <div className="flex justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="flex gap-3">
                <button
                  onClick={handleQuickRerun}
                  className="px-6 py-2 border border-purple-500 text-purple-600 dark:text-purple-400 rounded-lg font-medium hover:bg-purple-50 dark:hover:bg-purple-900/20 flex items-center gap-2"
                  title="Re-run algorithm with current settings (quick test)"
                >
                  <RefreshCw className="w-4 h-4" />
                  Re-run
                </button>
                <button
                  onClick={handleRerun}
                  className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  <Settings className="w-4 h-4" />
                  Adjust Settings
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

      {/* Auto-Detection Modal */}
      {showAutoDetectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Auto-Detection Results
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Found {autoDetectedMatches.length} coach kid{autoDetectedMatches.length !== 1 ? 's' : ''} and {siblingMatches.length} sibling pair{siblingMatches.length !== 1 ? 's' : ''}
                </p>
              </div>
              <button
                onClick={() => setShowAutoDetectModal(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
              {/* Coach Kids */}
              {autoDetectedMatches.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <User className="w-4 h-4 text-blue-500" />
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      Coach's Kids ({autoDetectedMatches.length})
                    </h4>
                  </div>
                  <div className="space-y-2">
                    {autoDetectedMatches.map(match => (
                      <label
                        key={match.playerId}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedMatches.has(match.playerId)
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedMatches.has(match.playerId)}
                          onChange={() => handleToggleMatch(match.playerId)}
                          className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-gray-900 dark:text-white">
                            {match.playerName}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {match.reason}
                          </div>
                        </div>
                        {match.alreadyMarked && (
                          <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                            Already marked
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Siblings */}
              {siblingMatches.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="w-4 h-4 text-green-500" />
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      Siblings ({siblingMatches.length} pairs)
                    </h4>
                  </div>
                  <div className="space-y-2">
                    {siblingMatches.map(match => {
                      const pairKey = `${match.player1Id}-${match.player2Id}`;
                      return (
                        <label
                          key={pairKey}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            selectedSiblingPairs.has(pairKey)
                              ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                              : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedSiblingPairs.has(pairKey)}
                            onChange={() => handleToggleSiblingPair(pairKey)}
                            className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-500"
                          />
                          <div className="flex-1">
                            <div className="font-medium text-gray-900 dark:text-white">
                              {match.player1Name} & {match.player2Name}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {match.reason}
                            </div>
                          </div>
                          {match.alreadyLinked && (
                            <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                              Already linked
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {autoDetectedMatches.length === 0 && siblingMatches.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No matches found. Make sure team coach names are filled in.
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSelectAllDetection}
                  className="text-sm text-purple-600 dark:text-purple-400 hover:underline"
                >
                  Select All
                </button>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <button
                  onClick={handleDeselectAllDetection}
                  className="text-sm text-gray-500 dark:text-gray-400 hover:underline"
                >
                  Deselect All
                </button>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowAutoDetectModal(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApplyDetection}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Apply ({selectedMatches.size + selectedSiblingPairs.size} selected)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
