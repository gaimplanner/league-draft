# Pitfalls Research

**Domain:** Youth sports evaluation/scoring systems (Little League baseball in-app evaluations)
**Researched:** 2026-01-29
**Confidence:** MEDIUM (domain analysis from existing codebase + structured reasoning about field-condition constraints; WebSearch unavailable for external validation)

## Critical Pitfalls

### Pitfall 1: Offline Data Loss During Field Evaluations

**What goes wrong:**
Volunteer scorers enter evaluation data on mobile devices at outdoor fields. Cell/WiFi connectivity is unreliable, spotty, or absent. Data entered during connectivity gaps is lost when the app refreshes, the browser crashes, or the device sleeps. An entire station's worth of tryout scores disappears mid-evaluation day.

**Why it happens:**
Developers build evaluation entry as a standard online form that POSTs to the server on submit. This works fine in development and testing (always online), but fails catastrophically in the real environment -- outdoor baseball fields with poor cellular coverage, especially in suburban/rural areas where many Little League fields are located. The existing app already has a localStorage fallback pattern (controlled by `VITE_USE_API`), but evaluation entry needs something more robust since data entry happens continuously, not as a single upload.

**How to avoid:**
- Design the evaluation entry UI as **offline-first from day one**. Every score keystroke must be persisted locally (IndexedDB or localStorage) before any network request.
- Implement a sync queue: scores save locally immediately, then sync to the server when connectivity returns. Use a visible sync status indicator (green = synced, yellow = pending, red = offline).
- Never show a "Submit" button that blocks on network. Instead, show "Saved locally" immediately and "Synced to server" when confirmed.
- Test with Chrome DevTools network throttling set to "Offline" throughout development.
- Consider using a Service Worker for the evaluation entry pages specifically.

**Warning signs:**
- No IndexedDB or localStorage calls in the evaluation entry component
- Network requests fire on every score input without local persistence
- No sync status indicator in the UI mockups
- Testing only happens on WiFi-connected development machines
- No "what happens if the phone loses signal" user story

**Phase to address:**
Phase 1 (Foundation) -- the offline-first data layer must be the first thing built for evaluation entry. Retrofitting offline support onto an online-first evaluation form requires rewriting the entire data flow.

---

### Pitfall 2: Inter-Rater Scoring Inconsistency Destroys Fairness

**What goes wrong:**
Different volunteer scorers at different stations (fielding, hitting, pitching, baserunning) apply subjective scales differently. Scorer A gives "3 out of 4" to above-average players; Scorer B gives "3 out of 4" only to exceptional players. The resulting composite scores are meaningless because a "3" from Station A is not equivalent to a "3" from Station B. Parents discover their kid was scored by the "tough grader" and the perceived unfairness undermines confidence in the entire system.

**Why it happens:**
The existing system normalizes scores to a 0-100 scale (see `scoreNormalization.ts`), but this normalization assumes the input scoring is consistent -- it maps `inputMin` to 0 and `inputMax` to 100 linearly. If Scorer A uses the full range (1-4) and Scorer B clusters at 2-3, their normalized outputs differ wildly for the same skill level. The system treats all "3"s as equal, but they represent different judgments.

This is the classic "inter-rater reliability" problem in psychometrics. Youth sports leagues rarely train volunteers on calibration, and even when they do, drift occurs throughout a 4-6 hour evaluation day.

**How to avoid:**
- **Per-station z-score normalization:** Instead of mapping to a fixed 0-100 scale, normalize each scorer's/station's scores relative to that scorer's own distribution (mean and standard deviation). A "3" from a tough grader and a "3.5" from an easy grader map to the same percentile if they're both one standard deviation above their respective means.
- **Anchor players:** Have 2-3 known-quality players evaluated by all scorers first as calibration references. Score deviations from these anchors reveal rater bias.
- **Score distribution dashboard:** After evaluation day, show admins a histogram of each station's scores. If Station A's mean is 2.1 and Station B's mean is 3.2, the admin can see the bias immediately and apply corrections.
- **Multiple evaluators per station:** If feasible, have 2 scorers at high-weight stations (pitching, hitting) and average their scores. This is the gold standard but doubles volunteer requirements.
- **UI guardrails for scorers:** Show a running distribution of scores entered so far at each station ("You've given 80% of players a 3 or higher -- is your scale calibrated?").

**Warning signs:**
- Category scores from one station cluster tightly (e.g., all 2s and 3s) while another station uses the full range
- Parents consistently complain about one specific evaluation station
- Standard deviation of scores at one station is significantly lower than others (scorer is not differentiating)
- The system only supports fixed-range normalization (0 to inputMax), with no scorer-relative adjustment

**Phase to address:**
Phase 2 (Scoring Engine) -- the normalization algorithm must support per-scorer/per-station distribution adjustment. This is also relevant in Phase 1 if the data model needs to capture which scorer entered which scores (currently not tracked in the codebase).

---

### Pitfall 3: Template Flexibility Creates Incomparable Data Across Leagues

**What goes wrong:**
Different leagues configure different evaluation templates (different skill categories, different scales, different weights). This is a desired feature -- but when templates change between seasons, or when leagues want to compare across years, the data becomes incomparable. A player's "85" from last season means something completely different than their "85" this season because the template changed. Cross-season "improvement" metrics become misleading. Leagues that rely on carry-forward coach ratings from prior seasons find those ratings are meaningless when the scale changed.

**Why it happens:**
Configurable templates are a necessary feature (different leagues evaluate differently), but developers implement them as "just different form fields" without versioning or metadata. The existing `ScoringWeights` and `FieldWeight` structures define what categories exist and their weights, but there's no concept of a "template version" or "evaluation schema" that's stamped on the data. When weights change, old scores silently become incompatible with new weights.

**How to avoid:**
- **Version evaluation templates.** Each template gets an immutable version ID. When a template is modified, a new version is created (never mutate in place). Player scores are always stored alongside the template version they were collected under.
- **Store raw scores AND the template metadata together.** Don't just store "fieldScore: 3" -- store "fieldScore: 3, scale: 0-5, template: v2.1". This is partially done in the existing `rawScores` structure but the template config is not stored with the player data.
- **Re-normalization on template change:** When weights change, re-normalize all raw scores under the new weights. The existing `recalculateWithWeights()` function does this for the current session, but cross-season data needs the same treatment.
- **Explicit "carry-forward" rules:** When importing prior-season data, require explicit mapping of old template fields to new template fields. Don't silently assume they match.

**Warning signs:**
- Template changes happen without creating a new version
- Old player data is displayed using current template weights (mixing apples and oranges)
- Cross-season comparison features are requested but no template versioning exists
- The `scoring_weights` JSON field on Division is mutable without history

**Phase to address:**
Phase 1 (Data Model) -- template versioning must be baked into the data model from the start. Retrofitting versioning onto a flat template structure requires migrating all existing data.

---

### Pitfall 4: Concurrent Multi-Station Entry Creates Race Conditions and Data Conflicts

**What goes wrong:**
On tryout day, multiple evaluation stations run simultaneously. Station 1 (fielding) and Station 2 (hitting) both score the same player concurrently. Both stations submit their scores. The second write overwrites the first, and one station's data is lost. Or, two scorers at the same station score the same player (the player went through twice), and the system doesn't know which score to keep.

**Why it happens:**
The existing data model stores player scores as flat fields on the `Player` model (`field_score`, `throw_score`, etc.). Each station would need to update specific fields without clobbering others. But if two stations read the same player record, modify their respective fields, and write back, the last write wins and the first station's changes are lost (classic lost-update problem).

The existing `processWorkbook()` merges data by BIB across tabs, but this is a batch post-hoc operation. Real-time concurrent entry from multiple devices is a fundamentally different data access pattern.

**How to avoid:**
- **Model evaluation scores as separate records per station/category**, not as fields on the Player model. Instead of `Player.field_score = 3`, create an `EvaluationScore` record: `{player_id, station_id, scorer_id, category, field, value, timestamp}`. This eliminates write conflicts because each station writes its own records.
- **Merge at read time, not write time.** When displaying a player's composite score, aggregate across their individual station scores. The existing `processWorkbook()` pattern (merge by BIB across tabs) is the right approach -- extend it to real-time merged views.
- **Optimistic concurrency with field-level granularity:** If you must use flat fields, implement field-level PATCH semantics (only update the fields the station is responsible for). Django's `F()` expressions or `update()` with specific fields can help, but this is fragile.
- **Station-scoped permissions:** Each scorer device should only be able to write scores for its assigned station/category. This prevents accidental cross-station overwrites.

**Warning signs:**
- Player scores are stored as flat fields on a single model (the current `Player` model design)
- No concept of "who scored this" or "which station entered this" in the data model
- Concurrent update testing is not in the test plan
- The sync mechanism uses PUT (full replace) instead of PATCH (partial update) for player data

**Phase to address:**
Phase 1 (Data Model) -- the evaluation score storage model must support concurrent writes from multiple stations. This is a foundational architectural decision that cannot be retrofitted without data migration.

---

### Pitfall 5: Ignoring the "Did Not Evaluate" Edge Cases

**What goes wrong:**
On tryout day, not every player completes every station. A player gets injured, arrives late, leaves early, or a station runs out of time. The system must handle partial evaluations gracefully, but developers either (a) treat missing scores as zeros (unfairly penalizing the player), (b) exclude the player entirely (unfair -- they have some valid data), or (c) crash/error when encountering incomplete data.

**Why it happens:**
The existing codebase already handles this somewhat -- `isDNE` flags, `isPartial` detection, `missingCategories` tracking, and weight redistribution when some fields are missing (see `calculatePlayerScores`: "Redistribute weights if some fields are missing data"). However, the current approach normalizes by redistributing weights, which can create misleading comparisons. A player evaluated on 3 of 5 categories gets their score extrapolated from available data, which may over- or under-represent their true ability.

The deeper problem: there are multiple "flavors" of missing data that require different treatment:
1. **DNE (Did Not Evaluate):** Player was registered but didn't attend. Score = 0 or special handling for draft.
2. **Partial attendance:** Player completed some stations but not all. Scores from completed stations are valid.
3. **Equipment/logistic failure:** Stopwatch malfunctioned, scorer forgot to save. Data is missing but player was present.
4. **Makeup evaluation:** Player missed tryout day and will be evaluated separately, possibly by different scorers on a different day.

**How to avoid:**
- **Distinguish missing-data reasons in the data model.** Not just "null" but "not_evaluated", "pending_makeup", "equipment_failure", "excused". Each reason implies different handling.
- **Don't redistribute weights for partial data by default.** Instead, show the raw scores for completed categories and flag the player for admin review. Let the admin decide: redistribute, assign average, or schedule makeup.
- **Makeup evaluation workflow:** Build an explicit "incomplete evaluations" queue that admins can review and either schedule makeups or manually assign scores.
- **Display partial scores clearly in the UI.** The draft board should show which categories are missing, not just a lower total that looks like the player is bad.

**Warning signs:**
- Missing scores silently become 0
- No distinction between "scored zero" and "not scored"
- Partial players rank lower than fully-evaluated players of similar ability
- No admin workflow for reviewing/resolving incomplete evaluations
- The weight redistribution produces composite scores that are statistically incomparable

**Phase to address:**
Phase 2 (Scoring Engine) -- the scoring algorithm must handle partial data correctly. Phase 1 data model should capture the reason for missing data.

---

### Pitfall 6: Building Desktop-First UI for a Mobile-First Use Case

**What goes wrong:**
Evaluation entry happens on phones and tablets at the baseball field, but the UI is designed and tested on desktop browsers. Scorers struggle with tiny inputs, fat-finger errors, accidental form submissions, and cannot see the player they're scoring while entering data. The app is technically "responsive" but functionally unusable on a phone held with one hand while the scorer watches the player with the other.

**Why it happens:**
The existing app is a React web app that was designed for the draft phase (naturally a desktop/laptop experience -- sitting at a table, full screen). The evaluation entry phase has completely different ergonomics: standing at a field, phone in one hand, glove in the other, sun glare on the screen, players cycling through quickly. Developers reuse the existing UI patterns (tables, small inputs, multi-column layouts) which are wrong for this context.

**How to avoid:**
- **Design evaluation entry mobile-first, not responsive-as-afterthought.** This means: large touch targets (minimum 48px), single-column layout, minimal scrolling, high-contrast colors for outdoor visibility.
- **Score entry via tappable buttons, not text inputs.** For a 0-4 scale, show 5 large buttons (0, 1, 2, 3, 4) that the scorer taps. No keyboard needed. For time entry, use a start/stop button or allow direct number entry with a large numeric keypad.
- **One player per screen.** Don't show a table of all players. Show the current player's name/BIB large and prominent, with score inputs below. "Next player" button advances.
- **Auto-advance after score entry.** When all fields for a player at this station are filled, automatically advance to the next player (with undo).
- **Landscape and portrait support.** Scorers hold phones differently. Test both.
- **Sun-readable contrast.** Dark text on white background washes out in direct sunlight. Consider a high-contrast mode with dark backgrounds and bright text, or at minimum, test with screen brightness at maximum.

**Warning signs:**
- Evaluation entry wireframes show table/grid layouts
- Score inputs use `<input type="number">` instead of large tappable buttons
- No mobile-specific user stories or acceptance criteria
- Testing only happens indoors on desktop browsers
- No consideration of screen glare, one-handed operation, or outdoor conditions

**Phase to address:**
Phase 1 (UI Foundation) -- the evaluation entry UI must be designed for mobile from the start. Building a desktop UI and "making it responsive" later means rebuilding the entire interaction pattern.

---

### Pitfall 7: Naive Composite Scoring Produces Unfair Rankings

**What goes wrong:**
The system combines subjective coach ratings (form, technique) with objective tryout measurements (time, hit count) into a single composite score. But the two types of data have fundamentally different statistical properties. Subjective ratings cluster around the middle of the scale (most players get 2-3 out of 4). Objective measurements spread more widely (times range from 3.5s to 7.0s). When both are normalized to 0-100 and weighted, the objective measurements dominate the spread (they differentiate players more), while subjective ratings compress differences. The composite score is disproportionately influenced by whichever measurement type has more variance, regardless of the configured weight percentages.

**Why it happens:**
The existing `normalizeScore()` function maps linearly from `inputMin` to `inputMax` (0 to 100). This preserves the original distribution shape. If fielding scores cluster at 2-3 on a 0-4 scale, they normalize to 50-75 on the 0-100 scale (25-point spread). If running times span 3.5s-7.0s, they normalize to 0-100 (100-point spread). Even with equal weights, running time has 4x the influence on final ranking because it creates 4x the score spread.

This is a well-known problem in composite scoring: **equal weights on the configuration screen do not produce equal influence on the outcome** when the underlying distributions differ.

**How to avoid:**
- **Z-score normalization before compositing.** Instead of linear 0-100 mapping, convert each score to standard deviations from the mean (z-score). A z-score of +1.0 always means "one standard deviation above average" regardless of the original scale. This ensures each category contributes proportionally to its configured weight.
- **Alternatively, percentile-rank normalization.** Convert each raw score to its percentile rank within the current player pool. This is simpler than z-scores and ensures uniform distribution for each category.
- **Make this an admin-selectable option.** Some leagues prefer simple linear normalization (it's more intuitive to explain to parents: "a 3 out of 4 is 75%"). Others care about statistical fairness. Offer both modes.
- **Show admins the actual influence of each category.** After scoring, display which category actually contributed most to ranking differentiation. If running time is configured at 10% weight but actually drives 40% of ranking variation, the admin should see that.

**Warning signs:**
- Rankings change dramatically when you toggle one low-weight category on/off (it has outsized influence due to high variance)
- Subjective scores barely differentiate top players from middle players (compression)
- Time-based scores dominate rankings despite modest weight configurations
- Players with similar subjective ratings get wildly different final rankings based on objective measurements

**Phase to address:**
Phase 2 (Scoring Engine) -- normalization method selection must be a deliberate design decision. The current linear normalization in `scoreNormalization.ts` should be supplemented with z-score and percentile options.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Storing evaluation scores as flat Player fields | Matches existing model, no migration needed | Cannot support concurrent entry, no audit trail, no scorer attribution | Never for in-app evaluations; only for post-hoc CSV import (which is already built) |
| Using localStorage for offline evaluation data | Quick to implement, familiar pattern | 5MB limit, no structured queries, data loss on browser clear, no cross-tab sync | Early prototype only; must migrate to IndexedDB for production |
| Skipping template versioning ("we'll add it later") | Ship faster, simpler data model | All historical data becomes uninterpretable when template changes; requires migration | Never -- template version must be stored with every score from day one |
| Using same normalization for all score types | Simpler code, one function handles all | Statistical unfairness between subjective/objective scores (see Pitfall 7) | MVP only, with explicit plan to add z-score/percentile in next phase |
| Hardcoding evaluation categories (fielding, pitching, hitting, flyBalls, baserunning) | Faster development, simpler code | Cannot support leagues with different category structures (e.g., no pitching station for younger divisions) | MVP if time-constrained; refactor to configurable categories in Phase 2 |
| Skipping per-scorer data attribution | Simpler data model, less UI complexity | Cannot detect or correct scorer bias, no audit trail for disputes | Never -- scorer ID should be captured from the start even if bias-correction features come later |

## Integration Gotchas

Common mistakes when connecting evaluation components to the existing system.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Evaluation scores to Player model | Writing evaluation scores directly to the existing `Player.field_score`, `Player.throw_score` etc. fields from mobile entry, creating conflicts with CSV import path | Create a separate `EvaluationScore` model for real-time entry; convert to Player fields only at finalization (like existing `convertToPlayers()` does for Excel import) |
| Mobile auth for scorer devices | Requiring each volunteer scorer to create an account and log in | Support temporary scorer tokens or PIN-based access scoped to a specific evaluation session and station; the admin creates the session, scorers join with a code |
| Syncing offline data with server state | Sending the full player dataset on reconnect, overwriting server data | Send individual score records (not full player objects) with timestamps; server resolves conflicts using "latest by station wins" |
| Cross-season data import | Treating last year's scores as equivalent to this year's | Explicitly mark imported scores as "prior season" with their original template version; display separately or apply a configurable decay factor |
| Evaluation results to draft system | Passing evaluation results directly to draft without admin review/approval | Add an explicit "finalize evaluations" step where the admin reviews scores, resolves partial evaluations, and approves the final rankings before they flow into draft configuration |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Loading all player scores in a single API call for the scorer UI | Slow initial load, large payload on mobile connection | Scope scorer API to their station + current batch of players only; paginate | At 150+ players (typical large league) on a 3G connection |
| Real-time leaderboard recalculation on every score entry | UI lag after each score input; server load during concurrent evaluation | Recalculate composite scores in batch (on admin request or on a timer), not on every individual score save | At 10+ concurrent scorers entering data simultaneously |
| Storing score history as JSON blobs (append-only arrays) | JSON parsing overhead, ever-growing field size | Use proper relational rows for score records with timestamp and scorer ID | After 2-3 seasons of accumulated data per player |
| Full player re-sort/re-rank on every score change | Noticeable delay in the admin dashboard during active evaluation | Defer ranking to an explicit "refresh rankings" action or background job; display "rankings may be stale" indicator | At 200+ players with 10+ active scorers |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Allowing scorers to see other stations' scores during evaluation | Anchoring bias -- a scorer who sees a player already scored high at another station is biased to score them high too | Station-scoped views: scorers can only see their own station's data. Admin sees all. |
| No audit trail for score modifications | A coach/admin secretly adjusts scores after evaluation day; no way to detect tampering | Immutable score records with append-only corrections (new record with correction flag, not UPDATE on original). Admin can apply `official_adjust` but the original scores are preserved. |
| Scorer identity not tied to scores | No accountability for a scorer entering random numbers or scoring friends' kids favorably | Store scorer ID with every score record. Admin can review per-scorer patterns. |
| Evaluation data accessible to all league members | Coaches see other teams' player scores before the draft, gaining unfair advantage | Role-based visibility: during evaluation, only admins see composite scores. Coaches see only their own station's raw entry. Draft board reveals scores only when draft begins. |
| Exportable CSV of all scores without access control | Sensitive player evaluation data (essentially performance grades for children) exported and shared publicly | Audit log for exports; admin-only export permission; consider redacting player names in exports shared with non-admins |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Requiring volunteer scorers to navigate a complex app menu | Scorers waste time figuring out the app instead of scoring players; long lines at stations | Direct-link or QR code that drops the scorer directly into their station's entry screen. No navigation required. |
| Showing numeric scores on the scorer screen (1, 2, 3, 4) without descriptive anchors | Scorers don't know what "3" means for pitching form vs. fielding; inconsistent interpretation | Show descriptive labels: "1 = Needs Work, 2 = Developing, 3 = Solid, 4 = Advanced" next to each score option |
| Small BIB number input that requires typing | Scorers repeatedly mistype BIB numbers, assigning scores to wrong players | Scannable BIB codes (QR or barcode), or large-button BIB selector, or player list filtered by station assignment order |
| No confirmation/undo for submitted scores | Scorer realizes they scored the wrong player or hit the wrong button; no way to fix it | Always allow undo of the last entry. Show the last 3-5 entries on screen for quick review. Admin can override any score. |
| Overwhelming the scorer with all fields at once | Cognitive overload when 6+ scores need entering per player; errors increase with fatigue | Step through fields one at a time (wizard-style). Show just "Pitching Form" with 5 large buttons, then advance to "Arm Strength" on tap. |
| No progress indicator during evaluation day | Scorer/admin doesn't know how many players have been through each station, or who's missing | Dashboard showing: players evaluated / total registered per station, with list of "not yet evaluated" players |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Offline support:** Scores save to local storage -- but verify: Does it survive browser crash? Device sleep? App switch on iOS (which kills background tabs)? Multiple tabs?
- [ ] **Score normalization:** All scores normalize to 0-100 -- but verify: Are distributions comparable across stations/scorers? Does a 75 in fielding mean the same thing as a 75 in running?
- [ ] **Template configuration:** Admin can customize categories and weights -- but verify: Are old scores re-normalized when weights change? Is template version stored with scores?
- [ ] **Multi-station concurrent entry:** Multiple scorers can enter simultaneously -- but verify: Does Station A's save overwrite Station B's data? Test with actual concurrent saves, not sequential.
- [ ] **Partial evaluation handling:** Players with missing categories get scores -- but verify: Is their composite score comparable to fully-evaluated players? Can the admin see which categories are missing?
- [ ] **Mobile scorer experience:** The app works on phones -- but verify: Can a scorer operate it one-handed? In direct sunlight? Without scrolling? While watching a player? With gloves on?
- [ ] **Score finalization:** Evaluation results flow into draft -- but verify: Is there an explicit approval step? Can the admin adjust scores after evaluation but before draft? Are changes audited?
- [ ] **Cross-season carry-forward:** Prior season ratings are imported -- but verify: Are they tagged with their original template version? Do they use current or original normalization? Can the admin weight them differently?
- [ ] **BIB assignment accuracy:** Scores are associated with the right player -- but verify: What happens when a scorer types the wrong BIB? Is there a reconciliation step? Can scores be re-assigned post-entry?
- [ ] **Evaluation day logistics:** The system handles the scoring -- but verify: Does it support the physical flow (player rotation between stations)? Station queue management? Warm-up time?

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Offline data loss | HIGH | Manual re-entry from paper backup (always have paper as fallback). If no paper backup, schedule makeup evaluations. Prevention is far cheaper. |
| Scorer inconsistency discovered post-evaluation | MEDIUM | Apply per-scorer z-score normalization retroactively. Requires raw scores to be preserved (not just composites). Admin reviews and approves adjusted rankings. |
| Template changed mid-season without versioning | HIGH | If raw scores are stored, re-normalize under the new template. If only composites are stored, data is lost and makeup evaluations needed. |
| Concurrent write data loss | MEDIUM | If individual score records exist (not flat Player fields), replay from the score history. If flat fields were used, the overwritten station must re-enter. |
| Wrong BIB assignment (scores on wrong player) | LOW-MEDIUM | If caught same day: admin swaps scores between players in the review UI. If caught after draft: requires manual score adjustment and possibly draft position recalculation. |
| Composite scoring unfairness | MEDIUM | Re-calculate rankings using z-score normalization. Requires raw scores to be preserved. May require re-doing draft if rankings change significantly. |
| Mobile UX too painful for volunteers | HIGH | Requires UI redesign and rebuild. Cannot be patched -- fundamental interaction patterns need rethinking. Build a prototype and field-test with actual volunteers before full development. |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Offline data loss | Phase 1: Data Layer | Airplane mode test: enter 10 scores offline, reconnect, verify all 10 synced |
| Inter-rater inconsistency | Phase 2: Scoring Engine | Generate synthetic data with known scorer bias; verify normalization produces fair rankings |
| Template versioning | Phase 1: Data Model | Change template weights; verify old scores display correctly under their original template |
| Concurrent multi-station conflicts | Phase 1: Data Model | Two browser tabs submit scores for same player simultaneously; verify both stations' data persists |
| DNE/partial evaluation handling | Phase 2: Scoring Engine | Create players with 2 of 5 categories; verify composite is flagged (not silently wrong) and admin can review |
| Desktop-first mobile UX | Phase 1: UI Foundation | Field test with 3 non-technical volunteers on their phones outdoors; measure task completion time |
| Naive composite scoring | Phase 2: Scoring Engine | Create dataset where one category has 3x the variance; verify configured weights match actual ranking influence |
| Scorer bias/score tampering | Phase 1: Data Model (attribution), Phase 3: Admin Tools (detection) | Verify every score record includes scorer ID and timestamp; admin can view score-entry audit trail |
| Wrong BIB assignment | Phase 1: UI + Phase 2: Admin Tools | Admin can reassign scores from one player to another; the correction is logged |
| Cross-season data incompatibility | Phase 3: Data Import | Import prior-season CSV with different template; verify scores tagged as "prior season" with original context |

## Sources

- Existing codebase analysis: `src/utils/evaluationProcessor.ts`, `src/utils/scoreNormalization.ts`, `src/types/evaluation.ts`, `server/draft/models.py` (all HIGH confidence -- direct code review)
- Domain reasoning about inter-rater reliability, composite scoring fairness, and offline-first architecture (MEDIUM confidence -- based on established psychometric and software engineering principles, not verified against external youth sports evaluation system post-mortems)
- Mobile field conditions and volunteer scorer UX (MEDIUM confidence -- based on the project context provided and reasonable inference about Little League tryout logistics)
- WebSearch was unavailable during this research session; external validation of pitfalls against real-world youth sports evaluation system failures could not be performed (confidence would increase with external validation)

---
*Pitfalls research for: Youth sports evaluation system (Little League baseball)*
*Researched: 2026-01-29*
