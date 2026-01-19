# Team Builder Implementation Prompt

## Context

I'm building a "Team Builder" feature for my Little League Draft System. This is for younger divisions where we don't do live drafts—instead, we auto-assign players to teams while balancing skill levels and honoring friend/coach requests.

The system is:
- **Frontend:** React + TypeScript + Vite + Tailwind CSS
- **Backend:** Django REST Framework + PostgreSQL
- **Branch:** Create new branch `feature/team-builder` from `backend-infra-django`

## Before Writing Code

1. **Explore the existing codebase** to understand:
   - How divisions are created and configured
   - How the multi-tab Excel import works (evaluation data)
   - How players are scored and weighted
   - How coach kid and sibling detection works
   - How the trade module works (we'll reuse this for swaps)
   - How draft state is structured (we'll output to this format)
   - How exports work

2. **Report back** with:
   - Key files I'll need to modify
   - Proposed new files to create
   - Any architectural concerns or questions

3. **Propose an implementation plan** broken into small PRs

## Requirements Summary

### What This Feature Does

Auto-assigns players to teams for non-draft divisions using this priority:
1. Locked players first (coach kids, assistant coach kids, siblings)
2. Spread top talent evenly for balance
3. Honor two-way friend requests (both kids named each other)
4. Honor one-way friend requests (weighted lower)
5. Honor coach requests (player requested specific coach)
6. Cluster by school when no other signal
7. Fall back to team balance (lowest scoring team gets next player)

### Input: Excel File

```
📁 AA_Division_2025.xlsx
├── "Registration Data" tab (NO Bib number)
│   └── First Name | Last Name | Coach Request | Teammate Requests | School | Grade
├── "Summary" tab (optional, ignored - we recalculate)
├── "Fielding" tab
│   └── Bib | Name | [scores...]
├── "Hitting" tab
├── "Pitching" tab
├── "Fly Balls" tab
└── "Base Running" tab
```

**Critical:** Registration Data has no Bib. Must match First Name + Last Name to eval tabs to link the Bib number.

### Request Parsing

**Teammate Requests column:**
- Multiple names in one cell, comma or space delimited
- Example: "Mike Smith, Jake Johnson" or "Smith Johnson"
- Must resolve to actual players
- Two-way = both players named each other
- One-way = only one direction

**Coach Request column:**
- Coach last name or full name
- Must resolve to an actual coach who is coaching this season
- If coach not found or not coaching, ignore

### Output

**Data structure:** Same as completed draft
- Each assignment is a "pick" in simulated draft order
- Enables reuse of trade module for manual swaps
- Enables reuse of export module for final rosters

**New: Happiness indicator per player**
- 🟢 All requests honored (coach + all teammates)
- 🟡 Some requests honored
- 🔴 No requests honored
- ⚪ No requests made

### Algorithm: Greedy Assignment

```
Phase 0: Place locked players
  - Coach kids → their coach's team
  - Assistant coach kids → that team
  - Siblings → together (with locked sibling, or held for same team)

Phase 1: Top talent distribution
  - Sort remaining by eval score (descending)
  - Take top N players (N = teams × 2, configurable)
  - Assign each to team with lowest current total score
  - This prevents stacking

Phase 2: Request-based placement
  - For each remaining player (still sorted by score):
    - Find best valid team using priority:
      1. Has player's two-way friend already assigned
      2. Has player's one-way friend already assigned
      3. Is player's requested coach's team
      4. Has most players from same school
      5. Has lowest total score (balance)
    - Valid = not full, doesn't break balance tolerance

Phase 3: Remaining players (no signals)
  - Assign to team with lowest total score
```

### Balance Rules

- Target: All teams within ±10% of mean total score (configurable)
- Roster size: Target even, allow ±2, hard max 13
- Algorithm sacrifices request honoring to maintain balance

### UI Flow

1. Create division → Select division type (Majors, AAA, AA, etc.)
2. **Mode selection prompt:**
   ```
   How will teams be formed?
   
   ○ Live Draft
     Teams take turns selecting players in real-time
   
   ○ League Generated Teams  
     System creates balanced teams automatically
     (honors friend requests & coach assignments)
   
   ⚠️ This choice cannot be changed later
   ```
3. If "Live Draft" → existing flow (no changes)
4. If "League Generated Teams" → continue below:
5. Import Excel → Parse all tabs → Link Registration to Eval by name
6. Resolve matching errors (unmatched names, ambiguous requests)
7. Configure teams → Assign coaches → Review locked players
8. Run auto-assignment → View results with happiness scores
9. Make swaps using trade module
10. Finalize → Export rosters + happiness report (CSV)

## Implementation Phases

### Phase 1: Data Model & Import (PR #1)

**Goal:** Add mode selection, parse the new Excel format, link Registration to Eval data

- Add mode selection UI after division type selection
  - Options: "Live Draft" | "League Generated Teams"
  - Warning: "This choice cannot be changed later"
  - Store as `mode: 'live-draft' | 'league-generated'` on Division (immutable after creation)
- If "Live Draft" selected → existing flow, no changes
- If "League Generated Teams" → continue with Team Builder flow
- Add player fields: `coachRequest`, `teammateRequests`, `school`, `grade`
- Create Registration Data tab parser
- Implement First Name + Last Name matching to link Bib
- Parse teammate requests (split on comma/space)
- UI for resolving unmatched players

### Phase 2: Request Resolution (PR #2)

**Goal:** Match request strings to actual players/coaches

- Resolve teammate request strings to player IDs
- Detect two-way vs one-way requests
- Resolve coach request strings to coach IDs
- Flag ambiguous matches for manual resolution
- UI for request resolution

### Phase 3: Auto-Assignment Algorithm (PR #3)

**Goal:** Implement the greedy assignment algorithm

- Implement Phase 0: locked placements
- Implement Phase 1: top talent distribution
- Implement Phase 2: request-based placement
- Implement Phase 3: remaining players
- Calculate happiness scores
- Output to draft state format (simulated picks)

### Phase 4: Results & Adjustment UI (PR #4)

**Goal:** Display results, enable swaps

- Team summary view (roster count, total score, delta from mean)
- Player list with happiness indicators
- Request detail expansion (which requests honored/not)
- Integration with existing trade module for swaps
- Re-run button (with confirmation, clears manual swaps)

### Phase 5: Export & Polish (PR #5)

**Goal:** Export happiness report, polish UX

- Happiness report visible in UI (per-player request fulfillment)
- Happiness report exportable as CSV for admin use in Excel:
  - Player name, team, total score
  - Coach request: honored / not honored / coach not participating
  - Each teammate request with status
  - Two-way vs one-way indicator
  - School and grade columns
- Warnings/flags panel (balance issues, unresolved requests)
- Edge case handling
- Testing

## Constraints

- **Reuse existing code** wherever possible (scoring, detection, trade, export)
- **Don't break existing draft functionality** - Team Builder is additive
- **Output to existing data structures** so trade/export just work
- **Keep algorithm simple and explainable** - admins need to understand why a player is placed

## What I Need From You

1. **Explore first** - Understand the codebase before proposing changes
2. **Ask questions** if requirements are ambiguous
3. **Propose before building** - Outline your approach for each PR
4. **Small increments** - Each PR should be reviewable in isolation
5. **Test critical paths** - Especially the name matching and algorithm logic
