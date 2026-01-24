# CLAUDE.md - AI Assistant Context

This file provides context for AI assistants working on this codebase.

## Project Overview

**Little League Draft Application** - A production-ready React/TypeScript web app for managing Little League baseball drafts. Supports two modes: live drafts where teams take turns picking players, and auto-generated teams for younger divisions. Handles player imports, scoring, draft execution with rule enforcement, and result exports.

**Current Status:** Production-ready with completed stabilization phases (0-6). All critical features implemented and tested.

## Key Concepts

### Division
Top-level container. Presets: Majors (10-12), AAA (8-10), AA (7-10), Custom. Each division has its own teams, players, and draft state.

**Division Modes:**
- `live-draft`: Traditional draft where teams take turns picking players
- `league-generated`: Auto-assignment algorithm creates balanced teams (Team Builder)

### Player
Imported from CSV, Excel, or dual CSV flow. Has skill scores, total score, rank, and flags (isCoachKid, siblingId, isAllStar, isDNE). Draft status tracked via isDrafted, draftedByTeamId, draftedInRound, draftedAtPick.

- `sibling`: Text field from CSV (display name of sibling - raw import data)
- `siblingId`: Actual link to another player (set when siblings are confirmed/linked)

### Team
Has name, roster (drafted players), totalScore, draftPosition, coachKids array, assistantCoaches, and ageBreakdown.

### Draft Formats
- **Straight**: 1-8, 1-8, 1-8...
- **Snake**: 1-8, 8-1, 1-8, 8-1...
- **Recalculated**: Lowest roster score picks first each round

### Mandatory Picks
- **Coach's kids**: Must be drafted by assigned team in their projected round (or lockedToRound if bumped due to conflicts)
- **Siblings**: When one is drafted, team must draft the other in the sibling's projected round (locked via lockedToTeamId, respects projectedRound/lockedToRound)

## Architecture

### App Phases (Live Draft Mode)
`upload` → `mapping` → `review` → `config` → `draft` → `complete`

### App Phases (Team Builder Mode)
`setup` → `import` → `resolution` → `confirm-requests` → `configure` → `generate` → `results`

### Backend (Django REST Framework)
- **Multi-tenant architecture**: Organization is the tenant model
- **OrganizationMembership**: Users can belong to multiple organizations with roles (admin/coach/viewer)
- **TenantMiddleware**: Injects `request.organization` based on user's membership
- **Session-based auth**: Django sessions with CSRF protection
- **Rate limiting**: AuthRateThrottle (5/min) and PasswordResetRateThrottle (3/hr)
- **Session timeout**: 24-hour expiration (SESSION_COOKIE_AGE)
- **Structured logging**: JSON logging with correlation IDs for request tracing

### State Management
- `useDivisions` hook: Division CRUD via API. `updateActiveDivision` persists teams via `saveTeamsToApi` and players via `savePlayersToApi`
- `useDraft` hook: Draft state, pick logic, undo, skip, mandatory pick checks via API
- `useEvaluationImport` hook: Excel workbook processing
- `AuthContext`: User authentication state

### Key Files

| File | Purpose |
|------|---------|
| `src/App.tsx` | Main orchestration, phase routing, state coordination |
| `src/api/client.ts` | API client with snake_case/camelCase transformations |
| `src/contexts/AuthContext.tsx` | Authentication state, login/logout/register |
| `src/hooks/useDraft.ts` | Draft state machine, pick validation, startDraft, draftPlayer, undoLastPick, skipPick |
| `src/hooks/useDivisions.ts` | Division CRUD via API |
| `src/utils/draftLogic.ts` | getMandatoryPick, lockSiblingToTeam, getBestAvailable |
| `src/utils/simulation.ts` | runSimulation, getSimulationStats |
| `src/utils/exports.ts` | generatePublicRosters, generateOfficialRecord, generateSimulationDraftBoard |
| `src/utils/draftOrder.ts` | calculateDraftOrder for all three formats |
| `src/utils/evaluationProcessor.ts` | Excel to Player conversion, score normalization |
| `src/utils/teamUtils.ts` | Team display name helpers |
| `src/types/index.ts` | All TypeScript interfaces (Player, Team, Division, DraftState, etc.) |
| `src/components/PlayerReviewTable.tsx` | Spreadsheet-style table for CSV player review |
| `src/components/DraftBoard.tsx` | Main draft interface with header, round order, drawer toggle, modals |
| `src/components/draft/DraftBoardPlayerGrid.tsx` | Available players table view (sortable, searchable, with flags and draft buttons) |
| `src/components/draft/DraftBoardRosterView.tsx` | Round-by-round roster grid (teams as columns, shows drafted/pre-filled/current pick) |
| `src/contexts/ViewContext.tsx` | Admin/Public view mode context for draft board |
| `src/components/TeamBuilderFlow.tsx` | Main orchestration for Team Builder steps |
| `src/components/teamBuilder/TeamBuilderResults.tsx` | Results display with happiness indicators and search |
| `src/components/teamBuilder/PlayerDetailDrawer.tsx` | Player request analysis and inline team moves |
| `src/utils/teamBuilderAlgorithm.ts` | Assignment algorithms (balance-first, requests-first, skill-tiered) |
| `src/utils/teamBuilderParser.ts` | Request parsing, name matching, normalization, cluster building |
| `server/draft/models.py` | Django models: Organization, User, OrganizationMembership, Division, Team, Player, DraftState |
| `server/draft/views/` | View functions for auth, divisions, teams, players, draft operations |
| `server/draft/transformers.py` | Model to dict transformations (replaces serializers) |
| `server/draft/services_draft.py` | Draft business logic with race condition prevention |
| `server/draft/middleware.py` | TenantMiddleware for multi-tenancy |
| `server/draft/logging.py` | Structured JSON logging with correlation IDs |
| `server/draft/throttling.py` | Rate limiting classes |
| `src/utils/importPipeline/` | Unified player field definitions, transforms, validation |
| `src/components/ErrorBoundary.tsx` | React error boundary with backend error reporting |
| `docs/RUNBOOK.md` | Operations runbook for production deployment |
| `server/tests/load/locustfile.py` | Locust load testing scenarios |

### Component Hierarchy
```
App
├── LoginPage / RegisterPage (if not authenticated)
├── ForgotPasswordPage / ResetPasswordPage (password reset flow)
├── JoinPage (organization invitation acceptance)
├── ProfilePage (settings mode)
│   ├── MembersTab (organization member management)
│   ├── InviteModal / JoinLinkSection (invitations)
│   ├── ProfileTab (edit profile)
│   └── ChangePasswordModal
├── DivisionSelector / DivisionCreator (with mode selection)
├── [Live Draft Mode]
│   ├── FileUpload → ColumnMapper (CSV flow)
│   ├── EvaluationImport (Excel flow)
│   │   └── PlayerSummaryTable, DetectionModal
│   ├── CSVImportFlow (Dual CSV flow with registration verification)
│   │   ├── DualCSVUpload (upload eval + registration CSVs)
│   │   └── CSVVerificationStep (match players, exclude/DNE)
│   ├── PlayerReview
│   │   └── PlayerReviewTable (spreadsheet-style table)
│   ├── DraftConfig
│   │   └── SimulationModal
│   ├── DraftBoard (main draft interface)
│   │   ├── Header: pick counter, current/next team, age breakdown, mandatory pick alert
│   │   ├── Round Order Display: horizontal team cards with pick states
│   │   ├── Drawer Toggle: switch between players/rosters views
│   │   ├── DraftBoardPlayerGrid (available players - sortable table with search, flags, draft buttons)
│   │   ├── DraftBoardRosterView (team rosters - round×team grid with drafted/pre-filled/current states)
│   │   ├── Round Interstitial Modal (between-round order display)
│   │   └── Draft Complete Modal (finalization prompt)
│   └── DraftComplete
│       ├── Team Balance metrics (Top 8 / Full Roster toggle)
│       ├── Export options (Public Rosters CSV, Official Record CSV)
│       └── TradeModal
└── [Team Builder Mode]
    └── TeamBuilderFlow
        ├── EvaluationImport (Excel with Registration Data tab)
        ├── NameMatchResolver (resolve unmatched player names)
        ├── RequestConfirmation (review/confirm request matches)
        ├── TeamBuilderResults (view assignments with happiness)
        │   ├── PlayerDetailDrawer (request analysis, inline moves)
        │   └── TradeSuggestions (apply balance trades)
        └── Export (rosters + happiness report)
```

## Data Flow

### Import → Draft (Live Draft Mode)
1. CSV/Excel/Dual CSV uploaded and parsed
2. For dual CSV: Registration verification (match players, exclude unregistered, add DNE)
3. Column mapping (for CSV flows) - maps all columns to Player fields
4. Players created with scores calculated
5. Coach's kids and siblings detected/confirmed
6. Teams configured with names and draft order
7. Draft started with resolvedPlayers (lockedToRound set for conflicts)
8. Each pick updates player.isDrafted, team.roster, checks for mandatory picks

### Team Builder Flow (League Generated Mode)
1. Registration Data + Eval tabs parsed from Excel
2. Players linked by First Name + Last Name matching
3. Requests parsed and resolved to actual players/coaches
4. Request Confirmation: User reviews/edits auto-resolved requests
5. Algorithm assigns players to teams (requests-first, balance-first, or skill-tiered)
6. Trade Suggestions: User can apply suggested trades for balance
7. Results show happiness indicators and allow manual swaps via TradeModal

### Simulation
Uses same logic as real draft but on cloned data. Returns SimulationResult with teams and players.

## Team Builder Feature

The Team Builder is for younger divisions (AA, etc.) where teams are auto-assigned rather than drafted.

### Algorithm Modes

**Requests-First (Recommended)**
Prioritizes request satisfaction over balance:
1. **Locked Placements**: Coach kids, assistant coach kids, siblings
2. **Cluster Placement**: Two-way request clusters placed together on same team
3. **Request-Based Placement**: Remaining players placed to maximize request satisfaction
4. **Balance via Trading**: Suggested trades to improve balance without breaking satisfied requests

**Skill-Tiered Draft**
Uses simulated draft rounds for balanced distribution:
1. **Locked Placements**: Coach kids, assistant coach kids, siblings
2. **Draft Simulation**: Players drafted in skill-tier rounds, honoring requests when possible
3. **Request Optimization**: Within each tier, prioritize two-way > one-way > coach requests

**Balance-First (Original)**
1. **Locked Placements**: Coach kids, assistant coach kids, siblings
2. **Top Talent Distribution**: Spread top N players by score for balance
3. **Request-Based Placement**: Honor two-way friends > one-way friends > coach requests > school clustering
4. **Balance-Based**: Remaining players assigned to lowest-scoring teams

### Request Resolution & Confirmation
- **Coach requests**: Match to coach names (exact or fuzzy)
- **Teammate requests**: Parse comma/space-delimited names, resolve to players
- **Two-way detection**: Both players requested each other (higher priority)
- **Confidence scoring**: Auto-confirm (≥90%), needs-review (50-90%), unresolvable (<50%)
- **Request status**: `auto-confirmed` | `needs-review` | `user-confirmed` | `unresolvable`

### Player Happiness Scores
- 🟢 All requests honored
- 🟡 Some requests honored
- 🔴 No requests honored
- ⚪ No requests made

### PlayerDetailDrawer Features
The player detail drawer (`src/components/teamBuilder/PlayerDetailDrawer.tsx`) provides comprehensive decision analysis:

**Algorithm Decision Section:**
- Shows WHY the player was placed on this team with descriptive labels and icons
- Assignment reasons: Coach's Kid, Assistant Coach's Kid, Sibling Lock, Two-Way Friend, One-Way Friend, Coach Request, School Cluster, Team Balance
- Shows round and pick number when player was assigned
- For balance picks: explains why requests couldn't be honored
- For request-based picks: confirms what request was satisfied

**Team-by-Team Analysis (collapsible):**
- Current team highlighted with request count
- All other teams with how many requests would be honored there
- Teams with better options highlighted in purple
- Shows which friends/coach are on each team

**Teammate Request Context:**
- Shows each requested player's score
- Shows how many OTHER friends are on the same team as that request

**Action Flow:**
- Suggested moves go directly to confirm (skip team selection)
- Confirm button in sticky footer (always visible)
- Move and Swap with inline confirmation

**Happiness Recalculation:**
- `recalculateHappiness()` function in teamBuilderAlgorithm.ts
- Called after any manual move or swap
- Updates individual player happiness scores
- Updates division-wide happiness percentage and stats

### Team Score Display
Team headers show three score metrics calculated from actual roster data:
- **Total**: Sum of all player scores
- **Top 8**: Sum of top 8 players by score
- **Avg**: Average score per player with delta % from mean

## Backend Development

### Running the Backend
```bash
docker compose up -d          # Start API + PostgreSQL
docker compose logs -f api    # View API logs
docker compose exec api python manage.py shell  # Django shell
docker compose down           # Stop services
```

### Database Migrations
```bash
docker compose exec api python manage.py makemigrations
docker compose exec api python manage.py migrate
```

### Key Backend Concepts

**Multi-tenancy:**
- Organization is the tenant model
- OrganizationMembership links users to organizations with roles (admin/coach/viewer)
- TenantMiddleware sets `request.organization` from user's membership
- All views filter by `request.organization`

**Auth Flow:**
- GET `/api/auth/csrf/` - Initialize CSRF token cookie (call on app load)
- POST `/api/auth/register/` - Creates user + optional organization + membership
- POST `/api/auth/login/` - Session login
- POST `/api/auth/logout/` - End session
- GET `/api/auth/me/` - Current user with organizations array
- PATCH `/api/auth/me/` - Update profile (name only; email is read-only)
- POST `/api/auth/change-password/` - Change password
- POST `/api/auth/password-reset/` - Request password reset email (rate limited: 3/hr)
- POST `/api/auth/password-reset/confirm/` - Confirm password reset

**Security Features:**
- Rate limiting on auth endpoints (5/min for login/register, 3/hr for password reset)
- Session timeout after 24 hours (SESSION_COOKIE_AGE = 86400)
- CSRF protection with cookie-based tokens
- Password validation: min 8 chars, not entirely numeric, not common passwords
- Email changes disabled (read-only field) to prevent account takeover

**Draft Operations:**
- POST `/api/draft/start/` - Start draft (admin only)
- POST `/api/draft/pick/` - Make a pick
- POST `/api/draft/skip/` - Skip current pick (admin only, final round)
- POST `/api/draft/undo/` - Undo last pick (admin only)
- POST `/api/draft/trade/` - Execute trade (admin only)
- POST `/api/divisions/{id}/reset/` - Reset draft (admin only)

## Testing

### Unit Tests (Vitest)
Frontend unit tests for critical business logic:
```bash
npm run test           # Run once
npm run test:watch     # Watch mode
npm run test:coverage  # With coverage report
```

Test files:
- `src/utils/__tests__/draftLogic.test.ts` - getMandatoryPick, lockSiblingToTeam, getBestAvailable
- `src/utils/__tests__/draftOrder.test.ts` - calculateDraftOrder for all 3 formats
- `src/utils/__tests__/importPipeline.test.ts` - Field definitions, transforms, validation

### Backend Unit Tests (Django)
```bash
docker compose exec api python manage.py test draft.tests
```

Test files:
- `server/draft/tests/test_draft_service.py` - DraftService operations (start, pick, undo, skip, trade)
- `server/draft/tests/test_sibling_locking.py` - Sibling chain locking/unlocking

### Load Testing (Locust)
```bash
pip install -r server/tests/load/requirements.txt
locust -f server/tests/load/locustfile.py --host=http://localhost:3001
```

### E2E Tests (Playwright)
Located in `e2e/draft-flow.spec.ts`. Run with:
```bash
npx playwright test
```

### Manual Verification
1. `npm run build` - Must pass without errors
2. `docker compose up -d` - Start backend
3. `npm run dev` - Test in browser
4. Test all phases: import → review → config → draft → complete
5. Verify coach's kid and sibling rules work
6. Test simulation and exports

## Coding Patterns

### React Patterns
- Functional components with hooks
- useCallback for stable function references
- useMemo for computed values
- useEffect for side effects and sync

### TypeScript
- Strict typing throughout
- Interfaces in `types/index.ts`
- Type guards where needed

### State Updates
Draft state uses functional updates: `setDraftState(prev => ({ ...prev, ... }))`

## Common Tasks

### Adding a new export format
1. Add function to `src/utils/exports.ts`
2. Call from appropriate component (SimulationModal, DraftComplete)
3. Use `downloadCSV()` or `downloadTextFile()` helper

### Adding a draft rule
1. Update `getMandatoryPick()` in `draftLogic.ts`
2. Handle in `useDraft.ts` draftPlayer callback
3. Display warning in `DraftBoard.tsx`

### Adding player fields
1. Add to `PLAYER_FIELD_DEFINITIONS` in `src/utils/importPipeline/fieldDefinitions.ts` (single source of truth)
2. Add to `Player` interface in `types/index.ts`
3. Update CSV parsing in `csvParser.ts`
4. Update Excel processing in `evaluationProcessor.ts`
5. Display in PlayerReview and DraftBoard

Note: The importPipeline module auto-generates transforms from field definitions, so adding a field there handles API transformations automatically.

## Branching

- `staging` - Testing and pre-production
- `main` - Production

## Stabilization Complete (January 2025)

The application underwent a comprehensive stabilization effort. All phases completed:

### Phase 0: Critical Fixes ✅
- Fixed backend race condition in pick counter using Max aggregation
- Added frontend operation lock timeout (30s failsafe)
- Converted sibling chain updates to atomic bulk_update

### Phase 1: Observability ✅
- Added structured JSON logging with correlation IDs (`server/draft/logging.py`)
- Added RequestIDMiddleware for request tracing
- Enhanced health check endpoint with database connectivity test
- Added React ErrorBoundary with backend error reporting
- Added client error logging endpoint (`/api/log-error/`)

### Phase 2: Testing ✅
- Added Vitest for frontend unit tests (67 tests)
- Added Django unit tests for backend (40 tests)
- Total: 107 unit tests covering critical business logic

### Phase 3: Data Pipeline ✅
- Created unified player field definitions (`src/utils/importPipeline/`)
- Single source of truth for all 41 player fields
- Auto-generated transforms from definitions
- Pre-flight validation before API calls

### Phase 4: Operations ✅
- Created comprehensive operations runbook (`docs/RUNBOOK.md`)
- Documented incident response procedures
- Documented database backup/restore procedures
- Documented alerting configuration

### Phase 5: Performance Validation ✅
- Added database indexes for frequently queried fields
- Fixed N+1 queries in division list, team/division detail, draft response
- Optimized team score calculations with SQL aggregation
- Created Locust load testing framework (`server/tests/load/`)

### Phase 6: Feature Completion ✅
- Skip pick API: Complete (backend service, API endpoint, frontend UI)
- Team Builder: Merged with skill-tiered algorithm, PlayerDetailDrawer, improved request satisfaction

## Outstanding Items

### Deferred (Low Priority)
- **Audit logging**: Events logged to stdout but not persisted to database. For compliance requirements, would need an AuditLog model and API endpoint.
- **Multi-tab sync in API mode**: Currently works for localStorage mode only. Would require WebSocket or polling.

### Future Enhancements (Not Started)
- Parent portal for request submission
- ML-based fuzzy name matching
- Request gaming detection
- Grade-based clustering algorithm improvements
- Algorithm Teaching Tool (Phases 2-5): Correction capture, pattern analysis, learned preferences

## Session Continuation Notes

### Current Work: Team Builder Algorithm Teaching Tool

**Completed (January 2025):**
- Phase 1: Decision Inspector - Fully implemented in PlayerDetailDrawer
- Happiness recalculation on manual moves/swaps
- UX improvements: sticky confirm footer, direct-to-confirm for suggested moves
- Team score display: Total, Top 8, Avg with delta %

**In Progress:**
- Algorithm Teaching Tool Phases 2-5 (see `docs/ALGORITHM_TEACHING_TOOL.md`)
- User's proposed algorithm flow:
  1. Assign coach kids to parent's team
  2. Place kids requested BY coach kids
  3. Place players who requested specific coaches
  4. Friend-chain placement (complex logic needed)
  5. Review & optimization phase

**Key Files for Continuation:**
- `src/components/teamBuilder/PlayerDetailDrawer.tsx` - Decision reasoning UI
- `src/components/teamBuilder/TeamBuilderResults.tsx` - Results display with team scores
- `src/utils/teamBuilderAlgorithm.ts` - Algorithm logic and happiness recalculation
- `docs/ALGORITHM_TEACHING_TOOL.md` - Teaching tool design doc
