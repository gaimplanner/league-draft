# Player Import Pipeline - Architectural Proposal

## Executive Summary

This document proposes a unified player import pipeline to replace the current fragmented approach where player data is transformed in 6+ separate locations. The goal is to create a single, predictable data flow that ensures all player fields (including `school`, `grade`, etc.) are consistently handled from import through persistence.

---

## Current Architecture Problems

### 1. Too Many Transformation Points

```
Current Flow (6 transformations):
CSV File → PapaParse → ColumnMapper → csvParser.ts → App.tsx post-processing → API toApi() → API fromApi()
```

Each transformation is a potential point of failure where fields can be:
- Forgotten (not included in transform function)
- Incorrectly typed (string vs number)
- Overwritten with defaults
- Lost during round-trip to API

### 2. Field Definition Fragmentation

Player fields are defined/handled in multiple places:

| Location | Purpose | Fields Defined |
|----------|---------|----------------|
| `types/index.ts` | TypeScript interface | All 40+ fields |
| `ColumnMapper.tsx` | CSV mapping options | ~25 fields (REQUIRED + OPTIONAL) |
| `csvParser.ts` | Parsing logic | ~30 fields (getMappedValue calls) |
| `api/client.ts` | API transforms | ~28 fields (manual snake_case mapping) |
| `server/transformers.py` | Django response | ~35 fields |

**Result**: When a new field is added, it must be added to 5 different files manually.

### 3. Implicit vs Explicit Data Sources

The current system doesn't clearly distinguish:
- **Primary source**: Evaluation CSV (scores, BIB)
- **Secondary source**: Registration CSV (school, official name)
- **Computed fields**: totalScore, rank, projectedRound
- **User-set fields**: siblingId, coachTeamId (set during Review)

This leads to confusion about which source should "win" when merging data.

---

## Proposed Architecture

### Design Principles

1. **Single Source of Truth**: One type definition generates all transforms
2. **Explicit Data Flow**: Clear pipeline stages with defined inputs/outputs
3. **Separation of Concerns**: Parsing, mapping, enrichment, and persistence are distinct
4. **Fail-Fast Validation**: Catch errors at import time, not during draft

### Pipeline Stages

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         UNIFIED PLAYER IMPORT PIPELINE                       │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   STAGE 1    │    │   STAGE 2    │    │   STAGE 3    │    │   STAGE 4    │
│  Raw Parse   │ -> │  Field Map   │ -> │  Enrichment  │ -> │   Factory    │
│              │    │              │    │              │    │              │
│ File → Rows  │    │ Rows → Typed │    │ Merge Sources│    │ → Player[]   │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
                                                                    │
                                                                    v
                                                           ┌──────────────┐
                                                           │   STAGE 5    │
                                                           │  Persistence │
                                                           │              │
                                                           │ Player → API │
                                                           └──────────────┘
```

---

## Stage 1: Raw Parser

**Purpose**: Convert source files to raw string records with no interpretation.

**Input**: File (CSV, Excel)
**Output**: `RawRecord[]`

```typescript
// src/utils/importPipeline/rawParser.ts

interface RawRecord {
  sourceFile: string;
  sourceType: 'evaluation' | 'registration' | 'excel';
  rowIndex: number;
  columns: Record<string, string>;  // Original column names → string values
}

interface ParseResult {
  records: RawRecord[];
  headers: string[];
  warnings: string[];
}

// Single CSV parser
function parseCSVToRaw(file: File, sourceType: 'evaluation' | 'registration'): Promise<ParseResult>;

// Excel parser (multiple sheets)
function parseExcelToRaw(file: File): Promise<ParseResult[]>;
```

**Key Points**:
- NO type conversion (everything is strings)
- NO defaults applied
- NO field renaming
- Preserves original column names exactly
- Tracks source file and row for error reporting

---

## Stage 2: Field Mapper

**Purpose**: Map raw columns to typed player fields with validation.

**Input**: `RawRecord[]` + `FieldMapping`
**Output**: `MappedPlayerData[]`

```typescript
// src/utils/importPipeline/fieldMapper.ts

// All possible player fields that can be mapped from CSV
type MappableField =
  // Identity
  | 'bib' | 'firstName' | 'lastName'
  // Scores (raw components)
  | 'fieldScore' | 'throwScore' | 'hitPower' | 'hitForm' | 'hitContact'
  | 'pitchingStrength' | 'pitchingForm' | 'catchScore' | 'runningScore'
  // Scores (subtotals)
  | 'fieldingSubtotal' | 'hittingSubtotal' | 'pitchingSubtotal'
  // Scores (totals)
  | 'totalScore' | 'officialAdjust'
  // Player info
  | 'littleLeagueAge' | 'birthday'
  // Flags
  | 'isAllStar' | 'isDNE' | 'isCoachKid'
  // Relationships
  | 'sibling' | 'coachTeam'
  // Registration data
  | 'school' | 'grade' | 'division'
  // Team assignments (legacy)
  | 'teamColumn' | 'managerTeam' | 'assistantTeam';

interface FieldMapping {
  [csvColumn: string]: MappableField;
}

interface MappedPlayerData {
  // Source tracking
  _source: {
    file: string;
    rowIndex: number;
    mappingUsed: FieldMapping;
  };

  // Mapped fields (all optional at this stage)
  bib?: string;
  firstName?: string;
  lastName?: string;
  fieldScore?: number;
  throwScore?: number;
  // ... all MappableField types with appropriate TS types
}

interface MappingResult {
  players: MappedPlayerData[];
  errors: MappingError[];
  warnings: string[];
}

interface MappingError {
  rowIndex: number;
  field: MappableField;
  value: string;
  error: string;  // e.g., "Expected number, got 'abc'"
}

function mapFields(records: RawRecord[], mapping: FieldMapping): MappingResult;
```

**Validation Rules**:
```typescript
const FIELD_VALIDATORS: Record<MappableField, Validator> = {
  bib: { type: 'string', required: true },
  firstName: { type: 'string', required: true },
  lastName: { type: 'string', required: true },
  totalScore: { type: 'number', required: true, min: 0, max: 100 },
  fieldScore: { type: 'number', required: false, min: 0, max: 20 },
  littleLeagueAge: { type: 'integer', required: false, min: 4, max: 16 },
  isAllStar: { type: 'boolean', required: false },
  school: { type: 'string', required: false },
  // ... etc
};
```

---

## Stage 3: Enrichment

**Purpose**: Merge data from multiple sources, apply business logic.

**Input**: `MappedPlayerData[]` (from evaluation) + `MappedPlayerData[]` (from registration)
**Output**: `EnrichedPlayerData[]`

```typescript
// src/utils/importPipeline/enrichment.ts

interface EnrichmentConfig {
  // Which source wins for each field
  fieldPriority: {
    school: 'registration';      // Always use registration for school
    firstName: 'registration';   // Official name from registration
    lastName: 'registration';
    totalScore: 'evaluation';    // Scores from evaluation
    // ... etc
  };

  // Matching strategy
  matchBy: 'name' | 'bib';
  fuzzyMatchThreshold: number;  // 0.8 = 80% similarity required
}

interface EnrichedPlayerData extends MappedPlayerData {
  // Enrichment metadata
  _enrichment: {
    matchedRegistration: boolean;
    matchConfidence: number;  // 0-1
    fieldsFromRegistration: string[];
    fieldsFromEvaluation: string[];
  };

  // Fields that are now guaranteed present
  bib: string;
  firstName: string;
  lastName: string;
  name: string;  // Computed: `${firstName} ${lastName}`
}

interface EnrichmentResult {
  players: EnrichedPlayerData[];

  // Players in evaluation but not registration
  unmatchedEvaluation: MappedPlayerData[];

  // Players in registration but not evaluation (DNE candidates)
  unmatchedRegistration: MappedPlayerData[];

  // Match quality report
  matchReport: {
    exactMatches: number;
    fuzzyMatches: number;
    unmatched: number;
  };
}

function enrichPlayers(
  evaluationData: MappedPlayerData[],
  registrationData: MappedPlayerData[],
  config: EnrichmentConfig
): EnrichmentResult;
```

**Enrichment Logic**:
```typescript
function enrichPlayers(evalData, regData, config) {
  const result: EnrichedPlayerData[] = [];

  for (const evalPlayer of evalData) {
    // Find matching registration record
    const match = findBestMatch(evalPlayer, regData, config);

    if (match) {
      // Merge based on field priority
      const enriched = mergeByPriority(evalPlayer, match.record, config.fieldPriority);
      enriched._enrichment = {
        matchedRegistration: true,
        matchConfidence: match.confidence,
        fieldsFromRegistration: getFieldsFrom(match.record),
        fieldsFromEvaluation: getFieldsFrom(evalPlayer),
      };
      result.push(enriched);
    } else {
      // No registration match - flag for review
      unmatchedEvaluation.push(evalPlayer);
    }
  }

  return { players: result, unmatchedEvaluation, unmatchedRegistration };
}
```

---

## Stage 4: Player Factory

**Purpose**: Create final Player objects with computed fields.

**Input**: `EnrichedPlayerData[]` + `FactoryConfig`
**Output**: `Player[]`

```typescript
// src/utils/importPipeline/playerFactory.ts

interface FactoryConfig {
  teamCount: number;
  scoringMode: 'pre-weighted' | 'raw';
  scoringWeights?: ScoringWeights;
  generateIds: boolean;  // false when IDs come from API
}

interface FactoryResult {
  players: Player[];
  coachAssignments: CoachAssignment[];
  warnings: string[];
}

function createPlayers(
  enrichedData: EnrichedPlayerData[],
  config: FactoryConfig
): FactoryResult {
  const players: Player[] = [];
  const coachAssignments: CoachAssignment[] = [];

  for (const data of enrichedData) {
    // Calculate scores based on mode
    const scores = config.scoringMode === 'raw'
      ? calculateFromRawScores(data, config.scoringWeights)
      : usePreWeightedScores(data);

    // Create player with all fields
    const player: Player = {
      // Identity
      id: config.generateIds ? generateTempId() : undefined,
      bib: data.bib,
      firstName: data.firstName,
      lastName: data.lastName,
      name: data.name,

      // Raw scores
      fieldScore: data.fieldScore ?? 0,
      throwScore: data.throwScore ?? 0,
      hitPower: data.hitPower ?? 0,
      hitForm: data.hitForm ?? 0,
      hitContact: data.hitContact ?? 0,
      pitchingStrength: data.pitchingStrength ?? 0,
      pitchingForm: data.pitchingForm ?? 0,
      catchScore: data.catchScore ?? 0,
      runningScore: data.runningScore ?? 0,

      // Calculated scores
      ...scores,

      // Player info
      littleLeagueAge: data.littleLeagueAge ?? 0,
      birthday: data.birthday ?? '',

      // Flags
      isAllStar: data.isAllStar ?? false,
      isDNE: data.isDNE ?? false,
      isCoachKid: data.isCoachKid ?? false,

      // Relationships (set later in review)
      sibling: data.sibling,
      siblingId: undefined,
      coachTeamId: undefined,

      // Registration data
      school: data.school,
      grade: data.grade,

      // Computed (set after sorting)
      rank: 0,
      projectedRound: 0,

      // Draft state
      isDrafted: false,
      draftedByTeamId: undefined,
      draftedInRound: undefined,
      draftedAtPick: undefined,
      lockedToRound: undefined,
      lockedToTeamId: undefined,
    };

    players.push(player);

    // Extract coach assignments
    if (data.coachTeam || data.teamColumn) {
      coachAssignments.push(extractCoachAssignment(player, data));
    }
  }

  // Sort and rank
  players.sort((a, b) => b.totalScore - a.totalScore);
  players.forEach((p, i) => {
    p.rank = i + 1;
    p.projectedRound = Math.ceil((i + 1) / config.teamCount);
  });

  return { players, coachAssignments, warnings: [] };
}
```

---

## Stage 5: Persistence Layer

**Purpose**: Handle API communication with auto-generated transforms.

### Auto-Generated Transforms

Instead of manually maintaining `transformPlayerToApi` and `transformPlayerFromApi`, generate them from a single field definition:

```typescript
// src/utils/importPipeline/persistence.ts

// Single source of truth for field mappings
const PLAYER_FIELD_DEFINITIONS = {
  // [frontendName, backendName, type, required]
  id: ['id', 'id', 'string', true],
  bib: ['bib', 'bib', 'string', true],
  firstName: ['firstName', 'first_name', 'string', true],
  lastName: ['lastName', 'last_name', 'string', true],
  name: ['name', 'name', 'string', true],
  fieldScore: ['fieldScore', 'field_score', 'number', false],
  throwScore: ['throwScore', 'throw_score', 'number', false],
  hitPower: ['hitPower', 'hit_power', 'number', false],
  hitForm: ['hitForm', 'hit_form', 'number', false],
  hitContact: ['hitContact', 'hit_contact', 'number', false],
  pitchingStrength: ['pitchingStrength', 'pitching_strength', 'number', false],
  pitchingForm: ['pitchingForm', 'pitching_form', 'number', false],
  catchScore: ['catchScore', 'catch_score', 'number', false],
  runningScore: ['runningScore', 'running_score', 'number', false],
  fieldingSubtotal: ['fieldingSubtotal', 'fielding_subtotal', 'number', false],
  hittingSubtotal: ['hittingSubtotal', 'hitting_subtotal', 'number', false],
  pitchingSubtotal: ['pitchingSubtotal', 'pitching_subtotal', 'number', false],
  subjectiveTotal: ['subjectiveTotal', 'subjective_total', 'number', false],
  objectiveTotal: ['objectiveTotal', 'objective_total', 'number', false],
  officialAdjust: ['officialAdjust', 'official_adjust', 'number', false],
  totalScore: ['totalScore', 'total_score', 'number', true],
  rank: ['rank', 'rank', 'number', false],
  projectedRound: ['projectedRound', 'projected_round', 'number', false],
  littleLeagueAge: ['littleLeagueAge', 'little_league_age', 'number', false],
  birthday: ['birthday', 'birthday', 'string', false],
  isAllStar: ['isAllStar', 'is_all_star', 'boolean', false],
  isDNE: ['isDNE', 'is_dne', 'boolean', false],
  isCoachKid: ['isCoachKid', 'is_coach_kid', 'boolean', false],
  coachTeamId: ['coachTeamId', 'coach_team_id', 'uuid', false],
  sibling: ['sibling', 'sibling', 'string', false],
  siblingId: ['siblingId', 'sibling_id', 'uuid', false],
  lockedToRound: ['lockedToRound', 'locked_to_round', 'number', false],
  lockedToTeamId: ['lockedToTeamId', 'locked_to_team_id', 'uuid', false],
  isDrafted: ['isDrafted', 'is_drafted', 'boolean', false],
  draftedByTeamId: ['draftedByTeamId', 'drafted_by_team_id', 'uuid', false],
  draftedInRound: ['draftedInRound', 'drafted_in_round', 'number', false],
  draftedAtPick: ['draftedAtPick', 'drafted_at_pick', 'number', false],
  // Registration/Team Builder fields
  school: ['school', 'school', 'string', false],
  grade: ['grade', 'grade', 'number', false],
  coachRequest: ['coachRequest', 'coach_request', 'string', false],
  teammateRequests: ['teammateRequests', 'teammate_requests', 'string[]', false],
} as const;

// Generate transform functions from definitions
function generateTransforms() {
  const toApi = (player: Partial<Player>): Record<string, unknown> => {
    const result: Record<string, unknown> = {};

    for (const [frontend, backend, type] of Object.values(PLAYER_FIELD_DEFINITIONS)) {
      const value = player[frontend as keyof Player];
      if (value !== undefined) {
        result[backend] = value;
      }
    }

    return result;
  };

  const fromApi = (data: Record<string, unknown>): Player => {
    const result: Partial<Player> = {};

    for (const [frontend, backend, type] of Object.values(PLAYER_FIELD_DEFINITIONS)) {
      const value = data[backend];
      if (value !== undefined && value !== null) {
        result[frontend as keyof Player] = parseValue(value, type);
      }
    }

    return result as Player;
  };

  return { toApi, fromApi };
}
```

---

## Implementation Plan

### Phase 1: Foundation (1-2 days)

1. **Create new directory structure**:
   ```
   src/utils/importPipeline/
   ├── index.ts           # Public API
   ├── types.ts           # All pipeline types
   ├── rawParser.ts       # Stage 1
   ├── fieldMapper.ts     # Stage 2
   ├── enrichment.ts      # Stage 3
   ├── playerFactory.ts   # Stage 4
   ├── persistence.ts     # Stage 5
   └── fieldDefinitions.ts # Single source of truth
   ```

2. **Define `PLAYER_FIELD_DEFINITIONS`** as single source of truth

3. **Generate API transforms** from field definitions

### Phase 2: Parser Refactor (1 day)

1. **Extract raw parsing** from `DualCSVUpload` and `csvParser.ts`
2. **Create unified `parseCSVToRaw`** function
3. **Add source tracking** to raw records

### Phase 3: Mapper Refactor (1 day)

1. **Update ColumnMapper** to use new `MappableField` type
2. **Add validation** during mapping
3. **Show errors/warnings** before proceeding

### Phase 4: Enrichment Implementation (1-2 days)

1. **Create enrichment service** with configurable field priority
2. **Implement fuzzy matching** with confidence scores
3. **Build UI for reviewing matches** (enhance CSVVerificationStep)

### Phase 5: Factory & Persistence (1 day)

1. **Create `createPlayers` factory** function
2. **Replace manual API transforms** with generated versions
3. **Add integration tests** for full pipeline

### Phase 6: Integration (1-2 days)

1. **Update App.tsx** to use new pipeline
2. **Update all import paths** (CSV, Excel, Dual CSV)
3. **Remove old code** from `csvParser.ts`, `api/client.ts`
4. **End-to-end testing**

---

## Migration Strategy

### Parallel Implementation

1. Build new pipeline alongside existing code
2. Feature flag: `USE_NEW_IMPORT_PIPELINE`
3. Test with subset of users
4. Gradually migrate import paths
5. Remove old code once stable

### Backwards Compatibility

- API contract remains unchanged
- Existing saved drafts continue to work
- Only import path changes

---

## Testing Strategy

### Unit Tests

```typescript
// Each stage should be independently testable
describe('Stage 1: Raw Parser', () => {
  it('parses CSV without transformation', async () => {
    const result = await parseCSVToRaw(mockFile, 'evaluation');
    expect(result.records[0].columns['First Name']).toBe('John');
    // Original column name preserved, not transformed
  });
});

describe('Stage 2: Field Mapper', () => {
  it('validates required fields', () => {
    const result = mapFields(records, { 'Name': 'firstName' }); // missing lastName
    expect(result.errors).toContainEqual({
      field: 'lastName',
      error: 'Required field not mapped',
    });
  });
});

describe('Stage 3: Enrichment', () => {
  it('merges registration school into evaluation player', () => {
    const evalPlayer = { firstName: 'John', lastName: 'Doe', totalScore: 45 };
    const regPlayer = { firstName: 'John', lastName: 'Doe', school: 'Lincoln Elementary' };

    const result = enrichPlayers([evalPlayer], [regPlayer], defaultConfig);

    expect(result.players[0].school).toBe('Lincoln Elementary');
    expect(result.players[0].totalScore).toBe(45);
  });
});
```

### Integration Tests

```typescript
describe('Full Import Pipeline', () => {
  it('imports dual CSV with school data preserved through API round-trip', async () => {
    // 1. Parse files
    const evalRaw = await parseCSVToRaw(evalFile, 'evaluation');
    const regRaw = await parseCSVToRaw(regFile, 'registration');

    // 2. Map fields
    const evalMapped = mapFields(evalRaw.records, evalMapping);
    const regMapped = mapFields(regRaw.records, regMapping);

    // 3. Enrich
    const enriched = enrichPlayers(evalMapped.players, regMapped.players, config);

    // 4. Create players
    const { players } = createPlayers(enriched.players, factoryConfig);

    // 5. Save to API
    const saved = await savePlayersToApi(divisionId, players);

    // 6. Load from API
    const loaded = await loadPlayersFromApi(divisionId);

    // Verify school survived round-trip
    expect(loaded.find(p => p.name === 'John Doe')?.school).toBe('Lincoln Elementary');
  });
});
```

---

## Appendix: Current vs Proposed Comparison

### Adding a New Field (e.g., `emergencyContact`)

**Current Process (6 files)**:
1. Add to `Player` interface in `types/index.ts`
2. Add to `OPTIONAL_FIELDS` in `ColumnMapper.tsx`
3. Add `getMappedValue('emergencyContact')` in `csvParser.ts`
4. Add to player object creation in `csvParser.ts`
5. Add to `transformPlayerToApi` in `api/client.ts`
6. Add to `transformPlayerFromApi` in `api/client.ts`
7. Add to Django model in `models.py`
8. Add to Django transformer in `transformers.py`
9. Create migration

**Proposed Process (3 files)**:
1. Add to `PLAYER_FIELD_DEFINITIONS` in `fieldDefinitions.ts`
2. Add to Django model in `models.py`
3. Create migration

The transform functions, column mapper options, and parser all automatically pick up the new field.

---

## Conclusion

This unified pipeline approach will:

1. **Eliminate field loss bugs** like the school issue
2. **Reduce code duplication** across 6+ files
3. **Make adding new fields trivial** (single source of truth)
4. **Improve error handling** with validation at each stage
5. **Enable better testing** with isolated, composable stages
6. **Provide clear data lineage** for debugging

The implementation can be done incrementally, with the new pipeline running alongside the old code until fully validated.
