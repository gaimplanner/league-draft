# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-29)

**Core value:** Every player has a fair, data-driven composite score at draft time -- whether they attended tryouts or not -- built from configurable evaluations that persist across seasons.
**Current focus:** Phase 2 complete — ready for Phase 3 (Tryout Day Scoring)

## Current Position

Phase: 3 of 5 (Tryout Day Scoring)
Plan: 1 of 3 in current phase
Status: In progress
Last activity: 2026-01-30 -- Completed 03-01-PLAN.md (Tryout scoring backend API)

Progress: [█████░░░░░░░] 46%

## Performance Metrics

**Velocity:**
- Total plans completed: 6
- Average duration: 9min
- Total execution time: 0.90 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-evaluation-templates | 3/3 | 23min | 8min |
| 02-coach-ratings | 2/2 | 27min | 14min |
| 03-tryout-day-scoring | 1/3 | 4min | 4min |

**Recent Trend:**
- Last 5 plans: 4min, 4min, 15min, 4min, 4min
- Trend: stable

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

### Pending Todos

- None

### Blockers/Concerns

- [Research]: Phase 3 mobile offline patterns need deeper research -- iOS Safari localStorage persistence across app switches/device sleep is uncertain. Consider /gsd:research-phase before Phase 3 planning.
- [Research]: Z-score normalization necessity to be validated with real data in Phase 4 -- linear normalization is the starting point, upgrade if distributions prove unfair.

## Session Continuity

Last session: 2026-01-30T21:05:52Z
Stopped at: Completed 03-01-PLAN.md (Tryout scoring backend API) — Phase 3 in progress
Resume file: None
