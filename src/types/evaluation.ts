// Types for Excel evaluation spreadsheet import

// Tab configuration for known evaluation categories
export interface EvaluationTabConfig {
  name: string;
  category: EvaluationCategory;
  expectedColumns: string[];
  fields: FieldConfig[];
}

export interface FieldConfig {
  name: string;
  columnPatterns: string[]; // Column name patterns to match
  scoreType: 'scale' | 'count' | 'time';
  inputMin: number;
  inputMax: number;
  lowerIsBetter: boolean;
  weight: number; // Weight within category (0-100, should sum to 100 per category)
}

export type EvaluationCategory = 'fielding' | 'pitching' | 'hitting' | 'flyBalls' | 'baserunning';

// Special "Summary" tab configuration that contains all scores in one sheet
// This is a combined format where all evaluation data is in a single tab
export const SUMMARY_TAB_CONFIG: EvaluationTabConfig = {
  name: 'Summary',
  category: 'fielding', // Placeholder - Summary contains all categories
  expectedColumns: ['BIB#', 'Field Score', 'Throw Score', 'Form', '# Catches', 'Time'],
  fields: [
    // Fielding
    { name: 'field', columnPatterns: ['field score', 'field'], scoreType: 'scale', inputMin: 0, inputMax: 5, lowerIsBetter: false, weight: 50 },
    { name: 'throw', columnPatterns: ['throw score', 'throw'], scoreType: 'scale', inputMin: 0, inputMax: 5, lowerIsBetter: false, weight: 50 },
    // Fly Balls - first "Form" and "# Catches" columns after fielding
    { name: 'flyBallForm', columnPatterns: ['form'], scoreType: 'scale', inputMin: 0, inputMax: 4, lowerIsBetter: false, weight: 40 },
    { name: 'catches', columnPatterns: ['# catches', 'catches'], scoreType: 'count', inputMin: 0, inputMax: 3, lowerIsBetter: false, weight: 60 },
    // Baserunning - Form and Time columns
    { name: 'baserunningForm', columnPatterns: ['form'], scoreType: 'scale', inputMin: 0, inputMax: 4, lowerIsBetter: false, weight: 40 },
    { name: 'time1', columnPatterns: ['time 1', 'time1', 'time'], scoreType: 'time', inputMin: 3.5, inputMax: 7.0, lowerIsBetter: true, weight: 30 },
    { name: 'time2', columnPatterns: ['time 2', 'time2'], scoreType: 'time', inputMin: 3.5, inputMax: 7.0, lowerIsBetter: true, weight: 30 },
    // Hitting
    { name: 'hittingForm', columnPatterns: ['form'], scoreType: 'scale', inputMin: 0, inputMax: 4, lowerIsBetter: false, weight: 30 },
    { name: 'contactPower', columnPatterns: ['contact/power', 'contact', 'power'], scoreType: 'scale', inputMin: 0, inputMax: 4, lowerIsBetter: false, weight: 40 },
    { name: 'hits', columnPatterns: ['# hits', 'hits'], scoreType: 'count', inputMin: 0, inputMax: 5, lowerIsBetter: false, weight: 30 },
    // Pitching
    { name: 'pitchingForm', columnPatterns: ['form'], scoreType: 'scale', inputMin: 0, inputMax: 4, lowerIsBetter: false, weight: 40 },
    { name: 'armStrength', columnPatterns: ['arm strength', 'arm', 'strength'], scoreType: 'scale', inputMin: 0, inputMax: 4, lowerIsBetter: false, weight: 60 },
  ],
};

// Default tab configurations for AAA evaluation spreadsheet
export const EVALUATION_TAB_CONFIGS: EvaluationTabConfig[] = [
  {
    name: 'Fielding',
    category: 'fielding',
    expectedColumns: ['BIB#', 'Field', 'Throw'],
    fields: [
      {
        name: 'field',
        columnPatterns: ['field'],
        scoreType: 'scale',
        inputMin: 0,
        inputMax: 4,
        lowerIsBetter: false,
        weight: 50,
      },
      {
        name: 'throw',
        columnPatterns: ['throw'],
        scoreType: 'scale',
        inputMin: 0,
        inputMax: 4,
        lowerIsBetter: false,
        weight: 50,
      },
    ],
  },
  {
    name: 'Pitching',
    category: 'pitching',
    expectedColumns: ['BIB#', 'Form', 'Arm Strength'],
    fields: [
      {
        name: 'form',
        columnPatterns: ['form'],
        scoreType: 'scale',
        inputMin: 0,
        inputMax: 4,
        lowerIsBetter: false,
        weight: 40,
      },
      {
        name: 'armStrength',
        columnPatterns: ['arm strength', 'arm', 'strength'],
        scoreType: 'scale',
        inputMin: 0,
        inputMax: 4,
        lowerIsBetter: false,
        weight: 60,
      },
    ],
  },
  {
    name: 'Hitting',
    category: 'hitting',
    expectedColumns: ['BIB#', 'Form', 'Contact/Power', '# Hits'],
    fields: [
      {
        name: 'form',
        columnPatterns: ['form'],
        scoreType: 'scale',
        inputMin: 0,
        inputMax: 4,
        lowerIsBetter: false,
        weight: 30,
      },
      {
        name: 'contactPower',
        columnPatterns: ['contact/power', 'contact', 'power'],
        scoreType: 'scale',
        inputMin: 0,
        inputMax: 4,
        lowerIsBetter: false,
        weight: 40,
      },
      {
        name: 'hits',
        columnPatterns: ['# hits', 'hits', 'number of hits'],
        scoreType: 'count',
        inputMin: 0,
        inputMax: 5,
        lowerIsBetter: false,
        weight: 30,
      },
    ],
  },
  {
    name: 'Fly Balls',
    category: 'flyBalls',
    expectedColumns: ['BIB#', 'Form', '# Catches'],
    fields: [
      {
        name: 'form',
        columnPatterns: ['form'],
        scoreType: 'scale',
        inputMin: 0,
        inputMax: 4,
        lowerIsBetter: false,
        weight: 40,
      },
      {
        name: 'catches',
        columnPatterns: ['# catches', 'catches', 'number of catches'],
        scoreType: 'count',
        inputMin: 0,
        inputMax: 3,
        lowerIsBetter: false,
        weight: 60,
      },
    ],
  },
  {
    name: 'Baserunning',
    category: 'baserunning',
    expectedColumns: ['BIB#', 'Form', 'Time 1', 'Time 2'],
    fields: [
      {
        name: 'form',
        columnPatterns: ['form'],
        scoreType: 'scale',
        inputMin: 0,
        inputMax: 4,
        lowerIsBetter: false,
        weight: 40,
      },
      {
        name: 'time1',
        columnPatterns: ['time 1', 'time1'],
        scoreType: 'time',
        inputMin: 3.5, // Fastest expected time
        inputMax: 7.0, // Slowest expected time
        lowerIsBetter: true,
        weight: 30, // Split evenly between time1 and time2, but we'll use best time
      },
      {
        name: 'time2',
        columnPatterns: ['time 2', 'time2'],
        scoreType: 'time',
        inputMin: 3.5,
        inputMax: 7.0,
        lowerIsBetter: true,
        weight: 30,
      },
    ],
  },
];

// Field-level weights for fine-grained control
export interface FieldWeight {
  fieldId: string;        // Unique identifier (e.g., 'pitchingForm')
  displayName: string;    // Display name (e.g., 'Pitching Form')
  category: EvaluationCategory;  // For UI grouping
  weight: number;         // 0-100, all must sum to 100
  enabled: boolean;
}

export const DEFAULT_FIELD_WEIGHTS: FieldWeight[] = [
  // Pitching (30% total)
  { fieldId: 'pitchingForm', displayName: 'Pitching Form', category: 'pitching', weight: 18, enabled: true },
  { fieldId: 'armStrength', displayName: 'Arm Strength', category: 'pitching', weight: 12, enabled: true },

  // Hitting (25% total)
  { fieldId: 'hittingForm', displayName: 'Hitting Form', category: 'hitting', weight: 12, enabled: true },
  { fieldId: 'contactPower', displayName: 'Contact/Power', category: 'hitting', weight: 10, enabled: true },
  { fieldId: 'hits', displayName: '# Hits', category: 'hitting', weight: 3, enabled: true },

  // Fielding (20% total)
  { fieldId: 'field', displayName: 'Field', category: 'fielding', weight: 10, enabled: true },
  { fieldId: 'throw', displayName: 'Throw', category: 'fielding', weight: 10, enabled: true },

  // Fly Balls (15% total)
  { fieldId: 'catches', displayName: '# Catches', category: 'flyBalls', weight: 10, enabled: true },
  { fieldId: 'flyBallForm', displayName: 'Fly Ball Form', category: 'flyBalls', weight: 5, enabled: true },

  // Baserunning (10% total)
  { fieldId: 'bestTime', displayName: 'Best Time', category: 'baserunning', weight: 5, enabled: true },
  { fieldId: 'baserunningForm', displayName: 'Baserunning Form', category: 'baserunning', weight: 5, enabled: true },
];

// Legacy category weights - kept for reference but no longer used
export interface CategoryWeight {
  category: EvaluationCategory;
  weight: number; // Percentage (0-100, all must sum to 100)
  enabled: boolean;
}

export const DEFAULT_CATEGORY_WEIGHTS: CategoryWeight[] = [
  { category: 'fielding', weight: 15, enabled: true },
  { category: 'pitching', weight: 35, enabled: true },
  { category: 'hitting', weight: 27, enabled: true },
  { category: 'flyBalls', weight: 13, enabled: true },
  { category: 'baserunning', weight: 10, enabled: true },
];

// Registration data from "Registration Data" tab
export interface RegistrationRecord {
  firstName: string;
  lastName: string;
  coachRequest?: string;       // Coach preference
  teammateRequests?: string[]; // Friend requests (parsed from comma-separated)
  school?: string;             // School name
  grade?: number;              // Grade level
  address?: string;            // Street address for sibling detection
  littleLeagueAge?: number;    // LL age (age between 9/1 of prev year and 8/31 of league year)
}

// Imported workbook structure
export interface ImportedWorkbook {
  filename: string;
  tabs: ImportedTab[];
  allBibs: string[]; // Union of all BIB#s found across tabs
  registrationData?: RegistrationRecord[]; // Optional registration data
}

// Single tab data
export interface ImportedTab {
  name: string; // Original sheet name
  headerRow: number; // Row index where headers were found (0-based)
  headers: string[];
  rows: TabRow[];
  bibColumn: string; // Name of the BIB column found
  matchedConfig: EvaluationTabConfig | null;
  playerCount: number;
  isCombinedTab?: boolean; // True if this is a Summary tab with all categories
}

// Row data from a tab
export interface TabRow {
  bib: string;
  firstName?: string;
  lastName?: string;
  age?: number;
  level?: string;
  scores: Record<string, number | null>; // field name -> raw value
}

// Player data aggregated across all tabs
export interface EvaluationPlayer {
  bib: string;
  firstName: string;
  lastName: string;
  fullName: string;
  age: number;
  littleLeagueAge?: number;  // Calculated LL age from birthdate
  level: string;

  // Raw scores from spreadsheet by category and field
  rawScores: Record<EvaluationCategory, Record<string, number | null>>;

  // Normalized to 0-100
  normalizedScores: Record<EvaluationCategory, Record<string, number>>;

  // Category averages (0-100, weighted within category)
  categoryScores: Record<EvaluationCategory, number | null>;

  // Final calculations
  manualAdjust: number;
  weightedTotal: number;
  rank: number;

  // Draft planning
  projectedRound: number;
  isCoachKid: boolean;
  coachTeamIndex: number | null; // Index into teams array (0-based)
  siblingGroupId: string | null; // Groups siblings together (e.g., 'A', 'B', 'C')
  isAllStar: boolean;

  // Tracking
  missingCategories: EvaluationCategory[];
  tabsFound: string[];
  isPartial: boolean;
  isDNE: boolean; // Did Not Evaluate - no scores recorded at all
}

// Import state
export type EvaluationImportStep = 'upload' | 'parsing' | 'overview' | 'registration' | 'weights' | 'summary';

export interface EvaluationImportState {
  step: EvaluationImportStep;
  workbook: ImportedWorkbook | null;
  fieldWeights: FieldWeight[];
  players: EvaluationPlayer[];
  errors: ImportError[];
  warnings: ImportWarning[];
  isProcessing: boolean;
}

export interface ImportError {
  type: 'missing_tab' | 'missing_column' | 'parse_error' | 'no_bib' | 'file_error';
  message: string;
  tab?: string;
  column?: string;
}

export interface ImportWarning {
  type: 'missing_player' | 'invalid_score' | 'duplicate_bib' | 'partial_data' | 'no_evaluation';
  message: string;
  bib?: string;
  tab?: string;
}

// Helper to get category display name
export function getCategoryDisplayName(category: EvaluationCategory): string {
  const names: Record<EvaluationCategory, string> = {
    fielding: 'Fielding',
    pitching: 'Pitching',
    hitting: 'Hitting',
    flyBalls: 'Fly Balls',
    baserunning: 'Baserunning',
  };
  return names[category];
}

// Helper to find tab config by sheet name
export function findTabConfig(sheetName: string): EvaluationTabConfig | null {
  const normalizedName = sheetName.toLowerCase().trim();

  for (const config of EVALUATION_TAB_CONFIGS) {
    if (normalizedName === config.name.toLowerCase()) {
      return config;
    }
    // Also check partial matches
    if (normalizedName.includes(config.name.toLowerCase())) {
      return config;
    }
  }

  return null;
}
