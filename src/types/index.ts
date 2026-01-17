// -----------------------------------------------------------------------------
// Auth Types
// -----------------------------------------------------------------------------

export type UserRole = 'master_admin' | 'user';

export type LeagueMembershipRole = 'admin' | 'member';

export interface LeagueMembership {
  id: string;
  leagueId: string;
  leagueName: string;
  leagueSlug: string;
  role: LeagueMembershipRole;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  leagues: LeagueMembership[];
}

export interface League {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  leagueName?: string;
  leagueSlug?: string;
}

export interface ProfileUpdateData {
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

// -----------------------------------------------------------------------------
// League Member Types
// -----------------------------------------------------------------------------

export interface LeagueMember {
  id: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: LeagueMembershipRole;
  joinedAt: string;
}

export interface LeagueInvitation {
  id: string;
  email: string | null;
  role: LeagueMembershipRole;
  invitedByEmail: string;
  isLinkInvite: boolean;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  isExpired: boolean;
  isPending: boolean;
}

export interface JoinLinkStatus {
  enabled: boolean;
  token: string | null;
  url: string | null;
}

export interface JoinLinkInfo {
  leagueName: string;
  leagueSlug: string;
}

export interface AcceptInvitationResult {
  message: string;
  leagueId: string;
  leagueName: string;
}

// -----------------------------------------------------------------------------
// Game Types
// -----------------------------------------------------------------------------

export interface Player {
  id: string;
  bib: string; // Unique ID from evaluation day
  firstName: string;
  lastName: string;
  name: string; // Full name (firstName + lastName)

  // Raw Component Scores (from evaluations)
  fieldScore: number;
  throwScore: number;
  hitPower: number;
  hitForm: number;
  hitContact: number;
  pitchingStrength: number;
  pitchingForm: number;
  catchScore: number;
  runningScore: number;

  // Calculated Subtotals (weighted aggregates)
  fieldingSubtotal: number;
  hittingSubtotal: number;
  pitchingSubtotal: number;
  subjectiveTotal: number; // Sum of weighted subjective scores
  objectiveTotal: number; // Sum of objective scores
  officialAdjust: number;

  totalScore: number;
  rank: number;
  projectedRound: number;

  // Player Info
  littleLeagueAge: number;
  birthday: string;
  isAllStar: boolean;
  isDNE: boolean; // Did Not Evaluate

  // Draft Rules
  isCoachKid: boolean;
  coachTeamId?: string;
  sibling?: string; // Display name of sibling
  siblingId?: string; // ID of linked sibling player

  // Locked assignments (for same-round conflicts and sibling requirements)
  lockedToRound?: number; // Override projectedRound for mandatory pick timing
  lockedToTeamId?: string; // Team that must draft this player (set when sibling is drafted)

  // Draft Status
  isDrafted: boolean;
  draftedByTeamId?: string;
  draftedInRound?: number;
  draftedAtPick?: number;
}

export interface Team {
  id: string;
  name: string;
  roster: Player[];
  totalScore: number;
  draftPosition: number; // 1-8
  coachKids: string[]; // player IDs
  assistantCoaches: string[]; // assistant coach last names
  ageBreakdown: Record<number, number>; // { 10: 3, 11: 4, 12: 2 } - count per age
}

export interface DraftPick {
  round: number;
  pick: number;
  teamId: string;
  playerId?: string;
  timestamp?: number;
  wasSkipped?: boolean;
}

export type DraftFormat = 'straight' | 'snake' | 'recalculated';

export interface DraftConfig {
  teams: Team[];
  draftFormat: DraftFormat;
  draftOrder: string[]; // team IDs in order
}

export interface DraftState {
  players: Player[];
  teams: Team[];
  draftFormat: DraftFormat;
  draftOrder: string[]; // team IDs (initial order)
  currentRoundOrder: string[]; // team IDs for current round (cached)
  picks: DraftPick[];
  currentRound: number;
  currentPickInRound: number;
  currentTeamId: string | null;
  isDraftComplete: boolean;
  mandatoryPick?: {
    playerId: string;
    reason: 'coach-kid' | 'sibling';
    siblingName?: string;
  };
  trades: Trade[];
}

export interface Trade {
  id: string;
  timestamp: number;
  team1Id: string;
  team2Id: string;
  player1Id: string; // moving FROM team1 TO team2
  player2Id: string; // moving FROM team2 TO team1
  reason: string;
}

export interface CSVRow {
  'First Name': string;
  'Last Name': string;
  'FIELDING SUBTOTAL': string;
  'HITTING SUBTOTAL': string;
  'PITCHING SUBTOTAL': string;
  'CATCH SCORE': string;
  'RUNNING Score': string;
  'Official Adjust': string;
  'Little League Age': string;
  'Birthday': string;
  'All-Star': string;
  'DNE': string;
  'Coach Kid'?: string;
  'Sibling'?: string;
}

export type ViewMode = 'list' | 'grid';

export type AppPhase = 'upload' | 'mapping' | 'review' | 'config' | 'draft' | 'complete';

export type AppField =
  | 'bib'
  | 'firstName'
  | 'lastName'
  | 'fieldScore'
  | 'throwScore'
  | 'hitPower'
  | 'hitForm'
  | 'hitContact'
  | 'pitchingStrength'
  | 'pitchingForm'
  | 'fieldingSubtotal'
  | 'hittingSubtotal'
  | 'pitchingSubtotal'
  | 'catchScore'
  | 'runningScore'
  | 'officialAdjust'
  | 'littleLeagueAge'
  | 'birthday'
  | 'isAllStar'
  | 'isDNE'
  | 'isCoachKid'
  | 'sibling'
  | 'managerTeam'
  | 'assistantTeam'
  | 'teamColumn'; // "Manager, Assistant" format for auto team creation

export interface ColumnMapping {
  [csvColumn: string]: AppField | null;
}

export interface ParsedCSVData {
  headers: string[];
  rows: Record<string, string>[];
}

export interface ScoringWeights {
  fielding: {
    field: number;  // % weight for field score
    throw: number;  // % weight for throw score
  };
  hitting: {
    power: number;   // % weight for hit power
    form: number;    // % weight for hit form
    contact: number; // % weight for hit contact
  };
  pitching: {
    strength: number; // % weight for pitching strength
    form: number;     // % weight for pitching form
  };
  catching: number;   // % weight for catch score
  running: number;    // % weight for running score
}

// Scoring mode determines how CSV scores are interpreted
export type ScoringMode = 'raw' | 'pre-weighted';

// Default weights based on evaluation criteria
export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  fielding: {
    field: 15.0,
    throw: 13.0,
  },
  hitting: {
    power: 9.0,
    form: 9.0,
    contact: 9.0,
  },
  pitching: {
    strength: 20.0,
    form: 15.0,
  },
  catching: 5.0,
  running: 5.0,
};

// Division types for multi-division support
export type DivisionPreset = 'majors' | 'aaa' | 'aa' | 'custom';

export interface DivisionAgeRange {
  min: number;
  max: number;
}

export interface Division {
  id: string;
  name: string;
  preset: DivisionPreset;
  ageRange: DivisionAgeRange;
  enforceAgeLimit: boolean;
  maxPerAge: number; // Max players per age group (0 = no limit)
  teamCount: number; // 5-10 teams
  rosterSize: number; // Calculated: players ÷ teams
  teams: Team[];
  players: Player[];
  draftState: DraftState | null;
  scoringWeights: ScoringWeights;
  scoringMode: ScoringMode; // Whether CSV scores are raw or pre-weighted
  phase: AppPhase;
  createdAt: string; // ISO date string
  completedAt?: string; // ISO date string
}

export interface DivisionSummary {
  id: string;
  name: string;
  preset: DivisionPreset;
  teamCount: number;
  playerCount: number;
  phase: AppPhase;
  createdAt: string;
  completedAt?: string;
}

// Preset configurations for common divisions
export const DIVISION_PRESETS: Record<Exclude<DivisionPreset, 'custom'>, {
  name: string;
  ageRange: DivisionAgeRange;
  enforceAgeLimit: boolean;
  maxPerAge: number;
}> = {
  majors: {
    name: 'Majors',
    ageRange: { min: 10, max: 12 },
    enforceAgeLimit: true,
    maxPerAge: 8,
  },
  aaa: {
    name: 'AAA',
    ageRange: { min: 8, max: 10 },
    enforceAgeLimit: true,
    maxPerAge: 8,
  },
  aa: {
    name: 'AA',
    ageRange: { min: 7, max: 10 },
    enforceAgeLimit: false,
    maxPerAge: 0, // No limit
  },
};

// Helper to create initial division state
export function createInitialDivision(
  id: string,
  name: string,
  preset: DivisionPreset,
  teamCount: number,
  ageRange: DivisionAgeRange,
  enforceAgeLimit: boolean,
  maxPerAge: number
): Division {
  const teams: Team[] = Array.from({ length: teamCount }, (_, i) => ({
    id: `${id}-team-${i + 1}`,
    name: '', // Empty to show placeholder text
    roster: [],
    totalScore: 0,
    draftPosition: i + 1,
    coachKids: [],
    assistantCoaches: [],
    ageBreakdown: {},
  }));

  return {
    id,
    name,
    preset,
    ageRange,
    enforceAgeLimit,
    maxPerAge,
    teamCount,
    rosterSize: 0,
    teams,
    players: [],
    draftState: null,
    scoringWeights: { ...DEFAULT_SCORING_WEIGHTS },
    scoringMode: 'pre-weighted', // Default to pre-weighted since most CSVs have this format
    phase: 'upload',
    createdAt: new Date().toISOString(),
  };
}
