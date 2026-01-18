# CLAUDE.md - AI Assistant Context

This file provides context for AI assistants working on this codebase.

## Project Overview

**Little League Draft Application** - A React/TypeScript web app for managing Little League baseball drafts. Handles player imports, scoring, draft execution with rule enforcement, and result exports.

## Key Concepts

### Division
Top-level container. Presets: Majors (10-12), AAA (8-10), AA (7-10), Custom. Each division has its own teams, players, and draft state.

### Player
Imported from CSV or Excel. Has skill scores, total score, rank, and flags (isCoachKid, siblingId, isAllStar, isDNE). Draft status tracked via isDrafted, draftedByTeamId, draftedInRound, draftedAtPick.

### Team
Has name, roster (drafted players), totalScore, draftPosition, coachKids array, assistantCoaches, and ageBreakdown.

### Draft Formats
- **Straight**: 1-8, 1-8, 1-8...
- **Snake**: 1-8, 8-1, 1-8, 8-1...
- **Recalculated**: Lowest roster score picks first each round

### Mandatory Picks
- **Coach's kids**: Must be drafted by assigned team in their projected round
- **Siblings**: When one is drafted, team must draft the other (locked via lockedToTeamId)

## Architecture

### App Phases
`upload` → `mapping` → `review` → `config` → `draft` → `complete`

### Backend (Django REST Framework)
- **Multi-tenant architecture**: League is the tenant model
- **LeagueMembership**: Users can belong to multiple leagues with roles (admin/member)
- **TenantMiddleware**: Injects `request.league` based on user's membership or X-League-ID header
- **Session-based auth**: Django sessions with CSRF protection
- **Rate limiting**: AuthRateThrottle (5/min) and PasswordResetRateThrottle (3/hr)
- **Session timeout**: 24-hour expiration (SESSION_COOKIE_AGE)

### State Management
- `useDivisions` hook: Division CRUD via API
- `useDraft` hook: Draft state, pick logic, undo, mandatory pick checks via API
- `useEvaluationImport` hook: Excel workbook processing
- `AuthContext`: User authentication state

### Key Files

| File | Purpose |
|------|---------|
| `src/App.tsx` | Main orchestration, phase routing, state coordination |
| `src/api/client.ts` | API client with snake_case/camelCase transformations |
| `src/contexts/AuthContext.tsx` | Authentication state, login/logout/register |
| `src/hooks/useDraft.ts` | Draft state machine, pick validation, startDraft, draftPlayer, undoLastPick |
| `src/hooks/useDivisions.ts` | Division CRUD via API |
| `src/utils/draftLogic.ts` | getMandatoryPick, lockSiblingToTeam, getBestAvailable |
| `src/utils/simulation.ts` | runSimulation, getSimulationStats |
| `src/utils/exports.ts` | generatePublicRosters, generateOfficialRecord, generateSimulationDraftBoard |
| `src/utils/draftOrder.ts` | calculateDraftOrder for all three formats |
| `src/utils/evaluationProcessor.ts` | Excel to Player conversion, score normalization |
| `src/utils/teamUtils.ts` | Team display name helpers |
| `src/types/index.ts` | All TypeScript interfaces (Player, Team, Division, DraftState, etc.) |
| `src/components/PlayerReviewTable.tsx` | Spreadsheet-style table for CSV player review |
| `server/draft/models.py` | Django models: League, User, LeagueMembership, LeagueInvitation, Division, Team, Player, DraftState |
| `server/draft/views.py` | DRF ViewSets, auth endpoints, member management, invitations |
| `server/draft/serializers.py` | DRF serializers with snake_case/camelCase handling |
| `server/draft/services.py` | Draft business logic (start, pick, undo, trade) |
| `server/draft/middleware.py` | TenantMiddleware for multi-tenancy |
| `server/draft/throttling.py` | Rate limiting classes (AuthRateThrottle, PasswordResetRateThrottle) |
| `server/draft/validators.py` | Custom password validators (StrongPasswordValidator) |
| `src/utils/passwordValidation.ts` | Client-side password validation matching Django validators |
| `src/components/profile/*.tsx` | Profile page, member management, invitations |
| `src/components/JoinPage.tsx` | League invitation acceptance flow |

### Component Hierarchy
```
App
├── LoginPage / RegisterPage (if not authenticated)
├── ForgotPasswordPage / ResetPasswordPage (password reset flow)
├── JoinPage (league invitation acceptance)
├── ProfilePage (settings mode)
│   ├── MembersTab (league member management)
│   ├── InviteModal / JoinLinkSection (invitations)
│   ├── ProfileTab (edit profile)
│   └── ChangePasswordModal
├── DivisionSelector / DivisionCreator
├── FileUpload → ColumnMapper (CSV flow)
├── EvaluationImport (Excel flow)
│   └── PlayerSummaryTable, DetectionModal
├── PlayerReview (CSV flow)
│   └── PlayerReviewTable (spreadsheet-style table)
├── DraftConfig
│   └── SimulationModal
├── DraftBoard
│   └── TeamRosters
└── DraftComplete
    └── TradeModal
```

## Data Flow

### Import → Draft
1. CSV/Excel uploaded and parsed
2. Players created with scores calculated
3. Coach's kids and siblings detected/confirmed
4. Teams configured with names and draft order
5. Draft started with resolvedPlayers (lockedToRound set for conflicts)
6. Each pick updates player.isDrafted, team.roster, checks for mandatory picks

### Simulation
Uses same logic as real draft but on cloned data. Returns SimulationResult with teams and players.

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
3. Use `downloadTextFile()` helper

### Adding a draft rule
1. Update `getMandatoryPick()` in `draftLogic.ts`
2. Handle in `useDraft.ts` draftPlayer callback
3. Display warning in `DraftBoard.tsx`

### Modifying simulation
1. Update `runSimulation()` in `simulation.ts`
2. Simulation uses same `getMandatoryPick`, `lockSiblingToTeam`, `getBestAvailable`

### Adding player fields
1. Add to `Player` interface in `types/index.ts`
2. Update CSV parsing in `csvParser.ts`
3. Update Excel processing in `evaluationProcessor.ts`
4. Display in PlayerReview and DraftBoard

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
- League is the tenant model
- LeagueMembership links users to leagues with roles (admin/member)
- TenantMiddleware sets `request.league` from user's membership
- DivisionViewSet filters by `request.league`

**Auth Flow:**
- GET `/api/auth/csrf/` - Initialize CSRF token cookie (call on app load)
- POST `/api/auth/register/` - Creates user + optional league + membership
- POST `/api/auth/login/` - Session login
- POST `/api/auth/logout/` - End session
- GET `/api/auth/me/` - Current user with leagues array
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

**League Member Management:**
- GET `/api/leagues/{id}/members/` - List league members
- DELETE `/api/leagues/{id}/members/{user_id}/` - Remove member
- PATCH `/api/leagues/{id}/members/{user_id}/role/` - Change member role

**Invitations:**
- GET/POST `/api/leagues/{id}/invitations/` - List/create email invitations
- DELETE `/api/leagues/{id}/invitations/{id}/` - Cancel invitation
- POST `/api/invitations/accept/` - Accept email invitation
- GET/POST/DELETE `/api/leagues/{id}/join-link/` - Manage join link
- GET `/api/leagues/join/{token}/` - Get league info from join token (public)
- POST `/api/leagues/join/{token}/` - Join via link

## Testing Approach

### E2E Tests (Playwright)
Located in `e2e/draft-flow.spec.ts`. Run with:
```bash
npx playwright test
```

Tests cover:
- Complete draft workflow from CSV import through completion
- DNE player handling
- Sibling rule enforcement

### Manual Verification
1. `npm run build` - Must pass without errors
2. `docker compose up -d` - Start backend
3. `npm run dev` - Test in browser
4. Test all phases: import → review → config → draft → complete
5. Verify coach's kid and sibling rules work
6. Test simulation and exports

## Important Implementation Notes

### API Mode vs localStorage Mode
- Controlled by `VITE_USE_API` env var
- API mode: All data persisted to PostgreSQL via Django REST API
- localStorage mode: Data stored in browser (legacy, for offline use)
- `useDraft.ts` and `useDivisions.ts` handle both modes

### Draft State ID
- `DraftState.id` must be captured from API responses
- Stored in `draftStateId.current` ref in `useDraft.ts`
- Required for all draft operations (pick, undo, trade)
- Without it, draft falls back to localStorage mode

### Player Data Persistence
- Players must be saved to API when exiting Review phase
- `savePlayersToApi()` called in `handleReviewComplete`
- Includes coach kid assignments (`coachTeamId`) and sibling links (`siblingId`)
- Sibling IDs remapped during bulk create (old frontend IDs → new DB UUIDs)

### Browser History
- Back button handled via popstate listener
- Re-pushes state to prevent navigation (keeps user in app)
- Prevents data loss from accidental back navigation

## Branching

- `development` - Feature work
- `staging` - Testing
- `main` - Production
