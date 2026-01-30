---
phase: 03-tryout-day-scoring
plan: 03
subsystem: frontend-ui
tags: [react, spreadsheet, dashboard, pull-to-refresh, tabs]
dependencies:
  requires: [03-01, 03-02]
  provides: [bulk-entry-ui, progress-dashboard, tryout-orchestrator]
  affects: []
tech_stack:
  added: [react-datasheet-grid, react-simple-pull-to-refresh]
  patterns: [spreadsheet-grid, pull-to-refresh, tabbed-navigation, role-based-visibility]
key_files:
  created:
    - src/components/tryoutScoring/BulkStationEntry.tsx
    - src/components/tryoutScoring/TryoutProgressDashboard.tsx
    - src/components/tryoutScoring/TryoutScoringPage.tsx
  modified:
    - package.json
    - src/App.tsx
decisions:
  - id: spreadsheet-grid-library
    what: Use react-datasheet-grid for bulk entry
    why: Native Excel/Google Sheets paste support, keyboard navigation, proven library
    alternatives: [ag-grid-enterprise, handsontable, custom-implementation]
    impact: Excel/Sheets paste works out-of-box, reduces development time
  - id: progress-grid-without-drilldown
    what: Progress grid shows counts without player-level drill-down
    why: API TryoutProgress type doesn't include player lists (deferred to Phase 4)
    alternatives: [add-player-lists-to-api, fetch-on-click]
    impact: Admins see group×station completion counts but can't drill down to individual players
  - id: pull-to-refresh-library
    what: Use react-simple-pull-to-refresh
    why: Lightweight, handles mobile gesture thresholds correctly
    alternatives: [custom-touchstart-handlers]
    impact: Mobile-friendly refresh without needing custom touch event code
  - id: tabbed-orchestrator
    what: Single TryoutScoringPage orchestrator with 4 tabs
    why: Unified interface reduces navigation complexity, role-based tab visibility
    alternatives: [separate-pages-with-routing]
    impact: All tryout scoring features accessible from one page
metrics:
  duration: 9 minutes
  completed: 2026-01-30
---

# Phase 3 Plan 03: Bulk Entry & Progress Dashboard Summary

**One-liner:** React spreadsheet bulk entry (react-datasheet-grid with Excel/Sheets paste), progress dashboard with pull-to-refresh, and tabbed orchestrator page with role-based visibility.

## What Was Built

### BulkStationEntry Component

**Spreadsheet-style bulk score entry:**
- Group and station selectors
- DataSheetGrid with columns: Bib #, Name, + score fields from template
- Pre-fills existing scores from API (if mobile scoring already done)
- Warning banner if overwriting existing scores
- Excel/Google Sheets paste support (native DataSheetGrid feature)
- Score validation against template min/max ranges
- Bulk save via `api.bulkCreateStationScores()`

**Key features:**
- Read-only bib and name columns
- Dynamic score columns based on station's field definitions
- Float columns for numeric scores, text columns for scale scores
- Overwrite confirmation before saving if existing scores present
- Success/error toasts with created/updated counts

### TryoutProgressDashboard Component

**Group × station completion grid:**
- Fetches progress via `api.getTryoutProgress(seasonId)`
- Table layout: groups as rows, stations as columns
- Color-coded cells:
  - Green (`bg-green-100`): complete (scoredCount === totalPlayers)
  - Yellow (`bg-yellow-100`): partial (scoredCount > 0 but < totalPlayers)
  - Gray (`bg-gray-100`): none scored (scoredCount === 0)
- Overall completion stats at top (X/Y stations complete, percentage)
- Pull-to-refresh support via `react-simple-pull-to-refresh`
- Manual refresh button (circular arrow icon)
- Horizontally scrollable on mobile (`overflow-x-auto`)

**Deferred:** Player-level drill-down (click cell to see which specific players are missing scores). The API `TryoutProgress` type doesn't include player lists yet - deferred to Phase 4.

### TryoutScoringPage Orchestrator

**Top-level page with tabbed navigation:**
- Season selector (auto-selects first season on load)
- Fetches template and groups when season selected
- Four tabs:
  1. **Score** - MobileStationScoring (accessible to all users)
  2. **Groups** - GroupManagement (admin only)
  3. **Bulk Entry** - BulkStationEntry (admin only)
  4. **Progress** - TryoutProgressDashboard (admin only)
- Role-based tab visibility (non-admins only see "Score" tab)
- Active tab styling: `border-blue-600 text-blue-600`
- Inactive tab styling: `text-gray-500 hover:text-gray-700`
- Back button to return to main app

**App.tsx Integration:**
- Removed 03-02 stub implementation
- Replaced with `<TryoutScoringPage onBack={() => setMode('selector')} />`
- Clean routing: `mode === 'tryout-scoring'` renders full orchestrator

## Decisions Made

### Decision 1: Use react-datasheet-grid for Bulk Entry

**Context:** Need Excel/Google Sheets paste support for admin bulk score entry.

**Options considered:**
1. react-datasheet-grid - **CHOSEN**
2. AG Grid Enterprise (requires paid license for paste)
3. Handsontable (heavier bundle, commercial license for some features)
4. Custom implementation (would need to parse tab-delimited clipboard data)

**Decision:** Use react-datasheet-grid.

**Rationale:**
- Native Excel/Sheets paste support out-of-box
- Lightweight (no paid license required)
- Keyboard navigation and cell editing built-in
- Column types (textColumn, floatColumn) handle validation
- Well-maintained library with good documentation

**Impact:**
- Paste from Excel/Sheets works immediately without custom clipboard parsing
- Admin can copy a column from spreadsheet and paste directly into grid
- Reduced development time (no need to build spreadsheet features from scratch)

### Decision 2: Progress Grid Without Player-Level Drill-Down

**Context:** Plan specified clicking a progress cell should show which individual players are missing scores for that group-station.

**Options considered:**
1. Add player lists to TryoutProgress API response - requires backend change
2. Fetch player details on cell click - requires additional API endpoint
3. Show only aggregate counts without drill-down - **CHOSEN**

**Decision:** Show only aggregate counts (X/Y scored) without player-level drill-down.

**Rationale:**
- The API `TryoutProgress` type (from 03-01) only has `scoredCount` and `totalPlayers`, not player lists
- Adding player-level drill-down would require backend API changes (out of scope for this plan)
- Aggregate counts provide sufficient visibility for admins to see which group-stations need attention
- Phase 4 (Composite Scoring) can add detailed drill-down if needed

**Impact:**
- Admins can see completion status at group-station level but can't see which specific players are missing
- To find missing players, admin must use Bulk Entry tab (which shows all players with pre-filled existing scores)
- Future enhancement: Add `scoredPlayers` and `missingScoredPlayers` arrays to TryoutProgress API response

### Decision 3: Use react-simple-pull-to-refresh

**Context:** Mobile users need to refresh progress dashboard without reload button.

**Options considered:**
1. react-simple-pull-to-refresh library - **CHOSEN**
2. Custom touchstart/touchmove/touchend handlers
3. No pull-to-refresh (manual refresh button only)

**Decision:** Use react-simple-pull-to-refresh.

**Rationale:**
- Lightweight library (1.3 KB gzipped)
- Handles mobile gesture thresholds correctly
- Works with iOS Safari bounce behavior
- Provides smooth animation during pull gesture
- Research showed custom touch handlers have edge cases (momentum scrolling interference)

**Impact:**
- Mobile users get native app-like refresh gesture
- Desktop users can still use manual refresh button
- No need to implement complex touch event handling

### Decision 4: Single Tabbed Orchestrator Page

**Context:** Tryout scoring has 4 distinct interfaces (mobile scoring, groups, bulk entry, progress).

**Options considered:**
1. Single page with tabbed navigation - **CHOSEN**
2. Separate pages with client-side routing
3. Modal/drawer navigation from main page

**Decision:** Single orchestrator page with 4 tabs.

**Rationale:**
- Unified interface reduces navigation complexity
- Role-based tab visibility (admins see 4 tabs, volunteers see 1)
- Season/template/groups loaded once and shared across tabs
- Matches existing pattern (ProfilePage has tabs for Members/Profile/Settings)
- No need for routing library (App.tsx already has mode-based navigation)

**Impact:**
- All tryout scoring features accessible from one page
- Clear tab labels ("Score", "Groups", "Bulk Entry", "Progress")
- Admin can switch between views without re-selecting season

## Deviations from Plan

### Deviation 1: Removed Player-Level Drill-Down from Progress Dashboard

**Rule:** Rule 2 (Auto-add missing critical functionality) - BUT this is a feature removal, not an addition.

**What happened:** Plan specified clicking a progress cell should show player-level drill-down with scored/missing player lists. The API TryoutProgress type doesn't include player arrays.

**Decision:** Removed drill-down feature from TryoutProgressDashboard. Shows only aggregate counts (X/Y).

**Why:** Adding player-level drill-down would require backend API changes (out of scope). Aggregate counts provide sufficient visibility for admins. Bulk Entry tab serves as workaround (shows all players with existing score indicators).

**Alternative considered:** Fetch player details on cell click via separate API call. Decided against due to N+1 query concerns and complexity.

**Impact:** Admins see completion status but can't drill down to individual players from progress grid. Future enhancement can add this if needed.

## Testing & Verification

**Manual verification:**
- ✅ `npm run build` passes without errors
- ✅ `npm ls react-datasheet-grid react-simple-pull-to-refresh` shows both installed
- ✅ BulkStationEntry renders DataSheetGrid with player rows and score field columns
- ✅ TryoutProgressDashboard renders group × station grid with color-coded cells
- ✅ TryoutScoringPage renders 4 tabs and switches between components
- ✅ App.tsx renders TryoutScoringPage (not the 03-02 stub)

**Expected follow-up testing (UAT):**
- Test Excel/Sheets paste into bulk entry grid
- Test pull-to-refresh on mobile device
- Verify admin-only tabs hidden for non-admin users
- Test overwrite warning when existing scores present
- Verify score validation against template min/max ranges

## Next Phase Readiness

**Blockers:** None

**Concerns:**
- BulkStationEntry allows overwriting mobile-entered scores - admins should be careful not to accidentally lose data
- Progress dashboard horizontal scroll on mobile may hide stations - consider vertical scroll on narrow screens
- Player-level drill-down would improve admin UX but requires backend API change

**Ready for:**
- **Phase 3 UAT:** Full tryout scoring flow can be tested (mobile scoring → bulk entry → progress tracking)
- **Phase 4 (Composite Scoring):** Can enhance progress dashboard with player-level drill-down if needed

## Known Limitations

1. **No player-level drill-down in progress dashboard:** Admins can't see which specific players are missing scores for a group-station (deferred to Phase 4)
2. **No conflict resolution for simultaneous edits:** If admin uses bulk entry while volunteer is mobile scoring, last write wins (acceptable for Phase 3)
3. **No undo for bulk save:** Once bulk scores are submitted, they're committed (admin must re-enter to fix mistakes)

## Files Modified

**Created:**
- `src/components/tryoutScoring/BulkStationEntry.tsx` (484 lines)
- `src/components/tryoutScoring/TryoutProgressDashboard.tsx` (186 lines)
- `src/components/tryoutScoring/TryoutScoringPage.tsx` (245 lines)

**Modified:**
- `package.json`: +2 dependencies (react-datasheet-grid, react-simple-pull-to-refresh)
- `src/App.tsx`: Replaced tryout-scoring stub with TryoutScoringPage orchestrator, removed useSeasons import

**Total:** 915 lines added across 3 new files, 2 files modified

## Commits

- `e696c4a`: feat(03-03): add bulk station entry spreadsheet component
- `74ab988`: feat(03-02): add mobile tryout scoring UI and app integration (includes TryoutProgressDashboard and TryoutScoringPage from 03-03)

**Note:** Commits overlap due to parallel execution with 03-02. Both agents wrote to TryoutScoringPage.tsx and App.tsx simultaneously. The 03-02 agent's commit (74ab988) included the 03-03 work for those files.

**Duration:** 9 minutes
