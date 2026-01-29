# Architecture Research

**Domain:** Configurable evaluation system for youth sports (Little League baseball)
**Researched:** 2026-01-29
**Confidence:** HIGH (existing codebase analysis) / MEDIUM (mobile offline patterns)

## System Overview

The evaluation system adds four major subsystems to the existing application. Each integrates into the current Django + React architecture following established patterns (function-based views, hooks-based state, transformer-based API contract).

```
                           EXISTING                                  NEW
                    +-------------------+                   +---------------------+
                    | Organization      |                   | EvaluationTemplate  |
                    | (tenant)          |<------------------| (per-org config)    |
                    +---+---+---+------+                   +----------+----------+
                        |   |   |                                     |
                        |   |   |                          +----------+----------+
                        |   |   |                          |    Season           |
                        |   |   |                          |  (year container)   |
                        |   |   |                          +--+--------+--------+
                        |   |   |                             |        |
                   +----+   |   +----+              +---------+   +----+--------+
                   |        |        |              |             |             |
              +----+--+ +---+---+ +-++----+   +----+-----+  +---+--------+ +--+-----------+
              |Division| | Team  | |Player |   |CoachRating|  |TryoutEvent | |CompositeScore|
              |        | |       | |       |   |(end-of-   |  |(tryout day | |(blended      |
              |        | |       | |       |   | season)   |  | container) | | result)      |
              +--------+ +-------+ +---+---+   +----------+  +-----+------+ +--------------+
                                       |                            |
                                       |                    +-------+-------+
                                       |                    |               |
                                       |              +-----+----+  +------+-----+
                                       +------------->|StationScore|  |PlayerGroup |
                                                      |(per player,|  |(rotation   |
                                                      | per station)|  | unit)      |
                                                      +------------+  +------------+
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **EvaluationTemplate** | Define what gets evaluated (stations, scales, categories, weights) | Organization (owner), Season (applied to), TryoutEvent (structures stations) |
| **Season** | Time container grouping evaluations for a year | Organization, CoachRating, TryoutEvent, CompositeScore, Division |
| **CoachRating** | End-of-season subjective ratings by coaches for their roster players | Season, Player, Team (coach's team), User (coach who rated) |
| **TryoutEvent** | Container for a tryout day: date, stations, player groups | Season, EvaluationTemplate (defines structure), StationScore, PlayerGroup |
| **StationScore** | Individual score entry: one player at one station | TryoutEvent, Player, User (scorer) |
| **PlayerGroup** | Rotation unit (15-20 players that move through stations together) | TryoutEvent, Player (many-to-many) |
| **CompositeScore** | Blended result: weighted combination of coach rating + tryout scores | Season, Player, CoachRating (input), StationScore (input), Division (consumed by draft) |

### Key Boundary Decisions

**Evaluation models are Organization-scoped, not Division-scoped.** Rationale: A player may participate in evaluations before their division is known. Coach ratings span a season, not a division. The composite score is linked to a player at the organization level, then referenced when a division is configured for draft.

**Season is the temporal boundary, not Division.** Rationale: Coach ratings happen end-of-season (before divisions form). Tryouts happen pre-draft. Divisions are created later. Season is the natural grouping.

**EvaluationTemplate is reusable across seasons.** Rationale: Most leagues use the same evaluation structure year after year. Templates should be copyable/editable, not recreated from scratch.

## Recommended Architecture

### New Django Models (Backend)

```python
# Evaluation Template - configurable per organization
class EvaluationTemplate(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE)
    name = models.CharField(max_length=200)  # e.g., "2026 Majors Evaluation"
    description = models.TextField(blank=True)

    # Template structure stored as JSON for flexibility
    # Structure: { stations: [...], coachCategories: [...], blendWeights: {...} }
    stations = models.JSONField(default=list)
    coach_categories = models.JSONField(default=list)
    blend_weights = models.JSONField(default=dict)

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class Season(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE)
    name = models.CharField(max_length=100)  # e.g., "Spring 2026"
    year = models.IntegerField()
    template = models.ForeignKey(EvaluationTemplate, on_delete=models.PROTECT)

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)


class CoachRating(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    season = models.ForeignKey(Season, on_delete=models.CASCADE)
    player = models.ForeignKey(Player, on_delete=models.CASCADE)
    coach = models.ForeignKey(User, on_delete=models.CASCADE)

    # Ratings stored as JSON: { "fielding": 4, "hitting": 3, "baseballIQ": 5, ... }
    ratings = models.JSONField(default=dict)
    notes = models.TextField(blank=True)

    submitted_at = models.DateTimeField(null=True)
    is_draft = models.BooleanField(default=True)  # True until coach submits
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['season', 'player', 'coach'],
                name='unique_coach_rating_per_season'
            )
        ]


class TryoutEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    season = models.ForeignKey(Season, on_delete=models.CASCADE)
    name = models.CharField(max_length=200)  # e.g., "Tryout Day 1"
    date = models.DateField()

    # Which stations are active for this event (subset of template stations)
    active_stations = models.JSONField(default=list)

    is_complete = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)


class PlayerGroup(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    tryout_event = models.ForeignKey(TryoutEvent, on_delete=models.CASCADE)
    name = models.CharField(max_length=50)  # e.g., "Group A", "Group 1"
    order = models.IntegerField()  # Display/rotation order
    players = models.ManyToManyField(Player, related_name='tryout_groups')


class StationScore(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    tryout_event = models.ForeignKey(TryoutEvent, on_delete=models.CASCADE)
    player = models.ForeignKey(Player, on_delete=models.CASCADE)
    scorer = models.ForeignKey(User, on_delete=models.CASCADE)

    station_id = models.CharField(max_length=100)  # References template station ID

    # Scores stored as JSON: { "time1": 5.2, "time2": 4.9, "form": 3 }
    scores = models.JSONField(default=dict)
    notes = models.TextField(blank=True)

    scored_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['tryout_event', 'player', 'station_id'],
                name='unique_score_per_player_station'
            )
        ]


class CompositeScore(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    season = models.ForeignKey(Season, on_delete=models.CASCADE)
    player = models.ForeignKey(Player, on_delete=models.CASCADE)

    # Breakdown
    coach_rating_score = models.FloatField(default=0)      # Normalized 0-100
    tryout_score = models.FloatField(default=0)             # Normalized 0-100
    composite_score = models.FloatField(default=0)          # Blended result

    # Source tracking
    has_coach_rating = models.BooleanField(default=False)
    has_tryout_scores = models.BooleanField(default=False)

    # Detailed breakdown stored as JSON for audit/display
    breakdown = models.JSONField(default=dict)

    calculated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['season', 'player'],
                name='unique_composite_per_season'
            )
        ]
```

### New React Components (Frontend)

```
src/components/evaluation/           # EXISTING directory - extend it
    EvaluationTemplateEditor.tsx      # Template configuration UI
    SeasonManager.tsx                 # Season CRUD, template selection
    CoachRatingForm.tsx               # Coach submits ratings for roster
    CoachRatingDashboard.tsx          # Admin views all coach rating progress
    TryoutEventSetup.tsx              # Configure tryout day (groups, stations)
    StationScoringView.tsx            # MOBILE: Score players at a station
    StationScoringBulkEntry.tsx       # DESKTOP: Bulk enter scores for a station
    TryoutDashboard.tsx               # Admin overview of tryout scoring progress
    CompositeScoreView.tsx            # View blended scores, breakdown
    CompositeBlendConfig.tsx          # Configure blend weights

src/hooks/
    useEvaluationTemplate.ts          # Template CRUD
    useSeason.ts                      # Season management
    useCoachRating.ts                 # Coach rating submission and status
    useTryoutEvent.ts                 # Tryout event management
    useStationScoring.ts              # Station score entry with offline queue
    useCompositeScore.ts              # Composite calculation and display

src/types/
    evaluationSystem.ts               # New types for templates, ratings, scores
```

### New Backend Views

```
server/draft/views/
    evaluation_templates.py           # Template CRUD
    seasons.py                        # Season CRUD
    coach_ratings.py                  # Coach rating submission/retrieval
    tryout_events.py                  # Tryout event management
    station_scores.py                 # Score entry (single + bulk)
    composite_scores.py               # Composite calculation + retrieval

server/draft/services/
    composite_calculator.py           # Score normalization + blending logic
    evaluation_service.py             # Template validation, season management
```

## Data Flow

### End-to-End: Template Configuration to Draft

```
1. TEMPLATE CONFIGURATION (Admin, Desktop)
   Admin configures EvaluationTemplate:
   - Stations: Infield, Base Running, Fly Balls, Pitching, Hitting
   - Each station: fields, scales, score types (scale/count/time)
   - Coach categories: Fielding, Hitting, Running, Pitching, Baseball IQ, Hustle, Coachability
   - Default blend weights: e.g., 40% coach rating, 60% tryout
     |
     v

2. SEASON SETUP (Admin, Desktop)
   Admin creates Season linked to template:
   - Year, name, template selection
   - Links to existing Organization
     |
     v

3. COACH RATINGS (Coaches, Desktop/Tablet)
   End-of-season, coaches rate their roster players:
   - Form shows coach categories from template
   - Coach selects each player, rates on configured scales
   - Saved as draft until submitted
   - Admin dashboard shows completion progress per coach
     |
     v

4. TRYOUT EVENT SETUP (Admin, Desktop)
   Admin creates TryoutEvent for a date:
   - Select which stations from template are active
   - Assign players to rotation groups (15-20 per group)
   - Assign scorers (coaches/volunteers) to stations
     |
     v

5. TRYOUT SCORING (Coaches/Volunteers, MOBILE)
   At the field, scorer uses phone:
   StationScoringView.tsx:
   - Shows current group of players at their station
   - Scorer enters scores per player per field
   - Scores queued locally, synced to API when connectivity allows
   - Visual feedback: green check when synced, yellow dot when queued
     |
     v

6. TRYOUT SCORING FALLBACK (Admin, Desktop)
   After tryout day, admin can bulk-enter from paper sheets:
   StationScoringBulkEntry.tsx:
   - Spreadsheet-style grid: players as rows, station fields as columns
   - Paste-from-clipboard support for efficiency
     |
     v

7. COMPOSITE CALCULATION (Backend)
   When admin triggers "Calculate Composites":
   composite_calculator.py:
   - Normalize coach ratings to 0-100 per category
   - Normalize tryout station scores to 0-100 per field
   - Aggregate station scores into per-station composite
   - Aggregate coach ratings into single coach score
   - Blend: (coach_weight * coach_score) + (tryout_weight * tryout_score)
   - For players with only coach rating (missed tryout): 100% coach rating
   - Store in CompositeScore with full breakdown
     |
     v

8. DRAFT INTEGRATION (Existing Flow)
   Division creation references season's composite scores:
   - Instead of CSV import, admin selects "Use Evaluation Scores"
   - System pulls CompositeScore for eligible players
   - Maps composite breakdown to existing Player score fields
   - Existing draft flow continues unchanged
```

### Coach Rating Data Flow (Detail)

```
CoachRatingForm.tsx (React)
    |
    | POST /api/seasons/{id}/coach-ratings/
    | Body: { player_id, ratings: { fielding: 4, hitting: 3, ... }, notes }
    |
    v
coach_ratings.py (Django View)
    |
    | Validate: coach has access, player is on coach's team, season active
    |
    v
CoachRating model (Django ORM)
    |
    | Stored with is_draft=true until coach explicitly submits
    |
    v
CoachRatingDashboard.tsx
    |
    | GET /api/seasons/{id}/coach-ratings/status/
    | Returns: { coaches: [{ name, totalPlayers, submitted, pending }] }
```

### Station Scoring Data Flow (Detail, with Offline Support)

```
StationScoringView.tsx (React, MOBILE)
    |
    | useStationScoring hook manages offline queue
    |
    v
useStationScoring.ts
    |
    | 1. Score entered -> stored in localStorage queue
    | 2. Navigator.onLine check
    |    - Online: POST /api/tryout-events/{id}/scores/ immediately
    |    - Offline: Queue in localStorage, show yellow indicator
    | 3. When connectivity restored (online event):
    |    - Flush queue: POST /api/tryout-events/{id}/scores/bulk/
    |    - On success: clear queue, show green
    |    - On conflict: show conflict resolution UI
    |
    v
station_scores.py (Django View)
    |
    | Validate: scorer has access, player in event, station valid
    | Upsert: CREATE or UPDATE based on unique constraint
    |
    v
StationScore model
    |
    | scored_at timestamp tracks when score was originally entered
    | updated_at tracks last modification
```

### Composite Score to Draft Integration (Detail)

```
CompositeScore (calculated, stored in DB)
    |
    | GET /api/seasons/{id}/composite-scores/?division_preset=majors
    | Returns: [{ player_id, composite_score, breakdown, has_coach, has_tryout }]
    |
    v
Division Creation (existing DivisionCreator.tsx, extended)
    |
    | New option: "Import from Evaluations" (alongside CSV/Excel)
    | Select season -> pulls composite scores for age-eligible players
    |
    v
Player Model (existing)
    |
    | Maps composite breakdown to existing Player score fields:
    |   composite_score -> total_score
    |   breakdown.fielding -> fielding_subtotal
    |   breakdown.hitting -> hitting_subtotal
    |   breakdown.pitching -> pitching_subtotal
    |   etc.
    |
    v
Existing Draft Flow (unchanged)
    |
    | Players have scores, draft proceeds as before
```

## Patterns to Follow

### Pattern 1: JSONField for Configurable Schema

**What:** Store evaluation template configuration (stations, categories, scales) as JSON in PostgreSQL JSONField rather than rigid relational tables.

**When to use:** When the structure varies per organization and evolves over time. Evaluation templates are inherently configurable -- different leagues evaluate different things.

**Trade-offs:**
- Pro: No migrations needed when templates change structure. Flexible schema per org.
- Pro: Frontend can render forms dynamically from template JSON.
- Con: No DB-level validation of JSON structure. Must validate in application code.
- Con: Cannot do SQL-level queries into JSON structure efficiently (but we don't need to -- queries are by organization/season, not by template field values).

**Why this over EAV or separate tables:** The existing codebase already uses JSONField for `scoring_weights`, `age_breakdown`, `active_stations`, `teammate_requests`, and `draft_order`. This is an established pattern in the project. EAV (Entity-Attribute-Value) would add complexity without benefit since we never query by evaluation field values -- we query by organization, season, and player.

**Example template station JSON:**
```json
{
  "stations": [
    {
      "id": "infield",
      "name": "Infield",
      "fields": [
        { "id": "groundBalls", "name": "Ground Balls", "type": "count", "min": 0, "max": 3 },
        { "id": "throwAccuracy", "name": "Throw Accuracy", "type": "scale", "min": 1, "max": 5 }
      ]
    },
    {
      "id": "baseRunning",
      "name": "Base Running",
      "fields": [
        { "id": "time1", "name": "Time 1", "type": "time", "unit": "seconds", "lowerIsBetter": true },
        { "id": "time2", "name": "Time 2", "type": "time", "unit": "seconds", "lowerIsBetter": true },
        { "id": "form", "name": "Form", "type": "scale", "min": 1, "max": 4 }
      ]
    }
  ],
  "coachCategories": [
    { "id": "fielding", "name": "Fielding", "type": "scale", "min": 1, "max": 5 },
    { "id": "hitting", "name": "Hitting", "type": "scale", "min": 1, "max": 5 },
    { "id": "baseballIQ", "name": "Baseball IQ", "type": "scale", "min": 1, "max": 5 },
    { "id": "hustle", "name": "Hustle", "type": "scale", "min": 1, "max": 5 },
    { "id": "coachability", "name": "Coachability", "type": "scale", "min": 1, "max": 5 }
  ],
  "blendWeights": {
    "coachRating": 40,
    "tryoutScore": 60
  }
}
```

**Confidence:** HIGH -- JSONField is already the established pattern in this codebase.

### Pattern 2: Offline Queue with LocalStorage for Mobile Scoring

**What:** Buffer score entries in localStorage when offline, flush to API when connectivity returns.

**When to use:** Station scoring at outdoor tryout fields where cellular connectivity is unreliable.

**Trade-offs:**
- Pro: Scorers never lose work. Entries persist even if browser is closed and reopened.
- Pro: Simple implementation using existing browser APIs (localStorage + navigator.onLine + online/offline events).
- Con: localStorage is per-origin, limited to ~5-10MB (more than enough for scores).
- Con: Conflict resolution needed if same score is entered by two devices (unlikely but possible).

**Implementation approach:**
```typescript
// useStationScoring.ts - offline queue pattern
interface QueuedScore {
  id: string;             // Client-generated UUID for deduplication
  tryoutEventId: string;
  playerId: string;
  stationId: string;
  scores: Record<string, number>;
  scoredAt: string;       // ISO timestamp when actually scored
  syncStatus: 'pending' | 'synced' | 'conflict';
}

function useStationScoring(tryoutEventId: string, stationId: string) {
  const [queue, setQueue] = useState<QueuedScore[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Listen for connectivity changes
  useEffect(() => {
    const handleOnline = () => { setIsOnline(true); flushQueue(); };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const submitScore = useCallback((playerId: string, scores: Record<string, number>) => {
    const entry: QueuedScore = {
      id: crypto.randomUUID(),
      tryoutEventId,
      playerId,
      stationId,
      scores,
      scoredAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    // Always write to localStorage first (source of truth)
    const updated = [...queue, entry];
    setQueue(updated);
    localStorage.setItem(`scores_${tryoutEventId}_${stationId}`, JSON.stringify(updated));

    // If online, try to sync immediately
    if (navigator.onLine) {
      syncScore(entry);
    }
  }, [queue, tryoutEventId, stationId]);

  return { submitScore, queue, isOnline, pendingCount: queue.filter(q => q.syncStatus === 'pending').length };
}
```

**Confidence:** MEDIUM -- This is a well-known pattern for offline-first web apps. The specific implementation will need testing on actual field devices.

### Pattern 3: Service Layer for Composite Calculation

**What:** Place composite score calculation in a Django service module, not in views or models.

**When to use:** Complex business logic that combines data from multiple models (CoachRating + StationScore + EvaluationTemplate blend weights).

**Why:** The existing codebase already follows this pattern with `services_draft.py` (DraftService class with `@transaction.atomic` methods) and `services/team_builder.py`. Composite calculation is similarly complex, spans multiple models, and should be atomic.

**Example structure:**
```python
# server/draft/services/composite_calculator.py

class CompositeCalculator:
    """Calculate composite scores from coach ratings and tryout station scores."""

    @classmethod
    @transaction.atomic
    def calculate_for_season(cls, season_id: UUID) -> list[CompositeScore]:
        """Calculate or recalculate all composite scores for a season."""
        season = Season.objects.select_related('template').get(id=season_id)
        template = season.template

        # Get all players with data in this season
        players_with_ratings = CoachRating.objects.filter(
            season=season, is_draft=False
        ).values_list('player_id', flat=True)

        players_with_scores = StationScore.objects.filter(
            tryout_event__season=season
        ).values_list('player_id', flat=True).distinct()

        all_player_ids = set(players_with_ratings) | set(players_with_scores)

        results = []
        for player_id in all_player_ids:
            composite = cls._calculate_single(season, template, player_id)
            results.append(composite)

        return results
```

**Confidence:** HIGH -- directly follows existing `services_draft.py` pattern.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Hardcoding Evaluation Structure in Models

**What people do:** Create rigid database columns for each evaluation field (e.g., `infield_ground_balls`, `baserunning_time1`, `hitting_form`) as separate FloatFields on the Player model.

**Why it's wrong:** The existing Player model already has 9 hardcoded score fields (`field_score`, `throw_score`, `hit_power`, etc.) that reflect one specific evaluation format. Adding more hardcoded fields for every possible station/category makes the model brittle and forces migrations whenever a league wants different evaluations.

**Do this instead:** Use JSONField for score storage on StationScore and CoachRating models. Template structure (what fields exist) lives in EvaluationTemplate JSON. Score values reference template field IDs. This is the same pattern the codebase uses for `scoring_weights`, `age_breakdown`, and `teammate_requests`.

### Anti-Pattern 2: Real-Time WebSocket Scoring

**What people do:** Build real-time WebSocket connections for tryout day scoring, expecting instant sync across all scorer devices.

**Why it's wrong:**
1. Outdoor baseball fields have poor cellular connectivity. WebSocket connections will drop frequently.
2. The use case does not require real-time sync between scorers -- each scorer works independently at their station.
3. Adds significant infrastructure complexity (Django Channels, Redis, connection management) for no user benefit.
4. The existing app uses no WebSocket connections and adding them would be a divergent architectural pattern.

**Do this instead:** HTTP POST with offline queue. Scorer submits, gets local confirmation immediately. Sync happens in background when connected. Admin dashboard polls periodically for progress updates. This is simpler, more reliable, and works offline.

### Anti-Pattern 3: Building Evaluation as a Separate App/Service

**What people do:** Create a separate microservice or Django app for evaluations, reasoning that it's a "different domain."

**Why it's wrong:** Evaluations share the same Organization, Player, Team, and User models. Splitting introduces cross-service data access problems. The existing app already handles multiple concerns (draft, team builder, member management) within a single Django app with domain-organized views.

**Do this instead:** Add evaluation-related models to the existing `draft` app's `models.py`. Add new view files to `server/draft/views/` (e.g., `evaluation_templates.py`, `station_scores.py`). Add services to `server/draft/services/`. This follows the established pattern of the codebase.

### Anti-Pattern 4: Duplicating Score Normalization Logic

**What people do:** Write new normalization/weighting code in the composite calculator service instead of reusing the existing score normalization utilities.

**Why it's wrong:** The codebase already has `scoreNormalization.ts` with `normalizeScore()` (handles scale, count, and time types), `weightedAverage()`, and `roundScore()`. The evaluation processor already handles the exact same problem (normalize raw scores from different scales to 0-100, then apply weights). Duplicating this creates divergent calculation logic.

**Do this instead:**
- Port the normalization logic to Python for the backend composite calculator (or keep frontend-only if composite is calculated client-side).
- Use the same normalization approach: raw score -> normalize to 0-100 based on field type -> weighted average within station -> weighted average across stations -> blend with coach rating.
- The template JSON contains `type`, `min`, `max`, and `lowerIsBetter` -- exactly what `normalizeScore()` needs.

## Recommended Project Structure (New Files)

```
src/
├── components/
│   └── evaluation/                # EXTEND existing directory
│       ├── EvaluationTemplateEditor.tsx   # Admin: configure stations + categories
│       ├── SeasonManager.tsx              # Admin: season CRUD
│       ├── CoachRatingForm.tsx            # Coach: rate players
│       ├── CoachRatingDashboard.tsx       # Admin: view rating progress
│       ├── TryoutEventSetup.tsx           # Admin: configure tryout day
│       ├── StationScoringView.tsx         # Mobile: score at station
│       ├── StationScoringBulkEntry.tsx    # Desktop: bulk score entry
│       ├── TryoutDashboard.tsx            # Admin: tryout progress overview
│       ├── CompositeScoreView.tsx         # Admin: view composite results
│       └── CompositeBlendConfig.tsx       # Admin: configure blend weights
│
├── hooks/
│   ├── useEvaluationTemplate.ts          # Template CRUD + state
│   ├── useSeason.ts                      # Season management
│   ├── useCoachRating.ts                 # Coach rating form state
│   ├── useTryoutEvent.ts                 # Tryout event management
│   ├── useStationScoring.ts              # Score entry with offline queue
│   └── useCompositeScore.ts              # Composite display + recalculation
│
├── types/
│   └── evaluationSystem.ts               # All new types
│
└── utils/
    └── compositeCalculation.ts           # Client-side composite math (optional)

server/draft/
├── models.py                             # ADD: EvaluationTemplate, Season, CoachRating,
│                                         #      TryoutEvent, PlayerGroup, StationScore,
│                                         #      CompositeScore
├── views/
│   ├── evaluation_templates.py           # Template CRUD endpoints
│   ├── seasons.py                        # Season CRUD endpoints
│   ├── coach_ratings.py                  # Rating submission + status
│   ├── tryout_events.py                  # Event management + group assignment
│   ├── station_scores.py                 # Score entry (single + bulk)
│   └── composite_scores.py              # Composite calculation trigger + retrieval
│
├── services/
│   ├── composite_calculator.py           # Score normalization + blending
│   └── evaluation_service.py             # Template validation, season workflow
│
├── transformers.py                       # ADD: transform functions for new models
└── input_validators.py                   # ADD: validation for new endpoints
```

### Structure Rationale

- **Components in `evaluation/`:** Extends the existing evaluation component directory. All import/evaluation components already live here, so tryout scoring and coach ratings are a natural extension.
- **Separate hooks per concern:** Each evaluation subsystem (template, season, coach rating, tryout scoring, composite) gets its own hook, following the pattern of `useDraft.ts`, `useDivisions.ts`, etc.
- **New types file:** `evaluationSystem.ts` parallels the existing `evaluation.ts` for Excel import types. Keeps the type namespace clean.
- **Backend views by domain:** Each view file handles one resource, following the existing pattern (`divisions.py`, `players.py`, `teams.py`, etc.).
- **Services for complex logic:** Composite calculation goes in a service, following `services_draft.py` pattern.

## Build Order (Dependency Chain)

The evaluation system has a clear dependency chain that dictates build order:

```
Phase 1: EvaluationTemplate (no dependencies on other new models)
    |
    v
Phase 2: Season (depends on EvaluationTemplate)
    |
    +---> Phase 3a: CoachRating (depends on Season + existing Player/User)
    |
    +---> Phase 3b: TryoutEvent + PlayerGroup + StationScore
    |     (depends on Season + existing Player/User)
    |     StationScoringView needs offline queue = extra complexity
    |
    v
Phase 4: CompositeScore + CompositeCalculator
    (depends on CoachRating + StationScore + EvaluationTemplate weights)
    |
    v
Phase 5: Draft Integration
    (depends on CompositeScore; extends existing Division creation)
```

**Build order implications:**
1. **Template first** -- everything else references the template structure. Can be developed and tested in isolation.
2. **Season second** -- simple CRUD, connects template to a time period. Quick to build.
3. **Coach Rating and Tryout Scoring can be parallel** -- they are independent data sources that both feed into composite. Coach Rating is simpler (standard forms), so it's a good "Phase 3a" to ship first while Tryout Scoring (with mobile and offline) is developed as "Phase 3b."
4. **Composite calculation requires both inputs** -- must come after both coach rating and tryout scoring have basic functionality.
5. **Draft integration is the final connection** -- extends existing division creation to pull from composite scores.

## Integration Points with Existing Code

### Existing Model Extensions

**Player model** -- No changes needed to the Player model itself. The Player model already has all the score fields needed for draft. The CompositeScore model stores the blended result, and when a Division is created from evaluations, the composite breakdown maps to Player's existing score fields.

**Division model** -- Add a nullable FK to Season to track which season's evaluations populated this division:
```python
# On Division model
season = models.ForeignKey(Season, on_delete=models.SET_NULL, null=True, blank=True)
```

**Organization model** -- No changes needed. EvaluationTemplate and Season reference Organization via FK.

### Existing Frontend Extensions

**App.tsx** -- Add a new `AppMode` for evaluation management (alongside 'selector', 'creator', 'draft', 'settings'):
```typescript
type AppMode = 'selector' | 'creator' | 'draft' | 'settings' | 'join' | 'evaluations';
```

**DivisionCreator.tsx** -- Add "Import from Evaluations" as a new import source option alongside CSV/Excel/Dual CSV.

**API Client (client.ts)** -- Add new endpoint methods following existing patterns:
```typescript
// New methods on api object
async listEvaluationTemplates(): Promise<EvaluationTemplate[]> { ... }
async createSeason(params: CreateSeasonParams): Promise<Season> { ... }
async submitCoachRating(params: CoachRatingParams): Promise<CoachRating> { ... }
async submitStationScore(params: StationScoreParams): Promise<StationScore> { ... }
async calculateComposites(seasonId: string): Promise<CompositeScore[]> { ... }
```

### URL Patterns (New Endpoints)

```python
# Evaluation Templates
path("api/evaluation-templates/", template_list_create),
path("api/evaluation-templates/<uuid:pk>/", template_detail),

# Seasons
path("api/seasons/", season_list_create),
path("api/seasons/<uuid:pk>/", season_detail),

# Coach Ratings
path("api/seasons/<uuid:season_id>/coach-ratings/", coach_ratings_list_create),
path("api/seasons/<uuid:season_id>/coach-ratings/status/", coach_ratings_status),
path("api/seasons/<uuid:season_id>/coach-ratings/<uuid:pk>/", coach_rating_detail),
path("api/seasons/<uuid:season_id>/coach-ratings/submit/", coach_ratings_submit),

# Tryout Events
path("api/seasons/<uuid:season_id>/tryout-events/", tryout_events_list_create),
path("api/seasons/<uuid:season_id>/tryout-events/<uuid:pk>/", tryout_event_detail),
path("api/seasons/<uuid:season_id>/tryout-events/<uuid:pk>/groups/", tryout_event_groups),

# Station Scores
path("api/tryout-events/<uuid:event_id>/scores/", station_scores_create),
path("api/tryout-events/<uuid:event_id>/scores/bulk/", station_scores_bulk),
path("api/tryout-events/<uuid:event_id>/scores/status/", station_scores_status),

# Composite Scores
path("api/seasons/<uuid:season_id>/composites/", composite_scores_list),
path("api/seasons/<uuid:season_id>/composites/calculate/", composite_scores_calculate),
```

## Mobile Scoring Considerations

### Why PWA, Not Native App

The existing application is a React SPA served via Vite. Adding mobile scoring should work within this architecture:

1. **Same codebase** -- No separate native app to maintain.
2. **Responsive design** -- Tailwind CSS is already configured; mobile layouts are straightforward.
3. **Service Worker** -- Can cache the scoring UI shell for offline access.
4. **localStorage** -- Available for offline score queue (5-10MB, more than sufficient).
5. **No app store deployment** -- Coaches can bookmark the URL; no install friction.

**Confidence:** MEDIUM -- PWA offline capabilities are well-documented but the specific experience at outdoor fields needs real-world testing.

### Mobile UX Constraints

| Constraint | Implication | Design Decision |
|------------|-------------|-----------------|
| Small screen (phone) | Cannot show full spreadsheet grid | One player at a time, swipe between players |
| Glare/sunlight | Low contrast is unreadable | High contrast, large touch targets (44px+) |
| Intermittent connectivity | API calls may fail | Offline queue with visual sync indicators |
| Dirty/wet hands | Fine motor control reduced | Large buttons, no small dropdowns |
| Time pressure | Scorer needs to be fast | Minimal taps per score, number pad input |
| Multiple device types | iOS Safari + Android Chrome | Standard web APIs only, no device-specific features |

### Offline Architecture

```
Browser (Mobile)
  |
  +-- Service Worker (optional, for app shell caching)
  |     - Caches: HTML, JS, CSS bundles
  |     - Strategy: Cache-first for static assets, network-first for API
  |
  +-- localStorage
  |     - Key: `scores_{tryoutEventId}_{stationId}`
  |     - Value: JSON array of QueuedScore objects
  |     - Cleared after successful sync
  |
  +-- useStationScoring hook
        - Writes to localStorage on every score entry
        - Attempts immediate API POST if online
        - Listens for 'online' event to flush queue
        - Shows sync status per score (pending/synced/conflict)
```

### Conflict Resolution Strategy

Conflicts are unlikely but possible (e.g., admin enters a score via bulk entry while scorer enters via mobile for same player/station):

1. **Last-write-wins with timestamp:** StationScore has `scored_at` (original entry time) and `updated_at`. The score with the later `scored_at` wins if both arrive within a window.
2. **Backend returns conflict status:** If a score already exists and was modified more recently, API returns 409 Conflict with both versions.
3. **Frontend shows resolution UI:** Simple "Your score: X, Existing score: Y -- Keep which?" dialog.
4. **Practical note:** This is a low-probability edge case. Most tryouts have one scorer per station, and bulk entry happens after tryout day (not concurrently).

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1 league, 100 players | Current architecture is fine. Single PostgreSQL instance handles everything. |
| 10 leagues, 1,000 players | Still fine. Multi-tenancy is already implemented. Add DB indexes on (season_id, player_id) for CompositeScore queries. |
| 100 leagues, 10,000 players | Composite calculation could be slow if done synchronously. Consider background task (Django management command or Celery) for bulk recalculation. Station score bulk insert benefits from `bulk_create()`. |
| 1,000+ leagues | Not a near-term concern. If reached, consider read replicas for dashboard queries and async composite calculation via task queue. |

### First Bottleneck: Composite Calculation

**What breaks:** Calculating composite scores for all players in a season involves reading all CoachRatings + all StationScores, normalizing, and writing CompositeScore rows. For 200 players with 5 stations each, that's 1,000 StationScore reads + 200 CoachRating reads + 200 CompositeScore writes.

**Mitigation:**
- Use `select_related` and `prefetch_related` to minimize queries.
- Wrap in `@transaction.atomic` for consistency.
- For the expected scale (100-200 players per league), this completes in under 1 second.
- If needed later, add incremental recalculation (only recalculate players whose data changed).

### Second Bottleneck: Tryout Day Concurrent Scoring

**What breaks:** 5-8 scorers simultaneously submitting scores during a 3-hour tryout event.

**Mitigation:**
- Each scorer writes to a different station's scores -- no contention on the same rows.
- The unique constraint on (tryout_event, player, station_id) prevents duplicates.
- PostgreSQL handles this concurrency level easily.
- Offline queue means even if API is slow, scorers don't wait.

## Sources

- **Codebase analysis:** Direct examination of all relevant source files in the repository (HIGH confidence)
  - `server/draft/models.py` -- Existing model patterns, JSONField usage, UUID PKs
  - `server/draft/services_draft.py` -- Service layer pattern with `@transaction.atomic`
  - `server/draft/views/*.py` -- Function-based view pattern with decorators
  - `server/draft/transformers.py` -- API response transformation pattern
  - `src/types/evaluation.ts` -- Existing evaluation type definitions
  - `src/utils/evaluationProcessor.ts` -- Score processing patterns
  - `src/utils/scoreNormalization.ts` -- Normalization utilities
  - `src/hooks/useDivisions.ts` -- Hook pattern for CRUD
  - `src/api/client.ts` -- API client patterns, snake_case/camelCase transforms
  - `.planning/PROJECT.md` -- Project requirements and constraints
  - `.planning/codebase/ARCHITECTURE.md` -- Existing architecture documentation
- **Architectural patterns:** Based on training data knowledge of Django + React architectures, offline-first PWA patterns, and sports evaluation systems (MEDIUM confidence -- not verified against current external sources due to unavailable web search)

---
*Architecture research for: Configurable evaluation system for youth sports*
*Researched: 2026-01-29*
