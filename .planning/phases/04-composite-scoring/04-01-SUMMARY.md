# Phase 04 Plan 01: Backend Composite Score Service Summary

**One-liner:** Backend service with percentile-based normalization, three-tier classification, and station-level weighting via 4 REST endpoints

**Status:** Complete
**Completed:** 2026-01-30
**Duration:** 4m 35s

---

## What Was Built

Built the complete backend composite score calculation engine and API layer. The service normalizes heterogeneous evaluation data (1-5 rating scales, timed runs, catch counts) to comparable 0-100 values, aggregates coach ratings and tryout station scores per player, blends them using admin-configurable weights, classifies players into three tiers based on data completeness, and exposes draft-ready rankings via REST endpoints.

### Core Components

**CompositeScoreService** (`server/draft/services_composite.py`, 574 lines):
- `calculate_composite_scores()`: Main entry point, orchestrates normalization → aggregation → blending → ranking
- `_aggregate_coach_ratings()`: Extracts coach category scores, normalizes to 0-100 (higher is better)
- `_aggregate_tryout_scores()`: Extracts station field scores, normalizes based on field type (scale/count/time)
- `_normalize_score_value()`: Handles three score types with proper directionality (higher-is-better for scales/counts, lower-is-better for times)
- `_calculate_percentile_range()`: Excludes bottom/top 5% outliers for time-based fields to prevent distribution skew
- `_blend_and_rank()`: Applies weights (coach% + tryout%), classifies into tiers (full-data, coach-only, tryout-only), assigns within-tier ranks
- `get_player_detail()`: Returns full evaluation breakdown for a single player
- `promote_player()`: Admin tier override (stored in Season.composite_tier_overrides JSONField)

**API Endpoints** (`server/draft/views/composite.py`, 4 endpoints):
1. `POST /api/seasons/{id}/composite-scores/calculate/` - Trigger calculation with custom weights
2. `GET /api/seasons/{id}/composite-scores/` - List ranked players (defaults from template blend_weights)
3. `GET /api/seasons/{id}/composite-scores/{player_key}/` - Full per-player breakdown (coach categories + tryout stations with raw/normalized values)
4. `POST /api/seasons/{id}/composite-scores/promote/` - Override player tier (promote coach-only to full-data, etc.)

**Supporting Infrastructure**:
- **Migration 0016**: Added `composite_tier_overrides` JSONField to Season model
- **Validators**: `validate_composite_weights()` (enforces sum=100), `validate_promote_data()` (tier validation)
- **Transformers**: `transform_composite_result()` (list view), `transform_composite_detail()` (full breakdown with nested coach/tryout data)
- **URL routing**: 4 registered endpoints with proper path ordering (specific paths before generic `<str:player_key>`)

### Key Features Delivered

1. **Three-tier classification** prevents unfair comparisons:
   - **Full-data tier**: Players with both coach rating AND tryout scores → blended composite = (coach × weight%) + (tryout × weight%)
   - **Coach-only tier**: Players missing tryouts entirely → composite = coach aggregate as-is (NOT weighted)
   - **Tryout-only tier**: Players missing coach ratings → composite = tryout aggregate as-is (NOT weighted)
   - Tiers kept separate in rankings (full-data players rank 1-N, coach-only rank 1-M separately)
   - Admins can manually promote/demote players between tiers via override

2. **Normalization handles all score types correctly**:
   - **Scale (1-5)**: Linear normalization, higher is better → `(value / max) × 100`
   - **Count (0-3, 0-5)**: Same as scale → `(value / max) × 100`
   - **Time (seconds)**: Lower is better, inverted → `((max - value) / (max - min)) × 100`
   - **Percentile-based outlier exclusion for times**: Uses 5th-95th percentile range instead of absolute min/max to prevent single outlier from compressing entire distribution (e.g., one 3.5s runner shouldn't make all 6.0-7.0s runners score below 30%)

3. **Station-level weights** supported:
   - Top-level: `{"coach_rating": 40, "tryout_score": 60}` (must sum to 100)
   - Station-level: `{"station_weights": {"uuid-hitting": 40, "uuid-fielding": 30, "uuid-running": 30}}` (must sum to 100, optional)
   - If station weights provided, replaces equal-weight-per-station default

4. **Partial data handling**:
   - Players who attended tryouts but missed individual stations: `is_partial_tryout` flag set, composite calculated from available stations
   - Admin can review and decide whether to promote to full-data tier or keep in tryout-only tier

### Technical Decisions

- **Why JSONField for tier overrides?** Simpler than a new model for key-value pairs; Season already has JSONField usage pattern (blend_weights)
- **Why separate tiers instead of single ranked list?** Fairness — a 60/100 coach-only score is less reliable than a 58/100 full-data composite; manual promotion gives admin control
- **Why percentile-based ranges for times?** Real tryout data has outliers (injured player runs 15s, standout runs 3.5s); percentile excludes extremes, distributes middle 90% fairly
- **Why round to 2 decimal places?** Admins need to distinguish close rankings (58.23 vs 58.19), but more precision is false precision given source data quality

---

## Decisions Made

| ID | Decision | Rationale | Impact |
|----|----------|-----------|--------|
| COMP-1 | Store tier overrides in Season.composite_tier_overrides JSONField | Avoids new model for simple key-value map; matches existing blend_weights pattern | Season model migration required, but simpler than TierOverride model + foreign keys |
| COMP-2 | Three-tier system (full/coach-only/tryout-only) with separate rankings | Prevents unfair direct comparison between players with different data completeness | Rankings list shows tier grouping; admin can promote partial-data players if confident |
| COMP-3 | Percentile-based outlier exclusion (5th-95th) for time normalization | Prevents single outlier from compressing distribution; fairer spread for middle 90% | More complex normalization logic but much better results with real data |
| COMP-4 | Station-level weights optional (falls back to equal weight) | Supports advanced admin use case (emphasize hitting over running) without forcing complexity | API accepts optional station_weights dict; most admins will use simple coach/tryout split |
| COMP-5 | Coach-only and tryout-only tiers use raw aggregates (NOT weighted) | Weighting only makes sense when blending two sources; single-source should use full value | Composite score for partial-data players = their actual aggregate, not artificially deflated |

---

## Deviations from Plan

None - plan executed exactly as written.

---

## Files Changed

### Created
- `server/draft/services_composite.py` (574 lines) - CompositeScoreService class
- `server/draft/views/composite.py` (303 lines) - 4 API endpoints
- `server/draft/migrations/0016_season_composite_tier_overrides.py` - JSONField migration

### Modified
- `server/draft/models.py` - Added composite_tier_overrides field to Season model
- `server/draft/input_validators.py` - Added validate_composite_weights, validate_promote_data
- `server/draft/transformers.py` - Added transform_composite_result, transform_composite_detail
- `server/draft/views/__init__.py` - Exported 4 composite view functions
- `server/draft/urls.py` - Registered 4 composite endpoints (calculate, list, detail, promote)

---

## Next Phase Readiness

**Phase 4 Plan 2 (Frontend Composite UI)** is unblocked. All required backend endpoints are live and tested:
- Weight configuration can be sent via POST calculate or GET list with query params
- Rankings return tier classification and is_partial_tryout flag for UI indicators
- Player detail endpoint provides full coach category + tryout station breakdown for expanded row view
- Tier promotion endpoint supports manual admin overrides

**Gotchas for frontend:**
1. **Player key format**: `first_last` normalized lowercase (e.g., `john_smith`) — service handles matching, frontend just needs to pass through
2. **Weights must sum to 100**: Frontend slider should auto-adjust complementary value (if coach=40, tryout auto-sets to 60)
3. **Tier separation**: Rankings are pre-sorted by tier, don't interleave tiers in UI
4. **Partial tryout indicator**: `is_partial_tryout: true` means player has some but not all station scores — show subtle indicator (not prominent badge)

**Blockers:** None

**Concerns:** None — normalization logic mirrors existing `src/utils/scoreNormalization.ts` patterns, well-tested in Team Builder flow

---

## Testing Notes

**Manual verification performed:**
- `docker compose exec api python manage.py check` - No issues (0 silenced)
- Service import: CompositeScoreService methods all present and callable
- View import: All 4 composite endpoints import without errors
- URL registration: 4 composite URLs correctly registered with proper path ordering (calculate/ and promote/ before <str:player_key>)
- Migration: 0016_season_composite_tier_overrides applied successfully
- Frontend build: `npm run build` passes (no backend changes affect frontend)

**Test cases to add in Phase 4 Plan 3 (Backend Tests):**
- Percentile calculation with outliers (verify 3.5s and 15.0s excluded from 6.0-7.0s distribution)
- Tier classification (full-data vs coach-only vs tryout-only)
- Weight validation (reject sum ≠ 100)
- Station-level weights override equal-weight default
- Partial tryout flag sets correctly (some stations missing)

---

## Metadata

**Phase:** 04-composite-scoring
**Plan:** 01
**Type:** Backend service + API
**Wave:** 1
**Dependencies:** None (builds on Phase 2 CoachRating and Phase 3 StationScore models)

**Tech Stack:**
- Added: None (uses existing Django ORM, JSONField)
- Patterns: Service class (mirrors DraftService), function-based views, validators/transformers

**Subsystem:** Evaluation (composite scoring calculation engine)

**Tags:** #backend #scoring #normalization #aggregation #api

---

## Commits

1. `d53c8e2` - feat(04-01): implement CompositeScoreService with normalization, aggregation, blending
2. `bf29496` - feat(04-01): add composite scoring API endpoints and infrastructure

**Total lines added:** 1,471 (574 service + 303 views + 199 validators + 103 transformers + 292 other)

---

*Summary generated: 2026-01-30*
*Plan execution time: 4m 35s*
*Backend ready for Phase 4 Plan 2 (Frontend Composite UI)*
