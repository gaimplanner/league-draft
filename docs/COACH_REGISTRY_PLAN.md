# Coach Registry - Implementation Plan

## Overview

**Feature:** Centralized Coach and Manager Registry

**Problem Statement:** League admins currently enter coach/manager names as free text on each team in each division. This leads to:
- Duplicate data entry across divisions and seasons
- No reusable coach database
- Stale spreadsheets used to track coaching staff
- No way to link coaches to user accounts for authentication
- Error-prone name matching for coach kid detection

**Solution:** A centralized coach registry at the organization level that can be referenced from any division's team configuration.

---

## User Stories

### Primary
1. As a league admin, I want to manage a central list of coaches so I don't have to re-enter them for each division.
2. As a league admin, I want to select coaches from a dropdown when creating teams, not type names manually.
3. As a division admin, I want to see all available coaches when configuring teams for my division.

### Secondary
4. As a league admin, I want to optionally link a coach to a user account so they can log in.
5. As a league admin, I want to track coach contact information (email, phone) in one place.
6. As a division admin, I want coach kid auto-detection to use the registry for more reliable matching.

---

## Data Model

### New: Coach Model (Backend)

```python
class Coach(models.Model):
    """Centralized coach registry at the organization level."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="coaches"
    )

    # Optional link to user account (for login access)
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="coach_profiles"
    )

    # Coach information
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    email = models.EmailField(null=True, blank=True)
    phone = models.CharField(max_length=20, null=True, blank=True)

    # Status
    is_active = models.BooleanField(default=True)  # Soft delete / inactive seasons

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "coaches"
        ordering = ["last_name", "first_name"]
        unique_together = [["organization", "first_name", "last_name"]]
        indexes = [
            models.Index(fields=["organization", "is_active"]),
            models.Index(fields=["last_name"]),
        ]

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"

    def __str__(self):
        return self.full_name
```

### Modified: Team Model

```python
class Team(models.Model):
    # ... existing fields ...

    # Current (keep for backward compatibility during migration)
    head_coach = models.CharField(max_length=100, blank=True, default="")
    assistant_coach = models.CharField(max_length=100, blank=True, default="")

    # New FK relationships
    head_coach_ref = models.ForeignKey(
        Coach,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="head_coach_teams"
    )
    assistant_coaches = models.ManyToManyField(
        Coach,
        blank=True,
        related_name="assistant_teams"
    )
```

### Frontend: Coach Interface

```typescript
interface Coach {
  id: string;
  organizationId: string;
  userId?: string;
  firstName: string;
  lastName: string;
  fullName: string;  // Computed: "First Last"
  email?: string;
  phone?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Extended Team interface
interface Team {
  // ... existing fields ...

  // Legacy (still supported)
  headCoach: string;
  assistantCoach: string;

  // New
  headCoachId?: string;
  headCoachRef?: Coach;
  assistantCoachIds?: string[];
  assistantCoachRefs?: Coach[];
}
```

---

## API Endpoints

### Coach Management

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/organizations/{id}/coaches/` | List all coaches for organization | Admin/Coach |
| POST | `/api/organizations/{id}/coaches/` | Create new coach | Admin only |
| GET | `/api/coaches/{id}/` | Get coach details | Admin/Coach |
| PATCH | `/api/coaches/{id}/` | Update coach | Admin only |
| DELETE | `/api/coaches/{id}/` | Deactivate coach (soft delete) | Admin only |
| POST | `/api/coaches/{id}/link-user/` | Link coach to user account | Admin only |
| POST | `/api/coaches/{id}/unlink-user/` | Unlink coach from user | Admin only |

### Response Examples

```json
// GET /api/organizations/{id}/coaches/
{
  "coaches": [
    {
      "id": "uuid-1",
      "first_name": "John",
      "last_name": "Smith",
      "full_name": "John Smith",
      "email": "jsmith@email.com",
      "phone": "555-1234",
      "is_active": true,
      "user_id": null,
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}

// POST /api/organizations/{id}/coaches/
// Request:
{
  "first_name": "John",
  "last_name": "Smith",
  "email": "jsmith@email.com",
  "phone": "555-1234"
}
```

---

## UI Components

### 1. Coach Registry Page (New)

**Location:** Profile Page → New "Coaches" tab (for admins)

**Features:**
- Table of all coaches in the organization
- Add new coach button → modal form
- Edit coach inline or via modal
- Deactivate/reactivate coaches
- Link to user account (if user exists)
- Search/filter by name
- Show active assignment count (how many teams currently using this coach)

**Wireframe:**
```
┌─────────────────────────────────────────────────────────────────┐
│  Organization Settings                                           │
├─────────────────────────────────────────────────────────────────┤
│  [Profile] [Members] [Coaches] [Invites]                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Coaches                                    [+ Add Coach]        │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Name           │ Email          │ Phone    │ Teams │ Actions││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ John Smith     │ jsmith@...     │ 555-1234 │ 2     │ ✏️ 🔗  ││
│  │ Jane Doe       │ jdoe@...       │ 555-5678 │ 1     │ ✏️ 🔗  ││
│  │ Bob Johnson    │ —              │ —        │ 0     │ ✏️ 🗑️  ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Showing 3 active coaches                                        │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Coach Selector Component (New)

**Used in:** DivisionCreator, PlayerReview team configuration

**Features:**
- Searchable dropdown of coaches from registry
- Shows coach name and current assignments
- "Add new coach" option at bottom (opens modal)
- Clear selection option
- Fallback to free text if registry empty

**Wireframe:**
```
┌────────────────────────────────────────┐
│ Head Coach                             │
│ ┌────────────────────────────────────┐ │
│ │ 🔍 Search coaches...            ▼  │ │
│ ├────────────────────────────────────┤ │
│ │ John Smith (2 teams)               │ │
│ │ Jane Doe (1 team)                  │ │
│ │ Bob Johnson (available)            │ │
│ ├────────────────────────────────────┤ │
│ │ + Add new coach...                 │ │
│ └────────────────────────────────────┘ │
└────────────────────────────────────────┘
```

### 3. Modified Team Configuration

**DivisionCreator changes:**
- Replace text inputs with CoachSelector
- Load coaches from organization on mount
- Allow creating new coach inline

**PlayerReview changes:**
- Team headers use CoachSelector instead of text input
- Coach selector filtered to unassigned coaches (prevent same coach on multiple teams)

---

## Implementation Phases

### Phase 1: Backend Foundation (PR #1)

**Goal:** Create Coach model and API without breaking existing functionality

1. Create Coach model with migration
2. Create Coach API endpoints (CRUD)
3. Add `head_coach_ref` and `assistant_coaches` FKs to Team model
4. Update Team transformer to include coach refs
5. Keep legacy `head_coach`/`assistant_coach` fields working
6. Add unit tests for Coach API

**Files to create:**
- `server/draft/migrations/0008_coach_registry.py`
- `server/draft/views/coaches.py`

**Files to modify:**
- `server/draft/models.py` - Add Coach model, Team FK fields
- `server/draft/transformers.py` - Add coach transforms
- `server/draft/urls.py` - Add coach routes

### Phase 2: Coach Management UI (PR #2)

**Goal:** Admin UI to manage coach registry

1. Create CoachesTab component for ProfilePage
2. Add coaches API client methods
3. Create coach list table with CRUD operations
4. Add coach form modal (create/edit)
5. Add search/filter functionality
6. Show team assignment counts

**Files to create:**
- `src/components/profile/CoachesTab.tsx`
- `src/components/profile/CoachFormModal.tsx`
- `src/api/coaches.ts`

**Files to modify:**
- `src/components/profile/ProfilePage.tsx` - Add Coaches tab
- `src/types/index.ts` - Add Coach interface

### Phase 3: Coach Selector Integration (PR #3)

**Goal:** Use registry in team configuration

1. Create CoachSelector component
2. Integrate into DivisionCreator
3. Integrate into PlayerReview team headers
4. Add "create coach inline" flow
5. Update team save to use coach IDs

**Files to create:**
- `src/components/CoachSelector.tsx`

**Files to modify:**
- `src/components/DivisionCreator.tsx`
- `src/components/PlayerReviewTable.tsx`
- `src/hooks/useDivisions.ts` - Load coaches with division

### Phase 4: Coach Kid Detection Enhancement (PR #4)

**Goal:** Use registry for more reliable coach kid matching

1. Update `autoDetectCoachKids()` to use Coach objects
2. Match by coach ID instead of name string
3. Handle multiple name formats (first, last, full)
4. Update detection modal to show coach registry info

**Files to modify:**
- `src/utils/coachKidDetection.ts`
- `src/components/PlayerReview.tsx`

### Phase 5: Migration & Cleanup (PR #5)

**Goal:** Migrate existing data and deprecate legacy fields

1. Create data migration script to:
   - Extract unique coaches from existing Team.head_coach/assistant_coach
   - Create Coach records for each
   - Link Team.head_coach_ref to Coach records
2. Update frontend to prefer coach refs over legacy fields
3. Add deprecation warnings for legacy fields
4. Update documentation

**Files to create:**
- `server/draft/management/commands/migrate_coaches.py`

**Files to modify:**
- `CLAUDE.md` - Document Coach model
- `README.md` - Update feature list

---

## Migration Strategy

### Backward Compatibility

1. **Dual-write:** When saving teams, write both:
   - Legacy `head_coach` (string) for old clients
   - New `head_coach_ref` (FK) for new clients

2. **Dual-read:** When loading teams:
   - Prefer `head_coach_ref.full_name` if present
   - Fall back to `head_coach` string if not

3. **Gradual migration:**
   - Phase 1-3: Both fields coexist
   - Phase 4: Migration script populates coach refs
   - Phase 5: Deprecate legacy fields (keep for 1 release)
   - Future: Remove legacy fields

### Data Migration Script

```python
# Extract coaches from existing teams
for team in Team.objects.exclude(head_coach=""):
    names = team.head_coach.strip().split()
    first_name = names[0] if names else ""
    last_name = names[-1] if len(names) > 1 else names[0]

    coach, created = Coach.objects.get_or_create(
        organization=team.division.organization,
        first_name=first_name,
        last_name=last_name,
        defaults={"is_active": True}
    )

    team.head_coach_ref = coach
    team.save()
```

---

## Edge Cases & Considerations

### 1. Coach Name Collisions
- What if "John Smith" exists twice in organization?
- **Solution:** Unique constraint on (organization, first_name, last_name)
- UI shows email/phone to disambiguate

### 2. Coach Deletion
- What if coach is deleted but still assigned to teams?
- **Solution:** Soft delete (`is_active=False`), keep references
- UI shows "Inactive" badge on coach

### 3. Empty Registry
- What if organization has no coaches yet?
- **Solution:** CoachSelector shows "No coaches yet. Add one?" prompt
- Fallback to free text input until registry has data

### 4. Cross-Division Coaches
- Same coach can manage teams in multiple divisions
- **Supported:** Coach is organization-level, teams reference by FK

### 5. Coach Kid Detection
- Coach registry improves matching reliability
- Still need fallback for legacy divisions without coach refs

### 6. Team Builder Mode
- Coach requests in Team Builder should also use registry
- Request confirmation can suggest matching registered coaches

---

## Security Considerations

1. **Authorization:** Only org admins can manage coach registry
2. **Visibility:** All org members can view coaches (for selection)
3. **User linking:** Only admins can link coach to user account
4. **Data isolation:** Coaches scoped to organization (multi-tenant)

---

## Success Metrics

1. **Reduced data entry:** Coaches entered once, reused across divisions
2. **Improved accuracy:** Coach kid detection uses reliable IDs
3. **Admin satisfaction:** No more stale spreadsheets for coach tracking
4. **Time saved:** Division setup faster with coach selection vs typing

---

## Open Questions

1. **Should coaches have a "role" field?** (head_coach, assistant, field_coach, etc.)
   - Current plan: No, role is determined by assignment on Team
   - Alternative: Add role to Coach model for filtering

2. **Should we support multiple assistant coaches per team?**
   - Current Team model has single `assistant_coach` field
   - Proposed: `assistant_coaches` M2M allows multiple
   - UI change: Multi-select for assistants

3. **Should coach be linkable to multiple user accounts?**
   - Unlikely scenario (one person = one coach record)
   - Current: One-to-one (nullable) FK to User

4. **Import from spreadsheet?**
   - Future feature: Bulk import coaches from CSV
   - Not in scope for initial implementation

---

## Files Summary

### New Files
| File | Purpose |
|------|---------|
| `server/draft/views/coaches.py` | Coach API endpoints |
| `server/draft/migrations/0008_coach_registry.py` | Coach model migration |
| `src/components/profile/CoachesTab.tsx` | Coach management UI |
| `src/components/profile/CoachFormModal.tsx` | Add/edit coach form |
| `src/components/CoachSelector.tsx` | Reusable coach dropdown |
| `src/api/coaches.ts` | Coach API client |
| `server/draft/management/commands/migrate_coaches.py` | Data migration |

### Modified Files
| File | Changes |
|------|---------|
| `server/draft/models.py` | Add Coach model, Team FK fields |
| `server/draft/transformers.py` | Coach serialization |
| `server/draft/urls.py` | Coach routes |
| `src/types/index.ts` | Coach interface |
| `src/components/profile/ProfilePage.tsx` | Add Coaches tab |
| `src/components/DivisionCreator.tsx` | Use CoachSelector |
| `src/components/PlayerReviewTable.tsx` | Use CoachSelector |
| `src/utils/coachKidDetection.ts` | Use Coach objects |
| `CLAUDE.md` | Document Coach feature |

---

## Timeline Estimate

| Phase | Scope | Estimate |
|-------|-------|----------|
| Phase 1 | Backend Foundation | 1-2 days |
| Phase 2 | Coach Management UI | 1-2 days |
| Phase 3 | Coach Selector Integration | 1-2 days |
| Phase 4 | Coach Kid Detection | 0.5-1 day |
| Phase 5 | Migration & Cleanup | 1 day |
| **Total** | | **5-8 days** |

---

## Review Checklist

Before implementation, confirm:

- [ ] Data model approved (Coach fields, Team FK changes)
- [ ] API endpoints approved
- [ ] UI placement approved (Coaches tab in Profile)
- [ ] Migration strategy approved (dual-write, gradual deprecation)
- [ ] Open questions resolved (roles, multiple assistants, etc.)
