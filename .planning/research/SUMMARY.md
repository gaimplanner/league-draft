# Project Research Summary

**Project:** Youth Sports Evaluation System (Little League Baseball)
**Domain:** Mobile-first evaluation and scoring system for tryout day and end-of-season coach ratings
**Researched:** 2026-01-29
**Confidence:** MEDIUM-HIGH

## Executive Summary

This evaluation system adds mobile tryout scoring and coach rating workflows to an existing Little League draft application. The research reveals that success hinges on three critical factors: offline-first mobile architecture (outdoor baseball fields have poor connectivity), robust score normalization across different evaluators (avoiding inter-rater bias that destroys fairness), and template versioning from day one (enabling cross-season data persistence).

The recommended approach is to build evaluation as an extension of the existing Django + React architecture using function-based views, hooks-based state management, and JSONField for configurable templates. The stack additions are minimal but strategic: react-hook-form + Zod for mobile form performance, TanStack Query for offline queue management with retry logic, and vitest for testing score calculation algorithms. Avoid Django Channels/WebSockets (overkill for polling-based progress updates), avoid mixing DRF with the existing function-based views, and avoid PWA/service workers in Phase 1 (defer offline complexity until online-first is proven).

The primary risk is underestimating mobile-first UX requirements. This is not a responsive web app problem — it's a standing-at-a-field-with-one-hand-while-the-sun-glares-on-your-screen problem. Large touch targets, high contrast, auto-advance between players, and a local-first data layer are non-negotiable. The secondary risk is naive composite scoring that produces statistically unfair rankings when subjective scores (compressed distribution) are mixed with objective measurements (wide distribution). Z-score or percentile normalization must supplement the existing linear normalization to ensure configured weights match actual ranking influence.

## Key Findings

### Recommended Stack

The existing Django + React + PostgreSQL stack handles the evaluation system's needs without major additions. The core stack remains function-based Django views (not DRF), React hooks for state, Tailwind for styling, and JSONField for flexible schema storage. This continuity is critical — mixing architectural patterns (e.g., adding DRF serializers alongside the existing transformers pattern) creates confusion.

**Core technology additions:**

- **react-hook-form (^7.51+):** Form state management for evaluation entry — Uncontrolled components prevent re-render lag on mobile when scoring 10-20 fields per player. The existing app has no form library; RHF is scoped to evaluation forms without retrofitting the draft UI.

- **Zod (^3.23+):** Schema validation for evaluation templates and score inputs — TypeScript-native validation with type inference. Template structure is defined as Zod schemas that validate both admin config and scorer input. Stronger type safety than Yup.

- **TanStack Query (^5.56+):** Server state management with automatic retry and offline queue support — Wraps around the existing `api/client.ts` methods to provide caching, retry logic, and optimistic updates for score submission. Tryout progress polling becomes trivial with `refetchInterval`. Eliminates need for manual cache invalidation logic.

- **vitest (^2.0+):** Unit test runner for score calculation algorithms — The existing app has E2E tests (Playwright) but no unit tests. Evaluation logic (normalization, weighting, composite blending, z-score calibration) is complex enough to warrant unit testing. Vitest integrates natively with Vite (zero config).

**What to avoid:**

- Django REST Framework — The existing app deliberately uses plain function-based views. Adding DRF for evaluation APIs creates two API patterns in one codebase.
- Formik — Re-renders entire form on every keystroke. Performance penalty is material on mobile with 10+ score fields.
- Redux/RTK Query — Requires adopting Redux for the whole app when TanStack Query handles server state independently.
- Django Channels + WebSockets — Infrastructure complexity (Redis, ASGI swap) for a feature that only needs 10-second polling intervals.
- Service Worker/PWA in Phase 1 — Offline complexity should be deferred until online-first scoring is validated at actual tryout fields.

### Expected Features

The evaluation system must replace the paper-then-spreadsheet workflow that leagues use today. The real competitor is Excel, not other software. Any digital solution must be faster and more reliable than "volunteers write on clipboards, then an admin hand-transcribes into a spreadsheet."

**Must have (table stakes):**

- **Admin-configurable evaluation templates** — Every league evaluates differently. Templates define stations, scoring scales, coach rating categories, and blend weights. Must support both tryout stations (fielding, hitting, pitching, baserunning) and coach review categories (baseball IQ, hustle, coachability). League-scoped with version tracking.

- **Mobile station scoring** — Volunteers score at outdoor stations using phone browsers. Must work on phones with poor connectivity, direct sunlight, and one-handed operation. Large touch targets, minimal scrolling, fast bib lookup. This is the make-or-break feature — if mobile UX is bad, volunteers fall back to paper.

- **Bulk entry fallback** — When mobile fails (rain, dead battery, confusion), admins transcribe from paper. Spreadsheet-style grid with paste-from-clipboard support. Non-negotiable for adoption.

- **Composite score calculation** — Weighted blend of coach ratings + tryout scores into one draft-ready score. Configurable weights per league (e.g., 40% coach, 60% tryout). Score normalization across different scales (1-5 subjective, time-based objective, count-based).

- **Evaluation data feeds draft** — Composite scores flow into the existing draft system, replacing or supplementing the CSV import path. Without this integration, evaluation is an island.

**Should have (competitive advantage):**

- **Cross-season coach rating persistence** — Coach ratings persist at the player/league level, carrying forward as baseline for next season. Leagues no longer "lose" last year's evaluations. Requires player identity to persist across seasons (not just within a division).

- **Tryout day progress dashboard** — Admin sees which groups have completed which stations in real-time. Flags incomplete evaluations before everyone goes home. Critical for tryout logistics.

- **Score confidence indicators** — Visual indicator of data quality: "Full eval" (coach + tryout), "Coach only", "Tryout only", "DNE". Helps draft board show data reliability alongside rankings.

- **Evaluator calibration / bias detection** — Flag evaluators who consistently score higher or lower than peers. Statistical z-score adjustment per evaluator. Valuable but requires multiple evaluators scoring same players (not always feasible).

**Defer to v2+:**

- **Real-time WebSocket score aggregation** — WebSocket complexity for no user benefit (polling every 10 seconds is sufficient for progress monitoring). Outdoor connectivity makes WebSocket connections unreliable.

- **Offline PWA with service workers** — Adds conflict resolution, sync UI, and data versioning complexity. Paper fallback is the established backup. Build online-first, add offline later if field testing shows need.

- **Multi-evaluator consensus scoring** — Two volunteers score the same station; system averages or flags disagreements. Most leagues don't have enough volunteers.

### Architecture Approach

The evaluation system extends the existing Django + React architecture with four new subsystems: EvaluationTemplate (configurable schemas), Season (temporal containers), CoachRating (end-of-season ratings), and TryoutEvent (tryout day scoring). Each follows established patterns: function-based views in `server/draft/views/`, hooks in `src/hooks/`, components in `src/components/evaluation/`, and transformers in `server/draft/transformers.py`.

**Major components:**

1. **EvaluationTemplate (Django model + React admin UI)** — Stores station definitions, coach rating categories, scoring scales, and blend weights as JSONField. Templates are versioned (never mutated in place). Frontend renders forms dynamically from template JSON. Follows existing pattern: the app already uses JSONField for `scoring_weights`, `age_breakdown`, `active_stations`, and `teammate_requests`.

2. **Season (temporal boundary for evaluation data)** — Links an evaluation template to a year. Coach ratings and tryout events belong to a season, not a division (divisions are created later from season data). Player scores always stored with their season and template version for cross-season comparability.

3. **StationScore (relational, not flat Player fields)** — Each score is a separate record: `{player_id, station_id, scorer_id, scores: {field1: value, field2: value}, timestamp}`. Enables concurrent multi-station entry without write conflicts. Eliminates the lost-update problem that would occur if scores were flat fields on the Player model. Mirrors the existing `processWorkbook()` pattern: merge at read time, not write time.

4. **CompositeCalculator (service layer)** — Lives in `server/draft/services/composite_calculator.py` following the existing `services_draft.py` pattern with `@transaction.atomic` methods. Normalizes coach ratings + station scores to 0-100, applies blend weights, handles partial evaluations, and stores results in CompositeScore model with full breakdown for audit.

**Key architectural decisions:**

- **JSONField for configurable schema:** Store template structure as JSON rather than rigid relational tables. Leagues' evaluation needs vary and evolve. No migrations needed when template changes. Frontend renders forms dynamically from JSON. This is the established pattern in the codebase (already used for weights, breakdown, requests, etc.).

- **Offline queue with localStorage (Phase 1) or IndexedDB (later):** Buffer score entries locally, flush to API when connectivity returns. Each score keystroke persists locally before any network request. Visual sync status (green = synced, yellow = pending, red = offline). The hook pattern: `useStationScoring` manages the queue, listens for `online` events, and retries failed POSTs.

- **Service layer for composite calculation:** Complex logic that spans multiple models (CoachRating + StationScore + EvaluationTemplate blend weights) belongs in a service, not views or models. Follows existing `DraftService` pattern with atomic transactions.

- **Evaluation models are Organization-scoped, not Division-scoped:** Players participate in evaluations before their division is known. Coach ratings span a season, not a division. CompositeScore is linked at player/organization level, then referenced when divisions are created for draft.

### Critical Pitfalls

Research identified seven critical pitfalls. The top five must be addressed in Phase 1; the others can wait until later phases with proper planning.

1. **Offline data loss during field evaluations** — Volunteers enter scores on mobile at outdoor fields with poor connectivity. Data entered during connectivity gaps is lost when the browser crashes or device sleeps. An entire station's scores disappear mid-tryout. **Solution:** Offline-first from day one. Every keystroke persists to localStorage before any network request. Visible sync status (green/yellow/red indicator). Test with network throttling set to "Offline" throughout development. This is non-negotiable for mobile scoring — retrofitting offline support onto an online-first form requires rewriting the entire data flow.

2. **Inter-rater scoring inconsistency destroys fairness** — Different scorers at different stations apply subjective scales differently. Scorer A gives "3 out of 4" to above-average players; Scorer B gives "3 out of 4" only to exceptional players. Raw composite scores are meaningless because a "3" from Station A is not equivalent to a "3" from Station B. **Solution:** Per-station z-score normalization (scores relative to that scorer's own distribution) or percentile-rank normalization. The existing `normalizeScore()` does linear 0-100 mapping, which preserves unfair distributions. Z-score normalization ensures configured weights match actual ranking influence.

3. **Template flexibility creates incomparable data across seasons** — When templates change between seasons (different categories, different scales), old scores become incompatible with new scores. A player's "85" from last season means something completely different than "85" this season. Cross-season coach ratings lose meaning. **Solution:** Version evaluation templates from day one. Each template gets an immutable version ID. Player scores always stored with their template version. Raw scores + template metadata stored together, enabling re-normalization under new weights. This must be in the Phase 1 data model — retrofitting versioning onto flat templates requires migrating all historical data.

4. **Concurrent multi-station entry creates race conditions** — Multiple stations score the same player simultaneously. Both stations submit scores. The second write overwrites the first, and one station's data is lost (classic lost-update problem). **Solution:** Model evaluation scores as separate records per station, not flat fields on Player model. Each station writes its own records (`EvaluationScore` or `StationScore`), eliminating write conflicts. Merge at read time (composite calculation), not write time. This mirrors the existing `processWorkbook()` merge-by-BIB pattern.

5. **Building desktop-first UI for a mobile-first use case** — Evaluation entry happens on phones at the baseball field, but the UI is designed for desktop. Scorers struggle with tiny inputs, fat-finger errors, and cannot see the player while scoring. The app is technically "responsive" but functionally unusable on a phone held with one hand. **Solution:** Design evaluation entry mobile-first, not responsive-as-afterthought. Large touch targets (48px minimum), single-column layout, high-contrast for sunlight, tappable buttons instead of text inputs. One player per screen with auto-advance. Test on actual phones outdoors with non-technical volunteers. The mobile UX must be built from scratch — "making it responsive" later means rebuilding the entire interaction pattern.

**Additional pitfalls to address in later phases:**

6. **Naive composite scoring produces unfair rankings** — When subjective ratings (compressed distribution) are mixed with objective measurements (wide distribution), the category with more variance dominates rankings regardless of configured weights. A 10% weight on running time can drive 40% of ranking variation if times spread widely while subjective scores cluster. **Solution (Phase 2):** Z-score or percentile normalization before compositing. The existing linear normalization preserves distribution shape, allowing high-variance categories to dominate.

7. **Ignoring "Did Not Evaluate" edge cases** — Players with partial evaluations (completed some stations but not all) are either penalized (missing scores = 0), excluded entirely (unfair — they have valid data), or cause calculation errors. The existing `isDNE` flag and weight redistribution handle some cases, but don't distinguish between "did not attend" vs "station ran out of time" vs "equipment failure". **Solution (Phase 2):** Distinguish missing-data reasons in the data model. Admin workflow for reviewing incomplete evaluations and scheduling makeups.

## Implications for Roadmap

Based on research, the evaluation system should be built in 3-4 phases with clear dependency ordering. The critical path is: Template → Season → Coach Ratings + Tryout Scoring (parallel) → Composite Calculation → Draft Integration.

### Phase 1: Evaluation Foundation (Template + Season + Data Model)

**Rationale:** Templates are the foundation — everything else references template structure. Season is a simple CRUD layer. The data model decisions (versioning, relational scores, Organization-scoping) must be correct from the start because they are expensive to migrate later. This phase establishes the evaluation data layer without building any scoring UIs yet.

**Delivers:**
- EvaluationTemplate model with versioned JSONField structure
- Season model linking templates to time periods
- StationScore and CoachRating models (relational, not flat Player fields)
- CompositeScore model with breakdown storage
- Backend API endpoints for template and season CRUD
- Admin UI for creating/editing templates and seasons
- Data model includes scorer attribution (scorer_id on every score record)
- Template version stored with every score for cross-season compatibility

**Addresses features:**
- TS-1: Admin-configurable evaluation templates (table stakes)
- Foundation for all other evaluation features

**Avoids pitfalls:**
- Pitfall 3: Template versioning (must be in data model from day one)
- Pitfall 4: Concurrent write conflicts (relational scores, not flat fields)

**Stack elements:**
- JSONField for template storage (follows existing pattern)
- Function-based Django views (matches existing backend)
- Zod schemas for template validation (TypeScript-native)

**Phase 1 research flag:** Standard CRUD with established patterns. Does not need deeper research.

---

### Phase 2: Coach Rating Submission

**Rationale:** Coach ratings are simpler than tryout scoring (no mobile/offline complexity, coaches use laptops/tablets, not time-pressured, fewer fields per player). Building coach ratings first validates the template system and establishes the score entry → normalization → storage pipeline before tackling mobile tryout scoring. Coach ratings also provide a baseline score for players who miss tryouts (reducing DNE impact).

**Delivers:**
- Coach rating form component (CoachRatingForm.tsx) rendered from template config
- Coach dashboard showing rating progress (submitted/pending per coach)
- Admin dashboard showing which coaches have completed ratings
- Score normalization logic for subjective scales (1-5 ratings)
- API endpoints for coach rating submission and status queries
- Draft/submit workflow (coaches can save in-progress ratings)

**Addresses features:**
- TS-8: End-of-season coach rating submission (table stakes, deferred from Phase 1)
- TS-2: Subjective score entry (1-5 scale ratings)
- Partial implementation of TS-6: Score normalization (coach ratings only)

**Uses stack:**
- react-hook-form for coach rating forms (first use case for RHF)
- Zod for rating validation (scale ranges, required fields)
- TanStack Query for rating submission with optimistic updates

**Implements architecture:**
- CoachRating model usage
- Service layer for rating aggregation (precursor to full composite calculation)

**Phase 2 research flag:** Standard form submission workflow. Does not need deeper research.

---

### Phase 3: Mobile Tryout Scoring (High Complexity)

**Rationale:** Tryout scoring is the highest-value and highest-risk feature. It requires mobile-first UX, offline queue management, bib lookup, group/rotation management, and concurrent multi-station handling. This phase cannot begin until the template system (Phase 1) is stable and score normalization (Phase 2) is proven. Building coach ratings first (Phase 2) de-risks the score entry pipeline before adding mobile and offline complexity.

**Delivers:**
- StationScoringView.tsx (mobile-first UI, one player at a time, large touch targets)
- Offline queue with localStorage (persist locally, sync when online)
- Bib number lookup UI (fast player identification)
- TryoutEvent and PlayerGroup models + setup UI (admin configures tryout day)
- Station assignment and rotation management
- Score entry for objective measures (times, counts) and subjective scales
- Sync status indicators (green/yellow/red) for scorers
- TryoutDashboard.tsx (admin progress monitoring — which stations have scored which groups)

**Addresses features:**
- TS-4: Mobile station scoring (table stakes, highest complexity)
- TS-5: Bib number player lookup (table stakes)
- TS-14: Group/rotation management (table stakes)
- TS-3: Objective score entry (times, counts)
- D-5: Tryout day progress dashboard (competitive advantage)
- D-11: Quick-score mode (UX optimization)

**Avoids pitfalls:**
- Pitfall 1: Offline data loss (offline-first architecture from the start)
- Pitfall 5: Desktop-first mobile UX (mobile-first design from the start)
- Pitfall 6: Mobile UX too painful for volunteers (large touch targets, high contrast, one-handed operation)

**Uses stack:**
- react-hook-form for station scoring forms (performance critical on mobile)
- TanStack Query for offline queue with retry logic (mutations with optimistic updates)
- localStorage for offline persistence (Phase 3a; migrate to IndexedDB in Phase 3b if needed)

**Implements architecture:**
- StationScore relational model (concurrent multi-station writes)
- useStationScoring hook with offline queue pattern
- TryoutEvent and PlayerGroup models

**Phase 3 research flag:** NEEDS DEEPER RESEARCH. Mobile offline patterns, PWA service worker trade-offs (defer or include?), iOS Safari compatibility for localStorage/IndexedDB persistence across app switches/device sleep, touch-optimized number input components. Consider `/gsd:research-phase` for offline architecture decisions.

---

### Phase 4: Composite Calculation & Bulk Entry

**Rationale:** Once both coach ratings (Phase 2) and tryout scores (Phase 3) are flowing, composite calculation can blend them. Bulk entry is built in parallel as the admin fallback for failed mobile scoring. Both features operate on the same StationScore model, so they can be developed concurrently.

**Delivers:**
- CompositeCalculator service (normalizes coach + tryout scores, applies blend weights)
- Admin UI for configuring blend weights (e.g., 40% coach, 60% tryout)
- Composite score calculation triggered by admin (not automatic per-score)
- CompositeScoreView.tsx showing blended results with breakdown
- StationScoringBulkEntry.tsx (spreadsheet-style grid for admin to transcribe from paper)
- Score normalization extended to handle multiple score types (scale, time, count)
- Handling of partial evaluations (players with only coach rating or only tryout scores)

**Addresses features:**
- TS-6: Composite score calculation (table stakes)
- TS-7: Admin-configurable blending weights (table stakes)
- TS-9: Score normalization across evaluators (table stakes)
- TS-10: Bulk score entry (table stakes, admin fallback)
- TS-11: Player evaluation history view (table stakes)
- TS-12: DNE handling (table stakes)
- D-6: Auto-recalculation on weight change (already proven in codebase with `recalculateWithWeights`)

**Avoids pitfalls:**
- Pitfall 5: DNE edge cases (distinguish missing-data reasons, don't silently treat as zero)

**Uses stack:**
- Service layer pattern (composite_calculator.py) following existing services_draft.py
- Existing score normalization utilities (`scoreNormalization.ts` ported to Python or used client-side)
- TanStack Query for composite recalculation (cache invalidation when weights change)

**Implements architecture:**
- CompositeCalculator service with @transaction.atomic
- CompositeScore model with breakdown storage
- Merge-at-read-time pattern for station scores

**Phase 4 research flag:** Standard aggregation logic. Needs unit testing (vitest) for score calculation algorithms. Does not need deeper research.

---

### Phase 5: Draft Integration & Admin Tools

**Rationale:** The final connection — composite scores feed into the existing draft system. Extends the existing DivisionCreator to pull from evaluation data instead of CSV import. Adds admin review and approval workflow (evaluation results must not auto-flow into draft without admin sign-off).

**Delivers:**
- Division creation "Import from Evaluations" option (alongside CSV/Excel)
- Composite score → Player model mapping (composite breakdown maps to existing score fields)
- Admin review UI for finalized evaluations before draft
- Score adjustment workflow (admin can override individual scores with audit trail)
- Evaluation progress reports (which players have incomplete data)
- Export options (evaluation results to CSV for external analysis)

**Addresses features:**
- TS-13: Evaluation data feeds draft (table stakes, closes the loop)
- D-9: Score confidence indicators (competitive advantage)

**Implements architecture:**
- Division.season FK linking divisions to evaluation seasons
- Extension of existing DivisionCreator.tsx import flow
- Transformer for CompositeScore → Player score fields

**Phase 5 research flag:** Standard integration with existing models. Does not need deeper research.

---

### Phase 6 (Future): Advanced Features

**Rationale:** Deferred features that require the full evaluation system to be operational and validated with real league usage. These are competitive advantages, not table stakes.

**Potential future features:**
- D-1: Cross-season coach rating persistence (requires player identity refactoring)
- D-2: Real-time score aggregation via WebSocket (requires Django Channels + Redis)
- D-3: Evaluator calibration / bias detection (requires sufficient multi-evaluator data)
- D-8: Template versioning UI (edit templates without losing historical data)
- D-10: Offline PWA with service workers (if online-first proves insufficient)

---

### Phase Ordering Rationale

**Why this dependency chain:**

1. **Template + Data Model (Phase 1) must come first.** Everything else references template structure. Data model decisions (versioning, relational scores, Organization-scoping) are expensive to change later. Template configuration can be developed and tested in isolation before any scoring UI exists.

2. **Coach Ratings (Phase 2) before Tryout Scoring (Phase 3).** Coach ratings are simpler (standard forms, desktop/tablet, not time-pressured, no offline complexity). Building coach ratings first validates the template system and establishes the score entry → normalization → storage pipeline before adding mobile and offline complexity. Coach ratings also provide a baseline for players who miss tryouts.

3. **Tryout Scoring (Phase 3) is highest risk.** Mobile-first UX, offline queue, bib lookup, concurrent multi-station writes, outdoor field conditions. This is the most complex phase and should not begin until Phases 1-2 are stable. Consider splitting into Phase 3a (online-only scoring) and Phase 3b (add offline queue) if scope is too large.

4. **Composite Calculation (Phase 4) requires both inputs.** Cannot blend coach ratings + tryout scores until both data sources exist. Bulk entry is built in Phase 4 as the admin fallback (developed in parallel with composite calculation since both operate on StationScore model).

5. **Draft Integration (Phase 5) is the terminal connection.** Extends existing division creation to pull from composite scores. This phase cannot deliver value until Phases 1-4 are complete, but it's also straightforward (standard model mapping, no new algorithms).

**How this avoids pitfalls:**

- **Pitfall 1 (Offline data loss):** Addressed in Phase 3 with offline-first design from the start.
- **Pitfall 2 (Inter-rater inconsistency):** Normalization strategy decided in Phase 2 (coach ratings) and extended in Phase 4 (composite calculation). Z-score option added when data shows need.
- **Pitfall 3 (Template versioning):** Baked into Phase 1 data model before any scores are entered.
- **Pitfall 4 (Concurrent write conflicts):** Prevented by Phase 1 data model (relational scores, not flat fields).
- **Pitfall 5 (Desktop-first mobile UX):** Phase 3 is mobile-first by design; no retrofit needed.
- **Pitfall 6 (Naive composite scoring):** Composite calculation in Phase 4 includes multiple normalization strategies (linear, z-score, percentile).
- **Pitfall 7 (DNE edge cases):** Phase 4 composite calculation handles partial evaluations with explicit missing-data reasons.

---

### Research Flags

**Phases needing deeper research during planning:**

- **Phase 3 (Mobile Tryout Scoring):** Offline-first architecture decisions need validation. Specific questions: (a) localStorage vs IndexedDB for offline queue persistence — does localStorage survive iOS Safari app switches and device sleep? (b) Service worker for app shell caching — is this needed in Phase 3a or defer to Phase 3b? (c) Conflict resolution strategy when same player/station scored by multiple devices. Consider `/gsd:research-phase` for these decisions before building Phase 3.

**Phases with standard patterns (skip deeper research):**

- **Phase 1 (Template + Data Model):** Standard Django CRUD with JSONField. Existing pattern in codebase (scoring_weights, age_breakdown).
- **Phase 2 (Coach Ratings):** Standard form submission. react-hook-form + Zod is well-documented.
- **Phase 4 (Composite Calculation):** Standard aggregation logic. Extend existing scoreNormalization.ts patterns. Needs unit tests (vitest) but not external research.
- **Phase 5 (Draft Integration):** Standard model mapping. Extends existing division creation flow.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Training data through May 2025. Version numbers need verification (`npm info <package> version`). WebSearch unavailable for latest releases. Core recommendations (react-hook-form, Zod, TanStack Query, vitest) are well-established, but exact versions are approximate. |
| Features | MEDIUM | Based on domain analysis of Little League tryout operations and existing codebase patterns. No live competitor product verification (WebSearch unavailable). Feature prioritization (table stakes vs competitive vs defer) is sound but should be validated with actual league admins. |
| Architecture | HIGH | Direct codebase analysis gives high confidence. All architectural patterns (JSONField templates, relational scores, service layer, hooks) follow established patterns in the existing code. Data model decisions are backed by specific pitfall avoidance rationale. |
| Pitfalls | MEDIUM | Pitfalls 1, 3, 4, 5 are high-confidence (based on codebase analysis + domain reasoning). Pitfalls 2, 6, 7 are medium-confidence (statistical fairness issues are well-known but need validation with real evaluation data to confirm severity). No external validation of pitfalls against real-world system failures (WebSearch unavailable). |

**Overall confidence:** MEDIUM-HIGH

The architecture and data model recommendations are high-confidence because they're grounded in direct codebase analysis. The stack recommendations are medium-confidence due to version uncertainty (training data cutoff). The feature prioritization and pitfall severity are medium-confidence because they're based on domain reasoning without external validation.

### Gaps to Address

**Gap 1: Mobile offline persistence across iOS Safari lifecycle events**

The research recommends localStorage for Phase 3a offline queue, but iOS Safari has complex behavior around app switches, device sleep, and background tab eviction. This needs validation:

- Does localStorage persist when Safari is backgrounded and iOS reclaims memory?
- Do online/offline events fire reliably on iOS?
- Is IndexedDB more reliable than localStorage on iOS?

**How to handle:** Prototype Phase 3a with localStorage and test on actual iOS devices in field conditions. If localStorage proves unreliable, migrate to IndexedDB in Phase 3b. Alternatively, conduct focused research on iOS Safari persistence behavior before Phase 3 kickoff using `/gsd:research-phase` with specific test cases.

**Gap 2: Z-score normalization necessity and timing**

The research flags naive composite scoring (Pitfall 6) as producing unfair rankings when distribution shapes differ across categories. Z-score normalization is recommended as the solution. However, the actual severity depends on real evaluation data:

- Do subjective scores actually cluster while objective scores spread in practice?
- How much do configured weights differ from actual ranking influence?
- Is this a Phase 4 requirement or a Phase 6 refinement?

**How to handle:** Implement linear normalization (existing `normalizeScore()` pattern) in Phase 4. After first real tryout, analyze score distributions and ranking influence. If configured weights deviate significantly from actual influence, add z-score normalization in Phase 4 follow-up sprint or defer to Phase 6 if impact is minor.

**Gap 3: Offline conflict resolution strategy**

When multiple devices enter scores for the same player/station (rare but possible — e.g., admin enters via bulk while scorer enters via mobile), the system needs conflict resolution. The research suggests "last-write-wins with timestamp" but doesn't specify the full user-facing workflow.

**How to handle:** Design the conflict resolution UI during Phase 3 detailed planning. Options: (a) simple last-write-wins with audit log, (b) admin review queue for conflicts, (c) merge strategies for multi-field stations. The choice depends on league admin feedback and conflict frequency in real use.

**Gap 4: Template versioning UI complexity**

The research mandates template versioning in the Phase 1 data model but doesn't specify how admins interact with versions. Questions:

- Can admins edit a template in-place (creates new version under the hood)?
- Do admins explicitly "publish" template versions?
- How do admins view historical scores under old template versions?

**How to handle:** Design the template versioning UX during Phase 1 detailed planning. Recommended approach: templates are immutable once used for a season; admins "copy and edit" to create new versions; old scores display with their original template context. This matches the existing draft pattern (drafts are immutable once started).

## Sources

### Primary (HIGH confidence)

**Existing codebase analysis:**
- `server/draft/models.py` — Data model patterns, JSONField usage, UUID PKs, multi-tenancy
- `server/draft/services_draft.py` — Service layer pattern with @transaction.atomic
- `server/draft/views/*.py` — Function-based view pattern with decorators
- `server/draft/transformers.py` — API response transformation (snake_case/camelCase)
- `src/types/evaluation.ts` — Existing evaluation type definitions
- `src/utils/evaluationProcessor.ts` — Score processing and aggregation patterns
- `src/utils/scoreNormalization.ts` — Normalization utilities (linear 0-100 mapping)
- `src/hooks/useDivisions.ts` — Hook pattern for CRUD + state management
- `src/api/client.ts` — API client patterns, request/response transforms
- `.planning/PROJECT.md` — Project requirements and constraints
- `.planning/codebase/ARCHITECTURE.md` — Existing architecture documentation

**Direct observation:** All architectural recommendations (JSONField templates, relational scores, service layer, hooks) are based on patterns already present in the codebase. This is the highest confidence area of the research.

### Secondary (MEDIUM confidence)

**Stack library capabilities:**
- react-hook-form official docs (https://react-hook-form.com/) — Performance characteristics, uncontrolled component approach
- TanStack Query official docs (https://tanstack.com/query/latest) — Offline queue patterns, mutation with retry
- Zod official docs (https://zod.dev/) — Schema validation, TypeScript inference
- Vitest official docs (https://vitest.dev/) — Vite integration, test patterns

**Domain knowledge:**
- Little League tryout logistics (outdoor fields, volunteer scorers, bib numbers, station rotation)
- Youth sports evaluation fairness (inter-rater reliability, scale calibration, DNE handling)
- Mobile-first UX constraints (sunlight glare, one-handed operation, touch targets)
- Psychometric composite scoring principles (z-score normalization, distribution matching)

**Caveat:** Domain knowledge is based on training data (through May 2025) and structured reasoning about field conditions. No direct validation with Little League administrators or field observation of actual tryout day operations. Feature prioritization should be validated with real users.

### Tertiary (LOW confidence — needs validation)

**Competitor landscape:**
- Generic sports evaluation apps (iScore, GameChanger, Sports Evaluations) exist but feature sets unverified (WebSearch unavailable)
- Assumption that paper + Excel is the primary competitor (based on project context, not validated with market research)

**Version numbers:**
- All npm package versions (react-hook-form ^7.51+, TanStack Query ^5.56+, Zod ^3.23+, vitest ^2.0+) are approximate based on May 2025 training data cutoff
- Recommendation: Run `npm info <package> version` to verify latest stable releases before installation

**iOS Safari offline behavior:**
- localStorage persistence across app switches/device sleep is assumed to be problematic based on general iOS Safari behavior, but specific testing is needed
- Recommendation: Prototype and test on actual iOS devices before committing to localStorage vs IndexedDB decision

---

*Research completed: 2026-01-29*
*Ready for roadmap: yes*
