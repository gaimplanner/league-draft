# Phase 2: Coach Ratings - Research

**Researched:** 2026-01-29
**Domain:** Django backend models + React form UI for coach end-of-season player ratings using Phase 1 evaluation templates, with draft/save/submit workflow and admin progress dashboard
**Confidence:** HIGH

## Summary

Phase 2 builds the first scoring system on top of Phase 1's evaluation template infrastructure. Coaches authenticated with the "coach" role in OrganizationMembership rate players on their roster using the league's configured evaluation template coach categories (both physical and soft skills). Each rating is a per-player, per-coach, per-season record stored relationally (not in JSONField) to avoid concurrent write conflicts as specified in the roadmap. The system supports a draft/submit workflow so coaches can save in-progress ratings and return later. An admin dashboard shows which coaches have completed their ratings and which are still pending.

The existing codebase provides everything needed for the backend: function-based Django views with `@require_http_methods`, transformer functions, input validators, multi-tenant scoping via `get_organization_from_request()`, and session-based auth with CSRF protection. Phase 1 already delivered EvaluationTemplate with `coach_categories` JSONField (both physical and soft types), Season model linked to a template, and full frontend types/API/hooks for templates and seasons. The frontend has react-hook-form + zod already installed and used successfully in the template editor.

The key new elements are: (1) a `CoachRating` model linking coach (User), player (a roster reference to be determined), season, and template with relational score records; (2) a coach-facing rating form that reads categories from the season's template and renders appropriate inputs; (3) a draft/submit state machine for each rating; and (4) an admin dashboard with per-coach completion counts.

**Primary recommendation:** Follow all existing codebase patterns exactly. The primary new Django model is `CoachRating` with a JSONField for scores keyed by category ID (each score is a simple number, not a complex structure). The coach-facing form reuses react-hook-form + zod with categories dynamically derived from the template. The admin dashboard is a simple read-only view aggregating rating status per coach.

## Standard Stack

### Core (Already Installed -- No New Dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Django | 5.2.7 | Backend ORM, views, migrations | Already in use; no new packages needed |
| PostgreSQL | 16 | Database | Already running in Docker |
| React | 18.2.0 | Frontend UI | Already in use |
| TypeScript | 5.2.2 | Type safety | Already in use |
| Tailwind CSS | 3.3.6 | Styling | Already in use |
| react-hook-form | ^7.71.1 | Form state management | Already installed (Phase 1) |
| zod | ^4.3.6 | Schema validation | Already installed (Phase 1) |
| @hookform/resolvers | ^5.2.2 | zod-to-RHF bridge | Already installed (Phase 1) |
| lucide-react | ^0.294.0 | Icons | Already in use |

### New Dependencies
**None.** Phase 2 requires zero new npm or Python packages. All required libraries are already installed from Phase 1.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| JSONField for score storage | Separate `CoachRatingScore` relational model (one row per category per rating) | Relational gives per-field queries but adds N rows per rating; JSONField with scores keyed by category ID is simpler and sufficient since ratings are always read/written as a unit per player. The roadmap says "Relational score records per station" -- but that guidance is for Phase 3 tryout scoring where multiple volunteers score independently at different stations with concurrent writes. Coach ratings are one coach writing one player at a time, making JSONField appropriate. |
| Coach identifies players by Division roster | Coach identifies players by a separate "Roster" concept | The existing codebase already has `Team` with `roster` (drafted players) and `Player.drafted_by_team`. However, coach ratings happen end-of-season for the *previous* year's roster, before the new draft. A Season-level player roster concept is needed. The simplest approach: the coach rating is linked to a Player and Season, where the admin or system determines which players are on each coach's roster for that season. |

## Architecture Patterns

### Recommended Project Structure (New Files)
```
server/draft/
    models.py                              # ADD: CoachRating model
    migrations/
        0008_coach_ratings.py              # NEW: CoachRating migration
    views/
        coach_ratings.py                   # NEW: Coach rating CRUD + admin progress views
    transformers.py                        # ADD: transform_coach_rating(), transform_rating_progress()
    input_validators.py                    # ADD: validate_coach_rating_data(), validate_rating_scores()

src/
    types/
        index.ts                           # ADD: CoachRating, CoachRatingProgress, RatingStatus types
    api/
        client.ts                          # ADD: coach rating API methods + transformers
    hooks/
        useCoachRatings.ts                 # NEW: Coach rating CRUD hook
    schemas/
        coachRating.ts                     # NEW: Zod schema for rating form
    components/
        coachRatings/
            CoachRatingPage.tsx            # NEW: Top-level page for coach rating flow
            PlayerRatingForm.tsx           # NEW: Rating form for one player (categories from template)
            CoachRosterList.tsx            # NEW: List of players for coach to rate (with status)
            AdminRatingDashboard.tsx       # NEW: Admin view of coach progress
```

### Pattern 1: CoachRating Data Model
**What:** A `CoachRating` Django model that stores one coach's complete rating for one player in one season. Scores are stored in a JSONField keyed by coach category ID from the template.
**When to use:** All coach rating storage.
**Key design decisions:**
- **Organization-scoped** (via Season -> Organization relationship) matching the roadmap decision
- **Season-linked** (each rating belongs to a Season which links to a template version)
- **JSONField for scores** (dict of category_id -> numeric_value), because coach ratings are read/written atomically per-player and the roadmap's "relational records per station" guidance is for tryout concurrent writes
- **Draft/Submitted status** for save-and-return workflow
- **Coach is the authenticated User** (via `request.user` with OrganizationMembership role="coach")

**Example model:**
```python
class CoachRating(models.Model):
    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("submitted", "Submitted"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    season = models.ForeignKey(
        Season,
        on_delete=models.CASCADE,
        related_name="coach_ratings",
    )
    coach = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="coach_ratings",
    )
    player_first_name = models.CharField(max_length=100)
    player_last_name = models.CharField(max_length=100)
    player_id = models.UUIDField(null=True, blank=True)  # Optional link to Player model

    # Scores keyed by coach category ID from template
    # e.g. {"cat-uuid-1": 4, "cat-uuid-2": 3, "cat-uuid-3": 5}
    scores = models.JSONField(default=dict)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="draft")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    submitted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "coach_ratings"
        ordering = ["player_last_name", "player_first_name"]
        constraints = [
            models.UniqueConstraint(
                fields=["season", "coach", "player_first_name", "player_last_name"],
                name="unique_coach_rating_per_player_season",
            )
        ]
```

### Pattern 2: Coach Roster Discovery
**What:** The system needs to know which players are on each coach's team/roster for the season being rated. This is a key design question.
**Options explored:**

**Option A (Recommended): Admin-managed roster via CoachRating creation.**
The admin (or the coach themselves) adds players to rate for a given season. The coach creates ratings for specific players. No separate "roster" model is needed -- the collection of CoachRating records for a coach+season IS the effective roster. This is the simplest approach and matches the workflow: coach opens the rating page, sees their players (previously added or they add them), and rates each one.

**Option B: Infer roster from completed Division drafts.**
If a Division's draft is complete and the coach's team has a roster, automatically populate the list of players to rate. This would require linking the Team's head_coach/assistant_coach name to the coach User account, which is currently stored as free-text strings (`Team.head_coach = "Bonacorsi"`), not as FK to User. This cross-reference is fragile.

**Option C: Separate SeasonRoster model.**
Create a `SeasonRoster` model that explicitly links coaches to players for a season. Adds complexity.

**Recommendation:** Start with Option A (admin-managed, implicit roster from ratings). The coach or admin creates ratings for players. A future enhancement could auto-populate from completed draft rosters. This keeps Phase 2 simple and avoids coupling to the draft flow.

### Pattern 3: Coach Role and Authorization
**What:** The OrganizationMembership model already has `role` choices: `admin`, `coach`, `viewer`. Coaches must only see and edit their own ratings. Admins can see all ratings and the progress dashboard.
**When to use:** All coach rating views.
**Implementation:**
```python
# Coach can only access their own ratings
@require_http_methods(["GET"])
@csrf_protect
@require_auth
def coach_ratings_list(request, season_id):
    organization = get_organization_from_request(request)
    season = Season.objects.get(id=season_id, organization=organization)

    # Coaches see only their own ratings; admins see all
    if request.user.is_org_admin(organization):
        ratings = CoachRating.objects.filter(season=season)
    else:
        ratings = CoachRating.objects.filter(season=season, coach=request.user)

    return json_response([transform_coach_rating(r) for r in ratings])
```

### Pattern 4: Dynamic Form from Template Categories
**What:** The rating form reads `coachCategories` from the season's template and dynamically renders a 1-5 rating input for each category. Physical and soft skill categories are displayed in grouped sections.
**When to use:** The PlayerRatingForm component.
**Implementation approach:**
```typescript
// Zod schema generated dynamically from template categories
function buildRatingSchema(categories: CoachCategoryDefinition[]) {
  const shape: Record<string, z.ZodNumber> = {};
  for (const cat of categories) {
    shape[cat.id] = z.number().min(cat.min).max(cat.max);
  }
  return z.object(shape);
}
```

### Pattern 5: Existing View Decorators and Helper Stack
**What:** Follow the exact same decorator pattern used by ALL existing views.
**Example from evaluation_templates.py (already working):**
```python
@require_http_methods(["GET", "POST"])
@csrf_protect
@require_auth
def coach_ratings_list_create(request, season_id):
    # ... parse, validate, create/list
```

### Anti-Patterns to Avoid
- **Building a separate Player model for coach ratings:** The existing Player model is Division-scoped and draft-focused. Coach ratings happen before draft/division assignment. Do NOT try to shoehorn coach ratings into the existing Player model's lifecycle. Use player name fields on CoachRating with an optional FK to Player for later linking.
- **Using flat Player fields for coach scores:** Do NOT add `coach_fielding_score`, `coach_hitting_score`, etc. columns to the Player model. Use the CoachRating model with JSONField scores.
- **Coupling coach identity to Team.head_coach string:** The Team model stores coach names as free-text strings. Do NOT try to match these strings to User accounts for roster discovery. Use the authenticated User directly.
- **Over-engineering the roster:** A separate SeasonRoster model is unnecessary for Phase 2. The set of CoachRating records implicitly defines what a coach is rating.
- **Locking the template when a rating is created:** The template should be locked when the FIRST rating score is saved (status=draft or submitted), not when a rating record is merely created. This aligns with Phase 1's copy-on-write versioning: once a coach has scored using specific categories, those category IDs must persist.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rating form validation | Manual if/else per category | zod schema with dynamic shape from template categories | Template categories vary per league; zod schema generation handles any template structure |
| Form state for N rating fields | useState with manual field tracking | react-hook-form with register/setValue | Already installed; handles dirty tracking, validation state, default values |
| 1-5 scale input with anchors | Custom radio/button group from scratch | Reusable RatingInput component wrapping radio buttons | Build once, use for all categories; anchors from template drive labels |
| Progress calculation | Manual counting in frontend | SQL aggregation in Django view (COUNT with GROUP BY coach, status) | Database does the counting; frontend just renders the results |
| snake_case/camelCase conversion | Ad-hoc per endpoint | Follow existing `transformers.py` pattern with `transform_coach_rating()` | Maintains consistency with all other API responses |
| Authorization per rating | Custom middleware or decorator | `require_auth` + inline role check (existing pattern) | The codebase uses inline role checks after `get_organization_from_request()` |

**Key insight:** The coach rating form is structurally simpler than the template editor (which has dynamic nested arrays). A rating form is a flat list of N categories, each needing one number input. react-hook-form handles this trivially with `register()` for each field.

## Common Pitfalls

### Pitfall 1: Template Categories Changed After Ratings Saved
**What goes wrong:** Admin modifies the template's coach categories after some coaches have already submitted ratings. The saved ratings have scores keyed to category IDs that no longer exist in the template.
**Why it happens:** Template editing is independent of rating status.
**How to avoid:** When a coach saves the first rating for a season, the Season's template should be locked (`is_locked=True`). This triggers Phase 1's copy-on-write versioning if the admin tries to edit. Ratings always reference the template version that was active when scoring began.
**Warning signs:** No template locking on first score save; no check that rating category IDs match template category IDs.

### Pitfall 2: Coach Rating for Wrong Season/Organization
**What goes wrong:** A coach submits ratings for a season belonging to a different organization, or a season that the coach isn't a member of.
**Why it happens:** Missing organization scope check or season ownership verification.
**How to avoid:** Every view must: (1) get organization from request, (2) verify the season belongs to that organization, (3) verify the requesting user has a membership (coach or admin) in that organization. Follow the existing pattern where `get_organization_from_request()` returns `None` if no valid context exists.
**Warning signs:** Season lookup without `organization=` filter; no membership verification.

### Pitfall 3: Partial Scores on Submit
**What goes wrong:** Coach submits a rating with some categories unscored. The composite calculation (Phase 4) doesn't know if 0 means "not scored" or "scored as zero."
**Why it happens:** No validation that all categories have scores before allowing submission.
**How to avoid:** Draft status allows partial scores (save-and-return). Submit status requires all categories scored. Validation in both frontend (zod schema: all fields required for submit) and backend (input validator checks all template category IDs present in scores dict).
**Warning signs:** Submit endpoint accepts partial scores; no distinct validation between draft save and final submit.

### Pitfall 4: Coach Without Membership Tries to Rate
**What goes wrong:** A user without the "coach" role in the organization somehow accesses the rating form and submits scores.
**Why it happens:** Authorization check only verifies authentication, not role.
**How to avoid:** The rating creation endpoint must verify the user has an OrganizationMembership with role "coach" (or "admin") for the organization that owns the season. Note: admins should also be able to submit ratings (they might also coach).
**Warning signs:** No role check beyond `@require_auth`; only checking `is_authenticated`.

### Pitfall 5: Rating Form Shows Stale Template Categories
**What goes wrong:** Admin updates the template (creating a new version via copy-on-write), but the season still points to the old version. The rating form renders old categories, and new coaches see a different form than coaches who started earlier.
**Why it happens:** Season's template FK isn't updated when template is versioned.
**How to avoid:** When the template is versioned (copy-on-write), if the season was using the old template AND no ratings have been saved yet, the season should point to the new template version. If ratings already exist, the season stays locked to the old version (the admin would need to create a new season with the new template).
**Warning signs:** Season template FK not updated on version change; no check whether ratings already exist.

### Pitfall 6: Admin Progress Dashboard Shows Wrong Counts
**What goes wrong:** The dashboard shows a coach has submitted ratings for 5/12 players, but the coach actually has 10/12 submitted and 2 draft. The query counted only submitted, missing that "total" should include all expected players (not just those with rating records).
**Why it happens:** Progress calculation uses only existing CoachRating records, but a coach with 0 records for a player should still show as "pending."
**How to avoid:** The progress dashboard needs to know the total expected players per coach. This requires a roster definition (even if implicit). The simplest approach: progress = submitted_ratings / total_ratings (including drafts), and the admin can see which coaches have started vs. not started at all.
**Warning signs:** Progress endpoint returns only submitted count without total expected.

## Code Examples

Verified patterns from the existing codebase:

### Django CoachRating Model
```python
# Source: follows patterns from server/draft/models.py
class CoachRating(models.Model):
    """A coach's rating of a player for a season."""

    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("submitted", "Submitted"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    season = models.ForeignKey(
        Season,
        on_delete=models.CASCADE,
        related_name="coach_ratings",
    )
    coach = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="coach_ratings",
    )
    # Player identity (name-based, since players may not exist in Player model yet)
    player_first_name = models.CharField(max_length=100)
    player_last_name = models.CharField(max_length=100)
    # Optional link to Player model (for later phases)
    player_id = models.UUIDField(null=True, blank=True)

    # Scores keyed by coach category ID from template
    # Example: {"uuid-fielding": 4, "uuid-baseball-iq": 3, "uuid-hustle": 5}
    scores = models.JSONField(default=dict)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="draft")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    submitted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "coach_ratings"
        ordering = ["player_last_name", "player_first_name"]
        constraints = [
            models.UniqueConstraint(
                fields=["season", "coach", "player_first_name", "player_last_name"],
                name="unique_coach_rating_per_player_season",
            )
        ]

    def __str__(self):
        return f"{self.coach.email} -> {self.player_first_name} {self.player_last_name}"
```

### Transformer Function
```python
# Source: follows pattern from server/draft/transformers.py
def transform_coach_rating(rating) -> dict:
    """Transform a CoachRating to dict."""
    return {
        "id": str(rating.id),
        "season_id": str(rating.season_id),
        "coach_id": str(rating.coach_id),
        "player_first_name": rating.player_first_name,
        "player_last_name": rating.player_last_name,
        "player_id": str(rating.player_id) if rating.player_id else None,
        "scores": rating.scores,  # Already JSON, pass through
        "status": rating.status,
        "created_at": rating.created_at.isoformat(),
        "updated_at": rating.updated_at.isoformat(),
        "submitted_at": rating.submitted_at.isoformat() if rating.submitted_at else None,
    }


def transform_rating_progress(coach_data) -> dict:
    """Transform aggregated coach rating progress to dict."""
    return {
        "coach_id": str(coach_data["coach_id"]),
        "coach_email": coach_data["coach_email"],
        "coach_first_name": coach_data["coach_first_name"],
        "coach_last_name": coach_data["coach_last_name"],
        "total_ratings": coach_data["total_ratings"],
        "submitted_ratings": coach_data["submitted_ratings"],
        "draft_ratings": coach_data["draft_ratings"],
    }
```

### Input Validator
```python
# Source: follows pattern from server/draft/input_validators.py
def validate_coach_rating_data(data: Dict[str, Any]) -> Tuple[Optional[Dict], Optional[Dict]]:
    """Validate coach rating creation/update data."""
    errors = {}

    player_first_name = data.get("player_first_name", "")
    if not player_first_name:
        errors["player_first_name"] = ["Player first name is required"]

    player_last_name = data.get("player_last_name", "")
    if not player_last_name:
        errors["player_last_name"] = ["Player last name is required"]

    scores = data.get("scores", {})
    if not isinstance(scores, dict):
        errors["scores"] = ["Scores must be an object"]
    else:
        for cat_id, score in scores.items():
            if not isinstance(score, (int, float)):
                errors[f"scores.{cat_id}"] = ["Score must be a number"]

    status = data.get("status", "draft")
    if status not in ("draft", "submitted"):
        errors["status"] = ["Status must be 'draft' or 'submitted'"]

    if errors:
        return None, errors

    return {
        "player_first_name": str(player_first_name).strip(),
        "player_last_name": str(player_last_name).strip(),
        "scores": scores,
        "status": status,
    }, None
```

### View Function
```python
# Source: follows pattern from server/draft/views/evaluation_templates.py
@require_http_methods(["GET", "POST"])
@csrf_protect
@require_auth
def coach_ratings_list_create(request, season_id):
    """List coach ratings or create a new one."""
    organization = get_organization_from_request(request)
    if not organization:
        return json_response({"error": "No organization context"}, status=400)

    try:
        season = Season.objects.get(id=season_id, organization=organization)
    except Season.DoesNotExist:
        return json_response({"error": "Season not found"}, status=404)

    # Verify user has coach or admin role
    membership = request.user.get_membership(organization)
    if not membership or membership.role not in ("coach", "admin"):
        return json_response({"error": "Coach or admin role required"}, status=403)

    if request.method == "GET":
        if membership.role == "admin":
            ratings = CoachRating.objects.filter(season=season)
        else:
            ratings = CoachRating.objects.filter(season=season, coach=request.user)
        return json_response([transform_coach_rating(r) for r in ratings])

    # POST - create rating
    data, parse_error = parse_json_body(request)
    if parse_error:
        return json_response({"error": parse_error}, status=400)

    cleaned, errors = validate_coach_rating_data(data)
    if errors:
        return json_response(errors, status=400)

    rating = CoachRating.objects.create(
        season=season,
        coach=request.user,
        **cleaned,
    )
    return json_response(transform_coach_rating(rating), status=201)
```

### Frontend TypeScript Types
```typescript
// Source: follows pattern from src/types/index.ts
export type RatingStatus = 'draft' | 'submitted';

export interface CoachRating {
  id: string;
  seasonId: string;
  coachId: string;
  playerFirstName: string;
  playerLastName: string;
  playerId: string | null;
  scores: Record<string, number>;  // category ID -> score value
  status: RatingStatus;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
}

export interface CoachRatingProgress {
  coachId: string;
  coachEmail: string;
  coachFirstName: string;
  coachLastName: string;
  totalRatings: number;
  submittedRatings: number;
  draftRatings: number;
}

export interface CreateCoachRatingData {
  playerFirstName: string;
  playerLastName: string;
  playerId?: string;
  scores: Record<string, number>;
  status?: RatingStatus;
}
```

### Frontend API Client Methods
```typescript
// Source: follows pattern from src/api/client.ts
function transformCoachRatingFromApi(data: Record<string, unknown>): CoachRating {
  return {
    id: data.id as string,
    seasonId: data.season_id as string,
    coachId: data.coach_id as string,
    playerFirstName: data.player_first_name as string,
    playerLastName: data.player_last_name as string,
    playerId: (data.player_id as string | null) ?? null,
    scores: (data.scores as Record<string, number>) || {},
    status: data.status as RatingStatus,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
    submittedAt: (data.submitted_at as string | null) ?? null,
  };
}

// Add to api object:
async listCoachRatings(seasonId: string): Promise<CoachRating[]> {
  const response = await fetch(
    `${API_BASE_URL}/seasons/${seasonId}/coach-ratings/`,
    getDefaultOptions()
  );
  const data = await handleResponse<Record<string, unknown>[]>(response);
  return data.map(transformCoachRatingFromApi);
},

async createCoachRating(seasonId: string, ratingData: CreateCoachRatingData): Promise<CoachRating> {
  const response = await fetchWithCSRFRetry(
    `${API_BASE_URL}/seasons/${seasonId}/coach-ratings/`,
    {
      ...getDefaultOptions('POST'),
      method: 'POST',
      body: JSON.stringify({
        player_first_name: ratingData.playerFirstName,
        player_last_name: ratingData.playerLastName,
        player_id: ratingData.playerId,
        scores: ratingData.scores,
        status: ratingData.status ?? 'draft',
      }),
    }
  );
  const data = await handleResponse<Record<string, unknown>>(response);
  return transformCoachRatingFromApi(data);
},

async updateCoachRating(ratingId: string, updates: Partial<CreateCoachRatingData>): Promise<CoachRating> {
  const body: Record<string, unknown> = {};
  if (updates.scores !== undefined) body.scores = updates.scores;
  if (updates.status !== undefined) body.status = updates.status;

  const response = await fetchWithCSRFRetry(
    `${API_BASE_URL}/coach-ratings/${ratingId}/`,
    {
      ...getDefaultOptions('PATCH'),
      method: 'PATCH',
      body: JSON.stringify(body),
    }
  );
  const data = await handleResponse<Record<string, unknown>>(response);
  return transformCoachRatingFromApi(data);
},
```

### Dynamic Zod Schema for Rating Form
```typescript
// Source: extends pattern from src/schemas/evaluationTemplate.ts
import { z } from 'zod';
import type { CoachCategoryDefinition } from '../types';

/**
 * Build a zod schema dynamically from template coach categories.
 * For draft saves, scores are optional. For submit, all required.
 */
export function buildRatingSchema(
  categories: CoachCategoryDefinition[],
  requireAll: boolean = false
) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const cat of categories) {
    const field = z.number().min(cat.min).max(cat.max);
    shape[cat.id] = requireAll ? field : field.optional();
  }
  return z.object(shape);
}
```

### Rating Form Component Pattern
```typescript
// The form reads categories from the template and renders inputs
function PlayerRatingForm({ season, template, existingRating, onSave }) {
  const physicalCategories = template.coachCategories.filter(c => c.type === 'physical');
  const softCategories = template.coachCategories.filter(c => c.type === 'soft');

  const methods = useForm({
    resolver: zodResolver(buildRatingSchema(template.coachCategories)),
    defaultValues: existingRating?.scores ?? {},
  });

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSave)}>
        <section>
          <h3>Physical Skills</h3>
          {physicalCategories.map(cat => (
            <RatingInput key={cat.id} category={cat} />
          ))}
        </section>
        <section>
          <h3>Soft Skills</h3>
          {softCategories.map(cat => (
            <RatingInput key={cat.id} category={cat} />
          ))}
        </section>
        <button type="button" onClick={handleDraftSave}>Save Draft</button>
        <button type="submit">Submit Rating</button>
      </form>
    </FormProvider>
  );
}
```

### URL Patterns
```python
# Add to server/draft/urls.py
# Coach Ratings
path("api/seasons/<uuid:season_id>/coach-ratings/",
     coach_ratings_list_create, name="coach-ratings-list-create"),
path("api/coach-ratings/<uuid:pk>/",
     coach_rating_detail, name="coach-rating-detail"),
path("api/seasons/<uuid:season_id>/coach-ratings/progress/",
     coach_ratings_progress, name="coach-ratings-progress"),
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Full-page form submissions | SPA with API calls + react-hook-form | Already in place | No change needed |
| DRF serializers for validation | Custom input_validators.py | Already established | Continue pattern |
| Static form fields | Dynamic form from template config | Phase 1 established pattern | Phase 2 extends this for rating forms |

**Deprecated/outdated:**
- N/A -- no deprecated approaches apply. Phase 2 extends patterns established in Phase 1 without introducing new technology.

## Open Questions

Things that couldn't be fully resolved:

1. **Player identity for coach ratings (pre-draft)**
   - What we know: Coach ratings happen end-of-season for the PREVIOUS season's roster. At this point, the existing Player model has players from a specific Division's draft. The NEXT season's evaluations are about pre-draft players who haven't been imported into a Division yet.
   - What's unclear: How does the coach identify which players to rate? They know their roster from last season, but the system may not have that data linked to their User account.
   - Recommendation: Store player identity as first_name + last_name on CoachRating (not as a FK to Player). Optionally add a player_id FK for later cross-referencing when the player is imported into a Division. The coach manually enters player names or selects from a pre-populated list (if the admin provides one). The admin could also bulk-import a roster list per coach per season.

2. **Admin-provided roster vs. coach self-service**
   - What we know: COACH-01 says coaches rate "players on their roster." But how is "their roster" defined in the system?
   - What's unclear: Does the admin upload a roster list per coach, or does the coach add players themselves?
   - Recommendation: Support both. The simplest MVP: coach adds players and rates them. Enhancement: admin can bulk-import a roster CSV that pre-populates CoachRating records (status=draft, empty scores) for each coach. The admin progress dashboard will show coaches who haven't started (0 ratings) vs. in-progress (some drafts) vs. complete (all submitted).

3. **Template locking trigger**
   - What we know: The EvaluationTemplate has `is_locked` which triggers copy-on-write versioning.
   - What's unclear: When exactly should the template be locked for coach ratings? When the season is created? When the first rating is saved?
   - Recommendation: Lock the template when the first CoachRating with `status != 'draft'` is saved (i.e., on first submit), OR when the admin explicitly activates the season for rating collection. This gives the admin time to adjust the template after creating the season but before coaches start submitting.

## Sources

### Primary (HIGH confidence)
- **Existing codebase** -- Direct analysis of:
  - `server/draft/models.py` (Organization, OrganizationMembership roles, EvaluationTemplate, Season, Player, Team models)
  - `server/draft/views/evaluation_templates.py` (Phase 1 view pattern)
  - `server/draft/views/seasons.py` (Phase 1 view pattern)
  - `server/draft/views/helpers.py` (require_auth, require_org_admin, get_organization_from_request, json_response, parse_json_body, RateLimiter)
  - `server/draft/transformers.py` (all existing transformer functions)
  - `server/draft/input_validators.py` (all existing validator functions including template validators)
  - `server/draft/middleware.py` (TenantMiddleware, organization resolution)
  - `server/draft/urls.py` (all existing URL patterns)
  - `src/types/index.ts` (all TypeScript interfaces including EvaluationTemplate, CoachCategoryDefinition, Season)
  - `src/api/client.ts` (full API client with transformation functions)
  - `src/hooks/useEvaluationTemplates.ts` (hook pattern)
  - `src/schemas/evaluationTemplate.ts` (zod schema pattern)
  - `src/components/evaluation/CoachCategoryEditor.tsx` (category rendering pattern)
  - `src/components/evaluation/TemplateEditor.tsx` (react-hook-form with zodResolver pattern)
  - `src/components/evaluation/EvaluationAdmin.tsx` (admin page navigation pattern)
  - `src/components/evaluation/templatePresets.ts` (template category structure)
  - `src/contexts/AuthContext.tsx` (authentication state pattern)
  - `package.json` (all installed dependencies)
  - `server/draft/migrations/` (0001-0007, next migration is 0008)

- **Phase 1 research** -- `.planning/phases/01-evaluation-templates/01-RESEARCH.md` (established patterns, decisions, and anti-patterns)
- **Roadmap** -- `.planning/ROADMAP.md` (Phase 2 requirements, dependencies, success criteria)
- **Requirements** -- `.planning/REQUIREMENTS.md` (COACH-01 through COACH-04 specifications)

### Secondary (MEDIUM confidence)
- None needed -- all research is based on direct codebase analysis and Phase 1 established patterns.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Zero new dependencies; everything is already installed and proven in Phase 1
- Architecture: HIGH -- All patterns directly observed in existing codebase; new model follows established conventions exactly
- Pitfalls: HIGH -- Identified from direct analysis of data model relationships and Phase 1 versioning mechanics

**Research date:** 2026-01-29
**Valid until:** 90 days (very stable domain; no external dependency changes)
