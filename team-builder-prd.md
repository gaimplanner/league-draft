# Team Builder - Product Requirements Document

## Overview

**Feature Name:** Team Builder (Auto-Assignment for Non-Draft Divisions)

**Problem Statement:** Younger baseball divisions don't use live drafts. Instead, league admins manually create balanced teams while honoring coach assignments, friend requests, and school groupings. This is currently done in spreadsheets and takes hours of manual work.

**Solution:** An automated team assignment system that creates fair teams while maximizing "happiness" (honoring requests), outputting to the same data structure as a completed draft so existing trade and export functionality works seamlessly.

---

## User Story

As a league admin for a younger division, I want to:
1. Import player evaluations and request data from a single Excel file
2. Configure teams by assigning coaches
3. Run an auto-assignment algorithm that balances teams by skill while honoring friend/coach requests
4. Review results with visibility into which requests were honored
5. Make manual swaps to fine-tune assignments
6. Export final rosters using existing export tools

---

## Data Model

### Input: Excel File Structure

```
📁 AA_Division_2025.xlsx
├── 📋 Tab: "Registration Data"
│   └── First Name | Last Name | Coach Request | Teammate Requests | School | Grade
├── 📋 Tab: "Summary" (optional)
│   └── Bib | Name | [calculated scores - ignored, we recalculate]
├── 📋 Tab: "Fielding"
│   └── Bib | Name | Ground Balls | Throw to First
├── 📋 Tab: "Hitting"
│   └── Bib | Name | Power | Form | Contact
├── 📋 Tab: "Pitching"
│   └── Bib | Name | Strength | Form
├── 📋 Tab: "Fly Balls"
│   └── Bib | Name | Catches (0-3)
└── 📋 Tab: "Base Running"
    └── Bib | Name | Time (seconds)
```

### Key Data Relationships

**Registration Data ↔ Eval Tabs:**
- Registration Data has NO Bib number
- Must match on First Name + Last Name to link Bib from eval tabs
- Handle: Name mismatches flagged for manual resolution

**Request Parsing:**
- Coach Request: Single value (coach last name or full name)
- Teammate Requests: Comma or space delimited names in single cell
- Both require fuzzy matching to actual players/coaches

---

## Feature Requirements

### 1. Import & Data Linking

**1.1 Excel Upload**
- Accept .xlsx file with expected tab structure
- Detect tabs by name:
  - "Registration Data" → request/school/grade data
  - "Summary" → skip (we recalculate scores)
  - Other tabs → eval categories (Fielding, Hitting, etc.)
- If no "Summary" tab exists, detect eval tabs by standard names

**1.2 Player Linking**
- Match Registration Data rows to eval data by First Name + Last Name
- Create unified player record with:
  - Bib (from eval tabs)
  - Name
  - Raw eval scores (from eval tabs)
  - Coach request (from Registration Data)
  - Teammate requests (parsed list from Registration Data)
  - School
  - Grade
- Flag unmatched players for manual resolution

**1.3 Request Parsing**
- Split Teammate Requests cell by comma or space
- For each request string, attempt to match to a player:
  - Try exact full name match
  - Try last name match (if unique)
  - If ambiguous, flag for manual resolution
- Identify two-way requests (Player A requests B AND Player B requests A)
- Identify one-way requests (only one direction)

**1.4 Coach Request Matching**
- Match coach request string to configured coaches
- Try last name match first, then full name
- If coach is not actually coaching this season, ignore request

### 2. Team Configuration

**2.1 Team Setup**
- Admin specifies number of teams (5-10 typical)
- Admin assigns head coach to each team
- Team name defaults to coach's last name
- Admin assigns assistant coaches (optional)

**2.2 Locked Players**
- Coach's kids auto-locked to coach's team
- Assistant coach's kids auto-locked to team
- Siblings detected by last name, locked together
- Admin can manually lock any player to any team

### 3. Auto-Assignment Algorithm

**3.1 Algorithm: Greedy Assignment with Constraints**

```
Phase 0: Lock Placements
  - Place all locked players (coach kids, assistant kids, manually locked)
  - Place siblings with their locked sibling
  - Calculate initial team scores

Phase 1: Skill-Based Placement (Top Talent)
  - Sort remaining players by total eval score (descending)
  - For top N players (configurable, e.g., top 2 per team):
    - Assign to team with lowest current total score
    - This spreads top talent evenly

Phase 2: Request-Honored Placement
  - For remaining players (still sorted by score descending):
    - Find "best" team using priority:
      1. Team that honors TWO-WAY teammate request (friend already on team)
      2. Team that honors ONE-WAY teammate request
      3. Team that honors coach request
      4. Team with most schoolmates
      5. Team with lowest total score (balance fallback)
    - Constraint: Team must not exceed max roster size
    - Constraint: Assignment must not break balance tolerance

Phase 3: Remaining Players
  - Any unassigned players (no requests, no matches)
  - Assign to team with lowest total score
  - These are effectively "free agents"
```

**3.2 Balance Tolerance**
- Target: All teams within ±X% of mean total score
- Default: 10% tolerance
- Admin configurable
- Algorithm will sacrifice request honoring to maintain balance

**3.3 Roster Size**
- Target: Even distribution (total players ÷ teams)
- Flexible: Allow ±2 players per team
- Hard max: 13 players per team

### 4. Results View

**4.1 Team Summary**
- Show all teams with:
  - Team name (coach)
  - Roster count
  - Total eval score
  - Score delta from mean (for balance visibility)

**4.2 Player List with Happiness**
- Each player row shows:
  - Name, Bib, Total Score
  - Assigned Team
  - Happiness Indicator:
    - 🟢 All requests honored
    - 🟡 Some requests honored
    - 🔴 No requests honored
    - ⚪ No requests made
  - Request Details (expandable):
    - Coach request: ✓ Honored / ✗ Not honored / — Not coaching
    - Each teammate request: ✓ Same team / ✗ Different team
    - Two-way requests highlighted

**4.3 Warnings & Flags**
- Unmatched players (registration ↔ eval)
- Ambiguous request matches
- Balance violations
- Roster size imbalances

### 5. Manual Adjustments

**5.1 Swap Interface**
- Reuse existing trade module
- Select Player A from Team X
- Select Player B from Team Y
- Execute swap
- Recalculate team scores and happiness indicators

**5.2 Re-run Algorithm**
- Admin can adjust parameters (balance tolerance, top talent rounds)
- Re-run algorithm from scratch
- Previous manual swaps are lost (confirm before re-run)

### 6. Finalization & Export

**6.1 Data Structure**
- Auto-assignment outputs as "completed draft" state
- Each placement is a "pick" in simulated draft order
- Enables full reuse of:
  - Trade module (post-assignment swaps)
  - Export module (rosters, draft history)

**6.2 Exports**
- Team rosters (same as existing)
- Comprehensive view (same as existing)
- Happiness report (new, UI + exportable):
  - Per-player request fulfillment details
  - Coach request: honored/not honored/coach not participating
  - Each teammate request: honored (same team) / not honored (different team)
  - Two-way vs one-way indicator
  - School and grade for reference
  - Export format: CSV for admin use in Excel

---

## User Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  1. CREATE DIVISION                                             │
│     Select division (Majors, AAA, AA, etc.)                     │
│                                                                 │
│     ┌─────────────────────────────────────────────────────┐     │
│     │  How will teams be formed?                          │     │
│     │                                                     │     │
│     │  ○ Live Draft                                       │     │
│     │    Teams take turns selecting players in real-time  │     │
│     │                                                     │     │
│     │  ○ League Generated Teams                           │     │
│     │    System creates balanced teams automatically      │     │
│     │    (honors friend requests & coach assignments)     │     │
│     │                                                     │     │
│     │  ⚠️ This choice cannot be changed later             │     │
│     └─────────────────────────────────────────────────────┘     │
│                                                                 │
│     [Live Draft] → Existing flow                                │
│     [League Generated Teams] → Team Builder flow                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. IMPORT EXCEL                                                │
│     Upload file → Detect tabs → Link players → Parse requests   │
│     Resolve any matching errors                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. CONFIGURE TEAMS                                             │
│     Set team count → Assign coaches → Detect coach kids         │
│     Review/edit locked players                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. RUN AUTO-ASSIGNMENT                                         │
│     Algorithm places all players → Shows results                │
│     Review balance + happiness scores                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. ADJUST                                                      │
│     Make swaps using trade module                               │
│     Or re-run with different parameters                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  6. FINALIZE & EXPORT                                           │
│     Mark complete → Export rosters + happiness report           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Out of Scope (V2+)

| Feature | Rationale |
|---------|-----------|
| Fuzzy name matching (ML-based) | MVP uses exact match + manual resolution |
| Request gaming detection | Needs historical data |
| Optimization algorithm (simulated annealing) | Greedy is explainable and sufficient |
| Parent portal for request submission | Separate product initiative |
| Grade-based clustering algorithm | MVP shows data; admin uses judgment |

---

## Technical Considerations

### Reuse from Existing System
- Eval tab parsing (existing multi-tab import)
- Scoring/weighting system
- Sibling detection
- Coach kid detection
- Trade module
- Export module
- Draft state data structure

### New Components
- Registration Data tab parser
- Request parser (comma/space split, name matching)
- Two-way request detection
- Auto-assignment algorithm
- Happiness score calculator
- Team Builder mode flag on division

### Data Model Additions

```typescript
// Extend Player interface
interface Player {
  // ... existing fields ...
  
  // New fields for Team Builder
  coachRequest?: string;           // Raw input
  coachRequestResolved?: string;   // Matched coach ID or null
  teammateRequests?: string[];     // Raw parsed list
  teammateRequestsResolved?: {     // Matched player IDs
    playerId: string;
    isTwoWay: boolean;
    isHonored: boolean;
  }[];
  school?: string;
  grade?: number;
  happinessScore?: 'all' | 'some' | 'none' | 'no-requests';
}

// Extend Division interface
interface Division {
  // ... existing fields ...
  
  mode: 'live-draft' | 'league-generated';  // Set at creation, immutable
  teamBuilderConfig?: {                      // Only present if mode = 'league-generated'
    balanceTolerance: number;      // e.g., 0.10 for 10%
    topTalentRounds: number;       // e.g., 2
    maxRosterSize: number;         // e.g., 13
  };
}
```

---

## Success Metrics

- **Time saved:** Team assignment completes in <30 minutes (vs 3+ hours manual)
- **Balance achieved:** All teams within configured tolerance
- **Happiness rate:** >70% of two-way requests honored
- **Admin satisfaction:** Fewer manual overrides needed post-assignment

---

## Design Decisions (Resolved)

| Question | Decision |
|----------|----------|
| How is mode selected? | After division selection, prompt: "Live Draft" or "League Generated Teams" |
| Can mode be changed later? | No. Locked at division creation. UI shows warning: "This choice cannot be changed later" |
| Is happiness report exportable? | Yes. Visible in UI AND exportable as CSV for admin use in Excel |
| What's the mode called? | "League Generated Teams" (not "Team Builder" - that's internal name) |
