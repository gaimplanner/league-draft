# Codebase Structure

**Analysis Date:** 2026-01-29

## Directory Layout

```
little-league-draft/
├── src/                           # React frontend source
│   ├── api/                       # API client
│   │   ├── client.ts              # Main API class with all endpoints
│   │   └── index.ts               # Helper functions (savePlayersToApi, etc.)
│   ├── components/                # React components organized by feature
│   │   ├── evaluation/            # Import flows (CSV, Excel, Dual CSV)
│   │   ├── draft/                 # Draft execution components
│   │   ├── teamBuilder/           # League-generated team assignment
│   │   ├── profile/               # User profile and league member management
│   │   ├── shared/                # Shared UI components (TeamSetupPanel, etc.)
│   │   ├── App.tsx                # Main orchestrator component
│   │   ├── DraftBoard.tsx         # Main draft interface
│   │   ├── DraftComplete.tsx      # Results and exports
│   │   ├── DraftConfig.tsx        # Draft format/order setup
│   │   ├── PlayerReview.tsx       # CSV player review and editing
│   │   ├── DivisionSelector.tsx   # Division selection/creation
│   │   └── ...                    # Other page/modal components
│   ├── contexts/                  # React context providers
│   │   ├── AuthContext.tsx        # Login/register/user session
│   │   └── ViewContext.tsx        # Admin vs public view mode
│   ├── hooks/                     # Custom React hooks
│   │   ├── useDraft.ts            # Draft state machine, pick/undo logic
│   │   ├── useDivisions.ts        # Division CRUD and list
│   │   ├── useAuth.ts (in AuthContext) # Auth state
│   │   ├── usePlayerScoring.ts    # Player field updates
│   │   └── useScoringWeights.ts   # Scoring weight management
│   ├── types/                     # TypeScript interfaces
│   │   ├── index.ts               # All main types (Player, Team, Division, etc.)
│   │   └── evaluation.ts          # Evaluation-specific types
│   ├── utils/                     # Pure utility functions
│   │   ├── csvParser.ts           # CSV to Player conversion with column mapping
│   │   ├── draftLogic.ts          # getMandatoryPick(), getBestAvailable(), lockSiblingToTeam()
│   │   ├── draftOrder.ts          # calculateDraftOrder() for Straight/Snake/Recalculated
│   │   ├── evaluationProcessor.ts # Excel to Player conversion, score processing
│   │   ├── excelParser.ts         # Low-level Excel workbook parsing
│   │   ├── scoreCalculation.ts    # Score aggregation and weighting
│   │   ├── scoreNormalization.ts  # Min-max normalization
│   │   ├── simulation.ts          # Draft simulation (cloned data, same logic)
│   │   ├── exports.ts             # CSV generation for rosters and boards
│   │   ├── teamBuilderAlgorithm.ts    # Requests-first/balance-first algorithms
│   │   ├── teamBuilderParser.ts       # Request parsing and resolution
│   │   ├── coachKidDetection.ts       # Fuzzy matching for coach/player names
│   │   ├── playerMerge.ts            # Consolidate eval + registration data
│   │   ├── teamUtils.ts              # Display name helper for teams
│   │   └── passwordValidation.ts     # Client-side password validation
│   ├── main.tsx                   # React entry point
│   └── vite-env.d.ts              # Vite environment types
│
├── server/                        # Django backend
│   ├── draft/                     # Main Django app
│   │   ├── models.py              # Database models (User, Organization, Division, Team, Player, DraftState, etc.)
│   │   ├── services_draft.py      # Draft business logic (start, pick, undo, trade)
│   │   ├── services/              # Service modules
│   │   │   ├── team_builder.py    # Team builder algorithms
│   │   │   └── __init__.py
│   │   ├── views/                 # Function-based views (replaces DRF)
│   │   │   ├── __init__.py        # Register all view functions as endpoints
│   │   │   ├── auth.py            # Login, register, logout, password reset
│   │   │   ├── divisions.py       # Division CRUD
│   │   │   ├── players.py         # Player bulk create/update
│   │   │   ├── teams.py           # Team bulk create/update
│   │   │   ├── draft.py           # Start draft, make pick, undo, trade
│   │   │   ├── leagues.py         # Organization (League) members and invitations
│   │   │   └── helpers.py         # json_response(), require_auth(), rate_limit()
│   │   ├── middleware.py          # TenantMiddleware (injects request.organization)
│   │   ├── transformers.py        # snake_case <-> camelCase conversion
│   │   ├── validators.py          # Strong password validator
│   │   ├── input_validators.py    # Request data validation functions
│   │   ├── throttling.py          # Custom rate limiting classes
│   │   ├── migrations/            # Database migrations
│   │   ├── management/            # Django management commands (seed_demo, seed_e2e)
│   │   ├── tests/                 # Test suite
│   │   └── admin.py               # Django admin config
│   ├── league_draft/              # Django project settings
│   │   ├── settings.py            # INSTALLED_APPS, middleware, DB config
│   │   ├── urls.py                # Main URLconf, routes to views
│   │   ├── wsgi.py                # WSGI entry point
│   │   └── asgi.py                # ASGI entry point (if async needed)
│   ├── manage.py                  # Django management script
│   └── requirements.txt           # Python dependencies
│
├── e2e/                           # End-to-end tests (Playwright)
│   └── draft-flow.spec.ts         # Complete draft workflow test
│
├── .planning/codebase/            # Generated analysis documents
│   ├── ARCHITECTURE.md            # Architecture analysis
│   └── STRUCTURE.md               # This file
│
├── public/                        # Static assets
├── dist/                          # Built frontend (generated by vite build)
├── node_modules/                  # Frontend dependencies (generated)
├── package.json                   # Frontend dependencies
├── tsconfig.json                  # TypeScript config
├── vite.config.ts                 # Vite build config
├── tailwind.config.js             # Tailwind CSS config
├── playwright.config.ts           # E2E test config
├── docker-compose.yml             # Local dev environment (API + PostgreSQL)
├── Dockerfile                     # Backend Docker image
└── CLAUDE.md                      # Project context for AI assistants
```

## Directory Purposes

**src/api/:**
- Purpose: Centralized HTTP client for backend communication
- Contains: Single API class with methods for all endpoints
- Key files: `client.ts` (main class), `index.ts` (exports and helpers)

**src/components/:**
- Purpose: UI layer - all React components organized by feature
- Contains: Page components (DivisionSelector, LoginPage), phase components (FileUpload, ColumnMapper, PlayerReview, DraftBoard), feature-specific components (evaluation/, draft/, teamBuilder/, profile/)
- Pattern: Components are declarative, call hooks for state, call props callbacks for actions
- Example: `DraftBoard.tsx` displays draft UI, calls props like `onDraftPlayer()`, `onUndo()` which come from App.tsx

**src/components/evaluation/:**
- Purpose: Import flow components (CSV, Excel, Dual CSV)
- Key files:
  - `CSVImportFlow.tsx` - Orchestrates dual CSV (eval + registration)
  - `DualCSVUpload.tsx` - Two-step CSV upload UI
  - `CSVVerificationStep.tsx` - Match/exclude/DNE decision UI
  - `EvaluationImport.tsx` - Excel workbook upload and processing
  - `PlayerSummaryTable.tsx` - Table showing parsed players from Excel

**src/components/draft/:**
- Purpose: Draft execution components
- Key files:
  - `DraftBoardPlayerGrid.tsx` - Available players as sortable table
  - `DraftBoardRosterView.tsx` - Team rosters as grid (teams as columns)

**src/components/teamBuilder/:**
- Purpose: League-generated team assignment flow
- Key files:
  - `TeamBuilderFlow.tsx` - Orchestrates 7-step flow
  - `NameMatchResolver.tsx` - Name matching UI
  - `RequestConfirmation.tsx` - Request confirmation with confidence scores
  - `TradeSuggestions.tsx` - Apply suggested balance trades

**src/components/profile/:**
- Purpose: User account and league member management
- Key files:
  - `ProfilePage.tsx` - User settings, profile edit, password change
  - `MembersTab.tsx` - League member list and removal
  - `InviteModal.tsx` - Send email invitations
  - `JoinLinkSection.tsx` - Manage shareable join links

**src/contexts/:**
- Purpose: Global state providers
- Files:
  - `AuthContext.tsx` - User login/logout, organizations list, session state
  - `ViewContext.tsx` - Admin vs public view toggle (for draft board viewing)

**src/hooks/:**
- Purpose: Custom React hooks for state and logic
- Key hooks:
  - `useDraft` - Core draft state machine (phase, picks, teams), API sync for draft operations
  - `useDivisions` - Division list, select, create, update
  - `useAuth` - User session (login, logout, checkAuth)
  - `usePlayerScoring` - Update player scores, link siblings
  - `useScoringWeights` - Manage division scoring weights

**src/types/:**
- Purpose: TypeScript interfaces - single source of truth for data shapes
- Key file: `index.ts` contains all types (Player, Team, Division, DraftState, etc.)
- Pattern: Export from types/index.ts; use in components, hooks, utils

**src/utils/:**
- Purpose: Pure functions for business logic (no React dependencies, no side effects)
- Key utilities:
  - **Parsing**: `csvParser.ts`, `evaluationProcessor.ts`, `excelParser.ts`
  - **Draft logic**: `draftLogic.ts` (getMandatoryPick), `draftOrder.ts`, `simulation.ts`
  - **Scoring**: `scoreCalculation.ts`, `scoreNormalization.ts`
  - **Exports**: `exports.ts` (CSV generation)
  - **Team Builder**: `teamBuilderAlgorithm.ts`, `teamBuilderParser.ts`
  - **Detection**: `coachKidDetection.ts` (fuzzy matching)

**server/draft/models.py:**
- Purpose: Database schema via Django ORM
- Key models: User, Organization (League), OrganizationMembership, Division, Team, Player, DraftState, Trade, OrganizationInvitation

**server/draft/services_draft.py:**
- Purpose: Draft business logic (state machine implementation)
- Key functions: `start_draft()`, `make_pick()`, `undo_pick()`, `execute_trade()`
- Pattern: Stateless functions that take in state and return new state

**server/draft/services/team_builder.py:**
- Purpose: Team builder algorithm implementations
- Key functions: Run team assignment logic (requests-first, balance-first)

**server/draft/views/:**
- Purpose: HTTP endpoints (function-based, no DRF)
- Files organized by domain:
  - `auth.py` - Login, register, password reset, CSRF
  - `divisions.py` - Division CRUD
  - `players.py` - Player bulk create/update
  - `teams.py` - Team operations
  - `draft.py` - Draft operations
  - `leagues.py` - Organization (League) management
  - `helpers.py` - Utilities like `json_response()`, `require_auth()`, `rate_limit()`
- Pattern: Each view function decorated with `@require_http_methods()`, `@csrf_protect`, `@require_auth`

**server/draft/transformers.py:**
- Purpose: Data transformation between frontend camelCase and backend snake_case
- Pattern: `transform_player()`, `transform_division()` etc. used in views

**server/draft/validators.py & input_validators.py:**
- Purpose: Request validation before processing
- Pattern: Validation functions called at start of each view

**e2e/:**
- Purpose: End-to-end tests using Playwright
- Coverage: Complete draft flow from CSV import through draft completion, DNE handling, sibling rules

## Key File Locations

**Entry Points:**
- `src/main.tsx` - React app entry
- `src/App.tsx` - Main orchestrator, routes to components based on phase
- `server/league_draft/urls.py` - Django URL routing

**Configuration:**
- `.env.local` - Environment variables (VITE_API_URL, etc.)
- `server/.env` - Backend env (DATABASE_URL, SECRET_KEY, etc.)
- `src/types/index.ts` - Type definitions (import any type from here)
- `package.json` - Frontend dependencies, dev scripts

**Core Logic:**
- `src/hooks/useDraft.ts` - Draft state machine
- `src/hooks/useDivisions.ts` - Division management
- `src/utils/draftLogic.ts` - Mandatory pick rules, best available pick
- `src/utils/draftOrder.ts` - Straight/Snake/Recalculated order calculation
- `server/draft/services_draft.py` - Backend draft service

**Data Import:**
- `src/components/FileUpload.tsx` - CSV upload
- `src/utils/csvParser.ts` - CSV to Player conversion
- `src/components/evaluation/EvaluationImport.tsx` - Excel upload
- `src/utils/evaluationProcessor.ts` - Excel to Player conversion

**Draft Execution:**
- `src/components/DraftBoard.tsx` - Main draft UI
- `src/components/draft/DraftBoardPlayerGrid.tsx` - Available players
- `src/components/draft/DraftBoardRosterView.tsx` - Team rosters

**Results & Export:**
- `src/components/DraftComplete.tsx` - Draft results, team balancing, exports
- `src/utils/exports.ts` - CSV generation functions

**Testing:**
- `e2e/draft-flow.spec.ts` - Playwright E2E tests

## Naming Conventions

**Files:**
- React components: PascalCase, `.tsx` (e.g., `DraftBoard.tsx`, `PlayerReview.tsx`)
- Utilities/hooks: camelCase, `.ts` (e.g., `csvParser.ts`, `useDraft.ts`)
- Types: singular, describe the entity (e.g., `Player`, `Team`, not `Players`)
- Tests: `.test.ts`, `.spec.ts` suffixes

**Directories:**
- Feature directories: camelCase (e.g., `components/evaluation/`, `utils/`)
- Group by domain/feature, not file type (e.g., `components/teamBuilder/` not `components/algorithms/`)

**Functions:**
- React components: PascalCase (e.g., `export function DraftBoard()`)
- Hooks: `use` prefix, camelCase (e.g., `useDraft()`, `useDivisions()`)
- Utilities: camelCase (e.g., `getMandatoryPick()`, `calculateDraftOrder()`)
- Backend views: snake_case (e.g., `divisions_list_create()`)

**Variables:**
- camelCase for primitives and objects
- PascalCase only for React components and classes
- Constants: UPPER_SNAKE_CASE if truly constant (e.g., `DEFAULT_TIMEOUT_MS`)

**TypeScript:**
- Interfaces: PascalCase, describe the shape (e.g., `Player`, `DraftState`, `DraftConfig`)
- Type aliases: PascalCase (e.g., `DraftFormat = 'straight' | 'snake' | 'recalculated'`)
- Enums: Not preferred; use discriminated unions instead

## Where to Add New Code

**New Feature (e.g., new export format):**
- Implementation: `src/utils/exports.ts` - Add export function
- Trigger: `src/components/DraftComplete.tsx` - Add button calling new function
- Test: Add E2E test in `e2e/draft-flow.spec.ts` if full workflow affected

**New Draft Rule (e.g., max per position):**
- Definition: `src/types/index.ts:Player` or `src/types/index.ts:Division` - Add field if needed
- Check: `src/utils/draftLogic.ts:getMandatoryPick()` - Add rule check
- Display: `src/components/DraftBoard.tsx` - Show warning/suggestion
- Backend: `server/draft/services_draft.py:make_pick()` - Validate rule on server
- Simulation: `src/utils/simulation.ts` - Uses same draftLogic, automatically respects new rule

**New Component/Page:**
- Create: `src/components/{FeatureName}.tsx` (or subdirectory if complex)
- Add to route: `src/App.tsx` - Add phase or mode check to render component
- Hook if needed: Create in `src/hooks/` if managing significant state
- Tests: Add Playwright test to `e2e/draft-flow.spec.ts`

**Utilities/Helpers:**
- Parsing logic: `src/utils/csvParser.ts` or create new file like `src/utils/newParser.ts`
- Scoring logic: `src/utils/scoreCalculation.ts`
- Algorithm logic: Create new file `src/utils/{algorithmName}.ts`, import types
- Shared UI: `src/components/shared/` subdirectory

**Backend Endpoint:**
- View function: Create or add to appropriate file in `server/draft/views/`
- Model if needed: Add to `server/draft/models.py`
- Service logic: Add to `server/draft/services/` or `server/draft/services_draft.py`
- Route: Register in `server/draft/views/__init__.py`
- URL: Add pattern to `server/league_draft/urls.py`

## Special Directories

**Generated Directories:**
- `dist/` - Built frontend (generated by `npm run build`, not committed)
- `node_modules/` - Frontend dependencies (generated, not committed)
- `server/venv/` - Python virtualenv (generated, not committed)
- `playwright-report/`, `test-results/` - Test artifacts (generated)

**Configuration Directories:**
- `.circleci/` - CI/CD pipeline configuration
- `k8s/` - Kubernetes deployment manifests (not used in local dev)

**Version Control:**
- `.git/` - Git repository
- `.gitignore` - Excluded files

**Planning/Documentation:**
- `.planning/codebase/` - Generated analysis documents (this file, ARCHITECTURE.md)
- `.claude/` - Claude workspace state

---

*Structure analysis: 2026-01-29*
