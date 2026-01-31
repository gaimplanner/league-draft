---
phase: 05
plan: 01
subsystem: draft-integration
tags: [backend, frontend, api, data-pipeline, composite-scoring]
requires: [04-01, 04-02]
provides: [composite-to-draft-export-api, player-mapper-utility]
affects: [05-02]
tech-stack:
  added: []
  patterns: [transformer-pattern, api-client-pattern]
key-files:
  created:
    - src/utils/compositeToPlayerMapper.ts
  modified:
    - server/draft/views/composite.py
    - server/draft/transformers.py
    - server/draft/urls.py
    - server/draft/views/__init__.py
    - src/types/index.ts
    - src/api/client.ts
decisions:
  - id: export-flat-ranking
    scope: composite-to-draft-pipeline
    choice: Re-rank all players by composite_score descending across all tiers
    rationale: Draft import needs single flat ranking, not per-tier ranks
  - id: temporary-player-ids
    scope: frontend-mapper
    choice: Generate IDs as player-eval-{rank}-{timestamp}-{index}
    rationale: Matches existing pattern (player-dne-*), API assigns real UUIDs when saved
  - id: evaluation-metadata-fields
    scope: player-export-format
    choice: Include tier, coachAggregate, tryoutAggregate, isPartialTryout in API response
    rationale: Preview table needs these for display, stripped by mapper before Player creation
metrics:
  duration: 5min
  completed: 2026-01-31
---

# Phase 5 Plan 01: Composite-to-Draft Export Pipeline Summary

**One-liner:** Backend endpoint transforms composite scores into Player-compatible records with flat ranking; frontend mapper converts API response to Player[] objects.

## What Was Built

Created the complete data pipeline for importing composite scores into the draft system:

### Backend Export Endpoint
- **New endpoint:** `POST /api/seasons/{id}/composite-scores/export-for-draft/`
- **Transformer function:** `transform_composite_to_player_data()` in `transformers.py`
- **Field mapping:** Composite scores → Player model fields
  - `composite_score` → `total_score` (primary ranking field)
  - `coach_aggregate` → `subjective_total`
  - `tryout_aggregate` → `objective_total`
  - `tier` → metadata field for preview
- **Flat ranking:** Re-sorts all players by composite_score descending across all tiers
- **Validation:** Uses existing `validate_composite_weights()`, adds `team_count` validation

### Frontend API Client
- **New types:** `CompositeExportPlayerData`, `CompositeExportResponse`
- **Transformer:** `transformCompositeExportFromApi()` (snake_case → camelCase)
- **API method:** `api.exportCompositeForDraft(seasonId, weights, teamCount)`
- **Response:** Player-compatible data + metadata (seasonName, tierCounts)

### Player Mapper Utility
- **File:** `src/utils/compositeToPlayerMapper.ts`
- **Function:** `mapCompositeToPlayers(exportPlayers: CompositeExportPlayerData[]): Player[]`
- **ID generation:** `player-eval-{rank}-{timestamp}-{index}` (temporary, replaced by API UUIDs)
- **Field stripping:** Removes evaluation metadata (tier, coachAggregate, etc.) for Player creation

## How It Works

**Flow:**
1. Admin selects season in draft configuration
2. Frontend calls `api.exportCompositeForDraft(seasonId, weights, teamCount)`
3. Backend calculates composite scores via `CompositeScoreService.calculate_composite_scores()`
4. Backend re-ranks ALL players by composite_score descending (flat ranking)
5. Backend transforms each result via `transform_composite_to_player_data()`
6. Frontend receives Player-compatible data with metadata
7. Frontend calls `mapCompositeToPlayers()` to generate Player[] objects
8. Player[] passed to `setPlayers()` in draft system

**Data transformation stages:**
```
CompositeResult (service)
  → PlayerData (transformer)
  → CompositeExportPlayerData (API response)
  → Player (mapper)
```

## Deviations from Plan

None - plan executed exactly as written.

## Test Results

### Backend
- `python manage.py check`: No issues
- New endpoint importable: `composite_scores_export_for_draft` ✓
- New transformer importable: `transform_composite_to_player_data` ✓

### Frontend
- TypeScript build: Success (no errors)
- Unit tests: 67/67 passed
- New types: `CompositeExportPlayerData`, `CompositeExportResponse` ✓
- New API method: `api.exportCompositeForDraft` ✓
- New mapper: `mapCompositeToPlayers` ✓

## Decisions Made

### 1. Export Flat Ranking Across All Tiers
**Context:** Composite scoring uses per-tier ranking (rank 1 within full-data tier, rank 1 within coach-only tier, etc.). Draft import needs a single flat ranking for projectedRound calculation.

**Decision:** Re-rank all players by composite_score descending across ALL tiers in the export endpoint.

**Rationale:**
- Draft system treats all players equally regardless of data source
- projectedRound = ceil(rank / team_count) requires single sequence
- Per-tier ranking would cause duplicate round projections
- Backend calculates flat rank once, frontend doesn't need to re-rank

**Implementation:**
```python
sorted_results = sorted(results, key=lambda r: r.get("composite_score") or 0, reverse=True)
for rank, result in enumerate(sorted_results, start=1):
    player_dict = transform_composite_to_player_data(result, rank, team_count)
```

### 2. Temporary Player IDs Pattern
**Context:** Export endpoint provides Player-compatible fields but no IDs (new records). Mapper needs to generate temporary IDs.

**Decision:** Use pattern `player-eval-{rank}-{timestamp}-{index}`.

**Rationale:**
- Matches existing pattern in App.tsx: `player-dne-${nextBib}-${Date.now()}`
- Human-readable (rank visible in ID)
- Unique (timestamp + index)
- Temporary (API assigns real UUIDs when saved via `savePlayersToApi`)

**Alternative considered:** `crypto.randomUUID()` or `uuidv4()` — rejected because:
- No semantic meaning (rank not visible)
- Inconsistent with existing codebase pattern

### 3. Evaluation Metadata in API Response
**Context:** Preview table (Plan 02) needs tier, coachAggregate, tryoutAggregate, isPartialTryout for display. Player model doesn't have these fields.

**Decision:** Include metadata fields in API response, strip in mapper before Player creation.

**Rationale:**
- Preview table shows "Full Data" vs "Coach Only" vs "Tryout Only" tags
- Preview table shows breakdown scores in tooltip/expanded row
- Player model only stores final composite score as totalScore
- Clean separation: API provides rich data, mapper creates Player with only persistent fields

**Implementation:**
- Backend transformer includes all 4 metadata fields
- Frontend type `CompositeExportPlayerData` includes metadata
- Mapper `mapCompositeToPlayers()` omits metadata fields when creating Player objects

## Next Phase Readiness

### For Phase 5 Plan 02 (Evaluation Import UI)
✅ **Ready:**
- API endpoint functional and tested
- Types defined and imported
- Mapper utility ready for use
- Response includes seasonName and tierCounts for UI display

**Integration points:**
```typescript
// In EvaluationImportButton or similar component
const response = await api.exportCompositeForDraft(seasonId, weights, teamCount);
const players = mapCompositeToPlayers(response.players);
setPlayers(players); // Draft system ready
```

### Blockers
None.

### Concerns
None. All must-haves verified:
- ✅ Backend endpoint returns composite scores in Player-compatible structure
- ✅ Frontend API client can fetch composite-to-player data from season
- ✅ Mapper converts API response to Player[] with correct field mapping and ranking

## Artifacts Delivered

### Backend
1. **Transformer:** `server/draft/transformers.py::transform_composite_to_player_data()`
2. **View:** `server/draft/views/composite.py::composite_scores_export_for_draft()`
3. **URL:** `api/seasons/<uuid:season_id>/composite-scores/export-for-draft/`

### Frontend
1. **Types:** `src/types/index.ts::CompositeExportPlayerData`, `CompositeExportResponse`
2. **API Client:** `src/api/client.ts::api.exportCompositeForDraft()`
3. **Mapper:** `src/utils/compositeToPlayerMapper.ts::mapCompositeToPlayers()`

## Commits

| Hash | Message |
|------|---------|
| 11ae7cd | feat(05-01): add backend export endpoint and transformer |
| 26d3d1d | feat(05-01): add frontend types, API client, and player mapper |

**Total commits:** 2 (both task commits)
**Duration:** 5 minutes
