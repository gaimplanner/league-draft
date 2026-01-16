# CLAUDE.md - AI Assistant Context

This file provides context for AI assistants working on this codebase.

## Project Overview

**Little League Draft Application** - A React/TypeScript web app for managing Little League baseball drafts. Handles player imports, scoring, draft execution with rule enforcement, and result exports.

## Key Concepts

### Division
Top-level container. Presets: Majors (10-12), AAA (8-10), AA (7-10), Custom. Each division has its own teams, players, and draft state.

### Player
Imported from CSV or Excel. Has skill scores, total score, rank, and flags (isCoachKid, siblingId, isAllStar, isDNE). Draft status tracked via isDrafted, draftedByTeamId, draftedInRound, draftedAtPick.

### Team
Has name, roster (drafted players), totalScore, draftPosition, coachKids array, assistantCoaches, and ageBreakdown.

### Draft Formats
- **Straight**: 1-8, 1-8, 1-8...
- **Snake**: 1-8, 8-1, 1-8, 8-1...
- **Recalculated**: Lowest roster score picks first each round

### Mandatory Picks
- **Coach's kids**: Must be drafted by assigned team in their projected round
- **Siblings**: When one is drafted, team must draft the other (locked via lockedToTeamId)

## Architecture

### App Phases
`upload` → `mapping` → `review` → `config` → `draft` → `complete`

### State Management
- `useDivisions` hook: Division CRUD, persistence to localStorage
- `useDraft` hook: Draft state, pick logic, undo, mandatory pick checks
- `useEvaluationImport` hook: Excel workbook processing

### Key Files

| File | Purpose |
|------|---------|
| `src/App.tsx` | Main orchestration, phase routing, state coordination |
| `src/hooks/useDraft.ts` | Draft state machine, pick validation, startDraft, draftPlayer, undoLastPick |
| `src/hooks/useDivisions.ts` | Division persistence, CRUD operations |
| `src/utils/draftLogic.ts` | getMandatoryPick, lockSiblingToTeam, getBestAvailable |
| `src/utils/simulation.ts` | runSimulation, getSimulationStats |
| `src/utils/exports.ts` | generatePublicRosters, generateOfficialRecord, generateSimulationDraftBoard |
| `src/utils/draftOrder.ts` | calculateDraftOrder for all three formats |
| `src/utils/evaluationProcessor.ts` | Excel to Player conversion, score normalization |
| `src/utils/teamUtils.ts` | Team display name helpers |
| `src/types/index.ts` | All TypeScript interfaces (Player, Team, Division, DraftState, etc.) |
| `src/components/PlayerReviewTable.tsx` | Spreadsheet-style table for CSV player review |

### Component Hierarchy
```
App
├── DivisionSelector / DivisionCreator
├── FileUpload → ColumnMapper (CSV flow)
├── EvaluationImport (Excel flow)
│   └── PlayerSummaryTable, DetectionModal
├── PlayerReview (CSV flow)
│   └── PlayerReviewTable (spreadsheet-style table)
├── DraftConfig
│   └── SimulationModal
├── DraftBoard
│   └── TeamRosters
└── DraftComplete
    └── TradeModal
```

## Data Flow

### Import → Draft
1. CSV/Excel uploaded and parsed
2. Players created with scores calculated
3. Coach's kids and siblings detected/confirmed
4. Teams configured with names and draft order
5. Draft started with resolvedPlayers (lockedToRound set for conflicts)
6. Each pick updates player.isDrafted, team.roster, checks for mandatory picks

### Simulation
Uses same logic as real draft but on cloned data. Returns SimulationResult with teams and players.

## Coding Patterns

### React Patterns
- Functional components with hooks
- useCallback for stable function references
- useMemo for computed values
- useEffect for side effects and sync

### TypeScript
- Strict typing throughout
- Interfaces in `types/index.ts`
- Type guards where needed

### State Updates
Draft state uses functional updates: `setDraftState(prev => ({ ...prev, ... }))`

## Common Tasks

### Adding a new export format
1. Add function to `src/utils/exports.ts`
2. Call from appropriate component (SimulationModal, DraftComplete)
3. Use `downloadTextFile()` helper

### Adding a draft rule
1. Update `getMandatoryPick()` in `draftLogic.ts`
2. Handle in `useDraft.ts` draftPlayer callback
3. Display warning in `DraftBoard.tsx`

### Modifying simulation
1. Update `runSimulation()` in `simulation.ts`
2. Simulation uses same `getMandatoryPick`, `lockSiblingToTeam`, `getBestAvailable`

### Adding player fields
1. Add to `Player` interface in `types/index.ts`
2. Update CSV parsing in `csvParser.ts`
3. Update Excel processing in `evaluationProcessor.ts`
4. Display in PlayerReview and DraftBoard

## Testing Approach

### E2E Tests (Playwright)
Located in `e2e/draft-flow.spec.ts`. Run with:
```bash
npx playwright test
```

Tests cover:
- Complete draft workflow from CSV import through completion
- DNE player handling
- Sibling rule enforcement

### Manual Verification
1. `npm run build` - Must pass without errors
2. `npm run dev` - Test in browser
3. Test all phases: import → review → config → draft → complete
4. Verify coach's kid and sibling rules work
5. Test simulation and exports

## Branching

- `development` - Feature work
- `staging` - Testing
- `main` - Production
