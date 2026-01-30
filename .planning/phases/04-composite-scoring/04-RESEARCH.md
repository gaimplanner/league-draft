# Phase 4: Composite Scoring - Research

**Researched:** 2026-01-30
**Domain:** Score normalization and weighted composite calculation
**Confidence:** HIGH

## Summary

Phase 4 implements weighted composite scores blending coach ratings and tryout evaluations. The system must normalize heterogeneous score types (1-5 scales, timed runs, catch counts) to comparable values, handle players with partial data sources (coach-only, tryout-only, or both), provide live-preview weight configuration, and show per-player evaluation breakdowns.

**Key findings:**
- **Linear normalization (min-max scaling)** is the recommended starting point for this domain - simpler, more predictable, and easier to explain to league admins than z-score normalization
- **Z-score normalization** should be implemented as an optional upgrade if real data shows unfair distributions, but is not required for v1
- **Separate tiers for partial-data players** (coach-only, tryout-only) prevents unfair direct comparison with full-data players
- **Live preview with useMemo** + debouncing handles real-time recalculation efficiently for slider-based weight configuration
- **Backend calculation service** pattern (similar to DraftService) provides clean separation of normalization logic from views

**Primary recommendation:** Start with linear normalization (existing codebase already uses this in scoreNormalization.ts), implement backend composite calculation service with station-level weights support, use React useMemo for live preview, and defer z-score normalization to v2 unless real data proves it necessary.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Django ORM | 5.1 | Composite calculation backend | Already in use, JSONField support for flexible weights |
| React + TypeScript | 18+ | Live preview UI | Existing stack, useMemo for efficient recalculation |
| NumPy/SciPy | (optional) | Z-score normalization (v2) | Industry standard for statistical normalization |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Django JSONField | 5.1 | Store station-level weights, normalized scores | Already in models (BlendWeights, scores fields) |
| TanStack Table | v8 | Expandable row detail panels | Already in use for Team Builder, proven pattern |
| Lucide React | Latest | UI icons (expand/collapse, partial data indicators) | Existing icon library |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Linear normalization | Z-score normalization | Z-score better for non-uniform distributions but harder to explain; defer until data proves it necessary |
| Backend calculation | Frontend-only calculation | Backend ensures consistent calculations, supports future API consumers |
| Slider + live preview | Text input + manual recalculate button | Live preview better UX but requires performance optimization |

**Installation:**
```bash
# No new dependencies required - using existing stack
# Optional for v2 z-score support:
pip install numpy scipy
```

## Architecture Patterns

### Recommended Project Structure
```
server/draft/
├── services_composite.py    # CompositeScoreService (similar to DraftService)
├── views/composite.py        # Composite calculation endpoints
├── migrations/               # Add composite score fields to models

src/
├── components/composite/
│   ├── CompositeScorePage.tsx         # Main page with rankings list
│   ├── WeightConfigPanel.tsx          # Slider controls with live preview
│   ├── PlayerEvaluationBreakdown.tsx  # Expandable detail view
│   └── RankingsList.tsx               # Table with expand/collapse rows
├── utils/
│   ├── compositeCalculation.ts        # Frontend calculation (mirrors backend)
│   └── scoreNormalization.ts          # (already exists) - extend for z-score if needed
├── hooks/
│   └── useCompositeScores.ts          # API integration + local state
```

### Pattern 1: Backend Composite Calculation Service
**What:** Separate service class for composite score logic (similar to DraftService pattern in services_draft.py)
**When to use:** All composite score calculations should go through this service for consistency
**Example:**
```python
# server/draft/services_composite.py
from django.db import transaction
from .models import Season, CoachRating, StationScore, GroupPlayer

class CompositeScoreService:
    """Service for composite score calculations."""

    @classmethod
    def calculate_composite_scores(cls, season_id: UUID, weights: dict) -> list[dict]:
        """Calculate composite scores for all players in a season.

        Returns list of {player_id, coach_score, tryout_score, composite_score, data_sources}
        """
        season = Season.objects.get(id=season_id)
        template = season.template

        # Gather all coach ratings
        coach_ratings = cls._aggregate_coach_ratings(season, template)

        # Gather all tryout station scores
        tryout_scores = cls._aggregate_tryout_scores(season, template)

        # Normalize and blend
        return cls._blend_scores(coach_ratings, tryout_scores, weights, template)

    @classmethod
    def _normalize_score(cls, value, field_def, all_values):
        """Normalize a single score based on field type (scale/time/count)."""
        # Linear normalization (existing pattern from scoreNormalization.ts)
        if field_def['type'] == 'time':
            # Lower is better - invert scale
            min_val, max_val = cls._calculate_range(all_values, percentile=5)
            return ((max_val - value) / (max_val - min_val)) * 100
        else:
            # Higher is better
            return (value / field_def['max']) * 100
```

### Pattern 2: Live Preview with useMemo + Debouncing
**What:** Recalculate composite scores in real-time as slider moves, memoized to avoid unnecessary recalculation
**When to use:** Weight configuration sliders (coach vs tryout, station-level weights)
**Example:**
```typescript
// Source: Existing AlgorithmComparisonPanel.tsx pattern
const CompositeScorePage = () => {
  const [weights, setWeights] = useState({ coachRating: 40, tryoutScore: 60 });

  // Memoized calculation - only recalculates when weights change
  const rankedPlayers = useMemo(() => {
    return calculateCompositeScores(coachRatings, tryoutScores, weights);
  }, [coachRatings, tryoutScores, weights]);

  // For slider onChange, use lodash debounce or native debouncing
  const handleWeightChange = useMemo(
    () => debounce((newWeights) => setWeights(newWeights), 100),
    []
  );

  return (
    <WeightSlider value={weights.coachRating} onChange={handleWeightChange} />
    <RankingsList players={rankedPlayers} />
  );
};
```

### Pattern 3: Expandable Row Detail (TanStack Table)
**What:** Click row to expand inline detail section showing evaluation breakdown
**When to use:** Per-player evaluation history view
**Example:**
```typescript
// Source: Material React Table / TanStack Table pattern
const RankingsList = ({ players }) => {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  return (
    <table>
      {players.map(player => (
        <>
          <tr onClick={() => toggleExpanded(player.id)} className="cursor-pointer">
            <td>{player.rank}</td>
            <td>{player.name}</td>
            <td>{player.compositeScore.toFixed(1)}</td>
            <td className="text-gray-500 text-sm">
              {player.dataSources.join(' + ')}
            </td>
          </tr>
          {expandedRows.has(player.id) && (
            <tr>
              <td colSpan={4}>
                <PlayerEvaluationBreakdown player={player} />
              </td>
            </tr>
          )}
        </>
      ))}
    </table>
  );
};
```

### Anti-Patterns to Avoid
- **Don't calculate composites on every API call** - Cache normalized scores, recalculate only when weights change or new evaluations submitted
- **Don't interleave partial-data players in main rankings** - Separate tiers prevent unfair comparisons (coach-only shouldn't compete directly with full-data)
- **Don't use uncontrolled weight updates** - Always validate weight sums to 100% before applying
- **Don't skip data source indicators** - Users must know which players have partial data

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Score normalization | Custom linear scaling logic | Existing `scoreNormalization.ts` functions | Already tested, handles edge cases (min=max, null values) |
| Statistical normalization | Manual z-score calculation | NumPy/SciPy `scipy.stats.zscore()` | Handles outliers, edge cases, optimized C implementation |
| Percentile calculation | Custom percentile logic | NumPy `np.percentile()` or SciPy `scipy.stats.percentileofscore()` | Multiple calculation methods, robust handling |
| Weighted averaging | Manual weighted sum | Existing `weightedAverage()` in scoreNormalization.ts | Handles null values, division by zero |
| Debounced slider | setTimeout/clearTimeout | Lodash `debounce()` or existing patterns | Handles leading/trailing edge cases |
| Missing data imputation | Zero-fill or mean imputation | Separate tier system + manual promotion | More transparent, gives admins control |

**Key insight:** Score normalization looks simple (just divide by max) but has many edge cases: missing data, min=max, outliers, different scale directions (higher vs lower is better). Use proven libraries and existing codebase patterns.

## Common Pitfalls

### Pitfall 1: Using Linear Normalization on Skewed Distributions
**What goes wrong:** If 90% of players run 6.0-7.0s and one player runs 3.5s, linear normalization compresses the 6.0-7.0s into a tiny range (0-20%) and gives the outlier 100%
**Why it happens:** Linear normalization assumes uniform distribution across the range
**How to avoid:** Use percentile-based range calculation (existing `calculateTimeRange()` in scoreNormalization.ts excludes bottom/top 5% as outliers)
**Warning signs:** Top player has 100 score, everyone else clustered below 30

### Pitfall 2: Interleaving Partial-Data Players in Main Rankings
**What goes wrong:** Player with only coach rating (60/100) ranks higher than player with both sources (coach 50 + tryout 80 = 65 composite), but coach-only score is less reliable
**Why it happens:** Treating all composite scores as directly comparable regardless of data sources
**How to avoid:** Separate tiers (full-data, coach-only, tryout-only) with manual promotion/demotion capability
**Warning signs:** Admins manually demoting players after reviewing their limited data

### Pitfall 3: Expensive Recalculation on Every Slider Event
**What goes wrong:** Slider fires onChange 60+ times per second during drag, each triggering full composite recalculation, UI freezes
**Why it happens:** Not debouncing or memoizing expensive calculations
**How to avoid:** Wrap calculation in useMemo with dependencies, debounce onChange handler, or use controlled updates (onChangeCommitted)
**Warning signs:** UI lag during slider drag, React DevTools showing excessive re-renders

### Pitfall 4: Not Validating Weight Configuration
**What goes wrong:** Admin sets coach=70%, tryout=50% (sums to 120%), produces inflated composite scores
**Why it happens:** No validation that weights sum to 100%
**How to avoid:** Linked sliders (moving one adjusts the other), validation on save, clear error messages
**Warning signs:** Composite scores > 100, unexpected ranking changes

### Pitfall 5: Ignoring Score Type Directionality
**What goes wrong:** Normalizing running times (lower is better) same as rating scales (higher is better), fast runners get low scores
**Why it happens:** Not checking `lowerIsBetter` flag in field definitions
**How to avoid:** Use existing `normalizeScore()` with `lowerIsBetter` parameter (already in scoreNormalization.ts)
**Warning signs:** Best athletes have worst composite scores

## Code Examples

Verified patterns from existing codebase and official sources:

### Linear Normalization (Existing Pattern)
```typescript
// Source: src/utils/scoreNormalization.ts (existing codebase)
export function normalizeScore(
  value: number | null | undefined,
  inputMin: number,
  inputMax: number,
  lowerIsBetter: boolean = false
): number | null {
  if (value === null || value === undefined || isNaN(value)) {
    return null;
  }

  if (!lowerIsBetter) {
    // For scales/counts: higher is better
    if (value <= 0) return 0;
    if (value >= inputMax) return 100;
    return (value / inputMax) * 100;
  }

  // For times: lower is better (inverted)
  const clampedValue = Math.max(inputMin, Math.min(inputMax, value));
  const range = inputMax - inputMin;
  if (range === 0) return 50; // Edge case: min === max
  return ((inputMax - clampedValue) / range) * 100;
}
```

### Weighted Average with Null Handling (Existing Pattern)
```typescript
// Source: src/utils/scoreNormalization.ts (existing codebase)
export function weightedAverage(
  scores: { value: number | null; weight: number }[]
): number | null {
  let totalWeight = 0;
  let weightedSum = 0;

  for (const { value, weight } of scores) {
    if (value !== null && !isNaN(value)) {
      weightedSum += value * weight;
      totalWeight += weight;
    }
  }

  if (totalWeight === 0) return null;
  return weightedSum / totalWeight;
}
```

### Django JSONField Aggregation
```python
# Source: Django docs + community patterns
from django.contrib.postgres.fields.jsonb import KeyTextTransform
from django.db.models import Sum, Avg
from django.db.models.functions import Cast
from django.db.models import FloatField

# Aggregate nested JSON scores
season_players = GroupPlayer.objects.filter(season=season).annotate(
    avg_hitting_score=Avg(
        Cast(
            KeyTextTransform('hitting_score', 'scores__scores'),
            FloatField()
        )
    )
)
```

### useMemo with Expensive Calculation (Existing Pattern)
```typescript
// Source: src/components/teamBuilder/AlgorithmComparisonPanel.tsx (existing codebase)
const { comparisons, results } = useMemo<AllAlgorithmsResult>(() => {
  return runAllAlgorithms(players, teams, resolvedRequests, config);
}, [players, teams, resolvedRequests, config]);
// Only recalculates when dependencies change
```

### NumPy Percentile (Optional, for v2 Z-Score)
```python
# Source: NumPy official docs - https://numpy.org/doc/stable/reference/generated/numpy.percentile.html
import numpy as np

# Calculate 5th and 95th percentile for outlier exclusion
times = [6.5, 7.0, 6.8, 3.5, 7.2, 6.9]  # 3.5 is outlier
p5, p95 = np.percentile(times, [5, 95])
# Use p5, p95 as min/max for normalization range
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Zero-fill missing data | Separate tiers for partial data | 2020s research | More transparent, gives admins control over incomplete evaluations |
| Fixed normalization ranges | Percentile-based dynamic ranges | NumPy/Pandas adoption | Better handling of outliers, fairer distributions |
| Manual weight recalculation | Live preview with useMemo | React 18+ | Better UX, admins can explore "what if" scenarios instantly |
| Client-side only calculation | Backend service + frontend cache | Modern APIs | Consistent results, supports future API consumers |

**Deprecated/outdated:**
- **Fixed normalization ranges (0-5, 0-100)**: Modern approach uses percentile-based ranges calculated from actual data to exclude outliers
- **Mean imputation for missing data**: Current best practice for composite scoring is transparency (show partial data status) rather than statistical imputation
- **Single composite score without breakdown**: Users expect explainability - must show how coach rating + tryout scores combined

## Open Questions

1. **Z-score normalization necessity**
   - What we know: Z-score better for non-uniform distributions, but harder to explain to non-technical admins
   - What's unclear: Will real tryout data have distributions skewed enough to warrant z-score over linear?
   - Recommendation: Start with linear (existing pattern), collect real data, implement z-score in v2 if distributions prove unfair. Add feature flag to switch between methods.

2. **Weight configuration persistence**
   - What we know: Context doc defers "save multiple weight configurations" to Claude's discretion
   - What's unclear: Do admins need to compare multiple saved configurations, or is one active configuration sufficient?
   - Recommendation: Start with single active configuration stored in Season model (simpler). Add named configurations in v2 if user feedback requests it.

3. **Station-level vs top-level weights**
   - What we know: Context doc specifies station-level weights (hitting 30%, fielding 20%, etc.) in addition to coach vs tryout split
   - What's unclear: UI complexity - should both be exposed simultaneously or separate screens?
   - Recommendation: Two-step UI: (1) Simple slider for coach% vs tryout%, (2) Expandable "Advanced" panel for station-level fine-tuning. Most admins will use simple slider only.

4. **Normalization algorithm selection UI**
   - What we know: Linear vs z-score normalization produces different rankings
   - What's unclear: Should this be admin-configurable or system-determined?
   - Recommendation: Hidden for v1 (always linear), expose as "Normalization Method" dropdown in v2 if data proves z-score necessary. Include tooltip explaining difference.

## Sources

### Primary (HIGH confidence)
- [Codebase: scoreNormalization.ts](file:///Users/ckutting/development/gaimplan/little-league-draft/src/utils/scoreNormalization.ts) - Existing linear normalization patterns
- [Codebase: AlgorithmComparisonPanel.tsx](file:///Users/ckutting/development/gaimplan/little-league-draft/src/components/teamBuilder/AlgorithmComparisonPanel.tsx) - useMemo pattern for expensive calculations
- [Codebase: services_draft.py](file:///Users/ckutting/development/gaimplan/little-league-draft/server/draft/services_draft.py) - Service class pattern for business logic
- [NumPy percentile docs](https://numpy.org/doc/stable/reference/generated/numpy.percentile.html) - Official percentile calculation
- [SciPy percentileofscore docs](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.percentileofscore.html) - Official percentile ranking

### Secondary (MEDIUM confidence)
- [Google Developers: Normalization](https://developers.google.com/machine-learning/crash-course/numerical-data/normalization) - Linear vs z-score comparison
- [GeeksforGeeks: Z-Score Normalization](https://www.geeksforgeeks.org/data-analysis/z-score-normalization-definition-and-examples/) - When to use z-score
- [Codecademy: Min-Max vs Z-Score](https://www.codecademy.com/article/min-max-zscore-normalization) - Normalization method comparison
- [AHRQ: Combining Quality Measures](https://www.ahrq.gov/talkingquality/translate/scores/combine-measures.html) - Best practices for composite scores
- [PMC: Handling Missing Data in Composite Outcomes](https://pmc.ncbi.nlm.nih.gov/articles/PMC9225614/) - Research on partial data handling
- [BMC: Multiple Imputation for Composite Scores](https://bmcmedresmethodol.biomedcentral.com/articles/10.1186/s12874-018-0542-6) - Item-level vs composite-level imputation
- [Material React Table: Detail Panel](https://www.material-react-table.com/docs/guides/detail-panel) - Expandable row pattern
- [Shadcn: Expandable Sub-Rows](https://www.shadcn.io/patterns/data-table-advanced-1) - React table expansion pattern
- [Django Forum: JSONField Aggregation](https://dev.to/saschalalala/aggregation-in-django-jsonfields-4kg5) - KeyTextTransform pattern
- [Developer Way: Debouncing in React](https://www.developerway.com/posts/debouncing-in-react) - useMemo + debounce pattern

### Tertiary (LOW confidence)
- WebSearch results for "React live preview slider" - General UX patterns (not specific implementation guidance)
- WebSearch results for "composite scoring best practices" - Academic research context (not software implementation)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing codebase stack (Django, React, TypeScript), no new dependencies for v1
- Architecture: HIGH - Patterns proven in existing codebase (services_draft.py, AlgorithmComparisonPanel.tsx)
- Normalization algorithms: HIGH - Existing scoreNormalization.ts already implements linear, NumPy/SciPy well-documented for z-score
- Pitfalls: MEDIUM - Based on academic research and community experiences, validated against existing codebase patterns

**Research date:** 2026-01-30
**Valid until:** 2026-02-28 (30 days - stable domain, libraries mature)
