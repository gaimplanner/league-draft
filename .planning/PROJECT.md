# Little League Draft — Evaluation System

## What This Is

A structured evaluation system for Little League baseball that replaces spreadsheet-based player scoring with an in-app workflow. League admins configure evaluation templates, coaches submit end-of-season player ratings, volunteers score players at tryout-day stations via mobile browser or bulk entry, and the system produces a weighted composite score that feeds directly into the existing draft flow — with admin review and approval before scores enter draft configuration.

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
- ✓ League admins can configure evaluation templates (stations, categories, scoring scales) — v1
- ✓ Evaluation templates support both tryout stations (objective: times, counts) and coach review categories (subjective: 1-5 ratings) — v1
- ✓ Coach review categories include physical skills plus soft skills (baseball IQ, hustle, coachability) — v1
- ✓ Templates are versioned so historical scores remain valid — v1
- ✓ Templates scoped to league/organization — v1
- ✓ Coaches can submit end-of-season ratings for players on their roster — v1
- ✓ Coach rating form uses template categories with draft/submit workflow — v1
- ✓ Admin can view coach rating submission progress — v1
- ✓ Volunteers can score players at tryout stations via mobile browser in real-time — v1
- ✓ Mobile-first scoring UI with bib numpad lookup, auto-advance, 48px+ touch targets — v1
- ✓ Admin can bulk-enter station scores from paper sheets via spreadsheet grid — v1
- ✓ Players organized into groups with station rotation management — v1
- ✓ Tryout progress dashboard with player-level drill-down — v1
- ✓ Scorer identity tracked for accountability — v1
- ✓ Weighted composite scoring blending coach ratings and tryout evaluations — v1
- ✓ Admin-configurable blend weights with live preview — v1
- ✓ Score normalization across different types (scales, times, counts) — v1
- ✓ DNE handling: coach-rating-only scoring for missed tryouts — v1
- ✓ Player evaluation history visible (coach rating + tryout + composite breakdown) — v1
- ✓ Composite scores feed into draft flow as primary scoring source — v1
- ✓ Existing CSV/Excel import unchanged as alternative — v1
- ✓ Admin review and approval before evaluation scores enter draft — v1

### Active

(None — define for next milestone via `/gsd:new-milestone`)

### Out of Scope

- Anonymous/unauthenticated volunteer scoring — all scorers need accounts for data integrity
- Real-time leaderboard during tryouts — creates pressure, parent complaints
- Parent/player-facing evaluation portal — opens door to disputes
- Video capture at stations — storage/bandwidth, legal issues with minors
- Automated pitch speed detection — hardware integration too fragile
- Native mobile app — phone browser with mobile-first UX is sufficient
- Free-text comments per player — unsearchable, unweightable, legal risk
- Multi-evaluator consensus scoring — most leagues don't have enough volunteers
- Offline mode — real-time is sufficient for tryout day (venue has connectivity)

## Context

Shipped v1 Evaluation System with ~7,600 LOC TypeScript + Python across 42 code files.
Tech stack: React/TypeScript frontend, Django/PostgreSQL backend.
Frontend: react-hook-form + Zod v4 for form validation, react-datasheet-grid for bulk entry.
Evaluation models are Organization-scoped (not Division-scoped) since players are evaluated before division assignment.
Three-tier composite classification (full-data, coach-only, tryout-only) prevents unfair comparisons.

Known tech debt: SeasonPlayerImport uses hardcoded 50/50 blend weights instead of reading template defaults.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Configurable evaluation templates per league | Different leagues evaluate differently; one fixed structure won't work | ✓ Good |
| Coach + admin accounts required for scoring | Simpler auth model, data integrity; volunteers coached through by admins | ✓ Good |
| Weighted blend controlled by league admin | Different divisions/leagues may weight coach ratings vs tryouts differently | ✓ Good |
| Mobile-first station scoring with bulk entry fallback | Ideal is real-time mobile entry, but paper-then-bulk-entry must remain viable | ✓ Good |
| Organization-scoped evaluation models | Players are evaluated before division assignment | ✓ Good |
| JSONField for template definitions | Flexible schema, matches existing codebase patterns | ✓ Good |
| Copy-on-write template versioning | Cannot retrofit later; built from Phase 1 | ✓ Good |
| Name-based player identity in CoachRating | Ratings happen pre-draft before Player records exist | ✓ Good |
| Relational score records per station | Avoids concurrent write conflicts on flat Player fields | ✓ Good |
| Three-tier composite classification | Fair comparisons between full-data, coach-only, tryout-only players | ✓ Good |
| Percentile-based outlier exclusion for normalization | Prevents single outlier from compressing score distribution | ✓ Good |
| Flat ranking across tiers for draft import | Single sequence simplifies draft integration | ✓ Good |
| Upsert pattern for station scores | Prevents duplicate errors from mobile UI retries | ✓ Good |

## Constraints

- **Tech stack**: React/TypeScript frontend, Django/PostgreSQL backend — must use existing stack
- **Auth model**: Coaches and admins must have accounts; no anonymous/public scoring links
- **Mobile UX**: Tryout-day station scoring must work well on phone browsers (not a native app)
- **Backwards compatibility**: Existing CSV/Excel import must continue to work alongside evaluation system
- **Multi-tenancy**: Evaluation templates and data are scoped to leagues (organizations)

---
*Last updated: 2026-01-30 after v1 milestone*
