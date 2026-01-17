# Little League Draft Application

A comprehensive draft management system for Little League baseball divisions. Streamlines the entire draft process from player evaluation import through final team roster generation, with advanced features for handling coach's kids, siblings, and multiple draft formats.

## Features

### Multi-Division Support
- Create divisions with presets: **Majors** (ages 10-12), **AAA** (8-10), **AA** (7-10), or **Custom**
- Support for 5-10 teams per division
- Configurable age limits and max players per age group
- Independent draft states with full persistence

### Dual Import Methods

**CSV Import:**
- Flexible column mapping interface
- Support for raw and pre-weighted scoring modes
- Auto-detection of common column names

**Excel Evaluation Workbooks:**
- Import multi-tab evaluation spreadsheets (Fielding, Hitting, Pitching, Fly Balls, Baserunning)
- Field-level scoring weights with real-time recalculation
- Auto-detection of coach's kids and siblings
- Direct team name and assistant coach assignment

### Pre-Draft Player Review
- Unified spreadsheet-style table view for both CSV and Excel imports
- Sortable columns (rank, round, name, age, scores)
- Inline cell editing for scores
- Search/filter by name or BIB number
- Row highlighting for coach's kids (blue) and siblings (green)
- Collapsible Teams & Detection panel
- Visual indicators for All-Stars, coach's kids, siblings, and DNE players
- Manual score adjustments with official override field

### Draft Configuration
- **Three Draft Formats:**
  - **Straight**: Standard rotation (1-8, 1-8, 1-8...)
  - **Snake**: Alternating direction (1-8, 8-1, 1-8...)
  - **Recalculated**: Lowest roster score picks first each round
- Drag-and-drop draft order with randomize option
- Team name and assistant coach setup
- Coach's kid team assignments

### Live Draft Board
- Real-time pick tracking with current/next team display
- Searchable available players list
- Mandatory pick alerts for coach's kids and siblings
- Live roster updates with running scores and age breakdowns
- Undo last pick and reset draft functionality
- Round interstitials showing new order (recalculated format)

### Draft Simulation
- Preview draft outcomes before committing
- Compare all three formats side-by-side
- Statistics: highest/lowest scores, spread, average
- Toggle coach's kid and sibling enforcement
- Export simulation results

### Post-Draft Features
- **Trade System**: Execute player swaps with reason tracking
- **Multiple Export Formats:**
  - Public rosters (alphabetical, no scores)
  - Official draft record (pick-by-pick with flags)
  - Simulation draft boards (grid + sequential views with scores)
- Print-ready formatting

### Dual-View Architecture
- **Admin View**: Full control over all functions
- **Public View**: Read-only live display for spectators
- Real-time sync via localStorage
- Access public view: `?view=public`

### Data Persistence
- Automatic save after each action
- Resume incomplete drafts
- Division state snapshots
- Completion timestamps for archives

## Getting Started

### Prerequisites

- Node.js 18+
- Docker and Docker Compose (for backend)

### Installation

```bash
npm install
```

### Backend Setup

The application uses a Django REST Framework backend with PostgreSQL.

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

### Preview Production Build

```bash
npm run preview
```

### Stop Backend Services

```bash
docker compose down
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

Each tab should include:
- `BIB#` column for player identification
- `First Name`, `Last Name` columns
- Skill-specific score columns (Form, Arm Strength, Time, etc.)

## Draft Rules

### Coach's Kids
- Must be drafted by their assigned team
- Must be drafted in their projected round (based on rank)
- System blocks other picks until fulfilled
- Round bumping available for conflicts

### Siblings
- If one sibling is drafted, the team must draft the other
- Prevents siblings from being separated
- Automatic locking when first sibling is picked

### Age Limits (Optional)
- Enforce maximum players per age group
- Configurable per division type
- Prevents roster imbalances

## Workflow

```
1. CREATE DIVISION → Select preset and team count
2. IMPORT PLAYERS → Upload CSV or Excel workbook
3. REVIEW & ADJUST → Edit scores, detect relationships
4. CONFIGURE DRAFT → Set format, order, team names
5. CONDUCT DRAFT → Live picks with rule enforcement
6. COMPLETE → View results, execute trades, export
```

## Technical Stack

| Component | Technology |
|-----------|------------|
| Frontend | React 18.2 |
| Language | TypeScript 5.2 |
| Build Tool | Vite 5.0 |
| Styling | Tailwind CSS 3.3 |
| Icons | lucide-react |
| CSV Parsing | papaparse |
| Excel Parsing | xlsx |
| State | React Hooks + Context |
| Backend | Django 5.2 + Django REST Framework |
| Database | PostgreSQL 16 |
| Auth | Session-based (Django sessions) |
| Container | Docker + Docker Compose |

## Project Structure

```
src/
├── App.tsx                    # Main app with phase routing
├── api/
│   └── client.ts              # API client with transformations
├── components/
│   ├── DivisionSelector.tsx   # Division management
│   ├── DivisionCreator.tsx    # New division setup
│   ├── FileUpload.tsx         # CSV upload
│   ├── ColumnMapper.tsx       # CSV column mapping
│   ├── PlayerReview.tsx       # Player review orchestration
│   ├── PlayerReviewTable.tsx  # Spreadsheet-style player table
│   ├── DraftConfig.tsx        # Draft configuration
│   ├── DraftBoard.tsx         # Live draft interface
│   ├── DraftComplete.tsx      # Results and exports
│   ├── SimulationModal.tsx    # Draft simulation
│   ├── TradeModal.tsx         # Post-draft trades
│   ├── CompleteRosters.tsx    # Roster display
│   ├── LoginPage.tsx          # User login
│   ├── RegisterPage.tsx       # User registration
│   └── evaluation/            # Excel import components
├── hooks/
│   ├── useDivisions.ts        # Division state (API mode)
│   ├── useDraft.ts            # Draft logic (API mode)
│   ├── useEvaluationImport.ts # Excel processing
│   └── usePlayerScoring.ts    # Score calculations
├── contexts/
│   ├── AuthContext.tsx        # Authentication state
│   └── ViewContext.tsx        # Admin/Public mode
├── types/
│   └── index.ts               # TypeScript interfaces
├── utils/
│   ├── csvParser.ts           # CSV operations
│   ├── draftOrder.ts          # Order calculations
│   ├── draftLogic.ts          # Pick validation
│   ├── simulation.ts          # Simulation engine
│   ├── exports.ts             # Export formatting
│   ├── teamUtils.ts           # Team display helpers
│   └── evaluationProcessor.ts # Excel processing
└── e2e/
    └── draft-flow.spec.ts     # Playwright E2E tests

server/
├── draft/
│   ├── models.py              # Django models (League, User, Division, Team, Player, etc.)
│   ├── views.py               # DRF ViewSets and auth views
│   ├── serializers.py         # DRF serializers
│   ├── services.py            # Draft business logic
│   ├── middleware.py          # Tenant middleware
│   └── migrations/            # Database migrations
├── league_draft/
│   ├── settings.py            # Django settings
│   └── urls.py                # URL routing
├── Dockerfile                 # API container
└── docker-compose.yml         # Full stack setup
```

## Branching Strategy

| Branch | Purpose |
|--------|---------|
| `development` | Feature development and experimentation |
| `staging` | Graduated features ready for testing |
| `main` | Production-ready code |

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## License

MIT
