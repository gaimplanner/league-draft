---
phase: 03-tryout-day-scoring
plan: 01
subsystem: backend-api
tags: [django, models, api, tryout-scoring]
dependencies:
  requires: [02-02]
  provides: [tryout-scoring-api]
  affects: [03-02, 03-03]
tech_stack:
  added: []
  patterns: [upsert-pattern, bulk-operations, prefetch-optimization]
key_files:
  created:
    - server/draft/views/tryout_scoring.py
    - server/draft/migrations/0015_groupplayer_tryoutgroup_stationscore_and_more.py
  modified:
    - server/draft/models.py
    - server/draft/input_validators.py
    - server/draft/transformers.py
    - server/draft/views/__init__.py
    - server/draft/urls.py
decisions:
  - id: tryout-models-structure
    what: Three-model structure (TryoutGroup, GroupPlayer, StationScore)
    why: Separation of concerns - groups manage rotation, players have bibs, scores track station data
    alternatives: [single-model-with-json, player-embedded-in-group]
    impact: Clean relational queries, proper indexing, enforced uniqueness constraints
  - id: bib-uniqueness-per-season
    what: Bib numbers unique per season (not per group)
    why: Prevents duplicate bibs if players move between groups or late-arrivals are added
    alternatives: [bib-unique-per-group]
    impact: Season FK on GroupPlayer for uniqueness constraint
  - id: upsert-pattern-for-scores
    what: update_or_create() for station score entry
    why: Mobile scoring UI can POST repeatedly without duplicate errors
    alternatives: [client-side-deduplication, PUT-for-updates]
    impact: Single endpoint for create/update, simpler mobile client logic
  - id: auto-bib-assignment
    what: Auto-assign next bib number when adding late players
    why: Admin doesn't need to track/calculate next available bib
    alternatives: [require-explicit-bib-number]
    impact: Max aggregation query on add-player endpoint
  - id: bulk-upsert-in-transaction
    what: Wrap bulk score import in transaction.atomic()
    why: All-or-nothing semantics for spreadsheet paste
    alternatives: [partial-success-with-error-list]
    impact: Failed import rolls back, admin retries entire batch
metrics:
  duration: 4 minutes
  completed: 2026-01-30
---

# Phase 3 Plan 01: Django Tryout Scoring Backend Summary

**One-liner:** Django models (TryoutGroup, GroupPlayer, StationScore) with 8 API endpoints for group management, mobile score entry (upsert), bulk import, and progress tracking.

## What Was Built

### Models (server/draft/models.py)

**TryoutGroup:**
- Organization + Season scoped
- Sequential rotation_order for station scheduling
- Unique constraint on season + name

**GroupPlayer:**
- ForeignKey to group and season (for bib uniqueness constraint)
- Bib numbers unique per season (not per group)
- Unique constraint on group + first_name + last_name (case-sensitive)

**StationScore:**
- JSONField scores keyed by template field IDs
- Unique constraint on season + player + station_id (one score per player per station)
- Tracks scored_by for accountability

**Indexes:**
- `organization + season` on TryoutGroup
- `season + group` on StationScore (progress queries)
- `player` on StationScore (player detail queries)
- `group` on GroupPlayer

### API Endpoints (server/draft/views/tryout_scoring.py)

| Endpoint | Method | Purpose | Role |
|----------|--------|---------|------|
| `/api/seasons/{id}/tryout-groups/` | GET/POST | List/create groups | Admin |
| `/api/seasons/{id}/tryout-groups/generate/` | POST | Auto-generate groups from player list | Admin |
| `/api/tryout-groups/{id}/` | GET/PATCH/DELETE | Group detail/update/delete | Admin |
| `/api/tryout-groups/{id}/players/` | POST | Add late-arriving player | Admin |
| `/api/seasons/{id}/station-scores/` | GET/POST | List/create scores | Coach/Admin |
| `/api/station-scores/{id}/` | GET/PATCH/DELETE | Score detail/update/delete | Coach/Admin |
| `/api/seasons/{id}/station-scores/bulk/` | POST | Bulk import for a station | Admin |
| `/api/seasons/{id}/tryout-progress/` | GET | Progress grid (groups × stations) | Admin |

**Auth patterns:**
- All endpoints use `@require_auth` decorator
- Organization context from `get_organization_from_request()`
- Role checks: admin-only for CRUD/bulk, coach-or-admin for score entry
- Matches established patterns from `coach_ratings.py`

### Key Features

**Auto-Generate Groups:**
- Sorts players by last_name, splits into groups of configurable size (default 18)
- Names groups "Group 1", "Group 2", etc.
- Assigns sequential bib numbers starting from 1

**Upsert Pattern for Scores:**
- `update_or_create()` keyed on (season, player, station_id)
- Mobile scoring UI can POST repeatedly without 409 conflicts
- Updates scorer identity on each save

**Bulk Import with Transaction:**
- Accepts list of {player_id, scores} entries
- Wrapped in `transaction.atomic()` - all-or-nothing
- Prefetches players to avoid N+1 queries

**Progress Dashboard:**
- Fetches groups with `prefetch_related('scores', 'players')`
- Reads station definitions from season.template.stations (JSONField)
- Returns group × station grid with completion counts

## Validation & Transformers

**Validators (input_validators.py):**
- `validate_tryout_group_data()`: name (required), rotation_order (int, >= 0)
- `validate_group_player_data()`: first_name, last_name (required), bib_number (optional, > 0)
- `validate_station_score_data()`: station_id, scores (dict of field_id → number), player_id
- `validate_bulk_scores_data()`: station_id, scores (list of {player_id, scores})

**Transformers (transformers.py):**
- `transform_tryout_group()`: includes player_count, optional players list
- `transform_group_player()`: id, group_id, season_id, name, bib_number
- `transform_station_score()`: includes scored_by_id and scored_by_email
- `transform_tryout_progress()`: group/station metadata with scored_count, complete flag

## Decisions Made

### Decision 1: Three-Model Structure

**Context:** Tryout day scoring needs groups, players, and scores.

**Options considered:**
1. Three models (TryoutGroup, GroupPlayer, StationScore) - **CHOSEN**
2. Single model with JSON for players/scores
3. Players embedded in TryoutGroup JSONField

**Decision:** Three-model relational structure.

**Rationale:**
- Proper indexing for bib lookups (mobile scoring primary use case)
- Unique constraints enforced at DB level (no race conditions)
- N+1 queries preventable with prefetch_related
- Matches existing patterns (CoachRating has separate model, not embedded in Season)

**Impact:**
- Clean separation of concerns (groups manage rotation, players have bibs, scores track data)
- Proper relational queries for progress dashboard
- DB-level enforcement of bib uniqueness

### Decision 2: Bib Uniqueness Per Season (Not Per Group)

**Context:** Bib numbers must be unique so volunteers can look up players quickly.

**Options considered:**
1. Bib unique per season (global) - **CHOSEN**
2. Bib unique per group (allows duplicate bibs across groups)

**Decision:** Season-level bib uniqueness.

**Rationale:**
- Prevents confusion if late-arriving player is added to wrong group initially
- Allows players to move between groups without bib number changes
- Simpler mental model for volunteers ("Bib 42 is always the same kid")
- Phase 4 (Composite Scoring) will merge tryout scores with coach ratings using player name matching - global bib uniqueness reduces ambiguity

**Impact:**
- Required adding `season` FK to GroupPlayer (in addition to `group` FK) for UniqueConstraint
- Max bib query scoped to season when adding late players

### Decision 3: Upsert Pattern for Score Entry

**Context:** Mobile scoring UI may POST repeatedly if network is flaky or volunteer accidentally taps "save" twice.

**Options considered:**
1. update_or_create() upsert pattern - **CHOSEN**
2. Separate POST (create) and PUT (update) endpoints
3. Client-side deduplication with idempotency keys

**Decision:** Single POST endpoint with `update_or_create()` keyed on (season, player, station_id).

**Rationale:**
- Simpler mobile client - no need to track whether a score exists yet
- No 409 Conflict errors that require client retry logic
- Matches Phase 2 coach rating pattern (though that used explicit checks, not update_or_create)
- Scorer identity updated on each save (accountability for latest edit)

**Impact:**
- Single endpoint for both create and update
- Returns 201 for create, 200 for update (mobile client can ignore status code)
- Unique constraint on DB enforces one score per player per station

### Decision 4: Auto-Assign Bib Numbers

**Context:** Admin needs to add late-arriving players during tryout day.

**Options considered:**
1. Auto-assign next bib (max + 1) - **CHOSEN**
2. Require admin to provide bib number explicitly

**Decision:** Auto-assign next available bib number.

**Rationale:**
- Admin doesn't need to track/calculate next bib manually
- Reduces data entry errors (typos, duplicates)
- Common pattern from coach_ratings.py (player name deduplication happens server-side)

**Impact:**
- Max aggregation query on add-player endpoint: `GroupPlayer.objects.filter(season=season).aggregate(max_bib=Max('bib_number'))`
- Not a performance concern (seasons have ~100-200 players max)

### Decision 5: Bulk Import Transaction

**Context:** Admin may paste 60+ scores from a spreadsheet for one station.

**Options considered:**
1. Wrap in transaction.atomic() - all-or-nothing - **CHOSEN**
2. Partial success with error list (process as many as possible)

**Decision:** Atomic transaction for bulk import.

**Rationale:**
- Spreadsheet paste is typically correct or has systematic errors (wrong player IDs, wrong field names)
- Partial success requires admin to figure out which rows succeeded and manually retry failures
- All-or-nothing is simpler mental model: import works or it doesn't
- Matches Django bulk_create patterns from existing codebase

**Impact:**
- Failed import returns 400 with first error encountered
- Admin fixes spreadsheet and retries entire batch
- Prefetch players upfront to avoid N+1 queries inside transaction

## Deviations from Plan

None - plan executed exactly as written.

## Testing & Verification

**Manual verification:**
- ✅ Django system check passed (no issues)
- ✅ Migration applied successfully to PostgreSQL
- ✅ All models importable
- ✅ All 8 view functions importable
- ✅ URL patterns registered

**Expected follow-up testing (Plan 02/03):**
- Mobile scoring UI will test upsert pattern and auth flow
- Bulk entry UI will test transaction rollback and error handling
- Progress dashboard will test prefetch optimization

## Next Phase Readiness

**Blockers:** None

**Concerns:**
- Bib lookup by number is critical for mobile UX - verify unique constraint actually prevents duplicates in Plan 02 testing
- Progress dashboard uses `prefetch_related('scores', 'players')` - monitor query count with django-debug-toolbar in Plan 03

**Ready for:**
- **Plan 02 (Mobile Scoring UI):** Can now POST to `/api/seasons/{id}/station-scores/` with upsert semantics
- **Plan 03 (Bulk Entry + Progress Dashboard):** Can use `/api/seasons/{id}/station-scores/bulk/` and `/api/seasons/{id}/tryout-progress/`

## Known Limitations

1. **No real-time updates:** Progress dashboard requires pull-to-refresh (addressed in Plan 03)
2. **No score range validation:** Template defines min/max for score fields, but API doesn't validate against those ranges yet (deferred to Plan 04)
3. **No conflict resolution:** If two volunteers score the same player at the same station simultaneously, last write wins (acceptable for Phase 3; Phase 4 may add timestamps or version conflicts)

## Files Modified

**Created:**
- `server/draft/views/tryout_scoring.py` (631 lines)
- `server/draft/migrations/0015_groupplayer_tryoutgroup_stationscore_and_more.py`

**Modified:**
- `server/draft/models.py`: +151 lines (3 models)
- `server/draft/input_validators.py`: +152 lines (4 validators)
- `server/draft/transformers.py`: +61 lines (4 transformers)
- `server/draft/views/__init__.py`: +9 lines (imports and exports)
- `server/draft/urls.py`: +19 lines (8 URL patterns)

**Total:** 1023 lines added across 7 files

## Commits

- `1caa286`: feat(03-01): add TryoutGroup, GroupPlayer, and StationScore models
- `4f59f82`: feat(03-01): add tryout scoring API endpoints

**Duration:** 4 minutes
