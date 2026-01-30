---
phase: 02-coach-ratings
plan: 02
subsystem: ui
tags: [react, typescript, coach-ratings, react-hook-form, zod, tailwind, dynamic-form]

# Dependency graph
requires:
  - phase: 01-evaluation-templates
    provides: EvaluationTemplate and Season models, template/season TypeScript types, API client, hooks, Zod schema patterns
  - phase: 02-coach-ratings plan 01
    provides: CoachRating backend API endpoints (list, create, detail, update, delete, submit, progress)
provides:
  - CoachRating, CoachRatingProgress, CreateCoachRatingData, UpdateCoachRatingData TypeScript types
  - API client methods for coach rating CRUD, submit, and progress with snake_case/camelCase transformers
  - useCoachRatings hook with CRUD + submit + progress operations
  - Dynamic Zod schema builder (buildRatingSchema) for template-driven form validation
  - RatingInput component (1-5 radio buttons with anchor labels)
  - PlayerRatingForm with grouped physical/soft skills, save-draft and submit
  - CoachRosterList with status badges and add-player form
  - AdminRatingDashboard with per-coach progress table and bars
  - CoachRatingPage orchestrator with season selection and tab navigation
  - App.tsx "coach-ratings" mode and DivisionSelector navigation link
affects: [phase 3 (tryout scoring UI patterns), phase 4 (composite score display), phase 5 (draft integration UI)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dynamic Zod schema from template categories for form validation"
    - "Template-driven rating form rendering grouped by physical/soft skill types"
    - "Coach/admin tab-based page navigation with role-based visibility"

key-files:
  created:
    - src/hooks/useCoachRatings.ts
    - src/schemas/coachRating.ts
    - src/components/coachRatings/RatingInput.tsx
    - src/components/coachRatings/PlayerRatingForm.tsx
    - src/components/coachRatings/CoachRosterList.tsx
    - src/components/coachRatings/AdminRatingDashboard.tsx
    - src/components/coachRatings/CoachRatingPage.tsx
  modified:
    - src/types/index.ts
    - src/api/client.ts
    - src/App.tsx
    - src/components/DivisionSelector.tsx

key-decisions:
  - "Dynamic Zod schema builder generates validation from template categories at runtime"
  - "Coach roster is implicit -- set of CoachRating records per coach per season, no separate roster model"
  - "Tab-based CoachRatingPage: 'My Ratings' for all users, 'Progress Dashboard' for admins only"
  - "Partial unique constraint on evaluation templates -- only active templates enforce name+version uniqueness"

patterns-established:
  - "Dynamic form from template config: buildRatingSchema() generates Zod schema from CoachCategoryDefinition[]"
  - "Rating page pattern: season selector + role-based tabs + nested roster/form views"
  - "Navigation link pattern: DivisionSelector prop-based feature links (onOpenTemplates, onOpenCoachRatings)"

# Metrics
duration: 23min
completed: 2026-01-30
---

# Phase 2 Plan 2: Coach Rating Frontend Summary

**Template-driven coach rating form with dynamic Zod validation, grouped physical/soft skill inputs, draft/submit workflow, coach roster list, admin progress dashboard, and App.tsx navigation integration**

## Performance

- **Duration:** 23 min
- **Started:** 2026-01-30T02:38:24Z
- **Completed:** 2026-01-30T03:01:43Z
- **Tasks:** 2 (+ 1 human verification checkpoint)
- **Files modified:** 11

## Accomplishments
- Complete coach rating frontend: types, API client, hook, schema, 5 UI components, and app integration
- Dynamic Zod schema builder generates form validation from template coach categories at runtime
- Rating form groups physical and soft skill categories with 1-5 radio button inputs and anchor labels
- Draft/submit workflow: coaches save partial ratings and return later, submit when all categories scored
- Admin progress dashboard with per-coach submitted/draft/total counts and progress bars
- CoachRatingPage orchestrates season selection, template loading, and tab-based navigation

## Task Commits

Each task was committed atomically:

1. **Task 1: TypeScript types, API client, hook, and Zod schema** - `1fd3b1b` (feat)
2. **Task 2: Coach rating UI components and App.tsx integration** - `87adb97` (feat)

Additional commits during verification:
- **Merge migration** - `2c3f54f` (fix) - Resolved conflicting migration leaf nodes from staging+main merge
- **Partial unique constraint** - `4ed7811` (fix) - Soft-deleted templates no longer block new template creation

## Files Created/Modified
- `src/types/index.ts` - Added CoachRating, CoachRatingProgress, CreateCoachRatingData, UpdateCoachRatingData, RatingStatus types
- `src/api/client.ts` - Added 2 transformer functions and 7 API methods for coach rating CRUD, submit, and progress
- `src/hooks/useCoachRatings.ts` - CRUD hook with fetchRatings, createRating, updateRating, deleteRating, submitRating, fetchProgress
- `src/schemas/coachRating.ts` - Dynamic buildRatingSchema() and addPlayerSchema with AddPlayerFormData type
- `src/components/coachRatings/RatingInput.tsx` - 1-5 radio button input with anchor text tooltips
- `src/components/coachRatings/PlayerRatingForm.tsx` - Rating form with grouped categories, save-draft and submit
- `src/components/coachRatings/CoachRosterList.tsx` - Player list with status badges and add-player form
- `src/components/coachRatings/AdminRatingDashboard.tsx` - Progress table with coach names, counts, progress bars
- `src/components/coachRatings/CoachRatingPage.tsx` - Page orchestrator with season selector and tab navigation
- `src/App.tsx` - Added 'coach-ratings' AppMode and CoachRatingPage rendering
- `src/components/DivisionSelector.tsx` - Added onOpenCoachRatings prop and "Coach Ratings" navigation button
- `server/draft/models.py` - Fixed unique constraint to partial (active only)
- `server/draft/migrations/0013_merge_20260130_0254.py` - Merge migration for staging+main branches
- `server/draft/migrations/0014_fix_template_unique_constraint_partial.py` - Partial unique constraint migration

## Decisions Made
- Dynamic Zod schema builder generates form validation from template categories at runtime (no static schema)
- Coach roster is implicit -- the set of CoachRating records for a coach+season IS the roster (no separate model)
- Tab-based page: "My Ratings" visible to all authenticated users, "Progress Dashboard" only for admins
- Partial unique constraint on templates: `condition=Q(is_active=True)` so soft-deleted templates don't block new ones

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript type error in PlayerRatingForm.tsx**
- **Found during:** Task 2 (UI components)
- **Issue:** `watch()` returned generic types causing `unknown` to be assigned to `number` for scores
- **Fix:** Applied explicit cast `as Record<string, number | undefined>` for the scores object
- **Committed in:** `87adb97` (part of Task 2 commit)

**2. [Rule 3 - Blocking] Created merge migration for conflicting migration branches**
- **Found during:** Human verification (migration step)
- **Issue:** Staging branch had migrations up to 0012, main branch had 0008_coach_ratings branching earlier — conflicting leaf nodes
- **Fix:** Ran `makemigrations --merge` to create 0013 merge migration
- **Committed in:** `2c3f54f`

**3. [Rule 1 - Bug] Fixed template unique constraint blocking creation after soft-delete**
- **Found during:** Human verification (template creation step)
- **Issue:** Unique constraint `(organization, name, version)` applied to ALL templates including inactive ones, so soft-deleted templates blocked creation of new templates with same name
- **Fix:** Added `condition=Q(is_active=True)` to make constraint partial — only active templates enforce uniqueness
- **Committed in:** `4ed7811`

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 blocking)
**Impact on plan:** All fixes necessary for correct operation. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 2 (Coach Ratings) is now complete — backend API + frontend UI fully delivered
- All 4 success criteria met: rating form with physical+soft skills, draft/submit workflow, admin progress dashboard
- Patterns established for Phase 3: dynamic form from template config, role-based tab navigation
- Migration chain clean: 0013 (merge) and 0014 (partial constraint) applied successfully

---
*Phase: 02-coach-ratings*
*Completed: 2026-01-30*
