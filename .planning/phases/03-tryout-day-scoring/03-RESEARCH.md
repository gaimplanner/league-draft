# Phase 3: Tryout Day Scoring - Research

**Researched:** 2026-01-30
**Domain:** Mobile-first data entry, real-time scoring UI, spreadsheet grids, group management
**Confidence:** HIGH

## Summary

Phase 3 implements a mobile-first tryout scoring system with three core interfaces: volunteer station scoring via mobile browser (numpad bib lookup, large touch targets, auto-advance), bulk entry spreadsheet grid (Excel/Sheets paste support), and admin progress monitoring (group rotation tracking). The research confirms that the existing stack (React, React Hook Form, Tailwind, Django) is well-suited for this phase with minimal new dependencies.

The primary technical challenges are:
1. Mobile-first form UX with one-handed operation (48px minimum touch targets, inputMode for numeric keyboards)
2. Spreadsheet-style bulk entry grid with Excel/Sheets paste support
3. Django relational score records model with JSONField for flexible station-specific scores
4. Safari localStorage persistence limitations (7-day eviction without interaction)

**Primary recommendation:** Use `react-datasheet-grid` for bulk entry (native Excel/Sheets paste), React Hook Form with Tailwind for mobile scoring UI (no additional form library needed), and Django ForeignKey relationships with JSONField scores (station scores as JSON, not flat columns).

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React Hook Form | 7.71.1 (current) | Mobile form state | Uncontrolled components minimize re-renders on mobile; existing stack |
| Zod | 4.3.6 (current) | Runtime validation | Dynamic schema generation from template categories; existing stack |
| Tailwind CSS | 3.3.6 (current) | Mobile-first styling | Built-in mobile-first breakpoints (unprefixed = all sizes); existing stack |
| Django 5.2 | 5.2.7 (current) | Backend models | Proven relational patterns with JSONField support; existing stack |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-datasheet-grid | Latest (3.x) | Spreadsheet bulk entry | Excel/Sheets paste, keyboard nav, cell editing |
| react-simple-pull-to-refresh | Latest (1.x) | Mobile refresh pattern | Pull-to-refresh for progress dashboard updates |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-datasheet-grid | AG Grid Enterprise | AG Grid requires paid license for paste; overkill for single-screen bulk entry |
| react-datasheet-grid | Handsontable | Similar features but heavier bundle; commercial license for some features |
| Pull-to-refresh library | Custom implementation | Custom CSS transforms work but library provides mobile gesture handling out-of-box |

**Installation:**
```bash
npm install react-datasheet-grid react-simple-pull-to-refresh
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   └── tryoutScoring/
│       ├── MobileStationScoring.tsx      # Mobile scoring UI (bib lookup + score entry)
│       ├── BibNumpad.tsx                  # Numpad bib entry component
│       ├── PlayerScoreCard.tsx            # Active player expanded card with score inputs
│       ├── BulkStationEntry.tsx           # Spreadsheet-style bulk entry
│       ├── TryoutProgressDashboard.tsx    # Group x station completion grid
│       └── GroupManagement.tsx            # Admin group setup + rotation scheduler
├── hooks/
│   ├── useTryoutScoring.ts                # Mobile scoring state (active player, auto-advance)
│   ├── useBulkEntry.ts                    # Bulk entry grid state + paste handling
│   └── useTryoutProgress.ts               # Progress dashboard data fetching
└── utils/
    ├── bibLookup.ts                       # Bib number to player resolution
    └── groupGeneration.ts                 # Auto-generate groups of ~15-20 players

server/draft/
├── models.py                              # TryoutGroup, StationScore models
├── views/tryout_scoring.py               # Station scoring endpoints
└── views/tryout_progress.py              # Progress dashboard endpoint
```

### Pattern 1: Mobile-First Touch Targets
**What:** Minimum 48px × 48px tap targets with 8px spacing for one-handed outdoor use
**When to use:** All mobile scoring UI buttons (scale ratings, numpad keys, navigation)
**Example:**
```typescript
// Source: WCAG 2.1 Success Criterion 2.5.8 + Apple HIG
// https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum
// https://edesignify.com/blogs/tap-targets-and-touch-zones-mobile-ux-that-works

// Tailwind mobile-first utility classes
<button className="min-h-[48px] min-w-[48px] text-lg">
  {/* 48px minimum, large text for outdoor visibility */}
</button>

// Scale rating buttons (e.g., 1-5 row)
<div className="flex gap-2">
  {[1, 2, 3, 4, 5].map(score => (
    <button
      key={score}
      className="flex-1 min-h-[56px] rounded-lg bg-blue-500 text-white text-xl font-bold"
    >
      {score}
    </button>
  ))}
</div>
```

### Pattern 2: Numeric Keyboard on Mobile
**What:** Use `inputMode="numeric"` + `pattern="[0-9]*"` for cross-platform numeric keyboard
**When to use:** Bib number entry, objective scores (times, counts)
**Example:**
```typescript
// Source: https://css-tricks.com/finger-friendly-numerical-inputs-with-inputmode/
// Source: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inputmode

// Bib number input
<input
  type="text"
  inputMode="numeric"
  pattern="[0-9]*"
  placeholder="Enter Bib #"
  className="min-h-[56px] text-2xl text-center"
/>

// Objective score (time in seconds)
<input
  type="text"
  inputMode="decimal"
  pattern="[0-9]*\.?[0-9]*"
  placeholder="0.00"
  className="min-h-[56px] text-xl"
/>
```

### Pattern 3: React Hook Form with Auto-Advance
**What:** Watch field completion, programmatically focus next field when all scores entered
**When to use:** Mobile scoring flow (score all fields → auto-advance to next player)
**Example:**
```typescript
// Source: React Hook Form Advanced Usage
// https://react-hook-form.com/advanced-usage
// Custom pattern based on GeeksforGeeks focus next field tutorial

const { register, watch, setValue } = useForm();
const formValues = watch();

useEffect(() => {
  // Check if all score fields are filled for current player
  const allFieldsFilled = scoreFields.every(field => formValues[field.id]);

  if (allFieldsFilled) {
    // Show brief confirmation (checkmark flash)
    setShowConfirmation(true);
    setTimeout(() => {
      setShowConfirmation(false);
      // Auto-advance to next player
      setActivePlayerIndex(prev => prev + 1);
    }, 800);
  }
}, [formValues]);
```

### Pattern 4: Django Relational Score Records
**What:** ForeignKey to TryoutGroup + Station with JSONField for score data
**When to use:** Station scores (multiple scores per player per station)
**Example:**
```python
# Source: Django 5.2 Model Field Reference + JSONField patterns
# https://docs.djangoproject.com/en/5.2/topics/db/models/
# https://pganalyze.com/blog/postgres-jsonb-django-python

class TryoutGroup(models.Model):
    """Group of players rotating through stations together (~15-20 players)."""
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE)
    season = models.ForeignKey(Season, on_delete=models.CASCADE)
    name = models.CharField(max_length=100)  # e.g., "Group A", "Group 1"
    created_at = models.DateTimeField(auto_now_add=True)

class StationScore(models.Model):
    """A player's scores for one station, entered by a scorer."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    season = models.ForeignKey(Season, on_delete=models.CASCADE)
    group = models.ForeignKey(TryoutGroup, on_delete=models.CASCADE, related_name="scores")

    # Player identity (name-based like CoachRating)
    player_first_name = models.CharField(max_length=100)
    player_last_name = models.CharField(max_length=100)
    bib_number = models.IntegerField()

    # Station being scored
    station_id = models.CharField(max_length=100)  # Template station UUID

    # Scores keyed by score field ID from template
    # e.g., {"uuid-fielding-rating": 4, "uuid-60-yard-time": 8.5}
    scores = models.JSONField(default=dict)

    # Scorer accountability
    scored_by = models.ForeignKey(User, on_delete=models.CASCADE)
    scored_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "station_scores"
        indexes = [
            models.Index(fields=["season", "group"]),
            models.Index(fields=["bib_number"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["season", "bib_number", "station_id"],
                name="unique_player_station_score"
            )
        ]
```

### Pattern 5: React Datasheet Grid with Excel Paste
**What:** Spreadsheet-style grid supporting copy/paste from Excel/Google Sheets
**When to use:** Bulk entry interface for admins entering paper score sheets
**Example:**
```typescript
// Source: react-datasheet-grid official docs
// https://react-datasheet-grid.netlify.app/docs/features/

import { DataSheetGrid, textColumn, floatColumn } from 'react-datasheet-grid';

const BulkStationEntry = ({ station, players }) => {
  const [data, setData] = useState(
    players.map(p => ({
      bibNumber: p.bibNumber,
      name: `${p.firstName} ${p.lastName}`,
      ...station.scoreFields.reduce((acc, field) => ({
        ...acc,
        [field.id]: null
      }), {})
    }))
  );

  const columns = [
    { ...textColumn, title: 'Bib #', key: 'bibNumber', disabled: true },
    { ...textColumn, title: 'Name', key: 'name', disabled: true },
    ...station.scoreFields.map(field => ({
      ...(field.type === 'scale' ? textColumn : floatColumn),
      title: field.label,
      key: field.id,
    }))
  ];

  return (
    <DataSheetGrid
      value={data}
      onChange={setData}
      columns={columns}
      height={600}
    />
  );
};
```

### Pattern 6: Pull-to-Refresh for Progress Updates
**What:** Mobile gesture for refreshing progress dashboard without reload button
**When to use:** Tryout progress dashboard (group × station completion grid)
**Example:**
```typescript
// Source: react-simple-pull-to-refresh
// https://www.npmjs.com/package/react-simple-pull-to-refresh

import PullToRefresh from 'react-simple-pull-to-refresh';

const TryoutProgressDashboard = () => {
  const [progress, setProgress] = useState([]);

  const handleRefresh = async () => {
    const response = await fetch('/api/tryout-progress');
    const data = await response.json();
    setProgress(data);
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="grid grid-cols-5 gap-2">
        {/* Group × Station grid */}
        {progress.map(cell => (
          <div
            key={`${cell.groupId}-${cell.stationId}`}
            className={`p-4 rounded ${
              cell.complete ? 'bg-green-100' :
              cell.partial ? 'bg-yellow-100' :
              'bg-gray-100'
            }`}
          >
            {cell.scoredCount}/{cell.totalPlayers}
          </div>
        ))}
      </div>
    </PullToRefresh>
  );
};
```

### Anti-Patterns to Avoid
- **Using `<input type="number">` alone for mobile numeric input:** The number input type shows spinners and doesn't guarantee numeric keyboard on all mobile browsers. Use `inputMode="numeric"` with `type="text"` instead.
- **Global event listeners for touch events:** Attach touch handlers to specific elements, not document root, to minimize performance impact.
- **Custom spreadsheet grid implementations:** react-datasheet-grid handles edge cases (column resize, paste parsing, keyboard nav) that are non-trivial to implement correctly.
- **Flat Player model fields for station scores:** Adding columns per station creates schema changes every time template changes and risks concurrent write conflicts. Use relational StationScore records with JSONField instead.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Spreadsheet paste parsing | Custom clipboard event handler | `react-datasheet-grid` | Excel/Sheets paste includes tab-delimited format with edge cases (quoted cells, line breaks in cells, formula conversion) |
| Numeric keyboard triggering | Browser detection + custom input | `inputMode="numeric"` + `pattern="[0-9]*"` | HTML standard attribute with iOS Safari fallback pattern handles all mobile browsers |
| Pull-to-refresh gesture | Custom touchstart/touchmove/touchend | `react-simple-pull-to-refresh` | Gesture thresholds, momentum scrolling interference, and iOS Safari bounce behavior are complex |
| Touch target sizing | Manual pixel calculations | Tailwind utility classes (`min-h-[48px]`) | WCAG 2.1 compliance built-in, responsive breakpoints handled |
| Form validation from template | Custom validation functions | Zod schema builder from template | Dynamic runtime validation with TypeScript inference already implemented in Phase 2 |

**Key insight:** Mobile UX patterns (touch targets, numeric keyboards, pull-to-refresh) have accessibility and cross-browser compatibility nuances that are easy to miss. Use established HTML standards (`inputMode`) and lightweight React libraries for gesture patterns rather than custom implementations.

## Common Pitfalls

### Pitfall 1: iOS Safari localStorage Eviction
**What goes wrong:** Mobile scoring data stored in localStorage disappears after 7 days of no user interaction with the app, causing data loss if volunteers don't sync scores daily.
**Why it happens:** Safari Intelligent Tracking Prevention (ITP) automatically evicts localStorage, IndexedDB, and other client storage after 7 days without user interaction. The timer resets only when the user actively visits the site.
**How to avoid:** Server-side persistence as the source of truth. Mobile scoring UI should POST scores immediately after each player is scored (auto-save on advance), not batch at end of session. localStorage can be used for offline queueing, but must sync to server when connectivity available.
**Warning signs:**
- Scores entered but not visible in progress dashboard after refresh
- Volunteers reporting "lost scores" after not opening app for several days
- localStorage data present immediately after scoring but gone later

**Source:** [WebKit Updates to Storage Policy](https://webkit.org/blog/14403/updates-to-storage-policy/)

### Pitfall 2: Touch Event preventDefault() Breaking Scrolling
**What goes wrong:** Calling `preventDefault()` on `touchstart` events prevents scrolling on the entire page, making the player list unscrollable.
**Why it happens:** Developers often call `preventDefault()` to prevent unwanted click events or text selection, but blocking `touchstart` prevents all touch gestures including scrolling.
**How to avoid:** Call `preventDefault()` on `touchmove` instead of `touchstart`, allowing mouse events and scrolling to continue working. Better yet, use CSS `touch-action` utility classes in Tailwind (`touch-none`, `touch-pan-y`) to declaratively control touch behavior.
**Warning signs:**
- Players can't scroll through the player list on mobile
- Touch interactions feel "stuck" or unresponsive
- Page jumps instead of smooth scrolling

**Source:** [MDN Using Touch Events](https://developer.mozilla.org/en-US/docs/Web/API/Touch_events/Using_Touch_Events)

### Pitfall 3: React Hook Form Re-renders on Every Keystroke
**What goes wrong:** Using `watch()` at the form root causes the entire component to re-render on every input change, causing lag on mobile devices.
**Why it happens:** `watch()` subscribes to all form field changes. When called in the parent component, it triggers re-renders for every keystroke in any field.
**How to avoid:** Subscribe to form values as deep in the component tree as possible using `useWatch` or `useFormState` for specific fields. Use `getValues()` instead of `watch()` when you only need the value once (e.g., on submit) rather than reactive updates.
**Warning signs:**
- Input lag when typing in score fields on mobile
- React DevTools showing frequent re-renders of large component tree
- Performance degradation with more score fields

**Source:** [React Hook Form Performance Guide](https://tillitsdone.com/blogs/react-hook-form-performance-guide/)

### Pitfall 4: Django Bulk Operations Bypassing Custom Logic
**What goes wrong:** Using `StationScore.objects.filter(...).delete()` for clearing scores doesn't trigger custom `delete()` methods or signals, causing incomplete cleanup.
**Why it happens:** Django's bulk operations (`.update()`, `.delete()`, `bulk_create()`) convert directly to SQL statements and bypass model-level methods for performance.
**How to avoid:** Use Django signals (`pre_delete`, `post_delete`) instead of overriding `delete()` methods when custom logic must run during bulk operations. For critical validation, use database constraints rather than model methods.
**Warning signs:**
- Orphaned related records after bulk delete
- Audit logs missing entries for bulk operations
- Custom validation not running during bulk score import

**Source:** [Django Model Field Reference](https://docs.djangoproject.com/en/5.2/topics/db/models/)

### Pitfall 5: JSONField Queries Without Indexes
**What goes wrong:** Filtering by JSONField keys (e.g., `StationScore.objects.filter(scores__fielding_rating__gte=4)`) causes slow queries as dataset grows.
**Why it happens:** Default B-tree indexes don't optimize JSON key lookups. PostgreSQL requires GIN (Generalized Inverted Index) for efficient JSONField queries.
**How to avoid:** Add GIN indexes for JSONField columns that will be queried frequently. Use Django's `GinIndex` in model Meta for PostgreSQL-specific optimization.
**Warning signs:**
- Progress dashboard loading slowly as scores accumulate
- Database query logs showing sequential scans on `station_scores` table
- Timeout errors when filtering by score values

**Source:** [Indexing JSONField in Django and PostgreSQL](https://medium.com/analytics-vidhya/indexing-jsonfield-in-django-and-postgresql-89b7571df830)

## Code Examples

Verified patterns from official sources:

### Mobile Numpad Component
```typescript
// Source: Tailwind mobile-first + inputMode standards
// https://tailwindcss.com/docs/responsive-design
// https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inputmode

const BibNumpad = ({ onBibEnter }) => {
  const [bib, setBib] = useState('');

  const handleKeyPress = (digit: string) => {
    setBib(prev => prev + digit);
  };

  const handleClear = () => setBib('');

  const handleSubmit = () => {
    if (bib) {
      onBibEnter(parseInt(bib));
      setBib('');
    }
  };

  return (
    <div className="p-4">
      {/* Display with native numeric keyboard on tap */}
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={bib}
        onChange={(e) => setBib(e.target.value.replace(/\D/g, ''))}
        placeholder="Bib Number"
        className="w-full min-h-[56px] text-3xl text-center mb-4 border-2 rounded"
      />

      {/* Large touch-target numpad */}
      <div className="grid grid-cols-3 gap-2">
        {[1,2,3,4,5,6,7,8,9].map(digit => (
          <button
            key={digit}
            onClick={() => handleKeyPress(String(digit))}
            className="min-h-[64px] min-w-[64px] text-2xl font-bold bg-blue-500 text-white rounded-lg active:bg-blue-600"
          >
            {digit}
          </button>
        ))}
        <button
          onClick={handleClear}
          className="min-h-[64px] text-lg bg-gray-300 rounded-lg"
        >
          Clear
        </button>
        <button
          onClick={() => handleKeyPress('0')}
          className="min-h-[64px] text-2xl font-bold bg-blue-500 text-white rounded-lg"
        >
          0
        </button>
        <button
          onClick={handleSubmit}
          className="min-h-[64px] text-lg bg-green-500 text-white rounded-lg font-bold"
        >
          OK
        </button>
      </div>
    </div>
  );
};
```

### Django Bulk Score Import with Transaction
```python
# Source: Django bulk operations best practices
# https://docs.djangoproject.com/en/5.2/topics/db/models/

from django.db import transaction

def bulk_import_station_scores(season_id, station_id, score_data, scorer_user):
    """
    Bulk import station scores from spreadsheet entry.
    Uses transaction for atomicity and bulk_create for performance.
    """
    score_records = []

    for row in score_data:
        score_records.append(
            StationScore(
                season_id=season_id,
                group_id=row['group_id'],
                player_first_name=row['first_name'],
                player_last_name=row['last_name'],
                bib_number=row['bib_number'],
                station_id=station_id,
                scores=row['scores'],  # Dict of field_id -> score_value
                scored_by=scorer_user,
            )
        )

    with transaction.atomic():
        # Delete existing scores for this station (if overwriting)
        StationScore.objects.filter(
            season_id=season_id,
            station_id=station_id
        ).delete()

        # Bulk create new scores (batch_size prevents memory issues)
        StationScore.objects.bulk_create(score_records, batch_size=500)
```

### Progress Dashboard Query with Prefetch
```python
# Source: Django select_related/prefetch_related optimization
# https://docs.djangoproject.com/en/5.2/topics/db/queries/

from django.db.models import Count, Q

def get_tryout_progress(season_id):
    """
    Get completion status for all groups × stations.
    Uses prefetch_related to avoid N+1 queries.
    """
    groups = TryoutGroup.objects.filter(season_id=season_id).prefetch_related(
        'scores'  # Prefetch all station scores for each group
    )

    # Get station IDs from template
    season = Season.objects.select_related('template').get(id=season_id)
    stations = season.template.stations  # JSONField list

    progress = []
    for group in groups:
        for station in stations:
            scores_for_station = [
                s for s in group.scores.all()
                if s.station_id == station['id']
            ]

            progress.append({
                'group_id': str(group.id),
                'group_name': group.name,
                'station_id': station['id'],
                'station_name': station['name'],
                'scored_count': len(scores_for_station),
                'total_players': group.player_count,
                'complete': len(scores_for_station) == group.player_count,
            })

    return progress
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `<input type="number">` | `inputMode="numeric"` with `type="text"` | HTML5.2 (2017) | Numeric keyboard on mobile without spinners; better UX |
| Custom touch event handlers | `touch-action` CSS property | CSS Level 4 (2018) | Declarative touch behavior control; fewer bugs |
| Complex form libraries (Formik, Redux Form) | React Hook Form (uncontrolled) | 2019+ | Better mobile performance via reduced re-renders |
| SQLAlchemy JSON columns | Django JSONField with GIN indexes | Django 3.1 (2020) | Native PostgreSQL JSONB support with query optimization |
| Custom spreadsheet grids | react-datasheet-grid | 2020+ | Excel/Sheets paste out-of-box; better accessibility |
| localStorage for offline data | IndexedDB with persistence request | Safari 17.0 (2023) | Better persistence control, though still 7-day eviction risk |

**Deprecated/outdated:**
- **`type="number"` for mobile numeric input:** Causes spinner UI on mobile, doesn't guarantee numeric keyboard. Use `inputMode="numeric"` instead.
- **Controlled inputs in React Hook Form:** Uncontrolled is now preferred for performance, especially on mobile. Use `defaultValue` instead of `value`.
- **`react-datasheet` (archived):** Original library no longer maintained. Use `react-datasheet-grid` (spiritual successor) instead.
- **Django `TextField` for JSON data:** Use `JSONField` for structured data (added in Django 3.1, native PostgreSQL JSONB support).

## Open Questions

Things that couldn't be fully resolved:

1. **Offline Queueing Reliability on iOS Safari**
   - What we know: Safari evicts localStorage/IndexedDB after 7 days without interaction; can request persistent mode via Storage API
   - What's unclear: Whether Home Screen PWA status exempts from eviction (documentation says "has its own counter of days of use" but unclear if that resets the 7-day timer)
   - Recommendation: Implement server-sync-first architecture (POST immediately after each player scored). Use localStorage only for temporary queuing during network interruptions, not long-term storage. Test thoroughly on iOS Safari in real outdoor conditions with intermittent connectivity.

2. **Group Size Algorithm Fairness**
   - What we know: Target is ~15-20 players per group for efficient station rotation
   - What's unclear: Whether uneven group sizes (e.g., 18, 18, 14) create unfair timing advantages or if station time should be normalized
   - Recommendation: Start with simple even-distribution algorithm (total_players / num_groups, remainder distributed). Monitor in Phase 3 UAT whether coaches perceive timing differences as unfair. Can add "equalize station time" feature in v2 if needed.

3. **Concurrent Score Entry Conflicts**
   - What we know: Django unique constraint prevents duplicate scores per player/station; JSONField avoids column-level conflicts
   - What's unclear: What UI feedback to show when volunteer A tries to save a score that volunteer B just saved (race condition during overlapping entry)
   - Recommendation: Use optimistic UI (show success immediately) with background POST. If 409 conflict, show toast "Score already entered by [other volunteer]" and refresh. Monitor in Phase 3 whether volunteers actually overlap or if bib-based lookup naturally serializes entry.

## Sources

### Primary (HIGH confidence)
- [React Hook Form Advanced Usage](https://react-hook-form.com/advanced-usage) - Form patterns, validation, performance
- [react-datasheet-grid Features](https://react-datasheet-grid.netlify.app/docs/features/) - Spreadsheet grid capabilities
- [WebKit Storage Policy Updates](https://webkit.org/blog/14403/updates-to-storage-policy/) - Safari localStorage/IndexedDB persistence rules
- [Django 5.2 Models Documentation](https://docs.djangoproject.com/en/5.2/topics/db/models/) - Relational patterns, bulk operations
- [MDN inputMode Attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inputmode) - Numeric keyboard triggering
- [MDN Touch Events](https://developer.mozilla.org/en-US/docs/Web/API/Touch_events/Using_Touch_Events) - Touch event handling patterns
- [Tailwind Responsive Design](https://tailwindcss.com/docs/responsive-design) - Mobile-first utility classes
- [WCAG 2.1 Target Size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) - Touch target accessibility standards

### Secondary (MEDIUM confidence)
- [React Hook Form Performance Guide](https://tillitsdone.com/blogs/react-hook-form-performance-guide/) - watch() optimization patterns
- [Postgres JSONB Django](https://pganalyze.com/blog/postgres-jsonb-django-python) - JSONField query patterns
- [Mobile UX Tap Targets](https://edesignify.com/blogs/tap-targets-and-touch-zones-mobile-ux-that-works) - Touch target sizing best practices
- [Offline-First Frontend Apps 2025](https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/) - IndexedDB patterns for offline data
- [Tailwind Mobile-First Design](https://tillitsdone.com/blogs/tailwindcss-mobile-first-design/) - Mobile-first patterns with Tailwind

### Tertiary (LOW confidence)
- [20 Tips for Mobile-First with Tailwind](https://dev.to/hitesh_developer/20-tips-for-designing-mobile-first-with-tailwind-css-36km) - General mobile UX tips (WebSearch only)
- [React Pull to Refresh](https://www.strictmode.io/articles/react-pull-to-refresh) - Custom pull-to-refresh implementation guide (WebSearch only)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Existing dependencies (React Hook Form, Zod, Tailwind, Django 5.2) verified via package.json, codebase patterns match recommendations
- Architecture: HIGH - Patterns verified via official documentation (Django models, React Hook Form, inputMode, touch targets)
- Pitfalls: HIGH - iOS Safari eviction verified via WebKit blog; Django bulk operations verified via official docs; touch event issues verified via MDN
- Offline patterns: MEDIUM - Safari storage policy is well-documented, but real-world reliability of offline queueing needs testing

**Research date:** 2026-01-30
**Valid until:** 2026-04-30 (90 days - stable domain with slow-moving standards)
