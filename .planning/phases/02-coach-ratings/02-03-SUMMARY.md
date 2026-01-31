---
phase: 02-coach-ratings
plan: 03
subsystem: api, ui
tags: django, react, coach-ratings, validation, UX
gap_closure: true
uat_issue: 7

# Dependency graph
requires:
  - phase: 02-01
    provides: CoachRating model with UniqueConstraint and duplicate blocking
provides:
  - Duplicate player name warning with user confirmation
  - Backend force flag to bypass duplicate check
  - Inline confirmation dialog in coach roster UI
affects: [none - isolated UX improvement]

# Tech tracking
tech-stack:
  added: []
  patterns: [warning-then-confirm pattern for non-critical validations]

key-files:
  created: [server/draft/migrations/0017_remove_coach_rating_unique_constraint.py]
  modified:
    - server/draft/models.py
    - server/draft/views/coach_ratings.py
    - src/types/index.ts
    - src/api/client.ts
    - src/hooks/useCoachRatings.ts
    - src/components/coachRatings/CoachRatingPage.tsx
    - src/components/coachRatings/CoachRosterList.tsx

key-decisions:
  - "Duplicate warning returns 200 (not error status) since it's not a true error - data is valid, just confirming intent"
  - "force flag in request body bypasses warning - simple boolean flag instead of separate endpoint"
  - "Inline amber confirmation (not modal) for lightweight UX - less disruptive than blocking modal"

patterns-established:
  - "Warning-then-confirm pattern: API returns 200 with warning field, frontend shows confirmation, retry with force flag"

# Metrics
duration: 3min
completed: 2026-01-31
---

# Phase 02 Plan 03: Duplicate Player Warning Summary

**Duplicate player names now warn coaches with inline confirmation instead of blocking - common names like "John Smith" no longer cause creation failures**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-31T03:50:50Z
- **Completed:** 2026-01-31T03:53:57Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Removed database-level UniqueConstraint allowing multiple ratings with same player name per coach per season
- Backend returns 200 with warning payload instead of 409 error when duplicate name detected
- Frontend shows inline amber confirmation dialog with "Add Anyway" button
- User can proceed after confirming they intend to rate multiple players with the same name

## Task Commits

Each task was committed atomically:

1. **Task 1: Backend - Remove UniqueConstraint and change duplicate check to warning** - `4d47dd9` (feat)
2. **Task 2: Frontend - Handle duplicate warning with confirmation dialog** - `8fcaf2b` (feat)

## Files Created/Modified
- `server/draft/models.py` - Removed constraints list from CoachRating.Meta
- `server/draft/migrations/0017_remove_coach_rating_unique_constraint.py` - Database migration to drop unique constraint
- `server/draft/views/coach_ratings.py` - Changed duplicate check from 409 block to 200 warning with force flag handling
- `src/types/index.ts` - Added DuplicatePlayerWarning interface and force field to CreateCoachRatingData
- `src/api/client.ts` - Updated createCoachRating to detect warning response and pass force flag
- `src/hooks/useCoachRatings.ts` - Updated createRating to return warning instead of throwing
- `src/components/coachRatings/CoachRatingPage.tsx` - Updated handleAddPlayer callback to handle warning
- `src/components/coachRatings/CoachRosterList.tsx` - Added inline amber confirmation dialog with "Add Anyway" button

## Decisions Made

**1. Warning as 200 (not error status)**
- Returning 200 instead of 409 because duplicate name is not an error - the data is valid, we're just confirming user intent
- Frontend detects `warning` field in successful response instead of catching error
- Simpler client-side logic - no try/catch needed

**2. Force flag in request body (not separate endpoint)**
- Adding `force: true` to the same POST endpoint bypasses the warning
- Simpler than creating a separate "force create" endpoint
- Backend checks `data.get("force")` before returning warning

**3. Inline confirmation (not modal)**
- Amber confirmation box appears below the form when duplicate detected
- Less disruptive than blocking modal dialog
- User can still see the form inputs while deciding
- "Add Anyway" confirms, "Cancel" dismisses warning

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - straightforward implementation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

UAT Test 7 resolved. All coach rating functionality now working as expected for real-world usage where multiple kids may share common names.

---
*Phase: 02-coach-ratings*
*Completed: 2026-01-31*
