/**
 * API Client for league-draft backend
 * Handles communication with Django REST Framework API
 */

import type {
  Division,
  DivisionSummary,
  DivisionPreset,
  DivisionAgeRange,
  Player,
  Team,
  DraftState,
  DraftFormat,
  ScoringWeights,
  ScoringMode,
  Trade,
  DraftPick,
  User,
  LoginCredentials,
  RegisterData,
  ProfileUpdateData,
  ChangePasswordData,
  LeagueMember,
  LeagueInvitation,
  LeagueMembershipRole,
  JoinLinkStatus,
  JoinLinkInfo,
  AcceptInvitationResult,
} from '../types';

// API base URL - defaults to local dev server
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

// Helper to get CSRF token from cookies
function getCSRFToken(): string | null {
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'csrftoken') {
      return value;
    }
  }
  return null;
}

// Default fetch options for session-based auth
function getDefaultOptions(method: string = 'GET'): RequestInit {
  const options: RequestInit = {
    credentials: 'include', // Include session cookies
    headers: {
      'Content-Type': 'application/json',
    },
  };

  // Add CSRF token for non-GET requests
  if (method !== 'GET' && method !== 'HEAD') {
    const csrfToken = getCSRFToken();
    if (csrfToken) {
      (options.headers as Record<string, string>)['X-CSRFToken'] = csrfToken;
    }
  }

  return options;
}

// -----------------------------------------------------------------------------
// Type Transformations (snake_case <-> camelCase)
// -----------------------------------------------------------------------------

/**
 * Transform player data from API (snake_case) to frontend (camelCase)
 */
function transformPlayerFromApi(data: Record<string, unknown>): Player {
  return {
    id: data.id as string,
    bib: data.bib as string,
    firstName: data.first_name as string,
    lastName: data.last_name as string,
    name: data.name as string,
    fieldScore: data.field_score as number,
    throwScore: data.throw_score as number,
    hitPower: data.hit_power as number,
    hitForm: data.hit_form as number,
    hitContact: data.hit_contact as number,
    pitchingStrength: data.pitching_strength as number,
    pitchingForm: data.pitching_form as number,
    catchScore: data.catch_score as number,
    runningScore: data.running_score as number,
    fieldingSubtotal: data.fielding_subtotal as number,
    hittingSubtotal: data.hitting_subtotal as number,
    pitchingSubtotal: data.pitching_subtotal as number,
    subjectiveTotal: data.subjective_total as number,
    objectiveTotal: data.objective_total as number,
    officialAdjust: data.official_adjust as number,
    totalScore: data.total_score as number,
    rank: data.rank as number,
    projectedRound: data.projected_round as number,
    littleLeagueAge: data.little_league_age as number,
    birthday: data.birthday as string,
    isAllStar: data.is_all_star as boolean,
    isDNE: data.is_dne as boolean,
    isCoachKid: data.is_coach_kid as boolean,
    coachTeamId: data.coach_team_id as string | undefined,
    sibling: data.sibling as string | undefined,
    siblingId: data.sibling_id as string | undefined,
    lockedToRound: data.locked_to_round as number | undefined,
    lockedToTeamId: data.locked_to_team_id as string | undefined,
    isDrafted: data.is_drafted as boolean,
    draftedByTeamId: data.drafted_by_team_id as string | undefined,
    draftedInRound: data.drafted_in_round as number | undefined,
    draftedAtPick: data.drafted_at_pick as number | undefined,
  };
}

/**
 * Transform player data from frontend (camelCase) to API (snake_case)
 */
function transformPlayerToApi(player: Partial<Player>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // Include id for sibling reference mapping during bulk create
  if (player.id !== undefined) result.id = player.id;
  if (player.bib !== undefined) result.bib = player.bib;
  if (player.firstName !== undefined) result.first_name = player.firstName;
  if (player.lastName !== undefined) result.last_name = player.lastName;
  if (player.fieldScore !== undefined) result.field_score = player.fieldScore;
  if (player.throwScore !== undefined) result.throw_score = player.throwScore;
  if (player.hitPower !== undefined) result.hit_power = player.hitPower;
  if (player.hitForm !== undefined) result.hit_form = player.hitForm;
  if (player.hitContact !== undefined) result.hit_contact = player.hitContact;
  if (player.pitchingStrength !== undefined) result.pitching_strength = player.pitchingStrength;
  if (player.pitchingForm !== undefined) result.pitching_form = player.pitchingForm;
  if (player.catchScore !== undefined) result.catch_score = player.catchScore;
  if (player.runningScore !== undefined) result.running_score = player.runningScore;
  if (player.fieldingSubtotal !== undefined) result.fielding_subtotal = player.fieldingSubtotal;
  if (player.hittingSubtotal !== undefined) result.hitting_subtotal = player.hittingSubtotal;
  if (player.pitchingSubtotal !== undefined) result.pitching_subtotal = player.pitchingSubtotal;
  if (player.subjectiveTotal !== undefined) result.subjective_total = player.subjectiveTotal;
  if (player.objectiveTotal !== undefined) result.objective_total = player.objectiveTotal;
  if (player.officialAdjust !== undefined) result.official_adjust = player.officialAdjust;
  if (player.totalScore !== undefined) result.total_score = player.totalScore;
  if (player.rank !== undefined) result.rank = player.rank;
  if (player.projectedRound !== undefined) result.projected_round = player.projectedRound;
  if (player.littleLeagueAge !== undefined) result.little_league_age = player.littleLeagueAge;
  if (player.birthday !== undefined) result.birthday = player.birthday;
  if (player.isAllStar !== undefined) result.is_all_star = player.isAllStar;
  if (player.isDNE !== undefined) result.is_dne = player.isDNE;
  if (player.isCoachKid !== undefined) result.is_coach_kid = player.isCoachKid;
  if (player.coachTeamId !== undefined) result.coach_team_id = player.coachTeamId;
  if (player.sibling !== undefined) result.sibling = player.sibling;
  if (player.siblingId !== undefined) result.sibling_id = player.siblingId;
  if (player.lockedToRound !== undefined) result.locked_to_round = player.lockedToRound;
  if (player.lockedToTeamId !== undefined) result.locked_to_team_id = player.lockedToTeamId;
  if (player.isDrafted !== undefined) result.is_drafted = player.isDrafted;
  if (player.draftedByTeamId !== undefined) result.drafted_by_team_id = player.draftedByTeamId;
  if (player.draftedInRound !== undefined) result.drafted_in_round = player.draftedInRound;
  if (player.draftedAtPick !== undefined) result.drafted_at_pick = player.draftedAtPick;

  return result;
}

/**
 * Transform team data from API to frontend
 */
function transformTeamFromApi(data: Record<string, unknown>): Team {
  const roster = (data.roster as Record<string, unknown>[] || []).map(transformPlayerFromApi);
  const coachKidsData = data.coach_kids as Record<string, unknown>[] || [];
  const coachKids = coachKidsData.map((p) => p.id as string);

  return {
    id: data.id as string,
    name: data.name as string,
    roster,
    totalScore: data.total_score as number,
    draftPosition: data.draft_position as number,
    coachKids,
    assistantCoaches: data.assistant_coaches as string[] || [],
    ageBreakdown: data.age_breakdown as Record<number, number> || {},
  };
}

/**
 * Transform draft pick from API to frontend
 */
function transformDraftPickFromApi(data: Record<string, unknown>): DraftPick {
  return {
    round: data.round as number,
    pick: data.pick as number,
    teamId: data.team_id as string,
    playerId: data.player_id as string | undefined,
    timestamp: data.timestamp ? new Date(data.timestamp as string).getTime() : undefined,
    wasSkipped: data.was_skipped as boolean,
  };
}

/**
 * Transform trade from API to frontend
 */
function transformTradeFromApi(data: Record<string, unknown>): Trade {
  return {
    id: data.id as string,
    timestamp: new Date(data.timestamp as string).getTime(),
    team1Id: data.team1_id as string,
    team2Id: data.team2_id as string,
    player1Id: data.player1_id as string,
    player2Id: data.player2_id as string,
    reason: data.reason as string,
  };
}

/**
 * Transform draft state from API to frontend
 */
function transformDraftStateFromApi(
  data: Record<string, unknown>,
  players: Player[],
  teams: Team[]
): DraftState {
  const picks = (data.picks as Record<string, unknown>[] || []).map(transformDraftPickFromApi);
  const trades = (data.trades as Record<string, unknown>[] || []).map(transformTradeFromApi);

  let mandatoryPick: DraftState['mandatoryPick'] = undefined;
  const mandatoryPickData = data.mandatory_pick as Record<string, unknown> | null;
  if (mandatoryPickData) {
    mandatoryPick = {
      playerId: mandatoryPickData.player_id as string,
      reason: mandatoryPickData.reason as 'coach-kid' | 'sibling',
      siblingName: mandatoryPickData.sibling_name as string | undefined,
    };
  }

  return {
    id: data.id as string | undefined,
    players,
    teams,
    draftFormat: data.draft_format as DraftFormat,
    draftOrder: data.draft_order as string[],
    currentRoundOrder: data.current_round_order as string[],
    picks,
    currentRound: data.current_round as number,
    currentPickInRound: data.current_pick_in_round as number,
    currentTeamId: data.current_team_id as string | null,
    isDraftComplete: data.is_draft_complete as boolean,
    mandatoryPick,
    trades,
  };
}

/**
 * Transform division data from API to frontend
 */
function transformDivisionFromApi(data: Record<string, unknown>): Division {
  const players = (data.players as Record<string, unknown>[] || []).map(transformPlayerFromApi);
  const teams = (data.teams as Record<string, unknown>[] || []).map(transformTeamFromApi);
  const ageRange = data.age_range as { min: number; max: number };

  let draftState: DraftState | null = null;
  const draftStateData = data.draft_state as Record<string, unknown> | null;
  if (draftStateData) {
    draftState = transformDraftStateFromApi(draftStateData, players, teams);
  }

  return {
    id: data.id as string,
    name: data.name as string,
    preset: data.preset as DivisionPreset,
    ageRange: ageRange,
    enforceAgeLimit: data.enforce_age_limit as boolean,
    maxPerAge: data.max_per_age as number,
    teamCount: data.team_count as number,
    rosterSize: data.roster_size as number,
    teams,
    players,
    draftState,
    scoringWeights: data.scoring_weights as ScoringWeights,
    scoringMode: data.scoring_mode as ScoringMode,
    phase: data.phase as Division['phase'],
    createdAt: data.created_at as string,
    completedAt: data.completed_at as string | undefined,
  };
}

/**
 * Transform league membership from API to frontend
 */
function transformLeagueMembershipFromApi(data: Record<string, unknown>): import('../types').LeagueMembership {
  return {
    id: data.id as string,
    leagueId: data.league_id as string,
    leagueName: data.league_name as string,
    leagueSlug: data.league_slug as string,
    role: data.role as import('../types').LeagueMembershipRole,
    createdAt: data.created_at as string,
  };
}

/**
 * Transform user data from API to frontend
 */
function transformUserFromApi(data: Record<string, unknown>): User {
  const leagues = (data.leagues as Record<string, unknown>[] || []).map(transformLeagueMembershipFromApi);
  return {
    id: data.id as string,
    email: data.email as string,
    firstName: data.first_name as string,
    lastName: data.last_name as string,
    role: data.role as User['role'],
    leagues,
  };
}

/**
 * Transform division summary from API to frontend
 */
function transformDivisionSummaryFromApi(data: Record<string, unknown>): DivisionSummary {
  return {
    id: data.id as string,
    name: data.name as string,
    preset: data.preset as DivisionPreset,
    teamCount: data.team_count as number,
    playerCount: data.player_count as number,
    phase: data.phase as DivisionSummary['phase'],
    createdAt: data.created_at as string,
    completedAt: data.completed_at as string | undefined,
  };
}

// -----------------------------------------------------------------------------
// API Error Handling
// -----------------------------------------------------------------------------

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let details: Record<string, unknown> | undefined;
    try {
      details = await response.json();
    } catch {
      // Response body might not be JSON
    }
    throw new ApiError(
      `API request failed: ${response.statusText}`,
      response.status,
      details
    );
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// -----------------------------------------------------------------------------
// API Client
// -----------------------------------------------------------------------------

export const api = {
  // ---------------------------------------------------------------------------
  // Health Check
  // ---------------------------------------------------------------------------

  async health(): Promise<{ status: string }> {
    const response = await fetch(`${API_BASE_URL.replace('/api', '')}/health`, getDefaultOptions());
    return handleResponse(response);
  },

  // ---------------------------------------------------------------------------
  // CSRF Token
  // ---------------------------------------------------------------------------

  /**
   * Initialize CSRF token cookie.
   * Call this on app initialization to ensure the CSRF cookie is set before any POST requests.
   */
  async initCSRF(): Promise<void> {
    try {
      await fetch(`${API_BASE_URL}/auth/csrf/`, {
        ...getDefaultOptions(),
        credentials: 'include',
      });
    } catch {
      // Silently fail - CSRF cookie might already be set
    }
  },

  // ---------------------------------------------------------------------------
  // Auth
  // ---------------------------------------------------------------------------

  async register(data: RegisterData): Promise<User> {
    const response = await fetch(`${API_BASE_URL}/auth/register/`, {
      ...getDefaultOptions('POST'),
      method: 'POST',
      body: JSON.stringify({
        email: data.email,
        password: data.password,
        first_name: data.firstName || '',
        last_name: data.lastName || '',
        league_name: data.leagueName || '',
        league_slug: data.leagueSlug || '',
      }),
    });
    const result = await handleResponse<Record<string, unknown>>(response);
    return transformUserFromApi(result);
  },

  async login(credentials: LoginCredentials): Promise<User> {
    const response = await fetch(`${API_BASE_URL}/auth/login/`, {
      ...getDefaultOptions('POST'),
      method: 'POST',
      body: JSON.stringify({
        email: credentials.email,
        password: credentials.password,
      }),
    });
    const result = await handleResponse<Record<string, unknown>>(response);
    return transformUserFromApi(result);
  },

  async logout(): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/auth/logout/`, {
      ...getDefaultOptions('POST'),
      method: 'POST',
    });
    await handleResponse<void>(response);
  },

  async getCurrentUser(): Promise<User> {
    const response = await fetch(`${API_BASE_URL}/auth/me/`, getDefaultOptions());
    const result = await handleResponse<Record<string, unknown>>(response);
    return transformUserFromApi(result);
  },

  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE_URL}/auth/password-reset/`, {
      ...getDefaultOptions('POST'),
      method: 'POST',
      body: JSON.stringify({ email }),
    });
    return handleResponse<{ message: string }>(response);
  },

  async confirmPasswordReset(uid: string, token: string, newPassword: string): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE_URL}/auth/password-reset/confirm/`, {
      ...getDefaultOptions('POST'),
      method: 'POST',
      body: JSON.stringify({
        uid,
        token,
        new_password: newPassword,
      }),
    });
    return handleResponse<{ message: string }>(response);
  },

  // ---------------------------------------------------------------------------
  // Divisions
  // ---------------------------------------------------------------------------

  async listDivisions(): Promise<DivisionSummary[]> {
    const response = await fetch(`${API_BASE_URL}/divisions/`, getDefaultOptions());
    const data = await handleResponse<Record<string, unknown>[]>(response);
    return data.map(transformDivisionSummaryFromApi);
  },

  async getDivision(id: string): Promise<Division> {
    const response = await fetch(`${API_BASE_URL}/divisions/${id}/?include=all`, getDefaultOptions());
    const data = await handleResponse<Record<string, unknown>>(response);
    return transformDivisionFromApi(data);
  },

  async createDivision(params: {
    name: string;
    preset: DivisionPreset;
    ageRange: DivisionAgeRange;
    teamCount: number;
    enforceAgeLimit?: boolean;
    maxPerAge?: number;
    scoringWeights?: ScoringWeights;
    scoringMode?: ScoringMode;
  }): Promise<Division> {
    const response = await fetch(`${API_BASE_URL}/divisions/`, {
      ...getDefaultOptions('POST'),
      method: 'POST',
      body: JSON.stringify({
        name: params.name,
        preset: params.preset,
        age_range: params.ageRange,
        team_count: params.teamCount,
        enforce_age_limit: params.enforceAgeLimit ?? true,
        max_per_age: params.maxPerAge ?? 0,
        scoring_weights: params.scoringWeights,
        scoring_mode: params.scoringMode ?? 'pre-weighted',
      }),
    });
    const data = await handleResponse<Record<string, unknown>>(response);
    return transformDivisionFromApi(data);
  },

  async updateDivision(
    id: string,
    updates: Partial<{
      name: string;
      preset: DivisionPreset;
      ageRange: DivisionAgeRange;
      enforceAgeLimit: boolean;
      maxPerAge: number;
      teamCount: number;
      rosterSize: number;
      scoringWeights: ScoringWeights;
      scoringMode: ScoringMode;
      phase: Division['phase'];
    }>
  ): Promise<Division> {
    const body: Record<string, unknown> = {};
    if (updates.name !== undefined) body.name = updates.name;
    if (updates.preset !== undefined) body.preset = updates.preset;
    if (updates.ageRange !== undefined) body.age_range = updates.ageRange;
    if (updates.enforceAgeLimit !== undefined) body.enforce_age_limit = updates.enforceAgeLimit;
    if (updates.maxPerAge !== undefined) body.max_per_age = updates.maxPerAge;
    if (updates.teamCount !== undefined) body.team_count = updates.teamCount;
    if (updates.rosterSize !== undefined) body.roster_size = updates.rosterSize;
    if (updates.scoringWeights !== undefined) body.scoring_weights = updates.scoringWeights;
    if (updates.scoringMode !== undefined) body.scoring_mode = updates.scoringMode;
    if (updates.phase !== undefined) body.phase = updates.phase;

    const response = await fetch(`${API_BASE_URL}/divisions/${id}/`, {
      ...getDefaultOptions('PATCH'),
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    const data = await handleResponse<Record<string, unknown>>(response);
    return transformDivisionFromApi(data);
  },

  async deleteDivision(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/divisions/${id}/`, {
      ...getDefaultOptions('DELETE'),
      method: 'DELETE',
    });
    await handleResponse<void>(response);
  },

  // ---------------------------------------------------------------------------
  // Players
  // ---------------------------------------------------------------------------

  async getPlayer(id: string): Promise<Player> {
    const response = await fetch(`${API_BASE_URL}/players/${id}/`, getDefaultOptions());
    const data = await handleResponse<Record<string, unknown>>(response);
    return transformPlayerFromApi(data);
  },

  async updatePlayer(id: string, updates: Partial<Player>): Promise<Player> {
    const response = await fetch(`${API_BASE_URL}/players/${id}/`, {
      ...getDefaultOptions('PATCH'),
      method: 'PATCH',
      body: JSON.stringify(transformPlayerToApi(updates)),
    });
    const data = await handleResponse<Record<string, unknown>>(response);
    return transformPlayerFromApi(data);
  },

  async deletePlayer(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/players/${id}/`, {
      ...getDefaultOptions('DELETE'),
      method: 'DELETE',
    });
    await handleResponse<void>(response);
  },

  async bulkCreatePlayers(divisionId: string, players: Partial<Player>[]): Promise<Player[]> {
    const response = await fetch(`${API_BASE_URL}/players/bulk/`, {
      ...getDefaultOptions('POST'),
      method: 'POST',
      body: JSON.stringify({
        division_id: divisionId,
        players: players.map(transformPlayerToApi),
      }),
    });
    const data = await handleResponse<Record<string, unknown>[]>(response);
    return data.map(transformPlayerFromApi);
  },

  async deleteAllPlayers(divisionId: string): Promise<{ deleted: number }> {
    const response = await fetch(`${API_BASE_URL}/players/delete_by_division/?division_id=${divisionId}`, {
      ...getDefaultOptions('DELETE'),
      method: 'DELETE',
    });
    return handleResponse<{ deleted: number }>(response);
  },

  // ---------------------------------------------------------------------------
  // Teams
  // ---------------------------------------------------------------------------

  async getTeam(id: string): Promise<Team> {
    const response = await fetch(`${API_BASE_URL}/teams/${id}/`, getDefaultOptions());
    const data = await handleResponse<Record<string, unknown>>(response);
    return transformTeamFromApi(data);
  },

  async updateTeam(
    id: string,
    updates: Partial<{
      name: string;
      draftPosition: number;
      assistantCoaches: string[];
      totalScore: number;
      ageBreakdown: Record<number, number>;
    }>
  ): Promise<Team> {
    const body: Record<string, unknown> = {};
    if (updates.name !== undefined) body.name = updates.name;
    if (updates.draftPosition !== undefined) body.draft_position = updates.draftPosition;
    if (updates.assistantCoaches !== undefined) body.assistant_coaches = updates.assistantCoaches;
    if (updates.totalScore !== undefined) body.total_score = updates.totalScore;
    if (updates.ageBreakdown !== undefined) body.age_breakdown = updates.ageBreakdown;

    const response = await fetch(`${API_BASE_URL}/teams/${id}/`, {
      ...getDefaultOptions('PATCH'),
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    const data = await handleResponse<Record<string, unknown>>(response);
    return transformTeamFromApi(data);
  },

  async listTeams(divisionId: string): Promise<Team[]> {
    const response = await fetch(`${API_BASE_URL}/teams/?division_id=${divisionId}`, getDefaultOptions());
    const data = await handleResponse<Record<string, unknown>[]>(response);
    return data.map(transformTeamFromApi);
  },

  // ---------------------------------------------------------------------------
  // Draft Operations
  // ---------------------------------------------------------------------------

  async startDraft(params: {
    divisionId: string;
    draftFormat: DraftFormat;
    draftOrder: string[];
  }): Promise<{ draftState: DraftState; players: Player[]; teams: Team[] }> {
    const response = await fetch(`${API_BASE_URL}/draft/start/`, {
      ...getDefaultOptions('POST'),
      method: 'POST',
      body: JSON.stringify({
        division_id: params.divisionId,
        draft_format: params.draftFormat,
        draft_order: params.draftOrder,
      }),
    });
    const data = await handleResponse<Record<string, unknown>>(response);

    const players = (data.players as Record<string, unknown>[]).map(transformPlayerFromApi);
    const teams = (data.teams as Record<string, unknown>[]).map(transformTeamFromApi);
    const draftState = transformDraftStateFromApi(
      data.draft_state as Record<string, unknown>,
      players,
      teams
    );

    return { draftState, players, teams };
  },

  async draftPlayer(params: {
    draftStateId: string;
    playerId: string;
    teamId: string;
  }): Promise<{ draftState: DraftState; players: Player[]; teams: Team[] }> {
    const response = await fetch(`${API_BASE_URL}/draft/pick/`, {
      ...getDefaultOptions('POST'),
      method: 'POST',
      body: JSON.stringify({
        draft_state_id: params.draftStateId,
        player_id: params.playerId,
        team_id: params.teamId,
      }),
    });
    const data = await handleResponse<Record<string, unknown>>(response);

    const players = (data.players as Record<string, unknown>[]).map(transformPlayerFromApi);
    const teams = (data.teams as Record<string, unknown>[]).map(transformTeamFromApi);
    const draftState = transformDraftStateFromApi(
      data.draft_state as Record<string, unknown>,
      players,
      teams
    );

    return { draftState, players, teams };
  },

  async undoLastPick(draftStateId: string): Promise<{ draftState: DraftState; players: Player[]; teams: Team[] }> {
    const response = await fetch(`${API_BASE_URL}/draft/undo/`, {
      ...getDefaultOptions('POST'),
      method: 'POST',
      body: JSON.stringify({
        draft_state_id: draftStateId,
      }),
    });
    const data = await handleResponse<Record<string, unknown>>(response);

    const players = (data.players as Record<string, unknown>[]).map(transformPlayerFromApi);
    const teams = (data.teams as Record<string, unknown>[]).map(transformTeamFromApi);
    const draftState = transformDraftStateFromApi(
      data.draft_state as Record<string, unknown>,
      players,
      teams
    );

    return { draftState, players, teams };
  },

  async createTrade(params: {
    draftStateId: string;
    team1Id: string;
    team2Id: string;
    player1Id: string;
    player2Id: string;
    reason: string;
  }): Promise<{ draftState: DraftState; players: Player[]; teams: Team[] }> {
    const response = await fetch(`${API_BASE_URL}/draft/trade/`, {
      ...getDefaultOptions('POST'),
      method: 'POST',
      body: JSON.stringify({
        draft_state_id: params.draftStateId,
        team1_id: params.team1Id,
        team2_id: params.team2Id,
        player1_id: params.player1Id,
        player2_id: params.player2Id,
        reason: params.reason,
      }),
    });
    const data = await handleResponse<Record<string, unknown>>(response);

    const players = (data.players as Record<string, unknown>[]).map(transformPlayerFromApi);
    const teams = (data.teams as Record<string, unknown>[]).map(transformTeamFromApi);
    const draftState = transformDraftStateFromApi(
      data.draft_state as Record<string, unknown>,
      players,
      teams
    );

    return { draftState, players, teams };
  },

  async resetDraft(divisionId: string): Promise<Division> {
    const response = await fetch(`${API_BASE_URL}/divisions/${divisionId}/reset/`, {
      ...getDefaultOptions('POST'),
      method: 'POST',
    });
    const data = await handleResponse<Record<string, unknown>>(response);
    return transformDivisionFromApi(data);
  },

  // ---------------------------------------------------------------------------
  // Profile
  // ---------------------------------------------------------------------------

  async updateProfile(data: ProfileUpdateData): Promise<User> {
    const body: Record<string, unknown> = {};
    if (data.firstName !== undefined) body.first_name = data.firstName;
    if (data.lastName !== undefined) body.last_name = data.lastName;
    if (data.email !== undefined) body.email = data.email;

    const response = await fetch(`${API_BASE_URL}/auth/me/`, {
      ...getDefaultOptions('PATCH'),
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    const result = await handleResponse<Record<string, unknown>>(response);
    return transformUserFromApi(result);
  },

  async changePassword(data: ChangePasswordData): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE_URL}/auth/change-password/`, {
      ...getDefaultOptions('POST'),
      method: 'POST',
      body: JSON.stringify({
        current_password: data.currentPassword,
        new_password: data.newPassword,
      }),
    });
    return handleResponse<{ message: string }>(response);
  },

  // ---------------------------------------------------------------------------
  // League Members
  // ---------------------------------------------------------------------------

  async listLeagueMembers(leagueId: string): Promise<LeagueMember[]> {
    const response = await fetch(`${API_BASE_URL}/leagues/${leagueId}/members/`, getDefaultOptions());
    const data = await handleResponse<Record<string, unknown>[]>(response);
    return data.map(transformLeagueMemberFromApi);
  },

  async removeLeagueMember(leagueId: string, userId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/leagues/${leagueId}/members/${userId}/`, {
      ...getDefaultOptions('DELETE'),
      method: 'DELETE',
    });
    await handleResponse<void>(response);
  },

  async updateMemberRole(leagueId: string, userId: string, role: LeagueMembershipRole): Promise<LeagueMember> {
    const response = await fetch(`${API_BASE_URL}/leagues/${leagueId}/members/${userId}/role/`, {
      ...getDefaultOptions('PATCH'),
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
    const data = await handleResponse<Record<string, unknown>>(response);
    return transformLeagueMemberFromApi(data);
  },

  // ---------------------------------------------------------------------------
  // League Invitations
  // ---------------------------------------------------------------------------

  async listLeagueInvitations(leagueId: string): Promise<LeagueInvitation[]> {
    const response = await fetch(`${API_BASE_URL}/leagues/${leagueId}/invitations/`, getDefaultOptions());
    const data = await handleResponse<Record<string, unknown>[]>(response);
    return data.map(transformLeagueInvitationFromApi);
  },

  async createInvitation(leagueId: string, email: string, role: LeagueMembershipRole = 'member'): Promise<LeagueInvitation> {
    const response = await fetch(`${API_BASE_URL}/leagues/${leagueId}/invitations/`, {
      ...getDefaultOptions('POST'),
      method: 'POST',
      body: JSON.stringify({ email, role }),
    });
    const data = await handleResponse<Record<string, unknown>>(response);
    return transformLeagueInvitationFromApi(data);
  },

  async cancelInvitation(leagueId: string, invitationId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/leagues/${leagueId}/invitations/${invitationId}/`, {
      ...getDefaultOptions('DELETE'),
      method: 'DELETE',
    });
    await handleResponse<void>(response);
  },

  async acceptInvitation(token: string): Promise<AcceptInvitationResult> {
    const response = await fetch(`${API_BASE_URL}/invitations/accept/`, {
      ...getDefaultOptions('POST'),
      method: 'POST',
      body: JSON.stringify({ token }),
    });
    const data = await handleResponse<Record<string, unknown>>(response);
    return {
      message: data.message as string,
      leagueId: data.league_id as string,
      leagueName: data.league_name as string,
    };
  },

  // ---------------------------------------------------------------------------
  // Join Link
  // ---------------------------------------------------------------------------

  async getJoinLinkStatus(leagueId: string): Promise<JoinLinkStatus> {
    const response = await fetch(`${API_BASE_URL}/leagues/${leagueId}/join-link/`, getDefaultOptions());
    const data = await handleResponse<Record<string, unknown>>(response);
    return {
      enabled: data.enabled as boolean,
      token: data.token as string | null,
      url: data.url as string | null,
    };
  },

  async generateJoinLink(leagueId: string): Promise<JoinLinkStatus> {
    const response = await fetch(`${API_BASE_URL}/leagues/${leagueId}/join-link/`, {
      ...getDefaultOptions('POST'),
      method: 'POST',
    });
    const data = await handleResponse<Record<string, unknown>>(response);
    return {
      enabled: data.enabled as boolean,
      token: data.token as string | null,
      url: data.url as string | null,
    };
  },

  async disableJoinLink(leagueId: string): Promise<JoinLinkStatus> {
    const response = await fetch(`${API_BASE_URL}/leagues/${leagueId}/join-link/`, {
      ...getDefaultOptions('DELETE'),
      method: 'DELETE',
    });
    const data = await handleResponse<Record<string, unknown>>(response);
    return {
      enabled: data.enabled as boolean,
      token: data.token as string | null,
      url: data.url as string | null,
    };
  },

  async getJoinLinkInfo(token: string): Promise<JoinLinkInfo> {
    const response = await fetch(`${API_BASE_URL}/leagues/join/${token}/`, getDefaultOptions());
    const data = await handleResponse<Record<string, unknown>>(response);
    return {
      leagueName: data.league_name as string,
      leagueSlug: data.league_slug as string,
      type: data.type as 'join_link' | 'email_invitation' | undefined,
      invitedBy: data.invited_by as string | null | undefined,
      role: data.role as LeagueMembershipRole | undefined,
    };
  },
};

// Transform league member from API
function transformLeagueMemberFromApi(data: Record<string, unknown>): LeagueMember {
  return {
    id: data.id as string,
    userId: data.user_id as string,
    email: data.email as string,
    firstName: data.first_name as string,
    lastName: data.last_name as string,
    role: data.role as LeagueMembershipRole,
    joinedAt: data.joined_at as string,
  };
}

// Transform league invitation from API
function transformLeagueInvitationFromApi(data: Record<string, unknown>): LeagueInvitation {
  return {
    id: data.id as string,
    email: data.email as string | null,
    role: data.role as LeagueMembershipRole,
    invitedByEmail: data.invited_by_email as string,
    isLinkInvite: data.is_link_invite as boolean,
    createdAt: data.created_at as string,
    expiresAt: data.expires_at as string,
    acceptedAt: data.accepted_at as string | null,
    isExpired: data.is_expired as boolean,
    isPending: data.is_pending as boolean,
  };
}

export default api;
