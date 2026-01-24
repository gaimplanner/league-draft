# Team Builder - Product Requirements Document

## Status: IMPLEMENTED ✅

This feature has been fully implemented and merged into the main codebase. See implementation notes at the end of this document.

---

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

### 1. Import & Data Linking ✅

**1.1 Excel Upload**
- Accept .xlsx file with expected tab structure
- Detect tabs by name:
  - "Registration Data" → request/school/grade data
  - "Summary" → skip (we recalculate scores)
  - Other tabs → eval categories (Fielding, Hitting, etc.)

**1.2 Player Linking**
- Match Registration Data rows to eval data by First Name + Last Name
- Create unified player record with all fields
- Flag unmatched players for manual resolution

**1.3 Request Parsing**
- Split Teammate Requests cell by comma or space
- For each request string, attempt to match to a player
- Identify two-way requests (Player A requests B AND Player B requests A)
- Identify one-way requests (only one direction)

**1.4 Coach Request Matching**
- Match coach request string to configured coaches
- Try last name match first, then full name

### 2. Team Configuration ✅

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

### 3. Auto-Assignment Algorithm ✅

**Three algorithm modes implemented:**

**3.1 Requests-First (Recommended)**
- Prioritizes request satisfaction over initial balance
- Places two-way request clusters together
- Suggests trades to improve balance without breaking satisfied requests

**3.2 Skill-Tiered Draft**
- Simulates draft rounds for balanced distribution
- Within each tier, honors requests when possible
- Better for divisions where balance is critical

**3.3 Balance-First (Original)**
- Spreads top talent evenly first
- Then honors requests where possible
- Falls back to balance for remaining players

### 4. Results View ✅

**4.1 Team Summary**
- All teams with roster count, total score, delta from mean

**4.2 Player List with Happiness**
- Each player shows assigned team and happiness indicator:
  - 🟢 All requests honored
  - 🟡 Some requests honored
  - 🔴 No requests honored
  - ⚪ No requests made

**4.3 Player Detail Drawer**
- Click any player to see full request analysis
- Shows which requests were honored/not honored
- Inline team move functionality

**4.4 Trade Suggestions**
- System suggests trades to improve balance
- Only tradeable players (no requests or all satisfied)
- Apply individually or all at once

### 5. Manual Adjustments ✅

**5.1 Swap Interface**
- Reuses existing trade module
- Select Player A from Team X, Player B from Team Y
- Execute swap, recalculate scores and happiness

**5.2 Re-run Algorithm**
- Adjust parameters and re-run
- Quick re-run workflow for testing

### 6. Finalization & Export ✅

**6.1 Data Structure**
- Auto-assignment outputs as "completed draft" state
- Enables full reuse of trade and export modules

**6.2 Exports**
- Team rosters (same as existing)
- Happiness report (per-player request fulfillment)

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
│  3. CONFIRM REQUESTS                                            │
│     Review auto-resolved requests with confidence scores        │
│     Edit any ambiguous matches                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. CONFIGURE TEAMS                                             │
│     Set team count → Assign coaches → Review locked players     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. RUN AUTO-ASSIGNMENT                                         │
│     Select algorithm → Generate teams → View results            │
│     Review balance + happiness scores                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  6. ADJUST                                                      │
│     Apply trade suggestions for balance                         │
│     Make manual swaps using trade module                        │
│     Or re-run with different algorithm/parameters               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  7. FINALIZE & EXPORT                                           │
│     Mark complete → Export rosters + happiness report           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Status

### Completed Features ✅

| Feature | Status | Notes |
|---------|--------|-------|
| Mode selection at division creation | ✅ Complete | Immutable after creation |
| Excel import with Registration Data tab | ✅ Complete | Full tab detection |
| Player linking (First + Last name) | ✅ Complete | With name resolution UI |
| Request parsing (comma/space delimited) | ✅ Complete | Fuzzy matching |
| Two-way request detection | ✅ Complete | Cluster building with Union-Find |
| Request confidence scoring | ✅ Complete | Auto-confirm, needs-review, unresolvable |
| Request confirmation UI | ✅ Complete | Edit matches inline |
| Coach kid/sibling locked placements | ✅ Complete | From EvaluationImport |
| Requests-First algorithm | ✅ Complete | With cluster placement |
| Skill-Tiered Draft algorithm | ✅ Complete | Simulated rounds |
| Balance-First algorithm | ✅ Complete | Original implementation |
| Trade suggestions | ✅ Complete | Balance improvement scoring |
| Player Detail Drawer | ✅ Complete | Decision reasoning, request analysis, inline moves |
| Happiness indicators | ✅ Complete | 🟢🟡🔴⚪ |
| Quick re-run workflow | ✅ Complete | Persist registration data |
| Happiness report export | ✅ Complete | CSV format |
| Algorithm Decision Inspector | ✅ Complete | Shows WHY each player was placed |
| Team-by-Team Analysis | ✅ Complete | Compares request satisfaction across teams |
| Happiness recalculation | ✅ Complete | Updates on manual moves/swaps |
| Team score display | ✅ Complete | Total, Top 8, Avg with delta % |

### Out of Scope (Deferred to Future)

| Feature | Rationale |
|---------|-----------|
| ML-based fuzzy name matching | MVP uses exact match + Levenshtein + manual resolution |
| Request gaming detection | Needs historical data |
| Optimization algorithm (simulated annealing) | Greedy is explainable and sufficient |
| Parent portal for request submission | Separate product initiative |
| Grade-based clustering algorithm | MVP shows data; admin uses judgment |

---

## Technical Implementation

### Key Files

| File | Purpose |
|------|---------|
| `src/components/TeamBuilderFlow.tsx` | Main orchestration (1400+ lines) |
| `src/components/teamBuilder/TeamBuilderResults.tsx` | Results display with team scores (Total/Top 8/Avg) |
| `src/components/teamBuilder/PlayerDetailDrawer.tsx` | Decision reasoning, request analysis, inline moves |
| `src/components/teamBuilder/NameMatchResolver.tsx` | Unmatched name resolution |
| `src/components/teamBuilder/RequestConfirmation.tsx` | Request confirmation UI |
| `src/components/teamBuilder/TradeSuggestions.tsx` | Balance trade suggestions |
| `src/utils/teamBuilderAlgorithm.ts` | All three algorithms + recalculateHappiness() |
| `src/utils/teamBuilderParser.ts` | Request parsing, name matching |
| `docs/ALGORITHM_TEACHING_TOOL.md` | Teaching tool design (Phase 1 implemented) |

### Data Model Additions

```typescript
// Player interface extensions
interface Player {
  // ... existing fields ...

  // Team Builder fields
  coachRequest?: string;           // Raw input
  teammateRequests?: string[];     // Raw parsed list
  school?: string;
  grade?: number;
}

// Division interface
interface Division {
  // ... existing fields ...

  mode: 'live-draft' | 'league-generated';  // Set at creation, immutable
}
```

---

## Success Metrics

- **Time saved:** Team assignment completes in <30 minutes (vs 3+ hours manual) ✅
- **Balance achieved:** All teams within configured tolerance ✅
- **Happiness rate:** >70% of two-way requests honored ✅
- **Admin satisfaction:** Fewer manual overrides needed post-assignment ✅

---

## Design Decisions (Resolved)

| Question | Decision |
|----------|----------|
| How is mode selected? | After division selection, prompt: "Live Draft" or "League Generated Teams" |
| Can mode be changed later? | No. Locked at division creation. UI shows warning. |
| Is happiness report exportable? | Yes. Visible in UI AND exportable as CSV. |
| What's the mode called? | "League Generated Teams" (not "Team Builder" - that's internal name) |
| Which algorithm is default? | Requests-First (best for honoring requests while maintaining balance) |

---

## Recent Improvements (January 2025)

### Algorithm Decision Inspector
The PlayerDetailDrawer now shows comprehensive decision reasoning:
- **Algorithm Decision section**: Shows WHY each player was placed (Coach's Kid, Two-Way Friend, Balance, etc.)
- **Round and pick number**: When the player was assigned in the algorithm
- **Context for balance picks**: Explains why requests couldn't be honored
- **Team-by-Team Analysis**: Collapsible section comparing request satisfaction across all teams

### UX Improvements
- **Sticky confirm footer**: Confirm button always visible above fold
- **Direct-to-confirm for suggested moves**: Click "Move to X" goes directly to confirm, skips team selection
- **Teammate request context**: Shows requested player's score and other friends on their team
- **Correct team scores**: Total, Top 8, and Avg calculated from actual roster data

### Happiness Recalculation
- New `recalculateHappiness()` function in teamBuilderAlgorithm.ts
- Called after every manual move or swap
- Updates individual player happiness (none → some → all)
- Updates division-wide happiness percentage and all stats

---

## Future Work: Algorithm Teaching Tool

See `docs/ALGORITHM_TEACHING_TOOL.md` for full design. Phase 1 (Decision Inspector) is complete.

**Remaining Phases:**
- Phase 2: Manual Override with Persistence - Track corrections vs algorithm results
- Phase 3: Correction Capture - Prompt for reason when admin moves a player
- Phase 4: Pattern Analysis - Suggest weight adjustments based on corrections
- Phase 5: Pre-Algorithm Training - Apply learned preferences before running

**User's Proposed Algorithm Flow:**
1. Assign all coach kids to parent's team
2. Place kids who the coach kids have requested
3. Place players who requested specific coaches
4. Friend-chain placement (complex - needs careful design)
5. Review & optimization phase
