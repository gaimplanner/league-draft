# Little League Draft — Evaluation System

## What This Is

A structured evaluation system for Little League baseball that replaces spreadsheet-based player scoring with an in-app workflow. League admins configure evaluation templates, coaches submit end-of-season player ratings, volunteers score players at tryout-day stations (via mobile or bulk entry), and the system produces a weighted composite score that feeds directly into the existing draft flow.

## Core Value

Every player has a fair, data-driven composite score at draft time — whether they attended tryouts or not — built from configurable evaluations that persist across seasons.

## Requirements

### Validated

- ✓ CSV/Excel/Dual CSV player import with column mapping — existing
- ✓ Player scoring with weighted subtotals and total score — existing
- ✓ Draft execution with mandatory pick rules (coach kids, siblings) — existing
- ✓ Draft simulation using same logic as real draft — existing
- ✓ Multi-tenant league/organization architecture — existing
- ✓ Session-based auth with role-based league membership (admin/member) — existing
- ✓ Team Builder for league-generated divisions — existing
- ✓ Score normalization and weighted aggregation — existing

### Active

- [ ] League admins can configure evaluation templates (stations, categories, scoring scales)
- [ ] Evaluation templates support both tryout stations (objective: times, counts) and coach review categories (subjective: 1-5 ratings)
- [ ] Coach review categories include physical skills (fielding, hitting, running, pitching) plus soft skills (baseball IQ, hustle, coachability)
- [ ] Coaches can submit end-of-season ratings for players on their roster
- [ ] End-of-season ratings persist at the player/league level across seasons
- [ ] Tryout-day evaluations: volunteers can score players at stations via mobile device in real-time
- [ ] Tryout-day evaluations: admins can bulk-enter station scores as a fallback
- [ ] Players are organized into groups (15-20) that rotate through stations
- [ ] Tryout stations: Infield (3 ground balls), Base Running (timed 2x120ft), Fly Balls (3 catches), Pitching (3 pitches — velocity, accuracy, form), Hitting (5 pitches from machine)
- [ ] League admins configure blending weights (how much coach rating vs tryout score contributes to composite)
- [ ] Composite score is a weighted blend of end-of-season coach rating + tryout evaluation
- [ ] Players who miss tryouts still have a score based on their coach rating alone
- [ ] Composite scores feed into the existing draft flow (replacing/supplementing CSV import path)
- [ ] Player evaluation history visible (coach rating baseline, tryout scores, composite)

### Out of Scope

- Anonymous/unauthenticated volunteer scoring via public link — all scorers need accounts (coaches + admins only)
- Real-time live leaderboard during tryouts — scores are entered, not displayed competitively
- Video capture or replay at stations — evaluations are numeric scores only
- Parent/player-facing evaluation portal — evaluations are admin/coach-facing only
- Automated pitch speed detection — velocity is manually entered by the scorer

## Context

- Existing app has a mature import pipeline (CSV, Excel, Dual CSV) that produces scored players for the draft. The evaluation system provides a structured alternative to that import path.
- Current pain point: evaluations happen on paper at tryout day, then a volunteer manually transcribes into a spreadsheet, which is then imported. Errors accumulate at each handoff.
- End-of-season coach ratings have been attempted via multi-tab spreadsheets sent to coaches, but there's no way to reincorporate that data into the next season. Ratings effectively get lost.
- The app already has score normalization (`scoreNormalization.ts`) and weighted aggregation (`scoreCalculation.ts`) — the composite blending can build on these patterns.
- Players already have component scores and a total score. The evaluation system needs to feed into this same structure.
- Bib numbers are assigned at registration and used to identify players at tryout stations.

## Constraints

- **Tech stack**: React/TypeScript frontend, Django/PostgreSQL backend — must use existing stack
- **Auth model**: Coaches and admins must have accounts; no anonymous/public scoring links
- **Mobile UX**: Tryout-day station scoring must work well on phone browsers (not a native app)
- **Backwards compatibility**: Existing CSV/Excel import must continue to work alongside the new evaluation system
- **Multi-tenancy**: Evaluation templates and data are scoped to leagues (organizations)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Configurable evaluation templates per league | Different leagues evaluate differently; one fixed structure won't work | — Pending |
| Coach + admin accounts required for scoring | Simpler auth model, data integrity; volunteers at stations are coached through by admins | — Pending |
| Weighted blend controlled by league admin | Different divisions/leagues may weight coach ratings vs tryouts differently | — Pending |
| Mobile-first station scoring with bulk entry fallback | Ideal is real-time mobile entry, but paper-then-bulk-entry must remain viable | — Pending |
| End-of-season ratings persist at player/league level | Enables cross-season continuity; coach rating becomes baseline for next year | — Pending |

---
*Last updated: 2026-01-29 after initialization*
