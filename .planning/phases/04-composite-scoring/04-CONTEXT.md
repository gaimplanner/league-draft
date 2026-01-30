# Phase 4: Composite Scoring - Context

**Gathered:** 2026-01-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Calculate weighted composite scores that blend coach ratings and tryout evaluations into draft-ready rankings. Includes normalization across score types, handling of players with partial/missing data, admin-configurable blend weights with live preview, and per-player evaluation breakdowns showing how scores were derived. Draft integration (feeding composites into the draft flow) is Phase 5.

</domain>

<decisions>
## Implementation Decisions

### Score transparency
- Rankings list shows composite score only — clean and simple, click to expand for details
- Partial-data players indicated subtly (muted text or asterisk) — not a prominent badge but visible enough to notice
- Both raw and normalized values shown throughout, with raw as primary display
- Composite scores displayed to 1-2 decimal places so admins can distinguish close rankings

### Partial data handling
- Players missing tryouts entirely get a coach-only composite, displayed in a **separate tier** below full-data players (not interleaved in main rankings)
- Players missing coach ratings (new players, coach didn't submit) get a tryout-only composite, same separate-tier treatment
- Players who attended tryouts but missed individual stations: calculate from available stations but **flag for admin review** — admin decides whether the partial tryout score is fair
- Admins can **manually promote/demote** players between tiers — move a partial-data player into the main rankings if confident in the score, or demote a full-data player if needed

### Weight configuration
- **Slider with live preview** — rankings update in real-time as the admin drags the coach/tryout weight slider
- **Station-level weights** supported in addition to top-level coach vs. tryout split — admins can weight individual tryout stations (e.g., hitting 30%, fielding 20%, running 10%)
- **Rank deltas** shown when weights change — up/down arrows indicating how many positions each player moved from the previous configuration
- Weight configuration saving/comparison: Claude's discretion (see below)

### Evaluation breakdown view
- **Click row to expand** inline detail section below the player row in the rankings list
- Coach rating details show **category scores with subtotal** (e.g., Hitting: 4, Fielding: 3, Baseball IQ: 5) — no coach name attribution
- Tryout station scores show **raw score + normalized value** per station (e.g., "7.2s → 82/100")
- **Numbers only** for the composite calculation — no visual charts or formula displays; the math is implied from the weights shown in the configuration panel

### Claude's Discretion
- Whether to support saving multiple named weight configurations for comparison, or keep it to a single active configuration — pick what fits without over-engineering
- Normalization algorithm choice (linear vs. z-score) — research should evaluate and recommend
- Exact layout of the inline expanded breakdown
- Loading/empty states during recalculation

</decisions>

<specifics>
## Specific Ideas

- Separate tier for partial-data players is a deliberate fairness choice — a coach-only score shouldn't directly compete with a player who has both sources. Admins can override if they know the player well enough.
- Station-level weights let admins emphasize what matters for their league (e.g., a league that values hitting more than running speed).
- Live preview on the weight slider means admins can explore "what if" scenarios quickly without committing.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-composite-scoring*
*Context gathered: 2026-01-30*
