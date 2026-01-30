# Architecture

**Analysis Date:** 2026-01-29

## Pattern Overview

**Overall:** Multi-tier layered architecture with clear separation of concerns between frontend (React) and backend (Django). Frontend manages UI state and orchestration; backend handles persistent storage, multi-tenancy, and business logic.

**Key Characteristics:**
- **Frontend-driven orchestration**: Phase-based state machine (`upload` → `mapping` → `review` → `config` → `draft` → `complete`) managed entirely on client
- **API mode + localStorage fallback**: Can operate in full API mode or standalone mode for offline/legacy usage
- **Multi-tenancy at backend**: Organizations (formerly "Leagues") are tenant units; users have role-based memberships
- **Functional Django views**: Plain function-based views with decorators instead of Django REST Framework
- **Draft logic isolation**: Core draft rules (mandatory picks, sibling constraints, best-available picks) centralized in `draftLogic.ts` and used by both real draft and simulation

## Layers

**Presentation Layer:**
- Purpose: Render UI, handle user interactions, manage phase transitions
- Location: `src/components/`
- Contains: React components organized by feature (evaluation/, draft/, teamBuilder/, profile/)
- Depends on: Hooks (useDraft, useDivisions, useAuth), Contexts (AuthContext, ViewContext), Types
- Used by: App.tsx orchestrator

**State Management Layer:**
- Purpose: Manage application state (divisions, draft, auth, scoring) and API sync
- Location: `src/hooks/`, `src/contexts/`
- Contains:
  - `useDivisions.ts` - Division CRUD and list, triggers API calls for persistence
  - `useDraft.ts` - Draft state machine, pick/undo/trade logic, API sync for picks
  - `useAuth.ts` (in AuthContext) - Login/logout/register, session management
  - `useScoringWeights.ts`, `usePlayerScoring.ts` - Score calculations and player field updates
  - `ViewContext.tsx` - Admin vs public view mode toggle
- Depends on: API client, Types, Utils
- Used by: Components, App.tsx

**Business Logic Layer:**
- Purpose: Pure functions for draft rules, simulation, scoring, file parsing
- Location: `src/utils/`
- Contains:
  - `draftLogic.ts` - `getMandatoryPick()` (coach kids, siblings), `lockSiblingToTeam()`, `getBestAvailable()`
  - `draftOrder.ts` - `calculateDraftOrder()` for Straight/Snake/Recalculated formats
  - `csvParser.ts` - CSV to Player conversion with column mapping
  - `evaluationProcessor.ts` - Excel workbook parsing, score normalization
  - `excelParser.ts` - Raw Excel sheet parsing (dependency of evaluationProcessor)
  - `scoreCalculation.ts` - Weighted score aggregation from component scores
  - `scoreNormalization.ts` - Min-max normalization of scores
  - `simulation.ts` - Draft simulation using same draft logic, returns final team states
  - `exports.ts` - CSV generation for rosters and draft boards
  - `teamBuilderAlgorithm.ts` - Requests-first and balance-first team assignment algorithms
  - `teamBuilderParser.ts` - Request resolution, name matching, clustering
  - `coachKidDetection.ts` - Fuzzy matching coach and player names
  - `playerMerge.ts` - Consolidate evaluation and registration data
  - `teamUtils.ts` - Display name helper for teams
- Depends on: Types
- Used by: Hooks, Components

**API Client Layer:**
- Purpose: HTTP communication with backend, snake_case/camelCase transformation
- Location: `src/api/`
- Contains:
  - `client.ts` - Main API class with methods for divisions, players, teams, draft, auth, leagues
  - `index.ts` - Exports and helper functions like `savePlayersToApi()`, `saveTeamsToApi()`
- Depends on: Types
- Used by: Hooks, App.tsx

**Backend API Layer (Django):**
- Purpose: Persistent storage, multi-tenancy, auth, business logic validation
- Location: `server/draft/views/`
- Contains (function-based views):
  - `auth.py` - Login/register/logout, password reset, CSRF token
  - `divisions.py` - Division CRUD, list with filtering by org
  - `players.py` - Bulk create/update players for a division
  - `teams.py` - Bulk create/update teams, team-specific updates
  - `draft.py` - Start draft, make pick, undo pick, execute trade
  - `leagues.py` (organizations) - Member management, invitations, join links
- Depends on: Models, Services, Transformers
- Used by: Frontend API client

**Data/Model Layer (Django):**
- Purpose: Database schema and ORM models
- Location: `server/draft/models.py`
- Contains: User, Organization, OrganizationMembership, Division, Team, Player, DraftState, Trade, OrganizationInvitation
- Depends on: Django ORM
- Used by: Views, Services

**Services Layer (Django):**
- Purpose: Complex business logic (draft operations, team builder)
- Location: `server/draft/services/`, `server/draft/services_draft.py`
- Contains:
  - `services_draft.py` - `start_draft()`, `make_pick()`, `undo_pick()`, `execute_trade()` - implements draft state machine
  - `team_builder.py` - Team builder algorithms
- Depends on: Models
- Used by: Views

## Data Flow

**CSV Import → Draft:**

1. User selects import type (CSV/Excel/Dual CSV) on `upload` phase
2. `FileUpload.tsx` → `CSVParser` loads and parses CSV into rows/headers
3. `ColumnMapper.tsx` matches CSV columns to Player fields via UI
4. `handleMappingComplete()` in App.tsx calls `parseCSVWithMapping()` from `csvParser.ts`
5. `csvParser.ts` converts CSV rows to Player objects with scores calculated via `scoreCalculation.ts`
6. Players sent to API via `savePlayersToApi()` (if API mode)
7. Players stored in `activeDivision.players`, phase moves to `review`
8. User adjusts scores/coach kids/siblings in `PlayerReview.tsx`
9. `handleReviewComplete()` saves updated players back to API
10. Phase moves to `config`, user configures draft format
11. `startDraft()` initializes draft state, enters `draft` phase

**Excel Evaluation Import:**

1. `EvaluationImport.tsx` → `useEvaluationImport()` → `excelParser.ts` parses workbook
2. `evaluationProcessor.ts` extracts player data from evaluation sheets
3. Scores normalized via `scoreNormalization.ts`
4. Coach kids auto-detected via `coachKidDetection.ts` (fuzzy matching)
5. Players returned to `handleEvaluationComplete()`, skips `review` phase
6. Jumps directly to `config`

**Dual CSV Import (Evaluation + Registration):**

1. `CSVImportFlow.tsx` manages two CSV uploads (eval + registration)
2. `RegistrationMatchStep.tsx` / `CSVVerificationStep.tsx` matches players by name
3. User confirms/excludes players, marks unregistered as DNE (Did Not Evaluate)
4. Verification result stored in state, proceeds to `ColumnMapper`
5. `handleMappingComplete()` filters excluded rows, adds DNE players with 0 scores
6. Continues like normal CSV flow

**Draft Execution:**

1. `DraftBoard.tsx` displays current team, available players
2. User clicks "Draft Player" on a player or mandatory pick suggestion
3. `onDraftPlayer()` calls `draftPlayer()` from `useDraft.ts`
4. `useDraft.ts` calls API `makePick()` with division ID, round, pick, player ID
5. API view `draft.py:make_pick()` calls service `make_pick()` which:
   - Updates Player: `isDrafted=true`, `draftedByTeamId`, `draftedInRound`, `draftedAtPick`
   - Updates Team roster, totalScore
   - Returns updated DraftState
6. Frontend receives response, updates `draftState`, re-checks for mandatory picks
7. Current pick advances (next team, round, or complete)
8. When all players drafted, `DraftState.isDraftComplete = true`, phase moves to `complete`

**Simulation (same logic as real draft):**

1. `SimulationModal.tsx` calls `runSimulation()` from `simulation.ts`
2. `simulation.ts` deep-clones players/teams, resets draft state
3. Iterates through rounds calling:
   - `calculateDraftOrder()` - get current round's team order
   - `getMandatoryPick()` - check for coach kids/siblings to draft this round
   - `getBestAvailable()` - get highest-scoring undrafted player (respects same logic as real draft)
4. Returns `SimulationResult` with final teams and rosters
5. Results displayed in modal without affecting real draft state

**Team Builder (league-generated mode):**

1. Division created with `mode: 'league-generated'`
2. `TeamBuilderFlow.tsx` orchestrates 7 steps: setup → import → resolution → confirm-requests → configure → generate → results
3. Registration data + eval data imported and matched
4. Requests parsed by `teamBuilderParser.ts` (coach requests, teammate requests, fuzzy matching)
5. Request resolution UI shows confidence scores, user confirms/edits
6. `teamBuilderAlgorithm.ts` runs requests-first or balance-first algorithm
7. Algorithm respects coach kids, siblings, and request clusters (two-way teammates)
8. Trade suggestions generated for balance improvement
9. Final team assignments with happiness indicators displayed

**State Management:**

- **Frontend state**: Phase, draft state, division data, auth state managed in React hooks
- **Backend persistence**: All data saved to PostgreSQL via API
- **Sync pattern**: Frontend is source of truth during session; API provides persistence layer
- **Conflict resolution**: API can override stale frontend state (e.g., if user is logged out mid-draft)

## Key Abstractions

**Division:**
- Purpose: Represents a single age group/skill level (Majors, AAA, AA, etc.) with its own teams, players, draft state
- Examples: `src/types/index.ts:Division`, `server/draft/models.py:Division`
- Pattern: Immutable after creation (mode set at creation, can't change to/from league-generated)

**DraftState:**
- Purpose: Represents current state of a draft (round, picks, current team, mandatory pick)
- Examples: `src/types/index.ts:DraftState`, `server/draft/models.py:DraftState`
- Pattern: Cached in division; synchronized with API on every pick

**Player:**
- Purpose: Individual player with scoring, draft status, constraints (coach kid, sibling)
- Examples: `src/types/index.ts:Player`, `server/draft/models.py:Player`
- Pattern: Component scores from eval → weighted subtotals → total score; rank/projected round calculated from total score

**Team:**
- Purpose: Container for drafted players, accumulates totalScore, tracks age breakdown
- Examples: `src/types/index.ts:Team`, `server/draft/models.py:Team`
- Pattern: Roster built during draft, finalized with team name after draft complete

**DraftFormat:**
- Purpose: Determines draft order calculation (Straight, Snake, Recalculated)
- Examples: `src/types/index.ts:DraftFormat`, `src/utils/draftOrder.ts`
- Pattern: Straight (1-8, 1-8, 1-8), Snake (1-8, 8-1, 1-8), Recalculated (lowest score picks first each round)

**MandatoryPick:**
- Purpose: Encapsulates draft rule that forces a pick (coach's kid or sibling)
- Examples: `src/utils/draftLogic.ts:getMandatoryPick()`, `src/types/index.ts:DraftState.mandatoryPick`
- Pattern: Single source of truth used by real draft and simulation; checked before each pick

**ResolvedRequest (Team Builder):**
- Purpose: Request with fuzzy-matched target and confidence score
- Examples: `src/types/index.ts:ResolvedRequest`, `src/utils/teamBuilderParser.ts`
- Pattern: Auto-confirmed (≥90%), needs-review (50-90%), unresolvable (<50%), user-confirmed

**RequestCluster (Team Builder):**
- Purpose: Group of players connected by two-way requests (union-find structure)
- Examples: `src/types/index.ts:RequestCluster`, `src/utils/teamBuilderAlgorithm.ts`
- Pattern: Placed together on same team when possible; oversized clusters auto-split at weakest connection

## Entry Points

**Frontend:**
- Location: `src/main.tsx`
- Triggers: Browser loads app
- Responsibilities: Mount React app in DOM, initialize root component

**App Orchestrator:**
- Location: `src/App.tsx`
- Triggers: After React mounts
- Responsibilities:
  - Phase routing (render appropriate component for current phase)
  - Activate/deactivate divisions
  - Call hooks (useDivisions, useDraft, useAuth) and coordinate their data flows
  - Handle phase transitions (upload → mapping → review → config → draft → complete)
  - Persist phase/player/team changes to API

**Auth Entry:**
- Location: `src/components/LoginPage.tsx`, `src/contexts/AuthContext.tsx`
- Triggers: App detects no auth token, redirects to login
- Responsibilities: Authenticate user, establish session, fetch user's organizations

**Backend API Entry:**
- Location: `server/league_draft/urls.py` (main URLconf)
- Routes to: Views in `server/draft/views/`
- Responsibilities: Route HTTP requests to appropriate view, enforce auth/permissions

**Division Selection Entry:**
- Location: `src/components/DivisionSelector.tsx`
- Triggers: User authenticated, no division selected
- Responsibilities: Display division list, let user select/create division

**Upload Entry (Phase Orchestrator):**
- Location: `src/components/FileUpload.tsx`, `src/components/evaluation/EvaluationImport.tsx`, `src/components/evaluation/CSVImportFlow.tsx`
- Triggers: User clicks import button in upload phase
- Responsibilities: Parse CSV/Excel, validate structure, trigger column mapping

**Draft Entry:**
- Location: `src/components/DraftBoard.tsx`
- Triggers: Phase changes to `draft` after startDraft() succeeds
- Responsibilities: Display available players, round order, current team, handle draft picks

## Error Handling

**Strategy:** Try-catch with user-facing error messages; API errors have specific status codes; fallback to localStorage if API fails

**Patterns:**

**API Error Class:**
```typescript
// src/api/client.ts
class ApiError extends Error {
  constructor(message: string, public status: number, public details?: unknown) {
    super(message);
  }
}
```

**Error Recovery:**
- Session expiry (401): Logout user, redirect to login
- Network failure: Show banner with error message, offer retry
- Validation failure: Display field errors in form
- API timeout (408): Automatic retry with exponential backoff (Issue #23)

**Silent Failures Prevented (Issue #5):**
- All API save operations (savePlayersToApi, saveTeamsToApi, makePick) wrapped in try-catch
- Failures show alert to user and prevent state transition
- Example in `App.tsx:handleMappingComplete()`: If save fails, alert user and return early

**Save Errors Displayed (Issue #27):**
- App.tsx has `saveError` state and banner
- Phase changes that save to API catch errors and populate saveError
- Banner shows until user dismisses

## Cross-Cutting Concerns

**Logging:**
- Frontend: `console.log()` for debug info, `console.error()` for errors
- Backend: Django logging to stdout in Docker
- No centralized logging service

**Validation:**
- **Frontend**: InputValidators in `server/draft/input_validators.py` match backend validators
  - `validate_division_create_data()`, `validate_login_data()`, etc.
  - Called by views before processing
- **Frontend validation**: Basic HTML5 + react component checks (e.g., duplicate division name)
- **Backend validation**: Strict validation in validators.py before any state change

**Authentication:**
- **Frontend**: AuthContext manages user object, login/logout
- **Backend**: Django sessions with CSRF token cookie (set by GET `/api/auth/csrf/`)
- **Protected Routes**: Frontend checks `isAuthenticated` before rendering; backend checks `@require_auth` decorator
- **Session Timeout**: 24 hours (SESSION_COOKIE_AGE = 86400)

**Rate Limiting:**
- **Backend**: Custom throttle classes in `server/draft/throttling.py`
  - AuthRateThrottle: 5 requests/minute for login/register
  - PasswordResetRateThrottle: 3 requests/hour for password reset
  - Implemented via `@rate_limit()` decorator on views
- **Frontend**: No client-side rate limiting; relies on backend

**Multi-Tenancy:**
- **Backend**: `TenantMiddleware` injects `request.organization` (formerly `request.league`)
  - Looks up from user's active membership or X-Organization-ID header
  - All views filter divisions/teams/players by organization
- **Frontend**: Currently single-organization per session (user selects org on login)

**Data Transformation:**
- **Frontend → API**: `transformers.py` converts snake_case to camelCase in responses
- **API → Backend**: `transformers.py` converts camelCase to snake_case in requests
- Pattern: All model fields use snake_case in database, converted to camelCase in API responses

**Undo/Retry Logic:**
- **Draft Undo**: `useDraft.ts:undoLastPick()` calls API `undo_pick()` which reverses last pick's player/team changes
- **Manual Retry**: No automatic retry; user sees error and can manually retry action

---

*Architecture analysis: 2026-01-29*
