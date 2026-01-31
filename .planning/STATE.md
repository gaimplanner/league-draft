# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-29)

**Core value:** Every player has a fair, data-driven composite score at draft time -- whether they attended tryouts or not -- built from configurable evaluations that persist across seasons.
**Current focus:** Phase 5 complete — Draft Integration finished

## Current Position

Phase: 5 of 5 (Draft Integration)
Plan: 2 of 2 in current phase
Status: Phase complete
Last activity: 2026-01-31 -- Completed 05-02-PLAN.md (Evaluation import UI)

Progress: [████████████] 100%

## Performance Metrics

**Velocity:**
- Total plans completed: 13
- Average duration: 8min
- Total execution time: 2 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-evaluation-templates | 3/3 | 23min | 8min |
| 02-coach-ratings | 2/2 | 27min | 14min |
| 03-tryout-day-scoring | 4/4 | 51min | 13min |
| 04-composite-scoring | 2/2 | 10min | 5min |
| 05-draft-integration | 2/2 | 9min | 4min |

**Recent Trend:**
- Last 5 plans: 3min, 5min, 5min, 5min, 4min
- Trend: accelerating (backend + UI patterns established, quick execution)

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: Evaluation models are Organization-scoped (not Division-scoped) since players are evaluated before division assignment
- [Roadmap]: JSONField for template definitions (flexible schema, matches existing codebase patterns)
- [Roadmap]: Template versioning required from Phase 1 data model (cannot retrofit later)
- [Roadmap]: Relational score records per station (not flat Player fields) to avoid concurrent write conflicts
- [Roadmap]: Coach ratings before tryout scoring (simpler, validates template system, provides DNE baseline)
- [01-01]: Soft delete for templates (is_active=False) to preserve parent_template references in child versions
- [01-01]: Hard delete for seasons (lightweight, no child references)
- [01-01]: Locked template DELETE returns 400 with guidance to create new version instead
- [01-02]: Zod v4 API is identical to v3 (import { z } from 'zod' and z.object() work as expected)
- [01-02]: Copy-on-write awareness in useEvaluationTemplates hook replaces old template in state on version change
- [01-03]: Zod schema description field uses .default('') instead of .optional().default('') for react-hook-form compatibility
- [01-03]: zodResolver requires Resolver<TemplateFormData> type cast due to ZodEffects input/output type mismatch
- [01-03]: Evaluation Setup navigation placed in DivisionSelector for admin discoverability
- [02-01]: Name-based player identity in CoachRating (player_first_name/player_last_name) -- ratings happen pre-draft before Player records exist
- [02-01]: Case-insensitive duplicate check on player name per coach per season (iexact lookup)
- [02-01]: Template auto-locks on first rating creation for a season
- [02-01]: Score range validation on submit checks min/max from template coach categories
- [02-02]: Dynamic Zod schema builder generates form validation from template categories at runtime
- [02-02]: Coach roster is implicit -- set of CoachRating records per coach per season
- [02-02]: Partial unique constraint on templates -- only active templates enforce name+version uniqueness
- [03-01]: Bib numbers unique per season (not per group) to prevent confusion if players move between groups
- [03-01]: Upsert pattern for station scores (update_or_create) prevents duplicate errors from mobile UI
- [03-01]: Bulk score import wrapped in transaction.atomic() for all-or-nothing semantics
- [03-02]: Minimum 48px touch targets throughout mobile UI for WCAG 2.1 Level AAA compliance
- [03-02]: Auto-advance after all score fields filled (800ms confirmation delay) minimizes taps for volunteers
- [03-02]: Bib numpad as primary entry, name search as secondary fallback
- [03-02]: Template-driven score fields from StationDefinition.fields array for configurable evaluations
- [03-02]: Linter auto-created TryoutScoringPage during commit (Plan 03-03 can focus on remaining components)
- [03-03]: react-datasheet-grid for bulk entry provides native Excel/Sheets paste without custom clipboard parsing
- [03-03]: Progress dashboard shows aggregate counts (X/Y scored) without player-level drill-down (API doesn't include player lists)
- [03-03]: Pull-to-refresh via react-simple-pull-to-refresh handles mobile gesture thresholds correctly
- [03-03]: Tabbed orchestrator page with role-based visibility (4 tabs for admin, 1 for volunteers)
- [03-04]: useRef for groups caching prevents redundant API calls when drilling down multiple cells
- [03-04]: Missing players sorted first in drill-down modal for workflow efficiency
- [03-04]: Click-to-modal pattern with keyboard accessibility (role, tabIndex, onKeyDown)
- [04-01]: Three-tier system (full-data, coach-only, tryout-only) prevents unfair comparisons between players with different data completeness
- [04-01]: Percentile-based outlier exclusion (5th-95th) for time normalization prevents single outlier from compressing distribution
- [04-01]: Tier overrides stored in Season.composite_tier_overrides JSONField (simpler than new model)
- [04-01]: Station-level weights optional (equal weight per station is default, advanced admins can override)
- [04-01]: Coach-only and tryout-only composites use raw aggregates (NOT weighted) since weighting only makes sense when blending two sources
- [04-02]: Debounced onChange (150ms) for live preview prevents excessive API calls during slider drag
- [04-02]: Three-tier display (full/coach-only/tryout-only) prevents unfair rank comparisons between partial-data players
- [04-02]: Rank delta arrows tracked via previousRanks Map in useCompositeScores hook
- [04-02]: Station weights optional (collapsible advanced panel) — equal weights is default
- [04-02]: Expandable player rows show inline evaluation breakdown (not modal) for quick comparison
- [05-01]: Export flat ranking across all tiers (single sequence for draft import) instead of per-tier ranks
- [05-01]: Temporary player IDs use pattern player-eval-{rank}-{timestamp}-{index} matching existing codebase pattern
- [05-01]: Evaluation metadata fields (tier, coachAggregate, tryoutAggregate, isPartialTryout) included in API response for preview table, stripped by mapper before Player creation
- [05-02]: Default 50/50 blend weights for initial composite export (can be made configurable later with weight sliders)
- [05-02]: Season selection via card grid (consistent with DivisionSelector pattern)
- [05-02]: Tier badge colors: green=Full, yellow=Coach Only, orange=Tryout Only

### Pending Todos

- None

### Blockers/Concerns

- [Research]: Phase 3 mobile offline patterns need deeper research -- iOS Safari localStorage persistence across app switches/device sleep is uncertain. Consider /gsd:research-phase before Phase 3 planning.
- [Research]: Z-score normalization necessity to be validated with real data in Phase 4 -- linear normalization is the starting point, upgrade if distributions prove unfair.

## Session Continuity

Last session: 2026-01-31T00:12:05Z
Stopped at: Completed 05-02-PLAN.md (Evaluation import UI) - Phase 5 complete
Resume file: None
