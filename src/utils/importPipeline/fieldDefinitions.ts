/**
 * Unified Player Field Definitions
 *
 * This is the SINGLE SOURCE OF TRUTH for all player fields.
 * Adding a new field requires only updating this file.
 *
 * Field definition format:
 * [frontendName, backendName, type, required, defaultValue?]
 *
 * Types:
 * - 'string': String field
 * - 'number': Numeric field (uses safeParseNumber)
 * - 'number?': Optional numeric (uses safeParseOptionalNumber)
 * - 'boolean': Boolean field
 * - 'string?': Optional string (null -> undefined)
 * - 'string[]': Array of strings (JSON field)
 */

export type FieldType = 'string' | 'number' | 'number?' | 'boolean' | 'string?' | 'string[]';

export interface FieldDefinition {
  frontend: string;
  backend: string;
  type: FieldType;
  required: boolean;
  defaultValue?: unknown;
}

/**
 * All Player fields with their frontend/backend names and types.
 * This drives all transformations and validations.
 */
export const PLAYER_FIELD_DEFINITIONS: FieldDefinition[] = [
  // Identity fields
  { frontend: 'id', backend: 'id', type: 'string', required: true },
  { frontend: 'divisionId', backend: 'division_id', type: 'string?', required: false },
  { frontend: 'bib', backend: 'bib', type: 'string', required: true },

  // Name fields
  { frontend: 'firstName', backend: 'first_name', type: 'string', required: true },
  { frontend: 'lastName', backend: 'last_name', type: 'string', required: true },
  { frontend: 'name', backend: 'name', type: 'string', required: true },

  // Raw Component Scores
  { frontend: 'fieldScore', backend: 'field_score', type: 'number', required: false, defaultValue: 0 },
  { frontend: 'throwScore', backend: 'throw_score', type: 'number', required: false, defaultValue: 0 },
  { frontend: 'hitPower', backend: 'hit_power', type: 'number', required: false, defaultValue: 0 },
  { frontend: 'hitForm', backend: 'hit_form', type: 'number', required: false, defaultValue: 0 },
  { frontend: 'hitContact', backend: 'hit_contact', type: 'number', required: false, defaultValue: 0 },
  { frontend: 'pitchingStrength', backend: 'pitching_strength', type: 'number', required: false, defaultValue: 0 },
  { frontend: 'pitchingForm', backend: 'pitching_form', type: 'number', required: false, defaultValue: 0 },
  { frontend: 'catchScore', backend: 'catch_score', type: 'number', required: false, defaultValue: 0 },
  { frontend: 'runningScore', backend: 'running_score', type: 'number', required: false, defaultValue: 0 },

  // Calculated Subtotals
  { frontend: 'fieldingSubtotal', backend: 'fielding_subtotal', type: 'number', required: false, defaultValue: 0 },
  { frontend: 'hittingSubtotal', backend: 'hitting_subtotal', type: 'number', required: false, defaultValue: 0 },
  { frontend: 'pitchingSubtotal', backend: 'pitching_subtotal', type: 'number', required: false, defaultValue: 0 },
  { frontend: 'subjectiveTotal', backend: 'subjective_total', type: 'number', required: false, defaultValue: 0 },
  { frontend: 'objectiveTotal', backend: 'objective_total', type: 'number', required: false, defaultValue: 0 },
  { frontend: 'officialAdjust', backend: 'official_adjust', type: 'number', required: false, defaultValue: 0 },

  // Totals and Ranking
  { frontend: 'totalScore', backend: 'total_score', type: 'number', required: false, defaultValue: 0 },
  { frontend: 'rank', backend: 'rank', type: 'number', required: false, defaultValue: 0 },
  { frontend: 'projectedRound', backend: 'projected_round', type: 'number', required: false, defaultValue: 1 },

  // Player Info
  { frontend: 'littleLeagueAge', backend: 'little_league_age', type: 'number', required: true },
  { frontend: 'birthday', backend: 'birthday', type: 'string', required: true },
  { frontend: 'isAllStar', backend: 'is_all_star', type: 'boolean', required: false, defaultValue: false },
  { frontend: 'isDNE', backend: 'is_dne', type: 'boolean', required: false, defaultValue: false },

  // Draft Rules
  { frontend: 'isCoachKid', backend: 'is_coach_kid', type: 'boolean', required: false, defaultValue: false },
  { frontend: 'coachTeamId', backend: 'coach_team_id', type: 'string?', required: false },
  { frontend: 'sibling', backend: 'sibling', type: 'string?', required: false },
  { frontend: 'siblingId', backend: 'sibling_id', type: 'string?', required: false },

  // Locked Assignments
  { frontend: 'lockedToRound', backend: 'locked_to_round', type: 'number?', required: false },
  { frontend: 'lockedToTeamId', backend: 'locked_to_team_id', type: 'string?', required: false },

  // Draft Status
  { frontend: 'isDrafted', backend: 'is_drafted', type: 'boolean', required: false, defaultValue: false },
  { frontend: 'draftedByTeamId', backend: 'drafted_by_team_id', type: 'string?', required: false },
  { frontend: 'draftedInRound', backend: 'drafted_in_round', type: 'number?', required: false },
  { frontend: 'draftedAtPick', backend: 'drafted_at_pick', type: 'number?', required: false },

  // Team Builder Fields
  { frontend: 'coachRequest', backend: 'coach_request', type: 'string?', required: false },
  { frontend: 'teammateRequests', backend: 'teammate_requests', type: 'string[]', required: false, defaultValue: [] },
  { frontend: 'school', backend: 'school', type: 'string?', required: false },
  { frontend: 'grade', backend: 'grade', type: 'number?', required: false },
];

/**
 * Map from frontend field name to definition
 */
export const FIELD_BY_FRONTEND = new Map<string, FieldDefinition>(
  PLAYER_FIELD_DEFINITIONS.map((def) => [def.frontend, def])
);

/**
 * Map from backend field name to definition
 */
export const FIELD_BY_BACKEND = new Map<string, FieldDefinition>(
  PLAYER_FIELD_DEFINITIONS.map((def) => [def.backend, def])
);

/**
 * Get all required fields
 */
export function getRequiredFields(): FieldDefinition[] {
  return PLAYER_FIELD_DEFINITIONS.filter((def) => def.required);
}

/**
 * Get all numeric fields (for score validation)
 */
export function getNumericFields(): FieldDefinition[] {
  return PLAYER_FIELD_DEFINITIONS.filter(
    (def) => def.type === 'number' || def.type === 'number?'
  );
}

/**
 * Get all score-related fields
 */
export function getScoreFields(): FieldDefinition[] {
  const scoreFieldNames = [
    'fieldScore', 'throwScore', 'hitPower', 'hitForm', 'hitContact',
    'pitchingStrength', 'pitchingForm', 'catchScore', 'runningScore',
    'fieldingSubtotal', 'hittingSubtotal', 'pitchingSubtotal',
    'subjectiveTotal', 'objectiveTotal', 'officialAdjust', 'totalScore'
  ];
  return PLAYER_FIELD_DEFINITIONS.filter((def) => scoreFieldNames.includes(def.frontend));
}
