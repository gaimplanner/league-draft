# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-29)

**Core value:** Every player has a fair, data-driven composite score at draft time -- whether they attended tryouts or not -- built from configurable evaluations that persist across seasons.
**Current focus:** Phase 1 - Evaluation Templates

## Current Position

Phase: 1 of 5 (Evaluation Templates)
Plan: 2 of 3 in current phase
Status: In progress
Last activity: 2026-01-29 -- Completed 01-02-PLAN.md (Frontend types, API client, hooks, zod schema, TemplateList)

Progress: [██░░░░░░░░] 14%

## Performance Metrics

**Velocity:**
- Total plans completed: 2
- Average duration: 4min
- Total execution time: 0.13 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-evaluation-templates | 2/3 | 8min | 4min |

**Recent Trend:**
- Last 5 plans: 4min, 4min
- Trend: consistent

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

### Pending Todos

- Run `docker compose exec api python manage.py migrate` when Docker is available to apply migration 0007_evaluation_templates

### Blockers/Concerns

- [Research]: Phase 3 mobile offline patterns need deeper research -- iOS Safari localStorage persistence across app switches/device sleep is uncertain. Consider /gsd:research-phase before Phase 3 planning.
- [Research]: Z-score normalization necessity to be validated with real data in Phase 4 -- linear normalization is the starting point, upgrade if distributions prove unfair.

## Session Continuity

Last session: 2026-01-29T23:57:15Z
Stopped at: Completed 01-02-PLAN.md (Frontend types, API client, hooks, zod schema, TemplateList)
Resume file: .planning/.continue-here.md
