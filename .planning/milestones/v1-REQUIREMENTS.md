# Requirements Archive: v1 Evaluation System

**Archived:** 2026-01-30
**Status:** SHIPPED

This is the archived requirements specification for v1.
For current requirements, see `.planning/REQUIREMENTS.md` (created for next milestone).

---

# Requirements: Little League Draft — Evaluation System

**Defined:** 2026-01-29
**Core Value:** Every player has a fair, data-driven composite score at draft time — whether they attended tryouts or not — built from configurable evaluations that persist across seasons.

## v1 Requirements

### Evaluation Templates

- [x] **TMPL-01**: League admin can create evaluation templates with configurable stations, categories, and scoring scales — validated v1
- [x] **TMPL-02**: Templates support subjective score entry (1-5 rating scales with descriptive anchors per level) — validated v1
- [x] **TMPL-03**: Templates support objective score entry (times, counts) with appropriate input validation — validated v1
- [x] **TMPL-04**: Templates are versioned so historical scores remain valid when the template is modified — validated v1
- [x] **TMPL-05**: Templates are scoped to the league/organization (each league configures independently) — validated v1
- [x] **TMPL-06**: Template categories include both tryout station types (infield, base running, fly balls, pitching, hitting) and coach review types (physical skills + soft skills) — validated v1

### Coach Ratings

- [x] **COACH-01**: Coaches can submit end-of-season ratings for players on their roster — validated v1
- [x] **COACH-02**: Coach rating form uses the league's configured evaluation template categories — validated v1
- [x] **COACH-03**: Coach ratings include soft-skill categories (baseball IQ, hustle, coachability) alongside physical skill ratings — validated v1
- [x] **COACH-04**: Admin can view coach rating submission progress (which coaches have submitted, which are pending) — validated v1

### Tryout Day Scoring

- [x] **TRYOUT-01**: Volunteers can score players at tryout stations via mobile browser in real-time — validated v1
- [x] **TRYOUT-02**: Station scoring UI is mobile-first (large touch targets, one player at a time, numeric input optimized for phone) — validated v1
- [x] **TRYOUT-03**: Players are identified by bib number with fast lookup (numpad entry) — validated v1
- [x] **TRYOUT-04**: Admin can bulk-enter station scores from paper sheets as a fallback — validated v1
- [x] **TRYOUT-05**: Players are organized into groups (15-20) that rotate through stations — validated v1
- [x] **TRYOUT-06**: Admin can view tryout progress (which groups have completed which stations, who is missing scores) — validated v1
- [x] **TRYOUT-07**: Each score record captures the scorer identity for accountability — validated v1

### Composite Scoring

- [x] **COMP-01**: System calculates a weighted composite score blending coach ratings and tryout evaluations — validated v1
- [x] **COMP-02**: League admin configures blending weights (how much coach rating vs tryout score contributes) — validated v1
- [x] **COMP-03**: Score normalization converts different score types (1-5 scales, times, counts) to comparable values — validated v1
- [x] **COMP-04**: Players who miss tryouts still receive a score based on coach rating alone (DNE handling) — validated v1
- [x] **COMP-05**: Admin can view player evaluation history (coach rating baseline, tryout scores, composite breakdown) — validated v1

### Draft Integration

- [x] **DRAFT-01**: Composite scores feed into the existing draft flow as the primary scoring source — validated v1
- [x] **DRAFT-02**: Existing CSV/Excel import continues to work as a secondary/alternative import path — validated v1
- [x] **DRAFT-03**: Admin reviews and approves evaluation-based rankings before they flow into draft configuration — validated v1

## v2 Requirements (Not Started)

### Cross-Season Persistence

- **SEASON-01**: End-of-season ratings persist at the player/league level across seasons
- **SEASON-02**: Returning players start the next season with their coach rating as a baseline
- **SEASON-03**: Composite score shows growth (delta between prior season rating and current tryout score)

### Advanced Scoring

- **ADV-01**: Score confidence indicators on draft board (Full eval / Coach only / Tryout only / DNE)
- **ADV-02**: Auto-recalculation of rankings when admin adjusts blending weights
- **ADV-03**: Per-division blending weight configuration (younger divisions may weight coach ratings more)
- **ADV-04**: Z-score or percentile normalization option (alongside linear) for statistical fairness

### Tryout Day Enhancements

- **TRYOUT-V2-01**: Quick-score mode for high-volume stations (one player card at a time, auto-advance)
- **TRYOUT-V2-02**: Offline-capable station scoring (scores sync when connectivity returns)
- **TRYOUT-V2-03**: Evaluator calibration/bias detection across scorers

## Out of Scope

| Feature | Reason |
|---------|--------|
| Anonymous/unauthenticated volunteer scoring | All scorers need accounts for data integrity and accountability |
| Real-time leaderboard during tryouts | Creates pressure, parent complaints, disputes; scores are admin-only during evaluation |
| Parent/player-facing evaluation portal | Opens door to disputes about scores; evaluations are admin/coach-facing only |
| Video capture at stations | Massive storage/bandwidth, legal issues with minors, slows station flow |
| Automated pitch speed detection | Hardware integration is fragile and varies by device; manual velocity entry instead |
| Native mobile app | Phone browser with mobile-first UX is sufficient; no app store deployment needed |
| Free-text comments per player | Unsearchable, unweightable, legal risk; use structured categories for intangibles instead |
| Multi-evaluator consensus scoring | Most leagues don't have enough volunteers; defer until demand proves need |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TMPL-01 | Phase 1 | Complete |
| TMPL-02 | Phase 1 | Complete |
| TMPL-03 | Phase 1 | Complete |
| TMPL-04 | Phase 1 | Complete |
| TMPL-05 | Phase 1 | Complete |
| TMPL-06 | Phase 1 | Complete |
| COACH-01 | Phase 2 | Complete |
| COACH-02 | Phase 2 | Complete |
| COACH-03 | Phase 2 | Complete |
| COACH-04 | Phase 2 | Complete |
| TRYOUT-01 | Phase 3 | Complete |
| TRYOUT-02 | Phase 3 | Complete |
| TRYOUT-03 | Phase 3 | Complete |
| TRYOUT-04 | Phase 3 | Complete |
| TRYOUT-05 | Phase 3 | Complete |
| TRYOUT-06 | Phase 3 | Complete |
| TRYOUT-07 | Phase 3 | Complete |
| COMP-01 | Phase 4 | Complete |
| COMP-02 | Phase 4 | Complete |
| COMP-03 | Phase 4 | Complete |
| COMP-04 | Phase 4 | Complete |
| COMP-05 | Phase 4 | Complete |
| DRAFT-01 | Phase 5 | Complete |
| DRAFT-02 | Phase 5 | Complete |
| DRAFT-03 | Phase 5 | Complete |

**Coverage:**
- v1 requirements: 25 total
- Shipped: 25
- Unmapped: 0

---

## Milestone Summary

**Shipped:** 25 of 25 v1 requirements
**Adjusted:** None — all requirements shipped as originally specified
**Dropped:** None

---
*Archived: 2026-01-30 as part of v1 milestone completion*
