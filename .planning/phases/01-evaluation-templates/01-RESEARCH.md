# Phase 1: Evaluation Templates - Research

**Researched:** 2026-01-29
**Domain:** Django models + React form UI for configurable evaluation templates with JSONField-based schema, template versioning, and multi-tenant scoping
**Confidence:** HIGH

## Summary

Phase 1 builds the foundational data model and admin UI for evaluation templates. This involves Django models (EvaluationTemplate, Season) with JSONField for flexible station/category configuration, a React template editor for creating and managing templates, and a versioning mechanism that preserves historical scores when templates are modified.

The existing codebase provides strong patterns to follow: function-based Django views with `@require_http_methods`, transformer functions for snake_case/camelCase conversion, input validator functions for request validation, `TenantManager` for organization-scoped queries, and UUID primary keys on all models. The frontend uses React hooks with the raw `api` client (no form library or server state manager currently installed). The codebase has no existing form library -- all forms use raw `useState`.

The primary complexity in this phase is the template editor UI, which requires dynamic form fields (add/remove/reorder stations, each with add/remove/reorder score fields). This is the strongest use case for adopting `react-hook-form` + `zod`, which handle dynamic form arrays (`useFieldArray`), schema validation, and TypeScript type inference. The backend side is straightforward Django model + view + transformer work following established patterns.

**Primary recommendation:** Follow existing codebase patterns exactly for backend (function-based views, transformers, validators). Introduce `react-hook-form` + `zod` for the template editor frontend since it is the first complex form in the evaluation system and sets the pattern for all subsequent phases.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Django | 5.2.7 | Backend framework with ORM, JSONField | Already in use; JSONField is native since Django 3.1 |
| PostgreSQL | 16 | Database with native JSON support | Already running in Docker |
| React | 18.2.0 | Frontend UI framework | Already in use |
| TypeScript | 5.2.2 | Type safety | Already in use |
| Tailwind CSS | 3.3.6 | Styling | Already in use |
| Vite | 5.0.8 | Build tool | Already in use |

### New for Phase 1
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-hook-form | ^7.71 | Form state management for template editor | Uncontrolled component approach minimizes re-renders; `useFieldArray` handles dynamic station/field arrays; best TypeScript support among form libraries |
| zod | ^4.3 | Schema validation for template structure | TypeScript-first; infers types from schemas; validates both form input and template JSON structure; current stable is v4.3.5 |
| @hookform/resolvers | ^5.2 | Connects zod to react-hook-form | Required bridge package |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-hook-form | Raw useState (current pattern) | useState works for simple forms but becomes unwieldy for dynamic arrays of stations with nested score fields; no built-in validation, dirty tracking, or field array management |
| zod | Manual validation functions | Manual validation works but duplicates type definitions; zod infers TypeScript types from schemas, eliminating the duplication |
| JSONField for template data | Separate relational tables (Station, ScoreField models) | Relational tables add migration burden when template shapes change; JSONField is already the established pattern in this codebase (used for scoring_weights, age_breakdown, teammate_requests, draft_order) |

**Installation:**
```bash
npm install react-hook-form zod @hookform/resolvers
```

**No new Python packages needed.** Django's built-in JSONField, ORM, and function-based views handle all backend requirements.

## Architecture Patterns

### Recommended Project Structure (New Files)
```
server/draft/
    models.py                          # ADD: EvaluationTemplate, Season models
    views/
        evaluation_templates.py        # NEW: Template CRUD endpoints
        seasons.py                     # NEW: Season CRUD endpoints
    transformers.py                    # ADD: transform_evaluation_template(), transform_season()
    input_validators.py                # ADD: validate_template_create_data(), validate_season_data()

src/
    types/
        index.ts                       # ADD: EvaluationTemplate, Season, Station, ScoreField types
    api/
        client.ts                      # ADD: template and season API methods
    hooks/
        useEvaluationTemplates.ts      # NEW: Template CRUD hook
        useSeasons.ts                  # NEW: Season management hook
    components/
        evaluation/
            TemplateEditor.tsx         # NEW: Main template editor (stations + categories + weights)
            StationEditor.tsx          # NEW: Single station config (name, score fields)
            ScoreFieldEditor.tsx       # NEW: Single score field config (name, type, min/max)
            CoachCategoryEditor.tsx    # NEW: Coach review category config (name, anchors)
            TemplateList.tsx           # NEW: List/select templates
            SeasonManager.tsx          # NEW: Season CRUD, template assignment
            BlendWeightsEditor.tsx     # NEW: Coach vs tryout weight slider
```

### Pattern 1: Django Function-Based Views with Validators and Transformers
**What:** Every endpoint follows the pattern: decorator stack -> parse body -> validate -> business logic -> transform response.
**When to use:** All new API endpoints.
**Example (from existing codebase):**
```python
# Source: server/draft/views/divisions.py (established pattern)
@require_http_methods(["GET", "POST"])
@csrf_protect
@require_auth
def evaluation_templates_list_create(request):
    """List templates or create a new one."""
    organization = get_organization_from_request(request)

    if request.method == "GET":
        templates = EvaluationTemplate.objects.filter(
            organization=organization,
            is_active=True
        ).order_by('-updated_at')
        return json_response([transform_evaluation_template(t) for t in templates])

    # POST - create template
    data, parse_error = parse_json_body(request)
    if parse_error:
        return json_response({"error": parse_error}, status=400)

    cleaned, errors = validate_template_create_data(data)
    if errors:
        return json_response(errors, status=400)

    template = EvaluationTemplate.objects.create(
        organization=organization,
        created_by=request.user,
        **cleaned,
    )
    return json_response(transform_evaluation_template(template), status=201)
```

### Pattern 2: JSONField with Application-Level Validation
**What:** Store flexible template configuration as JSON in PostgreSQL JSONField. Validate structure in Python (input_validators.py) and TypeScript (zod schema), not at the database level.
**When to use:** Template stations, coach categories, blend weights -- any configuration that varies per organization.
**Example template JSON structure:**
```json
{
  "stations": [
    {
      "id": "infield",
      "name": "Infield",
      "order": 1,
      "fields": [
        {
          "id": "ground_balls",
          "name": "Ground Balls",
          "type": "count",
          "min": 0,
          "max": 3,
          "description": "Successful ground ball fielding attempts out of 3"
        },
        {
          "id": "throw_accuracy",
          "name": "Throw Accuracy",
          "type": "scale",
          "min": 1,
          "max": 5,
          "anchors": {
            "1": "Cannot throw to base",
            "2": "Throws offline, poor accuracy",
            "3": "Average throw, reaches base",
            "4": "Accurate throw with good form",
            "5": "Strong, accurate throw consistently"
          }
        }
      ]
    }
  ],
  "coachCategories": [
    {
      "id": "fielding",
      "name": "Fielding",
      "type": "physical",
      "min": 1,
      "max": 5,
      "anchors": {
        "1": "Below expectations",
        "2": "Needs improvement",
        "3": "Meets expectations",
        "4": "Above expectations",
        "5": "Exceptional"
      }
    },
    {
      "id": "baseball_iq",
      "name": "Baseball IQ",
      "type": "soft",
      "min": 1,
      "max": 5,
      "anchors": {
        "1": "Does not understand game situations",
        "3": "Good awareness of game situations",
        "5": "Anticipates plays, makes smart decisions"
      }
    }
  ],
  "blendWeights": {
    "coachRating": 40,
    "tryoutScore": 60
  }
}
```

### Pattern 3: Template Versioning via Copy-on-Write
**What:** When a template that has been used for scoring is modified, create a new version (new row) rather than mutating the original. The original version is preserved with all scores that reference it.
**When to use:** Any modification to a template after it has been linked to a Season with score data.
**Implementation:**
```python
class EvaluationTemplate(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE)

    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    version = models.IntegerField(default=1)

    # Link versions together
    parent_template = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='child_versions'
    )

    # Template content (JSONField)
    stations = models.JSONField(default=list)
    coach_categories = models.JSONField(default=list)
    blend_weights = models.JSONField(default=dict)

    is_active = models.BooleanField(default=True)
    is_locked = models.BooleanField(default=False)  # Set True when scores reference this template

    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "evaluation_templates"
        ordering = ["-updated_at"]
        constraints = [
            models.UniqueConstraint(
                fields=['organization', 'name', 'version'],
                name='unique_template_version'
            )
        ]
```

**Version creation logic (in view or service):**
```python
def update_template(template, new_data):
    """Update a template, creating a new version if it has been used for scoring."""
    if template.is_locked:
        # Create new version
        new_template = EvaluationTemplate.objects.create(
            organization=template.organization,
            name=template.name,
            version=template.version + 1,
            parent_template=template,
            stations=new_data.get('stations', template.stations),
            coach_categories=new_data.get('coach_categories', template.coach_categories),
            blend_weights=new_data.get('blend_weights', template.blend_weights),
            created_by=new_data.get('created_by'),
        )
        # Deactivate old version from selection (but keep it for reference)
        template.is_active = False
        template.save(update_fields=['is_active'])
        return new_template
    else:
        # Template not yet used -- safe to update in place
        for key, value in new_data.items():
            if hasattr(template, key):
                setattr(template, key, value)
        template.save()
        return template
```

### Pattern 4: React Hook with API Client (Existing Pattern Extended)
**What:** Custom React hook wraps API calls and manages loading/error state, following the existing `useDivisions` and `useDraft` patterns.
**When to use:** All new data-fetching hooks.
**Example:**
```typescript
// Source: follows pattern from src/hooks/useDivisions.ts
export function useEvaluationTemplates() {
  const [templates, setTemplates] = useState<EvaluationTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.listEvaluationTemplates();
      setTemplates(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createTemplate = useCallback(async (data: CreateTemplateData) => {
    setIsLoading(true);
    setError(null);
    try {
      const template = await api.createEvaluationTemplate(data);
      setTemplates(prev => [template, ...prev]);
      return template;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create template');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { templates, isLoading, error, fetchTemplates, createTemplate };
}
```

### Pattern 5: react-hook-form with useFieldArray for Dynamic Template Editing
**What:** The template editor needs dynamic station arrays where each station has dynamic score field arrays. `useFieldArray` from react-hook-form handles this natively.
**When to use:** Template editor component.
**Example:**
```typescript
// Source: react-hook-form docs + verified via npm/docs research
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const scoreFieldSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['scale', 'time', 'count']),
  min: z.number(),
  max: z.number(),
  description: z.string().optional(),
  anchors: z.record(z.string(), z.string()).optional(),
});

const stationSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Station name is required'),
  order: z.number(),
  fields: z.array(scoreFieldSchema).min(1, 'At least one score field required'),
});

const templateSchema = z.object({
  name: z.string().min(1, 'Template name is required'),
  description: z.string().optional(),
  stations: z.array(stationSchema).min(1, 'At least one station required'),
  coachCategories: z.array(z.object({
    id: z.string(),
    name: z.string().min(1),
    type: z.enum(['physical', 'soft']),
    min: z.number().default(1),
    max: z.number().default(5),
    anchors: z.record(z.string(), z.string()).optional(),
  })),
  blendWeights: z.object({
    coachRating: z.number().min(0).max(100),
    tryoutScore: z.number().min(0).max(100),
  }).refine(data => data.coachRating + data.tryoutScore === 100, {
    message: 'Weights must sum to 100',
  }),
});

type TemplateFormData = z.infer<typeof templateSchema>;

function TemplateEditor({ existingTemplate }: { existingTemplate?: EvaluationTemplate }) {
  const { control, handleSubmit, formState: { errors } } = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    defaultValues: existingTemplate ?? {
      name: '',
      stations: [{ id: crypto.randomUUID(), name: '', order: 1, fields: [] }],
      coachCategories: [],
      blendWeights: { coachRating: 40, tryoutScore: 60 },
    },
  });

  const { fields: stations, append, remove, move } = useFieldArray({
    control,
    name: 'stations',
  });

  // Each station has its own nested useFieldArray for score fields
  // ... (see Code Examples section)
}
```

### Anti-Patterns to Avoid
- **Hardcoding evaluation structure in Django model columns:** Do NOT add `infield_score`, `baserunning_time`, etc. as separate FloatField columns. The existing Player model already has 9 hardcoded score fields reflecting one format. Use JSONField for flexible template-driven structure.
- **Mutating templates after scoring has begun:** Never update a template row that is referenced by score records. Always create a new version.
- **Building a separate Django app for evaluations:** Keep all models in the existing `draft` app's `models.py`. The evaluation system shares Organization, User, and (later) Player models.
- **Using DRF serializers alongside existing transformers:** The codebase deliberately avoids DRF. Continue using `transformers.py` functions.
- **Adding @tanstack/react-query in Phase 1:** The context recommends it, but for Phase 1 (template CRUD only, no real-time data), the existing hook pattern (useState + useCallback + api client) is sufficient. Adopt react-query when data fetching gets complex (Phase 2+).

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dynamic form arrays (add/remove stations) | Custom array state management with useState | `react-hook-form` `useFieldArray` | Handles reorder, insert, remove, and maintains form state consistency across nested arrays; custom implementations inevitably have bugs with key management and validation state |
| Form schema validation | Manual if/else validation in submit handler | `zod` schema + `@hookform/resolvers` | Schema defines both validation and TypeScript types in one place; eliminates type/validation drift |
| UUID generation for station/field IDs | Custom ID generation | `crypto.randomUUID()` (browser native) | Built into all modern browsers; matches the UUID pattern used throughout the codebase |
| JSON structure validation in Python | Custom dict traversal with isinstance checks | Pydantic models or structured validation functions | Keep validation logic organized; the existing `input_validators.py` pattern works well (tuple return of cleaned/errors) |
| snake_case/camelCase conversion | Custom conversion logic | Follow existing `transformers.py` pattern | The codebase already has `transform_player()`, `transform_team()`, etc. Add `transform_evaluation_template()` and `transform_season()` |

**Key insight:** The template editor is a form-builder building tool -- a form that defines other forms. This is inherently complex. react-hook-form's `useFieldArray` with nested field arrays is purpose-built for this exact problem. Custom useState-based implementations will fail when users reorder stations, add fields, undo changes, or interact with deeply nested elements.

## Common Pitfalls

### Pitfall 1: Template Versioning as Afterthought
**What goes wrong:** Developer builds template CRUD without versioning. Later, when Phase 2 (Coach Ratings) starts recording scores against templates, modifying a template corrupts historical scores.
**Why it happens:** Versioning seems like YAGNI when no scores exist yet. But the data model must support versioning from day one because retrofitting requires data migration.
**How to avoid:** Include `version`, `parent_template`, and `is_locked` fields on EvaluationTemplate from the start. The `is_locked` flag is set to `True` when a Season with scores references the template. The UI checks this flag and shows "Create new version" instead of "Save" when editing a locked template.
**Warning signs:** Template model has no `version` or `parent_template` field; no `is_locked` check in update logic.

### Pitfall 2: Flat JSON Without IDs for Stations/Fields
**What goes wrong:** Template stations and score fields are stored without stable IDs. When scores are recorded against field positions (array index), reordering stations or fields makes historical scores point to wrong fields.
**Why it happens:** Developer uses array index as implicit identifier.
**How to avoid:** Every station and every score field MUST have a UUID `id` property. Score records reference these IDs, not array positions. When template is versioned, field IDs persist across versions (allowing old scores to map to new template structure).
**Warning signs:** Station or field objects in JSON lack an `id` property; code references `stations[0]` instead of `stations.find(s => s.id === stationId)`.

### Pitfall 3: Organization Scope Leakage
**What goes wrong:** Templates from one organization become visible to another because the query forgets to filter by organization.
**Why it happens:** Developer queries `EvaluationTemplate.objects.all()` without organization filter.
**How to avoid:** Use `EvaluationTemplate.objects.filter(organization=request.organization)` consistently. Consider using the existing `TenantManager` pattern if adding a tenant-aware manager to the model. Every view that touches templates MUST call `get_organization_from_request(request)` and filter by it.
**Warning signs:** Any template query without `organization=` filter; no test verifying cross-org isolation.

### Pitfall 4: Blend Weights Not Summing to 100
**What goes wrong:** Admin sets coach rating to 60% and tryout to 70%. Composite scores are inflated or deflated.
**Why it happens:** No validation that weights sum to 100.
**How to avoid:** Validate in both frontend (zod `.refine()`) and backend (input validator). The UI should use a linked slider where adjusting one weight automatically adjusts the other (like a see-saw).
**Warning signs:** No sum validation in template create/update validators.

### Pitfall 5: No Default Template or Getting Started Flow
**What goes wrong:** Admin opens evaluation system for the first time and faces a blank editor with no guidance. They don't know what stations or categories to create.
**Why it happens:** Developer assumes admins know what they want.
**How to avoid:** Provide preset templates (e.g., "Standard Little League Tryout" with Infield, Base Running, Fly Balls, Pitching, Hitting stations) that admins can clone and customize. This also serves as an example of correct template structure.
**Warning signs:** Empty state shows only "Create Template" button with no guidance or presets.

### Pitfall 6: react-hook-form useFieldArray Key Management
**What goes wrong:** Reordering or removing stations causes form state to become misaligned with displayed fields. User edits station 2, removes station 1, and station 2's data appears in station 1's position.
**Why it happens:** Using array index as React key instead of the `field.id` provided by `useFieldArray`.
**How to avoid:** Always use `field.id` (the auto-generated identifier from useFieldArray) as the React `key` prop, NOT the array index. This is explicitly documented in react-hook-form docs.
**Warning signs:** `key={index}` instead of `key={field.id}` on field array items.

## Code Examples

Verified patterns from official sources:

### Django Model with JSONField (Existing Pattern)
```python
# Source: server/draft/models.py (existing pattern)
# The codebase already uses JSONField extensively:
# - Division.scoring_weights = models.JSONField(default=dict)
# - Division.draft_order = models.JSONField(default=list)
# - Team.age_breakdown = models.JSONField(default=dict)
# - Player.teammate_requests = models.JSONField(default=list)

# New EvaluationTemplate follows the same pattern:
class EvaluationTemplate(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='evaluation_templates',
    )
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    version = models.IntegerField(default=1)
    parent_template = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='child_versions',
    )
    stations = models.JSONField(default=list)
    coach_categories = models.JSONField(default=list)
    blend_weights = models.JSONField(default=dict)
    is_active = models.BooleanField(default=True)
    is_locked = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "evaluation_templates"
        ordering = ["-updated_at"]
        constraints = [
            models.UniqueConstraint(
                fields=['organization', 'name', 'version'],
                name='unique_template_version'
            )
        ]
```

### Season Model
```python
class Season(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='seasons',
    )
    name = models.CharField(max_length=100)  # e.g., "Spring 2026"
    year = models.IntegerField()
    template = models.ForeignKey(
        EvaluationTemplate,
        on_delete=models.PROTECT,  # Cannot delete template used by a season
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "seasons"
        ordering = ["-year", "-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=['organization', 'name'],
                name='unique_season_name_per_org'
            )
        ]
```

### Transformer Functions (Existing Pattern)
```python
# Source: follows pattern from server/draft/transformers.py
def transform_evaluation_template(template) -> dict:
    """Transform an EvaluationTemplate to dict."""
    return {
        "id": str(template.id),
        "organization_id": str(template.organization_id),
        "name": template.name,
        "description": template.description,
        "version": template.version,
        "parent_template_id": str(template.parent_template_id) if template.parent_template_id else None,
        "stations": template.stations,  # Already JSON, pass through
        "coach_categories": template.coach_categories,  # Already JSON, pass through
        "blend_weights": template.blend_weights,  # Already JSON, pass through
        "is_active": template.is_active,
        "is_locked": template.is_locked,
        "created_by_id": str(template.created_by_id) if template.created_by_id else None,
        "created_at": template.created_at.isoformat(),
        "updated_at": template.updated_at.isoformat(),
    }

def transform_season(season) -> dict:
    """Transform a Season to dict."""
    return {
        "id": str(season.id),
        "organization_id": str(season.organization_id),
        "name": season.name,
        "year": season.year,
        "template_id": str(season.template_id),
        "is_active": season.is_active,
        "created_at": season.created_at.isoformat(),
        "updated_at": season.updated_at.isoformat(),
    }
```

### Input Validator (Existing Pattern)
```python
# Source: follows pattern from server/draft/input_validators.py
def validate_template_create_data(data: Dict[str, Any]) -> Tuple[Optional[Dict], Optional[Dict]]:
    """Validate template creation data."""
    errors = {}

    name = data.get("name", "")
    if not name:
        errors["name"] = ["Name is required"]
    elif len(name) > 200:
        errors["name"] = ["Name must be 200 characters or less"]

    stations = data.get("stations", [])
    if not isinstance(stations, list):
        errors["stations"] = ["Stations must be a list"]
    else:
        for i, station in enumerate(stations):
            station_errors = _validate_station(station)
            if station_errors:
                errors[f"stations[{i}]"] = station_errors

    coach_categories = data.get("coach_categories", [])
    if not isinstance(coach_categories, list):
        errors["coach_categories"] = ["Coach categories must be a list"]

    blend_weights = data.get("blend_weights", {})
    if blend_weights:
        coach_w = blend_weights.get("coachRating", 0)
        tryout_w = blend_weights.get("tryoutScore", 0)
        if coach_w + tryout_w != 100:
            errors["blend_weights"] = ["Weights must sum to 100"]

    if errors:
        return None, errors

    return {
        "name": name.strip(),
        "description": data.get("description", "").strip(),
        "stations": stations,
        "coach_categories": coach_categories,
        "blend_weights": blend_weights or {"coachRating": 40, "tryoutScore": 60},
    }, None
```

### Frontend TypeScript Types
```typescript
// Source: follows pattern from src/types/index.ts

// Score field types for template configuration
export type ScoreFieldType = 'scale' | 'time' | 'count';
export type CoachCategoryType = 'physical' | 'soft';

export interface ScoreFieldDefinition {
  id: string;
  name: string;
  type: ScoreFieldType;
  min: number;
  max: number;
  description?: string;
  unit?: string;          // For time fields: "seconds"
  lowerIsBetter?: boolean; // For time fields
  anchors?: Record<string, string>; // For scale fields: { "1": "Poor", "5": "Excellent" }
}

export interface StationDefinition {
  id: string;
  name: string;
  order: number;
  fields: ScoreFieldDefinition[];
}

export interface CoachCategoryDefinition {
  id: string;
  name: string;
  type: CoachCategoryType;
  min: number;
  max: number;
  anchors?: Record<string, string>;
}

export interface BlendWeights {
  coachRating: number;  // 0-100, must sum with tryoutScore to 100
  tryoutScore: number;  // 0-100
}

export interface EvaluationTemplate {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  version: number;
  parentTemplateId: string | null;
  stations: StationDefinition[];
  coachCategories: CoachCategoryDefinition[];
  blendWeights: BlendWeights;
  isActive: boolean;
  isLocked: boolean;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Season {
  id: string;
  organizationId: string;
  name: string;
  year: number;
  templateId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### API Client Methods (Existing Pattern)
```typescript
// Source: follows pattern from src/api/client.ts
// Add to existing api object:

async listEvaluationTemplates(): Promise<EvaluationTemplate[]> {
  const options = getDefaultOptions('GET');
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/evaluation-templates/`,
    options
  );
  if (!response.ok) throw await createApiError(response);
  const data = await response.json();
  return data.map(transformTemplateFromApi);
}

async createEvaluationTemplate(templateData: CreateTemplateData): Promise<EvaluationTemplate> {
  const options = getDefaultOptions('POST');
  options.body = JSON.stringify(transformTemplateToApi(templateData));
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/evaluation-templates/`,
    options
  );
  if (!response.ok) throw await createApiError(response);
  const data = await response.json();
  return transformTemplateFromApi(data);
}

async updateEvaluationTemplate(id: string, templateData: Partial<CreateTemplateData>): Promise<EvaluationTemplate> {
  const options = getDefaultOptions('PATCH');
  options.body = JSON.stringify(transformTemplateToApi(templateData));
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/evaluation-templates/${id}/`,
    options
  );
  if (!response.ok) throw await createApiError(response);
  const data = await response.json();
  return transformTemplateFromApi(data);
}
```

### URL Patterns (New Endpoints)
```python
# Add to server/draft/urls.py
# Evaluation Templates
path("api/evaluation-templates/", evaluation_templates_list_create, name="evaluation-templates-list-create"),
path("api/evaluation-templates/<uuid:pk>/", evaluation_template_detail, name="evaluation-template-detail"),

# Seasons
path("api/seasons/", seasons_list_create, name="seasons-list-create"),
path("api/seasons/<uuid:pk>/", season_detail, name="season-detail"),
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Zod v3.x with separate type definitions | Zod v4.x with improved inference | Mid-2025 (v4 stable) | Install `zod@^4.3`; schemas auto-infer TS types more accurately. Import from `zod` directly (v4 is now the default export) |
| react-hook-form v7 alpha/beta | react-hook-form v7.71 (stable) | Ongoing v7.x releases | v8 is in beta but v7 is the stable target; v7.71.1 released Jan 2026 |
| Custom JSON validators in Python | django-structured-json-field (Pydantic-powered) | v1.2.0 Jan 2026 | Available option for JSON validation, but adds a dependency; manual validation in input_validators.py is simpler and matches existing codebase pattern |

**Deprecated/outdated:**
- `jsonfield` package (third-party): Deprecated since Django 3.1 introduced native JSONField. Do NOT install.
- Formik: While not deprecated, react-hook-form has largely replaced it in the ecosystem due to better performance and TypeScript support.

## Open Questions

Things that couldn't be fully resolved:

1. **Zod v4 vs v3 for @hookform/resolvers compatibility**
   - What we know: Zod v4.3.5 is the latest stable. @hookform/resolvers v5.2.2 supports both Zod v3 and v4 via "Standard Schema" support.
   - What's unclear: Whether there are edge cases with dynamic form fields in zod v4 (GitHub issue #4936 discusses this for very dynamic schemas).
   - Recommendation: Install `zod@^4.3` and `@hookform/resolvers@^5.2`. The template editor has a known schema structure (not truly dynamic at runtime), so the GitHub issue about runtime-dynamic schemas does not apply.

2. **Preset templates content**
   - What we know: The project context mentions specific stations (Infield, Base Running, Fly Balls, Pitching, Hitting) and coach review categories (physical skills + soft skills).
   - What's unclear: The exact score field definitions, anchor text, and min/max values for each preset station.
   - Recommendation: Define sensible defaults based on the project context. The admin can customize. Suggested defaults: Infield (ground balls 0-3 count, throw accuracy 1-5 scale), Base Running (2x 120ft time in seconds), Fly Balls (catches 0-3 count), Pitching (velocity, accuracy 1-5, form 1-5), Hitting (power 1-5, contact 0-5 count).

3. **Season-Template relationship cardinality**
   - What we know: A Season links to one EvaluationTemplate. Multiple seasons can use the same template.
   - What's unclear: Can a Season change its template after creation? If yes, what happens to scores already recorded under the old template?
   - Recommendation: Make template assignment immutable on Season after scores exist. Allow changing template only if no scores have been recorded in the season.

## Sources

### Primary (HIGH confidence)
- **Existing codebase** - Direct analysis of `server/draft/models.py`, `server/draft/views/divisions.py`, `server/draft/transformers.py`, `server/draft/input_validators.py`, `server/draft/views/helpers.py`, `server/draft/urls.py`, `src/api/client.ts`, `src/types/index.ts`, `package.json`
- **Existing planning docs** - `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/CONVENTIONS.md`, `.planning/codebase/STACK.md`, `.planning/research/ARCHITECTURE.md`, `.planning/research/STACK.md`, `.planning/research/PITFALLS.md`

### Secondary (MEDIUM confidence)
- [react-hook-form npm](https://www.npmjs.com/package/react-hook-form) - Version 7.71.1 confirmed via web search
- [zod npm](https://www.npmjs.com/package/zod) - Version 4.3.5 confirmed via web search
- [@hookform/resolvers npm](https://www.npmjs.com/package/@hookform/resolvers) - Version 5.2.2 confirmed via web search
- [react-hook-form useFieldArray docs](https://react-hook-form.com/docs/usefieldarray) - Dynamic form fields API
- [Engineering Dynamic Forms with Zod and RHF](https://medium.com/@adorekasun/4-engineering-dynamic-forms-zod-validation-and-react-hook-form-integration-4f02658e27d1) - Nov 2025 pattern article
- [django-structured-json-field](https://pypi.org/project/django-structured-json-field/) - v1.2.0 Jan 2026, Pydantic-powered JSONField validation

### Tertiary (LOW confidence)
- [Zod v4 dynamic fields GitHub issue #4936](https://github.com/colinhacks/zod/issues/4936) - Discussion about dynamic form schemas in Zod v4; may not apply to our use case (our schema shape is known at build time)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Uses existing codebase patterns verified by direct code analysis; new library versions confirmed via web search
- Architecture: HIGH - Models, views, transformers, validators all follow patterns directly observed in the existing codebase
- Pitfalls: HIGH - Identified from existing pitfalls research combined with domain-specific analysis of template versioning

**Research date:** 2026-01-29
**Valid until:** 60 days (stable domain; library versions may update but major patterns stable)
