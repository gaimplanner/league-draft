# Little League Draft Application

A production-ready draft management system for Little League baseball divisions. Supports two modes: **Live Draft** for traditional team-by-team player selection, and **League Generated Teams** (Team Builder) for automatic balanced team creation. Streamlines the entire process from player evaluation import through final team roster generation.

## Current Status

**Production Ready** - All stabilization phases (0-6) complete. 107 unit tests passing. Comprehensive documentation and operations runbook available.

## Features

### Two Division Modes

**Live Draft Mode** - Teams take turns selecting players in real-time
- Three draft formats: Straight, Snake, Recalculated
- Mandatory pick enforcement (coach's kids, siblings)
- Real-time draft board with admin/public views
- Simulation before committing
- Post-draft trades

**League Generated Teams (Team Builder)** - Automatic balanced team creation
- For younger divisions that don't use live drafts
- Honors friend requests and coach preferences
- **Algorithm Comparison**: Run all 3 algorithms, compare results side-by-side
  - Skill Priority: Best players distributed first
  - Request Priority: Maximize request satisfaction
  - Balance Priority: Recalculated draft order
- Request confirmation workflow with confidence scoring
- Sibling safeguards: siblings always stay together during moves/swaps

### Multi-Division Support
- Create divisions with presets: **Majors** (ages 10-12), **AAA** (8-10), **AA** (7-10), or **Custom**
- Support for 5-10 teams per division
- Configurable age limits and max players per age group
- Independent draft states with full persistence

### Three Import Methods

**CSV Import:**
- Flexible column mapping interface
- Support for raw and pre-weighted scoring modes
- Auto-detection of common column names

**Excel Evaluation Workbooks:**
- Import multi-tab evaluation spreadsheets (Fielding, Hitting, Pitching, Fly Balls, Baserunning)
- Field-level scoring weights with real-time recalculation
- Auto-detection of coach's kids and siblings
- Direct team name and assistant coach assignment

**Dual CSV with Registration Verification:**
- Upload evaluation CSV + registration CSV
- Automatically matches players by name (exact and fuzzy matching)
- Exclude evaluated players not in registration list
- Add registered players without evaluations as DNE (Did Not Evaluate)

### Live Draft Board

The draft board provides a comprehensive interface for conducting live drafts:

- **Compact gradient header** with pick counter and current/next team display
- **Age breakdown badges** showing player count per age for current team
- **Mandatory pick banner** alerts when coach's kid or sibling must be drafted
- **Best Available by Age** quick-pick buttons
- **Admin controls**: Skip pick (final round), Undo, Reset
- **Two switchable views**:
  - Available Players: Sortable table with search, flags, draft buttons
  - Team Rosters: Round-by-round grid with teams as columns
- **Round Interstitial Modal** between rounds
- **Admin/Public view modes** for spectator display

### Draft Rules

**Coach's Kids:**
- Must be drafted by their assigned team
- Must be drafted in their projected round
- System blocks other picks until fulfilled

**Siblings:**
- If one sibling is drafted, the team must draft the other
- Automatic locking when first sibling is picked

**Age Limits (Optional):**
- Enforce maximum players per age group
- Configurable per division type

### Team Builder (League Generated Teams)

For younger divisions that don't use live drafts:

- **Excel Import**: Registration Data tab with coach/teammate requests, plus evaluation tabs
- **Request Confirmation**: Review auto-resolved requests with confidence scores
- **Algorithm Comparison Panel**: Run all 3 algorithms, compare side-by-side
  - **Skill Priority**: Best players distributed first, requests honored when balance allows
  - **Request Priority**: Maximizes request satisfaction, suggests trades for balance
  - **Balance Priority**: Recalculated draft order with requests as tiebreakers
  - Shows Top 6 Avg, Spread, and Happiness % for each algorithm
  - Recommends best result (lowest spread + highest happiness)
- **Sibling Safeguards**: Siblings always placed together
  - Swap blocking: Cannot swap player away from sibling
  - Auto-move: Moving a player moves all siblings on that team
- **Happiness Indicators**: Visual status showing request fulfillment (🟢 all, 🟡 some, 🔴 none, ⚪ no requests)
- **Player Detail Drawer**:
  - Algorithm decision reasoning (WHY player was placed)
  - Sibling info section (shows siblings and their team)
  - Team-by-team analysis comparing request satisfaction
  - Inline moves with sticky confirm footer
- **Team Score Display**: Top 6 and Top 6 Avg with delta % from mean
- **Live Happiness Updates**: Scores recalculate on every manual move/swap
- **Finalize Flow**: Finalize teams with ability to edit afterward
- **Export**: Rosters grouped by team alphabetically, Team column first

### Post-Draft Features

- **Team Balance Metrics**: Top 8 Picks and Full Roster views
- **Trade System**: Execute player swaps with reason tracking
- **Multiple Export Formats**: Public rosters, Official draft record, Happiness reports
- Print-ready formatting and clipboard copy

### Organization Management

- **Multi-organization support**: Users can belong to multiple organizations
- **Role-based access**: Admin, Coach, and Viewer roles
- **Member management**: View, invite, and remove members
- **Invite system**: Email invitations or shareable join links

### Security

- Session-based authentication with CSRF protection
- Rate limiting on auth endpoints
- 24-hour session timeout
- Role-based authorization
- Multi-tenant data isolation

### Data Persistence

- Division saved immediately on creation
- Resume at any point after browser close
- Automatic save after each action
- Completion timestamps for archives

## Getting Started

### Prerequisites

- Node.js 18+
- Docker and Docker Compose

### Installation

```bash
npm install
```

### Backend Setup

```bash
# Start backend services (API + PostgreSQL)
docker compose up -d

# Run database migrations
docker compose exec api python manage.py migrate

# Create a superuser (optional)
docker compose exec api python manage.py createsuperuser
```

The API will be available at `http://localhost:3001`.

### Frontend Development

```bash
npm run dev
```

Visit `http://localhost:5173` in your browser.

### Build for Production

```bash
npm run build
```

### Running Tests

```bash
# Frontend unit tests (67 tests)
npm run test

# Backend unit tests (40 tests)
docker compose exec api python manage.py test draft.tests

# E2E tests
npx playwright test
```

## Import Formats

### CSV Format

| Column | Required | Description |
|--------|----------|-------------|
| First Name | Yes | Player's first name |
| Last Name | Yes | Player's last name |
| Little League Age | Yes | Player's LL age (7-12) |
| FIELDING SUBTOTAL | Yes | Fielding score |
| HITTING SUBTOTAL | Yes | Hitting score |
| PITCHING SUBTOTAL | Yes | Pitching score |
| CATCH SCORE | Yes | Catching ability |
| RUNNING Score | Yes | Running speed |
| Official Adjust | No | Manual adjustment |
| Birthday | No | Player's birthday |
| All-Star | No | TRUE/FALSE |
| DNE | No | Did Not Evaluate flag |
| Coach Kid | No | TRUE/FALSE |
| Sibling | No | Sibling's full name |

### Excel Evaluation Workbook

Expected tabs: `Fielding`, `Pitching`, `Hitting`, `Fly Balls`, `Baserunning`

For Team Builder mode, include a `Registration Data` tab with:
- First Name, Last Name
- Coach Request (coach name)
- Teammate Requests (comma-separated names)
- School, Grade

## Workflow

### Live Draft
```
1. CREATE DIVISION → Select preset, team count, and "Live Draft" mode
2. IMPORT PLAYERS → Upload CSV or Excel workbook
3. REVIEW & ADJUST → Edit scores, detect relationships
4. CONFIGURE DRAFT → Set format, order, team names
5. CONDUCT DRAFT → Live picks with rule enforcement
6. COMPLETE → View results, execute trades, export
```

### Team Builder
```
1. CREATE DIVISION → Select preset, team count, and "League Generated Teams" mode
2. IMPORT EXCEL → Upload file with Registration Data + eval tabs
3. RESOLVE NAMES → Match registration to evaluation data
4. CONFIRM REQUESTS → Review auto-resolved friend/coach requests
5. CONFIRM COACH KIDS → Verify coach kids and siblings
6. COMPARE ALGORITHMS → View 3 algorithms side-by-side, select best
7. REVIEW & ADJUST → Make manual moves/swaps (siblings move together)
8. FINALIZE → Save teams (can still edit afterward)
9. EXPORT → Rosters + happiness report (grouped by team)
```

## Technical Stack

| Component | Technology |
|-----------|------------|
| Frontend | React 18, TypeScript 5 |
| Build Tool | Vite 5 |
| Styling | Tailwind CSS 3 |
| Icons | lucide-react |
| CSV/Excel Parsing | papaparse, xlsx |
| State | React Hooks + Context |
| Backend | Django 5, Django REST Framework |
| Database | PostgreSQL 16 |
| Auth | Session-based (Django sessions) |
| Container | Docker + Docker Compose |
| Testing | Vitest (frontend), Django TestCase (backend), Playwright (E2E) |

## Project Structure

```
src/
├── api/                    # API client
├── components/
│   ├── draft/              # Draft board components
│   ├── evaluation/         # Import components
│   ├── profile/            # Profile & organization management
│   └── teamBuilder/        # Team Builder components
├── contexts/               # React contexts (Auth, View)
├── hooks/                  # Custom hooks (useDraft, useDivisions)
├── types/                  # TypeScript interfaces
└── utils/
    ├── __tests__/          # Unit tests
    └── importPipeline/     # Player field definitions

server/
├── draft/
│   ├── models.py           # Django models
│   ├── views/              # API views
│   ├── services_draft.py   # Draft business logic
│   ├── transformers.py     # Model transformations
│   ├── logging.py          # Structured logging
│   └── tests/              # Backend tests
└── league_draft/           # Django settings

docs/
├── RUNBOOK.md              # Operations runbook
└── PLAYER_IMPORT_PIPELINE_PROPOSAL.md

e2e/                        # Playwright E2E tests
```

## Documentation

- **[CLAUDE.md](./CLAUDE.md)** - AI assistant context and codebase overview
- **[docs/RUNBOOK.md](./docs/RUNBOOK.md)** - Production operations runbook
- **[team-builder-prd.md](./team-builder-prd.md)** - Team Builder product requirements

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## License

MIT
