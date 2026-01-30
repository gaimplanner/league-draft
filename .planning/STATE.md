# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-29)

**Core value:** Every player has a fair, data-driven composite score at draft time -- whether they attended tryouts or not -- built from configurable evaluations that persist across seasons.
**Current focus:** Phase 2 complete — ready for Phase 3 (Tryout Day Scoring)

## Current Position

Phase: 3 of 5 (Tryout Day Scoring)
Plan: 4 of 4 in current phase
Status: Phase complete
Last activity: 2026-01-30 -- Completed 03-04-PLAN.md (Progress dashboard drill-down - gap closure)

Progress: [████████░░░░] 69%

## Performance Metrics

**Velocity:**
- Total plans completed: 9
- Average duration: 10min
- Total execution time: 1.68 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-evaluation-templates | 3/3 | 23min | 8min |
| 02-coach-ratings | 2/2 | 27min | 14min |
| 03-tryout-day-scoring | 4/4 | 51min | 13min |

**Recent Trend:**
- Last 5 plans: 4min, 4min, 35min, 9min, 3min
- Trend: variable (complex UI plans take longer, gap closure plans fastest)

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

### Pending Todos

- None

### Blockers/Concerns

- [Research]: Phase 3 mobile offline patterns need deeper research -- iOS Safari localStorage persistence across app switches/device sleep is uncertain. Consider /gsd:research-phase before Phase 3 planning.
- [Research]: Z-score normalization necessity to be validated with real data in Phase 4 -- linear normalization is the starting point, upgrade if distributions prove unfair.

## Session Continuity

Last session: 2026-01-30T22:00:00Z
Stopped at: Completed 03-04-PLAN.md (Progress dashboard drill-down - gap closure) — Phase 3 complete
Resume file: None
