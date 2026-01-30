---
phase: 02-coach-ratings
plan: 01
subsystem: api
tags: [django, coach-ratings, crud, json-api, draft-submit-workflow]

# Dependency graph
requires:
  - phase: 01-evaluation-templates
    provides: EvaluationTemplate and Season models, template CRUD views pattern
provides:
  - CoachRating model with draft/submit workflow
  - Coach rating CRUD API endpoints (list, create, detail, update, delete)
  - Rating submission endpoint with template category completeness validation
  - Admin progress endpoint with per-coach aggregated counts
  - Template auto-lock on first rating creation
affects: [02-02 (frontend rating form), phase 3 (mobile scoring), phase 4 (composite scoring), phase 5 (draft integration)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Draft/submit workflow pattern for two-phase data entry"
    - "Coach/admin role-based authorization on views"
    - "Template auto-lock on first data creation"

key-files:
  created:
    - server/draft/views/coach_ratings.py
    - server/draft/migrations/0008_coach_ratings.py
  modified:
    - server/draft/models.py
    - server/draft/input_validators.py
    - server/draft/transformers.py
    - server/draft/views/__init__.py
    - server/draft/urls.py

key-decisions:
  - "Name-based player identity in CoachRating (player_first_name/player_last_name) -- ratings happen pre-draft before Player model is populated"
  - "Case-insensitive duplicate check on player name per coach per season (iexact lookup)"
  - "Template auto-locks on first rating creation for a season"
  - "Score range validation on submit (checks min/max from template coach categories)"

patterns-established:
  - "Draft/submit workflow: create as draft, PATCH to update scores, POST /submit to finalize"
  - "Role-based view access: coaches see own data, admins see all"
  - "SQL aggregation for progress dashboard: COUNT with GROUP BY and conditional Q filters"

# Metrics
duration: 4min
completed: 2026-01-30
---

# Phase 2 Plan 1: Coach Rating Backend API Summary

**CoachRating model with draft/submit workflow, 4 CRUD endpoints with coach/admin authorization, score completeness validation on submit, and admin progress dashboard**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-30T00:56:31Z
- **Completed:** 2026-01-30T01:00:31Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- CoachRating model with UUID PK, season FK, coach FK, player name fields, JSONField scores, draft/submitted status, and unique constraint
- 4 API endpoints: list/create, detail (GET/PATCH/DELETE), submit, progress
- Draft/submit workflow with template category completeness validation on submit
- Admin progress dashboard with per-coach aggregated counts using SQL COUNT/GROUP BY
- Template auto-lock on first rating creation for a season

## Task Commits

Each task was committed atomically:

1. **Task 1: CoachRating model, migration, validators, and transformers** - `99baf3f` (feat)
2. **Task 2: Coach rating CRUD views, submission endpoint, progress endpoint, and URL routing** - `1bd0126` (feat)

## Files Created/Modified
- `server/draft/models.py` - Added CoachRating model with UUID PK, season/coach FKs, player name fields, JSONField scores, draft/submitted status
- `server/draft/migrations/0008_coach_ratings.py` - Migration creating coach_ratings table with unique constraint
- `server/draft/input_validators.py` - Added validate_coach_rating_data and validate_rating_scores_complete
- `server/draft/transformers.py` - Added transform_coach_rating and transform_rating_progress
- `server/draft/views/coach_ratings.py` - 4 view functions: list/create, detail, submit, progress
- `server/draft/views/__init__.py` - Registered coach rating views and added to __all__
- `server/draft/urls.py` - 4 URL patterns for coach rating endpoints

## Decisions Made
- Name-based player identity (player_first_name/player_last_name) instead of FK to Player model, since ratings happen pre-draft before Player records exist
- Case-insensitive duplicate check prevents same coach from rating "John Smith" and "john smith" as separate entries
- Template auto-locks when first rating is created for a season (prevents template modification after scoring begins)
- Score range validation on submit checks each score against the category's min/max from the template definition

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

Migration pending: Run `docker compose exec api python manage.py migrate` when Docker is available to apply migration 0008_coach_ratings.

## Next Phase Readiness
- Backend API ready for plan 02-02 (frontend rating form and admin dashboard)
- All 4 endpoints follow established patterns from Phase 1 evaluation template views
- Transformers output snake_case keys matching the existing API contract

---
*Phase: 02-coach-ratings*
*Completed: 2026-01-30*
