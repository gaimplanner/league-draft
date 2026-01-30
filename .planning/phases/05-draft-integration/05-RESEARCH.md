# Phase 5: Draft Integration - Research

**Researched:** 2026-01-30
**Domain:** Multi-source data import with admin approval workflow
**Confidence:** HIGH

## Summary

Phase 5 integrates the evaluation system's composite scores into the existing draft workflow. This phase must bridge two separate data models: the evaluation system (Season/GroupPlayer/CoachRating/CompositeScore) and the draft system (Division/Player/Team). The core challenge is creating a new import pathway alongside the existing CSV/Excel/Dual CSV flows while maintaining the current architecture's patterns and ensuring admins have explicit control over when evaluation data enters the draft.

**Key findings:**
- **Import source selection pattern** already exists in the codebase via `ImportTypeSelector.tsx` - extend with fourth option for evaluation import
- **Approval workflow pattern** follows existing two-step flow: preview table → explicit confirmation (used in PlayerReview, CSVVerificationStep)
- **Data mapping strategy** mirrors existing `parseCSVWithMapping()` but pulls from composite score API instead of CSV rows
- **No new dependencies required** - all patterns exist in codebase (React hooks, API client, transformer pattern)

**Primary recommendation:** Add "Import from Evaluations" option to ImportTypeSelector, create SeasonPlayerImport component following existing PlayerReview pattern, map composite score breakdowns to Player model fields via new transform function, and use existing Division phase flow to preserve approval semantics.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Django REST | 5.1 | Backend data transformation | Already in use, handles Season → Division data bridge |
| React + TypeScript | 18+ | Frontend orchestration | Existing stack, proven import workflow patterns |
| Existing API client | - | Composite score + division endpoints | No new HTTP library needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| React Hook Form | 7+ | Season selection form | Already in codebase for evaluation forms |
| Existing transformers | - | Score field mapping | Pattern established in transformers.py |
| Zod | Latest | Season selection validation | Already in use for evaluation schemas |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Extend ImportTypeSelector | New standalone page | ImportTypeSelector maintains consistency with CSV/Excel flows |
| New approval component | Reuse PlayerReview | PlayerReview pattern proven but requires data shape adaptation |
| Direct API endpoint | Service layer transform | Service layer cleaner separation but adds complexity for simple mapping |

**Installation:**
```bash
# No new dependencies required - using existing stack
```

## Architecture Patterns

### Recommended Project Structure
```
server/draft/
├── services_composite.py    # (exists) - source of composite scores
├── transformers.py           # (extend) - add transform_composite_to_player()
├── views/divisions.py        # (extend) - add import_from_season endpoint

src/
├── components/
│   ├── evaluation/
│   │   └── SeasonPlayerImport.tsx     # NEW: Season selection + preview + approve
│   └── ImportTypeSelector.tsx         # (extend) - add evaluation option
├── utils/
│   └── compositeToPlayerMapper.ts     # NEW: Map composite → Player fields
├── hooks/
│   └── useDivisions.ts                # (extend) - add importPlayersFromSeason()
├── api/
│   └── client.ts                      # (extend) - add importFromSeason()
```

### Pattern 1: Extend Import Type Selection
**What:** Add fourth option to existing ImportTypeSelector for evaluation-based import
**When to use:** Division creation flow, alongside CSV/Excel/Dual CSV options
**Example:**
```typescript
// Source: Existing ImportTypeSelector.tsx pattern
<ImportTypeSelector
  onSelectCSV={...}
  onSelectExcel={...}
  onSelectDualCSV={...}
  onSelectEvaluation={() => setImportMode('evaluation')}  // NEW
/>

// Add fourth card:
<button onClick={onSelectEvaluation}>
  <FileSpreadsheet className="w-6 h-6 text-indigo-600" />
  <h2>From Evaluations</h2>
  <p>Import composite scores from a completed season.</p>
  <ul>
    <li>• Pre-calculated composites</li>
    <li>• Coach + tryout blended</li>
    <li>• Admin-approved rankings</li>
  </ul>
</button>
```

### Pattern 2: Two-Step Approval Flow (Preview → Confirm)
**What:** Show composite scores in preview table, admin explicitly approves before creating Division players
**When to use:** SeasonPlayerImport component (mirrors PlayerReview pattern)
**Example:**
```typescript
// Source: PlayerReview.tsx pattern adapted
const SeasonPlayerImport = () => {
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
  const [compositeScores, setCompositeScores] = useState<CompositeScore[]>([]);
  const [isApproved, setIsApproved] = useState(false);

  // Step 1: Select season
  const handleSeasonSelect = async (seasonId: string) => {
    setSelectedSeason(seasonId);
    // Fetch composite scores from API
    const scores = await api.getCompositeScores(seasonId);
    setCompositeScores(scores);
  };

  // Step 2: Preview rankings table (similar to PlayerReviewTable)
  // Shows: Rank | Name | Composite | Coach Score | Tryout Score | Data Sources

  // Step 3: Admin clicks "Approve and Import"
  const handleApprove = async () => {
    await onPlayersImported(transformCompositeToPlayers(compositeScores));
    setIsApproved(true);
    onNext(); // Proceed to config phase
  };

  return isApproved ? (
    <SuccessMessage />
  ) : (
    <>
      <SeasonSelector onSelect={handleSeasonSelect} />
      {compositeScores.length > 0 && (
        <CompositeScorePreviewTable
          scores={compositeScores}
          onApprove={handleApprove}
        />
      )}
    </>
  );
};
```

### Pattern 3: Data Transformation (Composite → Player)
**What:** Map composite score breakdown to Player model fields
**When to use:** After admin approves rankings, before creating Division players
**Example:**
```typescript
// Source: parseCSVWithMapping pattern adapted
function transformCompositeToPlayers(
  compositeScores: CompositeScore[],
  seasonMetadata: SeasonMetadata
): Player[] {
  return compositeScores.map((score, index) => ({
    // Identity fields
    id: uuid(),
    bib: score.bibNumber?.toString() || `BIB-${index + 1}`,
    firstName: score.firstName,
    lastName: score.lastName,
    name: `${score.firstName} ${score.lastName}`,

    // Composite as totalScore
    totalScore: score.compositeScore,
    rank: score.rank,
    projectedRound: calculateProjectedRound(score.rank, teamCount),

    // Component scores from breakdowns
    // Map coach rating categories → Player fields
    fieldScore: score.coachBreakdown?.fielding || 0,
    throwScore: score.coachBreakdown?.throwing || 0,
    hitForm: score.coachBreakdown?.hittingForm || 0,
    hitContact: score.coachBreakdown?.contact || 0,
    pitchingForm: score.tryoutBreakdown?.pitching?.form || 0,
    pitchingStrength: score.tryoutBreakdown?.pitching?.strength || 0,
    catchScore: score.tryoutBreakdown?.flyBalls?.catches || 0,
    runningScore: score.tryoutBreakdown?.baserunning?.time || 0,

    // Metadata from season
    littleLeagueAge: seasonMetadata.ageRange || 10,
    birthday: '', // Not available from evaluation system
    isAllStar: false,
    isDNE: score.tier === 'dne' || score.dataSources.length === 0,

    // Draft state
    isDrafted: false,
    isCoachKid: false,
    sibling: '',
  }));
}
```

### Pattern 4: Backend Transform in Service Layer (Alternative)
**What:** Server-side transformation from composite scores to Player data structure
**When to use:** If mapping logic becomes complex or needs database access
**Example:**
```python
# server/draft/services_composite.py (extend)
class CompositeScoreService:
    @classmethod
    def export_to_division_format(cls, season_id: UUID) -> List[dict]:
        """Transform composite scores into Player-compatible format.

        Returns list of dicts matching Player model fields.
        """
        composite_scores = cls.calculate_composite_scores(
            season_id,
            weights=season.template.blend_weights
        )

        players = []
        for score in composite_scores:
            players.append({
                "bib": str(score["bib_number"]) if score["bib_number"] else f"BIB-{score['rank']}",
                "first_name": score["first_name"],
                "last_name": score["last_name"],
                "total_score": score["composite_score"],
                "rank": score["rank"],
                # Map breakdown to component fields
                "field_score": score.get("coach_breakdown", {}).get("fielding", 0),
                "throw_score": score.get("coach_breakdown", {}).get("throwing", 0),
                # ... continue mapping
                "is_dne": score["tier"] == "dne",
            })

        return players
```

### Anti-Patterns to Avoid
- **Don't bypass approval workflow** - Evaluation scores must not auto-populate Division without admin review (Requirement DRAFT-03)
- **Don't break existing import flows** - CSV/Excel/Dual CSV must continue working unchanged (Requirement DRAFT-02)
- **Don't duplicate composite calculation** - Always fetch from CompositeScoreService, never recalculate client-side
- **Don't lose data source transparency** - UI must show which players have partial data (coach-only, tryout-only)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Season selection UI | Custom dropdown | React Hook Form + Zod schema | Already in codebase for template forms |
| Preview table | New table component | Extend PlayerReviewTable pattern | Proven spreadsheet-style table with sorting |
| Data fetching | Custom fetch logic | Existing API client methods | Centralized error handling, transforms |
| Score mapping | Manual field assignment | Transformer function pattern | Consistent with parseCSVWithMapping |
| Approval state | Local useState only | Division phase flow | Phase persistence allows resume if browser closes |

**Key insight:** The codebase already has three import flows (CSV, Excel, Dual CSV) that converge on the same `setPlayers()` call. Evaluation import follows identical pattern: fetch data → preview → approve → setPlayers(). Don't reinvent the wheel.

## Common Pitfalls

### Pitfall 1: Breaking Existing Import Paths
**What goes wrong:** Adding evaluation import breaks CSV/Excel/Dual CSV flows
**Why it happens:** Shared code paths modified without considering all entry points
**How to avoid:** Make evaluation import a fourth parallel path, not a replacement. Test all four import modes after implementation.
**Warning signs:** Integration tests for CSV import failing, ImportTypeSelector routing broken

### Pitfall 2: Missing Approval Gate
**What goes wrong:** Composite scores auto-populate Division.players without admin review
**Why it happens:** Skipping preview step to simplify flow
**How to avoid:** Follow existing PlayerReview pattern - always show preview table with explicit "Approve and Import" button
**Warning signs:** No confirmation step, players appear in Division immediately after season selection

### Pitfall 3: Incomplete Score Mapping
**What goes wrong:** Player records created with zero values for component scores (field_score, throw_score, etc.)
**Why it happens:** Composite score structure doesn't map 1:1 to Player model fields
**How to avoid:** Define explicit mapping rules, handle missing breakdown data gracefully (default to 0 or proportional split)
**Warning signs:** Players have totalScore but all component fields are 0, draft board shows incomplete skill data

### Pitfall 4: Ignoring Partial Data Status
**What goes wrong:** Players with coach-only or tryout-only data treated same as full-data players
**Why it happens:** Not checking `tier` or `dataSources` fields from composite scores
**How to avoid:** Set `isDNE` flag for players with no evaluation data, show data source indicators in preview table
**Warning signs:** DNE players included in draft rankings, no visual distinction for partial data

### Pitfall 5: Duplicate Player Records
**What goes wrong:** Same player appears twice if imported from evaluations then CSV imported later
**Why it happens:** No deduplication check on bib number or name
**How to avoid:** Division → Player has unique constraint on (division, bib). Handle constraint violations gracefully or prevent re-import.
**Warning signs:** Database constraint errors, duplicate names in player list

### Pitfall 6: Season-Division Mismatch
**What goes wrong:** Importing AAA season scores into Majors division (wrong age range)
**Why it happens:** No validation that season age range matches division preset
**How to avoid:** Show season age range in selection UI, warn if mismatch with division configuration
**Warning signs:** 8-year-olds appearing in Majors draft, age limit violations

## Code Examples

Verified patterns from existing codebase:

### Import Type Selection (Existing Pattern)
```typescript
// Source: src/components/evaluation/ImportTypeSelector.tsx (existing codebase)
export function ImportTypeSelector({
  onSelectCSV,
  onSelectExcel,
  onSelectDualCSV
}: ImportTypeSelectorProps) {
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      <button onClick={onSelectCSV}>
        <FileText className="w-6 h-6 text-blue-600" />
        <h2>Summary CSV</h2>
      </button>
      <button onClick={onSelectExcel}>
        <FileSpreadsheet className="w-6 h-6 text-green-600" />
        <h2>Evaluation Excel</h2>
      </button>
      <button onClick={onSelectDualCSV}>
        <Users className="w-6 h-6 text-purple-600" />
        <h2>With Registration</h2>
      </button>
    </div>
  );
}
```

### API Client Pattern (Existing)
```typescript
// Source: src/api/client.ts pattern
class ApiClient {
  async getCompositeScores(seasonId: string): Promise<CompositeScore[]> {
    const response = await this.get(`/api/seasons/${seasonId}/composite-scores/`);
    return response.data;
  }

  async importPlayersFromSeason(
    divisionId: string,
    seasonId: string
  ): Promise<void> {
    await this.post(`/api/divisions/${divisionId}/import-from-season/`, {
      seasonId,
    });
  }
}
```

### Transformer Pattern (Backend)
```python
# Source: server/draft/transformers.py pattern
def transform_composite_to_player(composite_result: dict, team_count: int) -> dict:
    """Transform composite score result to Player model fields.

    Args:
        composite_result: Result from CompositeScoreService.calculate_composite_scores()
        team_count: Number of teams in division (for projected round calculation)

    Returns:
        Dict matching Player model fields
    """
    return {
        "bib": str(composite_result["bib_number"]) if composite_result["bib_number"] else f"BIB-{composite_result['rank']}",
        "first_name": composite_result["first_name"],
        "last_name": composite_result["last_name"],
        "total_score": composite_result["composite_score"],
        "rank": composite_result["rank"],
        "projected_round": calculate_projected_round(composite_result["rank"], team_count),
        # Component scores from breakdown
        "field_score": composite_result.get("coach_breakdown", {}).get("fielding_score", 0),
        "throw_score": composite_result.get("coach_breakdown", {}).get("throwing_score", 0),
        # Flags
        "is_dne": composite_result["tier"] == "dne" or len(composite_result["data_sources"]) == 0,
        "little_league_age": composite_result.get("age", 10),  # Default to 10 if not available
        # Draft state
        "is_drafted": False,
        "is_coach_kid": False,
    }
```

### useDivisions Hook Extension
```typescript
// Source: src/hooks/useDivisions.ts pattern
export function useDivisions() {
  // ... existing code

  const importPlayersFromSeason = useCallback(async (
    divisionId: string,
    seasonId: string
  ): Promise<void> => {
    try {
      setIsLoading(true);
      await api.importPlayersFromSeason(divisionId, seasonId);
      // Refresh division to get newly created players
      await refreshDivisions();
      setError(null);
    } catch (err: ApiError) {
      console.error('Failed to import from season:', err);
      setError('Failed to import players from evaluation season');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    // ... existing returns
    importPlayersFromSeason,
  };
}
```

### Preview Table Component
```typescript
// Source: PlayerReviewTable.tsx pattern adapted
interface CompositeScorePreviewTableProps {
  scores: CompositeScore[];
  onApprove: () => void;
  onCancel: () => void;
}

const CompositeScorePreviewTable = ({
  scores,
  onApprove,
  onCancel
}: CompositeScorePreviewTableProps) => {
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th>Rank</th>
              <th>Name</th>
              <th>Composite</th>
              <th>Coach Score</th>
              <th>Tryout Score</th>
              <th>Data Sources</th>
              <th>Tier</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {scores.map(score => (
              <tr key={score.playerKey}>
                <td>{score.rank}</td>
                <td>{score.firstName} {score.lastName}</td>
                <td>{score.compositeScore.toFixed(1)}</td>
                <td>{score.coachAggregate?.toFixed(1) || 'N/A'}</td>
                <td>{score.tryoutAggregate?.toFixed(1) || 'N/A'}</td>
                <td className="text-sm text-gray-500">
                  {score.dataSources.join(' + ')}
                </td>
                <td>
                  <TierBadge tier={score.tier} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between">
        <button onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
        <button onClick={onApprove} className="btn-primary">
          Approve and Import {scores.length} Players
        </button>
      </div>
    </div>
  );
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual CSV export/import | Direct API integration | Modern SaaS apps | Eliminates data loss, format errors from CSV round-trip |
| Auto-import without review | Explicit approval workflow | Post-2020 data governance | Admins maintain control, can validate before committing |
| Single import source | Multi-source selection UI | React 16+ | Users choose best import path for their workflow |
| Client-side transforms only | Backend service layer | DRF best practices | Consistent data regardless of API consumer |

**Deprecated/outdated:**
- **Auto-population without approval**: Modern admin tools require explicit confirmation before importing external data
- **CSV as only interchange format**: APIs now primary integration point, CSV is fallback/export only
- **Inline score calculation**: Composite scores calculated in backend service, not client-side

## Open Questions

1. **Score breakdown mapping specificity**
   - What we know: Composite scores have coach_breakdown and tryout_breakdown nested objects
   - What's unclear: Exact field mapping from breakdown categories to Player component fields (e.g., which coach category maps to field_score?)
   - Recommendation: Start with best-effort mapping based on field names, allow admin to review imported values in PlayerReview-style table before approval. Document mapping in transform function comments.

2. **Season metadata availability**
   - What we know: Season has name, year, template reference
   - What's unclear: Does Season store player age data, birthday, or must we infer from season year?
   - Recommendation: If Season doesn't have player ages, default littleLeagueAge based on division preset (Majors=10-12, AAA=8-10). Admin can correct in review phase.

3. **Concurrent import handling**
   - What we know: Division can have players from CSV or Evaluation import
   - What's unclear: Should evaluation import be blocked if Division already has players? Or allow merge?
   - Recommendation: For v1, require empty Division (no players). Display error if players exist: "Division already contains players. Reset division to import from evaluations." Prevents duplicate/conflict scenarios.

4. **Weight configuration source**
   - What we know: Composite scores can be calculated with custom weights OR template default weights
   - What's unclear: Should import use season's last calculated weights, or always use template defaults?
   - Recommendation: Use template blend_weights as source of truth. If admin wants different weights, they recalculate composites in Phase 4 UI before importing.

## Sources

### Primary (HIGH confidence)
- [Codebase: ImportTypeSelector.tsx](/Users/ckutting/development/gaimplan/little-league-draft/src/components/evaluation/ImportTypeSelector.tsx) - Existing import source selection pattern
- [Codebase: PlayerReview.tsx](/Users/ckutting/development/gaimplan/little-league-draft/src/components/PlayerReview.tsx) - Preview + approval workflow pattern
- [Codebase: parseCSVWithMapping](/Users/ckutting/development/gaimplan/little-league-draft/src/utils/csvParser.ts) - Data transformation pattern
- [Codebase: services_composite.py](/Users/ckutting/development/gaimplan/little-league-draft/server/draft/services_composite.py) - Composite score service API
- [Codebase: Player model](/Users/ckutting/development/gaimplan/little-league-draft/server/draft/models.py#L506) - Target data structure for import
- [Codebase: Division model](/Users/ckutting/development/gaimplan/little-league-draft/server/draft/models.py#L337) - Container for imported players
- [Codebase: useDivisions hook](/Users/ckutting/development/gaimplan/little-league-draft/src/hooks/useDivisions.ts) - Division CRUD operations

### Secondary (MEDIUM confidence)
- [React Flow: Workflow Editor](https://reactflow.dev/ui/templates/workflow-editor) - Modern workflow UI patterns
- [Ant Design](https://www.builder.io/blog/react-component-libraries-2026) - Enterprise admin panel patterns for data-heavy interfaces
- [Semantic UI React: Confirm](https://react.semantic-ui.com/addons/confirm/) - Confirmation dialog pattern

### Tertiary (LOW confidence)
- WebSearch results for "admin approval workflow" - General patterns, not specific implementation
- WebSearch results for "multi-source import UI" - UI library marketing, not architectural guidance

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing codebase stack (Django, React, TypeScript), zero new dependencies
- Architecture: HIGH - All patterns proven in existing import flows (CSV, Excel, Dual CSV)
- Data mapping: MEDIUM - Composite → Player field mapping requires domain knowledge of score categories
- Approval workflow: HIGH - PlayerReview pattern well-established, just needs data source adaptation

**Research date:** 2026-01-30
**Valid until:** 2026-02-28 (30 days - stable domain, mature codebase)
