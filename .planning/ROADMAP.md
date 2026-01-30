# Roadmap: Little League Draft -- Evaluation System

## Overview

This roadmap delivers an in-app evaluation system that replaces the spreadsheet-based player scoring workflow. The build follows the natural dependency chain: configurable templates define what gets evaluated, coach ratings provide baseline scores using those templates, tryout-day scoring captures real-time field evaluations, composite scoring blends both sources into draft-ready rankings, and draft integration closes the loop by feeding composites into the existing draft flow. Each phase delivers a complete, verifiable capability that unblocks the next.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Evaluation Templates** - Admin-configurable evaluation structure with stations, categories, scoring scales, and versioning
- [ ] **Phase 2: Coach Ratings** - End-of-season coach rating submission with template-driven forms and progress tracking
- [ ] **Phase 3: Tryout Day Scoring** - Mobile-first station scoring with bib lookup, groups, bulk fallback, and progress monitoring
- [ ] **Phase 4: Composite Scoring** - Weighted blending of coach ratings and tryout scores with normalization and DNE handling
- [ ] **Phase 5: Draft Integration** - Composite scores feed into the existing draft flow with admin approval gate

## Phase Details

### Phase 1: Evaluation Templates
**Goal**: League admins can create and manage evaluation templates that define exactly what gets evaluated, how it is scored, and how sources are weighted -- establishing the foundation every subsequent phase builds on.
**Depends on**: Nothing (first phase)
**Requirements**: TMPL-01, TMPL-02, TMPL-03, TMPL-04, TMPL-05, TMPL-06
**Success Criteria** (what must be TRUE):
  1. Admin can create an evaluation template with named stations, each containing one or more score fields with configurable types (scale, time, count)
  2. Admin can define coach review categories on a template including both physical skills and soft skills (baseball IQ, hustle, coachability), each with 1-5 rating scales and descriptive anchors per level
  3. Admin can set default blend weights on a template (e.g., 40% coach rating, 60% tryout)
  4. When an admin modifies a template that has been used for scoring, a new version is created (original version preserved) so historical scores remain valid
  5. Templates are scoped to the league -- each league sees only its own templates and cannot access another league's configuration
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md -- Backend models (EvaluationTemplate, Season), migration, validators, transformers, CRUD views with versioning, URL routing
- [x] 01-02-PLAN.md -- Frontend foundation: install react-hook-form/zod, TypeScript types, API client methods, data hooks, zod schema, TemplateList component
- [x] 01-03-PLAN.md -- Template editor UI: dynamic station/field/category forms, blend weight slider, presets, season manager, app integration

### Phase 2: Coach Ratings
**Goal**: Coaches can submit structured end-of-season ratings for players on their roster using the league's evaluation template, and admins can track which coaches have completed their ratings.
**Depends on**: Phase 1 (templates define what coaches rate)
**Requirements**: COACH-01, COACH-02, COACH-03, COACH-04
**Success Criteria** (what must be TRUE):
  1. A coach can open a rating form for any player on their roster, see the league's configured coach review categories (physical skills and soft skills), and submit ratings on the configured scales
  2. Coach ratings include soft-skill categories (baseball IQ, hustle, coachability) rendered from the template alongside physical skill categories
  3. A coach can save an in-progress rating and return later to complete it before final submission
  4. An admin can view a dashboard showing which coaches have submitted ratings and which are still pending, with submitted/total counts per coach
**Plans**: 2 plans

Plans:
- [ ] 02-01-PLAN.md -- Backend: CoachRating model, migration, validators, transformers, CRUD views with draft/submit workflow, admin progress endpoint, URL routing
- [ ] 02-02-PLAN.md -- Frontend: TypeScript types, API client, hooks, Zod schema, rating form with template-driven categories, coach roster list, admin dashboard, App.tsx integration

### Phase 3: Tryout Day Scoring
**Goal**: Volunteers can score players at tryout stations in real-time via mobile browser, with bib-based player lookup, group rotation management, and a bulk-entry fallback for paper-based scoring -- all with scorer identity tracked for accountability.
**Depends on**: Phase 1 (templates define stations and score fields)
**Requirements**: TRYOUT-01, TRYOUT-02, TRYOUT-03, TRYOUT-04, TRYOUT-05, TRYOUT-06, TRYOUT-07
**Success Criteria** (what must be TRUE):
  1. A volunteer at a tryout station can open the scoring UI on a phone browser, enter a bib number via numpad, and immediately see the player's name ready for scoring -- with large touch targets usable one-handed in outdoor conditions
  2. The mobile scoring UI presents one player at a time with station-appropriate input fields (tappable scale buttons for subjective scores, numeric input for times/counts) and auto-advances to the next player after all fields are completed
  3. An admin can organize players into named groups (15-20 players each) and assign groups to station rotations before tryout day
  4. An admin can bulk-enter an entire station's scores from paper sheets via a spreadsheet-style grid interface as a fallback to mobile scoring
  5. An admin can view a tryout progress dashboard showing which groups have completed which stations, which players are missing scores, and overall scoring completion
  6. Every score record captures the identity of the scorer who entered it
**Plans**: TBD (estimated 3-4 plans: tryout event + group setup, mobile station scoring UI, bulk entry, progress dashboard)

Plans:
- [ ] 03-01: Tryout event and player group backend
- [ ] 03-02: Mobile station scoring UI
- [ ] 03-03: Bulk score entry and progress dashboard

### Phase 4: Composite Scoring
**Goal**: The system calculates a fair, weighted composite score that blends coach ratings and tryout evaluations -- normalizing across different score types, handling players with partial or missing data, and showing admins the full breakdown of how each player's score was derived.
**Depends on**: Phase 2 (coach ratings as input), Phase 3 (tryout scores as input)
**Requirements**: COMP-01, COMP-02, COMP-03, COMP-04, COMP-05
**Success Criteria** (what must be TRUE):
  1. When an admin triggers composite calculation for a season, the system produces a blended score for every player who has at least one evaluation source (coach rating, tryout scores, or both)
  2. An admin can configure blend weights (e.g., 40% coach / 60% tryout) and recalculate composites to see how weight changes affect rankings
  3. Different score types (1-5 subjective scales, timed runs, catch counts) are normalized to comparable values before blending so that no single score type dominates rankings disproportionately to its configured weight
  4. Players who missed tryouts receive a composite score based on their coach rating alone (not penalized with zeros for missing tryout data), and their partial-data status is clearly indicated
  5. An admin can view any player's evaluation history showing the coach rating breakdown, individual tryout station scores, and how they combined into the final composite
**Plans**: TBD (estimated 2-3 plans: composite calculator service, admin weight config + history UI)

Plans:
- [ ] 04-01: Composite calculation service and normalization
- [ ] 04-02: Weight configuration and evaluation history UI

### Phase 5: Draft Integration
**Goal**: Composite scores flow into the existing draft system as the primary scoring source, with admin review and approval before scores enter draft configuration, while the existing CSV/Excel import path continues to work as an alternative.
**Depends on**: Phase 4 (composite scores as the data source)
**Requirements**: DRAFT-01, DRAFT-02, DRAFT-03
**Success Criteria** (what must be TRUE):
  1. When creating a division for draft, the admin can select "Import from Evaluations" to pull composite scores from a season -- mapping composite breakdowns to the existing Player score fields used by the draft
  2. The existing CSV/Excel/Dual CSV import paths continue to work unchanged as alternative import methods alongside evaluation-based import
  3. Before evaluation scores flow into draft configuration, the admin reviews finalized rankings and explicitly approves them -- evaluation results do not auto-populate draft data without admin sign-off
**Plans**: TBD (estimated 2 plans: evaluation import path, admin review + approval gate)

Plans:
- [ ] 05-01: Evaluation-to-draft import pathway
- [ ] 05-02: Admin review and approval workflow

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5

| Phase | Plans Complete | Status | Completed |
|-------|---------------|--------|-----------|
| 1. Evaluation Templates | 3/3 | Complete | 2026-01-30 |
| 2. Coach Ratings | 0/2 | Not started | - |
| 3. Tryout Day Scoring | 0/3 | Not started | - |
| 4. Composite Scoring | 0/2 | Not started | - |
| 5. Draft Integration | 0/2 | Not started | - |

---
*Roadmap created: 2026-01-29*
*Last updated: 2026-01-30*
