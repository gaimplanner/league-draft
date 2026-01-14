# Little League Draft App

A comprehensive draft board application for Little League with 8 teams, featuring player evaluations, draft configuration, and live draft management with real-time roster tracking.

## Features

### 1. CSV Upload & Parsing
- Import player evaluations from CSV files
- Expected columns: `Name`, `Hitting`, `Fielding`, `Baserunning`, `Pitching`, `Fly Balls`, `Override`, `Coach Kid`, `Sibling`
- Automatic score calculation and ranking
- Auto-assigns draft round values

### 2. Pre-Draft Player Review
- Toggle between list and grid views
- Edit individual player skill scores
- Real-time score and ranking recalculation
- Visual indicators for coach's kids and siblings

### 3. Draft Configuration
- Customize team names
- Set draft order with drag/drop reordering
- Three draft formats:
  - **Straight**: 1-8, 1-8, 1-8...
  - **Snake**: 1-8, 8-1, 1-8, 8-1...
  - **Recalculated**: Lowest total roster score picks first each round
- Assign coach's kids to their parent's team

### 4. Draft Rules Engine
- **Coach's Kids**: Must be drafted by their assigned team in their projected round
- **Siblings**: Must be drafted by the same team
- Visual warnings for mandatory picks
- Blocks invalid picks

### 5. Live Draft Board
- Searchable available players list
- Current team and pick information
- Real-time team rosters with running scores
- Highlighted mandatory picks
- Undo last pick functionality
- Reset draft with confirmation

### 6. Draft Complete
- Final rosters for all teams
- Team rankings by total score
- Export to CSV functionality
- Complete draft history

### 7. Additional Features
- **localStorage Persistence**: Draft state survives page refreshes
- **Mobile Responsive**: Works on phones and tablets
- **Dark Mode Support**: Automatic theme detection
- **Undo Functionality**: Revert the last pick
- **Reset Draft**: Start over with confirmation

## Getting Started

### Installation

```bash
npm install
```

### Development

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

## CSV Format

Create a CSV file with the following columns:

### Required Columns

| Column Name | Description | Example |
|-------------|-------------|---------|
| **First Name** | Player's first name | Barrett |
| **Last Name** | Player's last name | Laubach |
| **FIELDING SUBTOTAL** | Combined fielding skills score | 14 |
| **HITTING SUBTOTAL** | Combined hitting skills score | 11.7 |
| **PITCHING SUBTOTAL** | Combined pitching skills score | 15.5 |
| **CATCH SCORE** | Catching ability score | 5 |
| **RUNNING Score** | Running speed score | 4.72 |
| **Official Adjust** | Manual score adjustment (can be negative) | 0.5 |
| **Little League Age** | Player's Little League age | 12 |
| **Birthday** | Player's birthday (optional, can be blank) | |
| **All-Star** | TRUE if All-Star player, FALSE otherwise | TRUE |
| **DNE** | TRUE if Did Not Evaluate (manual score), FALSE otherwise | FALSE |

### Optional Columns

| Column Name | Description | Example |
|-------------|-------------|---------|
| **Coach Kid** | TRUE if player is a coach's kid, FALSE otherwise | FALSE |
| **Sibling** | Full name of sibling if applicable (must match exactly) | Hudson Laubach |

### Sample Row

```csv
First Name,Last Name,FIELDING SUBTOTAL,HITTING SUBTOTAL,PITCHING SUBTOTAL,CATCH SCORE,RUNNING Score,Official Adjust,Little League Age,Birthday,All-Star,DNE,Coach Kid,Sibling
Barrett,Laubach,14,11.7,15.5,5,4.72,0.5,12,,TRUE,FALSE,FALSE,
```

### Score Calculation

**Total Score** = FIELDING SUBTOTAL + HITTING SUBTOTAL + PITCHING SUBTOTAL + CATCH SCORE + RUNNING Score + Official Adjust

### Special Notes

- **DNE (Did Not Evaluate)**: Players marked as DNE=TRUE can have all skill scores set to 0, with the total calculated via Official Adjust. These players will be flagged in the UI but are still draftable.
- **Coach Kid**: Must be assigned to their parent's team in draft configuration
- **Sibling**: If one sibling is drafted, the team MUST draft the other sibling as their next pick
- **All-Star**: Displays a badge during review and draft

## Usage Workflow

1. **Upload CSV**: Start by uploading your player evaluations CSV file
2. **Review Players**: Review and optionally edit player scores
3. **Configure Draft**: Set team names, draft order, and format; assign coach's kids to teams
4. **Conduct Draft**: Make picks in order, with automatic enforcement of rules
5. **Complete Draft**: View final rosters and export results

## Draft Rules

### Coach's Kids Rule
- Coach's kids must be drafted by their assigned team
- Must be drafted in their projected round
- System will block other picks if a coach's kid needs to be drafted

### Sibling Rule
- If a player with a sibling is drafted, that team MUST draft the sibling as their next pick
- System will block other picks until sibling requirement is fulfilled
- Sibling names in CSV must match exactly (case-insensitive)

## Technical Stack

- **React** 18.2
- **TypeScript** 5.2
- **Vite** 5.0
- **Tailwind CSS** 3.3
- **lucide-react** (icons)
- **papaparse** (CSV parsing)

## Project Structure

```
src/
├── components/
│   ├── FileUpload.tsx         # CSV upload interface
│   ├── PlayerReview.tsx       # Player review with list/grid toggle
│   ├── DraftConfig.tsx        # Draft configuration
│   ├── DraftBoard.tsx         # Live draft interface
│   ├── TeamRosters.tsx        # Team roster display
│   └── DraftComplete.tsx      # Final results
├── hooks/
│   ├── useDraft.ts            # Main draft state management
│   └── usePlayerScoring.ts    # Player scoring logic
├── types/
│   └── index.ts               # TypeScript interfaces
├── utils/
│   ├── csvParser.ts           # CSV parsing and export
│   ├── draftOrder.ts          # Draft order calculation
│   └── scoring.ts             # Player scoring utilities
└── App.tsx                    # Main application component
```

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## License

MIT
