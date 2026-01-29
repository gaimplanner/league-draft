# Feature Research: Youth Sports Evaluation System

**Domain:** Youth baseball evaluation and tryout management
**Researched:** 2026-01-29
**Confidence:** MEDIUM (domain analysis + codebase inspection; no live competitor product verification due to tool unavailability)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or league admins fall back to spreadsheets.

| # | Feature | Why Expected | Complexity | Notes |
|---|---------|--------------|------------|-------|
| TS-1 | **Admin-configurable evaluation templates** | Every league evaluates differently. Fixed categories guarantee mismatch. | HIGH | Template defines stations, scoring scales, weight per category. Must support both tryout stations and coach review categories. League-scoped. |
| TS-2 | **Subjective score entry (1-5 scale ratings)** | Coach ratings and volunteer form assessments are the primary input type. Standard in every paper-based eval sheet. | LOW | Already partially exists in codebase (`scoreType: 'scale'`). Need structured entry UI. |
| TS-3 | **Objective score entry (times, counts)** | Base running times, catch counts, hit counts are factual and must be captured differently than subjective scores. | LOW | Already modeled (`scoreType: 'time'`, `scoreType: 'count'`). Need input validation (e.g., reasonable time ranges). |
| TS-4 | **Tryout-day station scoring via mobile browser** | Volunteers score at outdoor stations with phones. If the mobile UX is bad, they go back to paper clipboards. | HIGH | Not a native app. Must work on phone browsers in outdoor light. Large touch targets, minimal scrolling, fast player lookup by bib number. This is the make-or-break feature. |
| TS-5 | **Player identification by bib number** | Players wear bib numbers at tryouts. Scoring must be fast: enter bib, score, next. | LOW | Bib numbers already exist in the data model. Need fast bib lookup UX (type-ahead or numpad entry). |
| TS-6 | **Composite score calculation (weighted blend)** | The whole point: combine multiple evaluation sources into one score for the draft. | MEDIUM | Existing `scoreNormalization.ts` and `evaluationProcessor.ts` provide the pattern. Need to extend for blending coach ratings + tryout scores with configurable weights. |
| TS-7 | **Admin-configurable blending weights** | Different leagues weight coach opinions vs tryout performance differently. Majors may emphasize tryouts; younger divisions may trust coach ratings more. | LOW | UI for sliders/percentages. Similar pattern to existing `FieldWeightSliders.tsx`. Backend stores per-division weights. |
| TS-8 | **End-of-season coach rating submission** | Coaches rate players they coached. This is the "baseline" score. Without it, players who miss tryouts have no score at all. | MEDIUM | New workflow: coach sees their roster, rates each player on configured categories. Must be simple enough that coaches actually complete it (target: 5-10 min for 12 players). |
| TS-9 | **Score normalization across evaluators** | Different volunteers score differently (one gives 3s, another gives 5s for equivalent performance). Raw scores are not comparable without normalization. | MEDIUM | Existing `normalizeScore()` handles scale/count/time normalization. Cross-evaluator calibration is the harder problem (see Differentiators). |
| TS-10 | **Bulk score entry (admin fallback)** | When mobile scoring fails (rain, dead battery, volunteer confusion), admins transcribe from paper. This is today's workflow and must remain viable. | MEDIUM | Spreadsheet-style grid: rows = players, columns = score categories. Copy-paste from external spreadsheet should work. |
| TS-11 | **Player evaluation history view** | Admin/coach must see: coach rating, tryout scores, composite. "How did we get this number?" | LOW | Read-only view per player showing component breakdown. Existing `PlayerDetailModal.tsx` pattern. |
| TS-12 | **DNE (Did Not Evaluate) handling** | Players who miss tryouts need a score path. With coach ratings, they still have a baseline. Without either, they are DNE. | LOW | Already exists in codebase (`isDNE` flag). Extend to handle partial evaluation (coach rating only, tryout only, both, neither). |
| TS-13 | **Evaluation data feeds draft** | Composite scores must flow into the existing draft system, replacing or supplementing the CSV import path. | MEDIUM | Existing `convertToPlayers()` converts evaluation data to Player format. Need a new pathway that reads from persisted evaluations instead of file import. |
| TS-14 | **Group/rotation management for tryout day** | Players organized into groups of 15-20 that rotate through stations. Evaluators need to know which group is at their station. | MEDIUM | New model: groups assigned to rotation slots. UI shows evaluator "your current group" with player list. |

### Differentiators (Competitive Advantage)

Features that set this product apart from paper/spreadsheet-based approaches and basic competitor tools. Not required day one, but create significant value.

| # | Feature | Value Proposition | Complexity | Notes |
|---|---------|-------------------|------------|-------|
| D-1 | **Cross-season coach rating persistence** | Coach ratings persist at the player/league level, carrying forward as a baseline for next season. Leagues no longer "lose" last year's evaluations. | MEDIUM | Requires player identity to persist across seasons (not just within a single import). Player becomes a league-level entity, not just a division/season entity. |
| D-2 | **Real-time score aggregation during tryouts** | Admin sees composite scores updating live as stations submit scores. No waiting for spreadsheet merging. | MEDIUM | WebSocket or polling for live updates. Admin dashboard shows scored/unscored counts per station, flagging incomplete evaluations before tryout day ends. |
| D-3 | **Evaluator calibration / bias detection** | Flag evaluators who consistently score higher or lower than peers on the same players. "Evaluator A averages 4.2, everyone else averages 3.1." | HIGH | Requires multiple evaluators scoring same players (not always the case at stations). Statistical analysis: z-score adjustment per evaluator. Valuable but complex. |
| D-4 | **Configurable soft-skill categories** | Coach reviews include intangibles: baseball IQ, hustle, coachability, attitude. These are the categories paper forms always include but spreadsheets lose. | LOW | Just more categories in the template. The value is in making them first-class, weighted, and persistent. |
| D-5 | **Tryout day progress dashboard** | Admin sees: "Station 3 has scored 42/80 players. Group C has not been scored at Pitching. 12 players have incomplete evaluations." | MEDIUM | Aggregation queries. Critical for tryout day logistics — admin needs to know what's missing BEFORE everyone goes home. |
| D-6 | **Automatic composite recalculation on weight change** | Admin adjusts blending weights (70/30 coach/tryout -> 50/50) and sees rank changes instantly. Existing pattern in `recalculateWithWeights()`. | LOW | Already proven in the codebase. Extend to blending weights. |
| D-7 | **Multi-evaluator per station (consensus scoring)** | Two volunteers score the same station; system averages or flags disagreements. Reduces individual bias. | HIGH | Doubles data entry. Most leagues won't have enough volunteers. Better as optional feature. |
| D-8 | **Evaluation template versioning** | Templates can be updated between seasons without losing historical data. "2025 template had 5 stations, 2026 has 6." | MEDIUM | Template versions linked to evaluations. Historical scores remain valid even if template changes. |
| D-9 | **Score confidence indicators** | Visual indicator of how much data backs a player's composite: "Full eval" (coach + tryout), "Coach only", "Tryout only", "DNE". | LOW | Metadata flag on composite score. Helps draft board show data quality alongside rankings. |
| D-10 | **Offline-capable station scoring** | Evaluators can score even with poor cell signal (common at outdoor fields). Scores sync when connectivity returns. | HIGH | Service worker + IndexedDB for offline queue. Complex to build right (conflict resolution). Major differentiator for field conditions. |
| D-11 | **Quick-score mode for high-volume stations** | Evaluator sees one player at a time, enters scores, taps "Next". Optimized for speed when 80+ players rotate through. | LOW | UX pattern: single-player card with score inputs and forward/back navigation. Bib auto-advance. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems in the youth sports evaluation domain.

| # | Feature | Why Requested | Why Problematic | Alternative |
|---|---------|---------------|-----------------|-------------|
| AF-1 | **Real-time leaderboard during tryouts** | "Let's see who's winning!" | Creates pressure, parent complaints, disputes during tryout. Scores should not be visible until admin finalizes. Youth sports is developmental, not competitive rankings during eval. | Admin-only progress dashboard (D-5). Scores visible only to admins, never to parents/players during tryout. |
| AF-2 | **Parent/player-facing evaluation portal** | "Parents want to see their kid's scores." | Opens door to disputes, complaints, "why did evaluator X give my kid a 2?" Politicizes evaluation. Creates pressure on evaluators. | Share final team assignments only. Evaluation details stay admin/coach-facing per PROJECT.md scope. |
| AF-3 | **Video capture at stations** | "Record the tryout for review later." | Massive storage/bandwidth requirements. Legal issues with recording minors. Slows down station flow. Evaluators watch video instead of live performance. | Numeric scores only. If league wants video, they handle it outside the app. |
| AF-4 | **Automated pitch speed detection (radar integration)** | "We have a radar gun, feed it in automatically." | Hardware integration is fragile, varies by device, requires Bluetooth/USB. Scope explosion. | Manual velocity entry field. Evaluator reads radar gun and types the number. |
| AF-5 | **Anonymous/unauthenticated volunteer scoring** | "Volunteers don't want to create accounts." | No accountability for scores. Can't trace bad data. Can't do evaluator calibration. Opens abuse vector. | All scorers need accounts per PROJECT.md constraint. Keep registration lightweight (email + name). |
| AF-6 | **Overly granular scoring scales (1-10 or 1-100)** | "More granularity = more precision." | Volunteers at outdoor stations with clipboards cannot meaningfully distinguish a 6 from a 7. False precision creates noise. Inter-rater reliability drops as scale granularity increases. | Use 1-5 scale for subjective scores. Use objective measures (time, count) where precision matters. Research supports 5-point scales for field reliability. |
| AF-7 | **Complex weighting UIs with per-evaluator weights** | "Weight the head coach's opinion more than the assistant." | Adds political complexity. Who decides whose opinion counts more? Creates interpersonal friction. | Weight by evaluation TYPE (coach rating vs tryout), not by individual evaluator. All evaluators of the same type are weighted equally. |
| AF-8 | **Automated team balancing from evaluation scores** | "Just auto-assign teams based on scores." | Already exists as Team Builder feature. Don't duplicate in the evaluation system. Evaluation produces scores; draft/team-builder consumes them. Separation of concerns. | Evaluation system outputs composite scores. Draft system and Team Builder consume them independently. |
| AF-9 | **Free-text comments per player** | "Let coaches write notes." | Text is unsearchable, unweightable, and creates legal/HR risk ("this kid has a bad attitude"). Hard to incorporate into composite scoring. | Structured categories for intangibles (baseball IQ = 1-5, hustle = 1-5). Converts opinion to data. If notes are needed, keep them admin-only and non-scorable. |
| AF-10 | **Skill-specific drill recommendations** | "Based on scores, suggest practice drills." | Out of scope. This is an evaluation tool, not a coaching platform. Scope creep into a different product category. | Focus on accurate scoring and fair draft outcomes. Coaching tools are a separate product. |

## Feature Dependencies

```
[TS-1] Evaluation Templates
    |
    +--requires--> [TS-2] Subjective Score Entry
    +--requires--> [TS-3] Objective Score Entry
    +--enables---> [TS-8] Coach Rating Submission (needs template to define categories)
    +--enables---> [TS-4] Mobile Station Scoring (needs template to define stations)
    +--enables---> [TS-14] Group/Rotation Management (needs template to define stations)

[TS-8] Coach Rating Submission
    +--enables---> [D-1] Cross-Season Persistence (ratings need somewhere to live)
    +--feeds-----> [TS-6] Composite Score Calculation

[TS-4] Mobile Station Scoring
    +--requires--> [TS-5] Bib Number Lookup
    +--enhanced--> [D-10] Offline Capability (overlay on mobile scoring)
    +--enhanced--> [D-11] Quick-Score Mode (UX optimization)
    +--feeds-----> [TS-6] Composite Score Calculation

[TS-6] Composite Score Calculation
    +--requires--> [TS-7] Blending Weights Configuration
    +--requires--> [TS-9] Score Normalization
    +--enhanced--> [D-6] Auto-Recalculation on Weight Change
    +--enhanced--> [D-9] Score Confidence Indicators
    +--feeds-----> [TS-13] Evaluation Data Feeds Draft

[TS-10] Bulk Score Entry
    +--independent (fallback path, parallel to mobile scoring)
    +--feeds-----> [TS-6] Composite Score Calculation

[TS-14] Group/Rotation Management
    +--enhanced--> [D-5] Tryout Day Progress Dashboard
    +--enhanced--> [D-2] Real-Time Score Aggregation

[D-3] Evaluator Calibration
    +--requires--> [D-7] Multi-Evaluator per Station (needs overlap data)
    +--OR-------> Sufficient sample size from single evaluator across many players
```

### Dependency Notes

- **TS-1 (Templates) is the foundation.** Nearly everything else depends on having configurable evaluation templates. Build this first.
- **TS-8 (Coach Ratings) and TS-4 (Mobile Scoring) are parallel tracks** that both feed into TS-6 (Composite). They can be built independently.
- **TS-10 (Bulk Entry) is the safety net.** Must exist even if mobile scoring is perfect, because some leagues will always have a paper fallback need.
- **D-10 (Offline) enhances D-4 (Mobile)** but is not required for launch. Mobile scoring can work online-only initially.
- **D-3 (Evaluator Calibration) requires D-7 (Multi-Evaluator)** to work well, since you need overlapping data to detect bias. However, basic z-score detection is possible with single evaluators scoring many players.
- **TS-13 (Feeds Draft) is the terminal dependency.** Everything flows toward getting composite scores into the draft. If this link doesn't work, the evaluation system is an island.

## MVP Definition

### Launch With (v1)

Minimum viable evaluation system -- what's needed to replace the spreadsheet workflow for one tryout season.

- [ ] **TS-1: Evaluation templates** -- Foundation for everything. Admin creates template with stations and scoring scales.
- [ ] **TS-2 + TS-3: Score entry (subjective + objective)** -- Core data capture, both types.
- [ ] **TS-5: Bib number player lookup** -- Fast identification at stations.
- [ ] **TS-4: Mobile station scoring** -- Replace paper clipboards. The primary value proposition.
- [ ] **TS-10: Bulk score entry** -- Fallback when mobile fails. Non-negotiable for adoption.
- [ ] **TS-9: Score normalization** -- Already exists, extend to new evaluation data.
- [ ] **TS-6 + TS-7: Composite score with configurable weights** -- Combine sources into draft-ready scores.
- [ ] **TS-13: Feed scores to draft** -- Close the loop. Without this, evaluation is disconnected.
- [ ] **TS-12: DNE handling** -- Players without evaluations must be handled gracefully.
- [ ] **TS-11: Player evaluation history view** -- "Show your work" -- admins need to see component scores.

### Add After Validation (v1.x)

Features to add once the core evaluation flow is proven with real league usage.

- [ ] **TS-8: End-of-season coach rating submission** -- Add once template system is stable. Introduces coach-facing UX (new user type interaction).
- [ ] **TS-14: Group/rotation management** -- Add once tryout-day scoring is validated. Groups are logistics, not scoring.
- [ ] **D-1: Cross-season persistence** -- Add once coach ratings exist. Requires player identity refactoring.
- [ ] **D-5: Tryout day progress dashboard** -- Add once station scoring data flows. "What's missing?" view.
- [ ] **D-9: Score confidence indicators** -- Add once multiple evaluation sources exist. "Full eval" vs "coach only" vs "tryout only".
- [ ] **D-4: Soft-skill categories** -- Add to template system. Low cost once templates are configurable.
- [ ] **D-6: Auto-recalculation on weight change** -- Already proven pattern in codebase. Low risk.
- [ ] **D-11: Quick-score mode** -- UX refinement for high-volume stations.

### Future Consideration (v2+)

Features to defer until evaluation system is established and league adoption is proven.

- [ ] **D-2: Real-time score aggregation** -- WebSocket complexity. Polling is fine for v1.
- [ ] **D-3: Evaluator calibration** -- Requires sufficient data and statistical sophistication. Most leagues won't need it initially.
- [ ] **D-7: Multi-evaluator consensus** -- Most leagues don't have enough volunteers. Defer until demand proves.
- [ ] **D-8: Template versioning** -- Not needed until the second season. Build when leagues want to change templates.
- [ ] **D-10: Offline-capable scoring** -- Service worker complexity. Defer until online-only proves insufficient at actual tryout fields.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Phase |
|---------|------------|---------------------|----------|-------|
| TS-1: Evaluation templates | HIGH | HIGH | P1 | v1 |
| TS-2: Subjective score entry | HIGH | LOW | P1 | v1 |
| TS-3: Objective score entry | HIGH | LOW | P1 | v1 |
| TS-4: Mobile station scoring | HIGH | HIGH | P1 | v1 |
| TS-5: Bib number lookup | HIGH | LOW | P1 | v1 |
| TS-6: Composite score calculation | HIGH | MEDIUM | P1 | v1 |
| TS-7: Blending weights config | HIGH | LOW | P1 | v1 |
| TS-9: Score normalization | HIGH | MEDIUM | P1 | v1 |
| TS-10: Bulk score entry | HIGH | MEDIUM | P1 | v1 |
| TS-11: Player eval history | MEDIUM | LOW | P1 | v1 |
| TS-12: DNE handling | MEDIUM | LOW | P1 | v1 |
| TS-13: Feed scores to draft | HIGH | MEDIUM | P1 | v1 |
| TS-8: Coach rating submission | HIGH | MEDIUM | P2 | v1.x |
| TS-14: Group/rotation mgmt | MEDIUM | MEDIUM | P2 | v1.x |
| D-1: Cross-season persistence | HIGH | MEDIUM | P2 | v1.x |
| D-4: Soft-skill categories | MEDIUM | LOW | P2 | v1.x |
| D-5: Progress dashboard | MEDIUM | MEDIUM | P2 | v1.x |
| D-6: Auto-recalculation | MEDIUM | LOW | P2 | v1.x |
| D-9: Score confidence | LOW | LOW | P2 | v1.x |
| D-11: Quick-score mode | MEDIUM | LOW | P2 | v1.x |
| D-2: Real-time aggregation | LOW | MEDIUM | P3 | v2+ |
| D-3: Evaluator calibration | LOW | HIGH | P3 | v2+ |
| D-7: Multi-evaluator | LOW | HIGH | P3 | v2+ |
| D-8: Template versioning | LOW | MEDIUM | P3 | v2+ |
| D-10: Offline scoring | MEDIUM | HIGH | P3 | v2+ |

**Priority key:**
- P1: Must have for launch. Without these, the system doesn't replace spreadsheets.
- P2: Should have. Add when core flow is validated. Coach ratings and tryout logistics.
- P3: Nice to have. Advanced features for leagues with sophisticated needs.

## Competitor Feature Analysis

**Note:** WebSearch and WebFetch were unavailable during this research session. Competitor analysis is based on domain knowledge of the youth sports evaluation software landscape. **Confidence: LOW** -- these observations should be validated with direct product review.

| Feature | Paper/Spreadsheet (Incumbent) | Generic Sports Eval Apps | Our Approach |
|---------|-------------------------------|--------------------------|--------------|
| Template config | Fixed columns in Excel | Usually fixed or limited templates | Fully admin-configurable per league |
| Mobile scoring | No (paper at stations) | Usually native app required | Mobile-first web (no install) |
| Coach ratings | Multi-tab spreadsheet emailed to coaches | Rarely included | First-class workflow with persistence |
| Score blending | Manual weighted formulas in Excel | Usually one score source | Configurable multi-source blending |
| Draft integration | Export CSV, import to draft tool | No integration | Native pipeline to draft system |
| Bib lookup | Visual scan of paper list | Usually player search | Bib-first numpad entry |
| Cross-season data | Starts fresh each year | Varies | Persistent player/league data |
| Offline scoring | Paper is always offline | Varies (native apps: yes) | Deferred to v2 (online-first) |

### Key Competitive Observations (LOW confidence -- unverified)

1. **The real competitor is paper + Excel.** Most Little League organizations use paper evaluation forms at tryouts, then a volunteer hand-transcribes into a spreadsheet. Any digital solution must be faster and more reliable than this workflow, or adoption fails.

2. **Generic sports evaluation apps exist** (e.g., iScore, GameChanger, Sports Evaluations) but they tend to be either (a) focused on game stats rather than tryout evaluations, or (b) generic enough that Little League-specific workflows (bib numbers, coach kids, sibling rules, division-specific evaluation templates) feel awkward.

3. **The unique advantage here is the closed loop.** Evaluations feed directly into the draft system that already exists. No export-import gap. This is the strongest differentiator and should be emphasized.

4. **Coach rating persistence across seasons is uncommon** in tools targeting this level. Most reset each year. Making this work means every player starts the next season with a baseline, which dramatically reduces the "what if they miss tryouts?" problem.

## Domain-Specific Feature Considerations

### Tryout Day Logistics (Informs Feature Design)

A typical Little League tryout day works like this:
- 60-100 players arrive, get bib numbers, split into groups of 15-20
- 4-6 stations run simultaneously (infield, fly balls, base running, pitching, hitting)
- Groups rotate through stations every 15-20 minutes
- 2-3 hours total
- Each station has 1-2 volunteers scoring
- Weather, distractions, interruptions are constant
- By the last group, evaluators are tired and less consistent

This reality drives several feature priorities:
- **Mobile UX must be dead simple** (TS-4 is HIGH complexity because getting this right is hard, not because the tech is hard)
- **Bulk entry must exist** (TS-10) because mobile WILL fail for some stations
- **Score normalization** (TS-9) must account for evaluator fatigue and drift
- **Progress dashboard** (D-5) prevents "we forgot to score Group D at pitching" situations

### Coach Rating Timing

End-of-season coach ratings happen weeks/months before tryouts. This means:
- Coach sees their roster from last season
- Rates each player on configured categories
- Has time to be thoughtful (unlike rushed tryout scoring)
- Ratings are more stable and reliable than tryout-day scores
- But coaches have bias (their own kid, favorites, etc.)

This informs the blending weight design: coach ratings provide signal quality but bias risk; tryout scores provide objectivity but noise.

### Scoring Scale Design

From youth sports evaluation research and practice:
- **1-5 subjective scales** are the sweet spot for field reliability. 3-point is too coarse; 7+ points exceed human discrimination ability in noisy outdoor conditions.
- **Anchor descriptions matter.** "3 = average for age group" produces better inter-rater reliability than unlabeled scales.
- **Objective measures** (time, count) should always be preferred where possible, since they eliminate evaluator bias entirely.
- The template system should support labeling each scale point (1 = "Needs significant development", 5 = "Elite for age group").

## Sources

- Codebase analysis: `src/types/evaluation.ts`, `src/utils/evaluationProcessor.ts`, `src/utils/scoreNormalization.ts`, `src/types/index.ts`
- Codebase analysis: `src/components/evaluation/*.tsx` (existing evaluation UI components)
- Codebase analysis: `src/utils/teamBuilderAlgorithm.ts` (existing team builder patterns)
- PROJECT.md requirements and constraints
- Domain knowledge of Little League baseball tryout operations (MEDIUM confidence)
- Competitor landscape analysis (LOW confidence -- no live product verification available)

---
*Feature research for: Youth sports evaluation system (Little League baseball)*
*Researched: 2026-01-29*
