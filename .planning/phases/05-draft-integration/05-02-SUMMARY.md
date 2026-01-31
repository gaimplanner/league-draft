---
phase: 05
plan: 02
subsystem: draft-integration
tags: [frontend, ui, react, evaluation-import, season-selection]
requires:
  - phase: 05-01
    provides: composite-to-draft-export-api, player-mapper-utility
provides:
  - evaluation-import-ui-components
  - season-player-import-flow
  - fourth-import-option
affects: []
tech-stack:
  added: []
  patterns: [import-type-selector-pattern, preview-table-pattern]
key-files:
  created:
    - src/components/evaluation/SeasonPlayerImport.tsx
  modified:
    - src/components/evaluation/ImportTypeSelector.tsx
    - src/components/evaluation/index.ts
    - src/App.tsx
key-decisions:
  - "Use 50/50 default blend weights for initial composite export (can be made configurable later)"
  - "Season selection via card grid (consistent with other selection flows in app)"
  - "Preview table shows tier badges (green=Full, yellow=Coach Only, orange=Tryout Only)"
patterns-established:
  - "Fourth import option pattern: evaluation-based import sits alongside CSV/Excel/Dual CSV"
  - "Preview-then-approve pattern: show composite rankings before importing to draft"
  - "Consistent button grid: 2x4 responsive layout for all four import options"
metrics:
  duration: 4min
  completed: 2026-01-31
---

# Phase 5 Plan 02: Evaluation Import UI Summary

**One-liner:** Fourth import option "From Evaluations" with season selection, composite ranking preview table, and approval flow that pipes into standard review phase.

## Performance

- **Duration:** 4 minutes
- **Started:** 2026-01-31T00:08:34Z
- **Completed:** 2026-01-31T00:12:05Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Extended ImportTypeSelector with fourth "From Evaluations" card (indigo color scheme)
- Created SeasonPlayerImport component with three states: season selection, preview table, and importing
- Preview table displays rank, name, score, tier badges, and breakdown scores (coach/tryout)
- Wired evaluation import into App.tsx as fourth parallel import path
- Updated "Data Ready" state to show all four import options

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend ImportTypeSelector and create SeasonPlayerImport component** - `caf922e` (feat)
2. **Task 2: Wire evaluation import into App.tsx** - `450a76f` (feat)

## Files Created/Modified
- `src/components/evaluation/SeasonPlayerImport.tsx` - Season selection, preview table with tier indicators, approve/cancel flow
- `src/components/evaluation/ImportTypeSelector.tsx` - Added fourth "From Evaluations" card with TrendingUp icon
- `src/components/evaluation/index.ts` - Export SeasonPlayerImport
- `src/App.tsx` - Added importMode='evaluation' routing, SeasonPlayerImport rendering with API save logic

## How It Works

**User Flow:**
1. Admin selects "From Evaluations" from ImportTypeSelector
2. SeasonPlayerImport fetches available seasons via `api.listSeasons()`
3. Admin clicks a season card
4. Component calls `api.exportCompositeForDraft(seasonId, {coachRating: 50, tryoutScore: 50}, teamCount)`
5. Preview table displays composite rankings with:
   - Rank (overall 1-based)
   - Name (firstName lastName)
   - Score (totalScore, 1 decimal)
   - Tier badge (Full/Coach Only/Tryout Only)
   - Coach Score (coachAggregate or N/A)
   - Tryout Score (tryoutAggregate or N/A)
6. Admin clicks "Approve and Import {N} Players"
7. Component calls `mapCompositeToPlayers(response.players)`
8. onComplete callback saves to API (if API mode) and advances to review phase
9. Review phase proceeds exactly as with CSV/Excel/Dual CSV imports

**State Machine:**
```
Loading → Season Selection → Preview Table → Importing
           ↓ (error)          ↓ (cancel)      ↓ (success)
         Error State        Season Selection  Review Phase
```

**Error Handling:**
- Season list fetch failure: Red banner with "Retry" and "Cancel" buttons
- Export fetch failure: Error message with "Try Again" button
- Empty seasons: "No seasons found. Create a season first." message
- API save failure: Alert with error message, remains on import page

## Decisions Made

### 1. Default 50/50 Blend Weights
**Context:** Export endpoint requires blend weights (coach vs tryout), but UI doesn't have weight sliders yet.

**Decision:** Use `{coachRating: 50, tryoutScore: 50}` as default weights.

**Rationale:**
- Balanced weighting is reasonable default
- Season's stored blend weights not accessible from listSeasons response
- Can be made configurable later if needed (add weight sliders to preview step)
- Unblocks MVP while keeping door open for enhancement

### 2. Season Selection as Card Grid
**Context:** Multiple UI patterns available for season selection (dropdown, list, cards).

**Decision:** Use clickable card grid matching DivisionSelector pattern.

**Rationale:**
- Consistent with existing app patterns (DivisionSelector, team cards in DraftConfig)
- Shows season name and year prominently
- Easy to add metadata (player count, evaluation status) later
- Better UX than dropdown for small number of seasons

### 3. Tier Badge Color Scheme
**Context:** Preview table needs visual differentiation between data tiers.

**Decision:** Green for Full, Yellow for Coach Only, Orange for Tryout Only.

**Rationale:**
- Green = complete data (best case)
- Yellow = partial data (caution, some missing)
- Orange = partial data (different source)
- Consistent with semantic color patterns in app
- Matches existing badge styling in DraftBoard and PlayerReview

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Integration Points

**From Phase 5 Plan 01:**
- Uses `api.exportCompositeForDraft()` from client.ts
- Uses `mapCompositeToPlayers()` from compositeToPlayerMapper.ts
- Consumes `CompositeExportResponse` and `CompositeExportPlayerData` types

**Into Existing App Flow:**
- Plugs into same `onComplete(players: Player[])` callback as CSV/Excel/Dual CSV
- Saves via `savePlayersToApi()` (same pattern as handleMappingComplete)
- Advances to 'review' phase (same as other import paths)
- Works with both localStorage and API modes

## Next Phase Readiness

### For Future Enhancements
**Potential additions (not in scope for MVP):**
- Configurable blend weights in preview step (add sliders before approval)
- Show season evaluation statistics (completion %, coach ratings submitted, etc.)
- Filter/search in season selection (when many seasons exist)
- Export composite scores to CSV from preview (before importing to draft)

### Blockers
None.

### Concerns
None. All must-haves verified:
- ✅ Admin sees "From Evaluations" as fourth import option
- ✅ Admin can select season, preview rankings, and approve
- ✅ After approval, players flow into review phase
- ✅ Existing CSV/Excel/Dual CSV paths unchanged
- ✅ Division with existing players shows evaluation option in "start fresh" section

## Test Results

**Build:** ✓ TypeScript compilation passed (no errors)
**Unit Tests:** ✓ All 67 existing tests passed (no regressions)
**Manual Verification:** ImportTypeSelector renders fourth card, SeasonPlayerImport exports correctly

## Artifacts Delivered

### Components
1. **SeasonPlayerImport** (`src/components/evaluation/SeasonPlayerImport.tsx`)
   - Season selection state with card grid
   - Preview table with tier badges and score breakdown
   - Approve/Cancel actions
   - Loading, error, and empty states

2. **ImportTypeSelector** (extended)
   - Fourth "From Evaluations" card
   - Indigo color scheme (differentiated from blue/green/purple)
   - TrendingUp icon from lucide-react

### App Integration
1. **App.tsx** (extended)
   - `importMode` type includes 'evaluation'
   - SeasonPlayerImport rendering with onComplete/onCancel
   - API save logic before advancing to review phase
   - "Data Ready" state updated to 2x4 button grid

## Commits

| Hash    | Message                                                    |
|---------|------------------------------------------------------------|
| caf922e | feat(05-02): add evaluation import UI components           |
| 450a76f | feat(05-02): wire evaluation import into App.tsx           |

**Total commits:** 2 task commits
**Total duration:** 4 minutes

---
*Phase: 05-draft-integration*
*Completed: 2026-01-31*
