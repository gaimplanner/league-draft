# Algorithm Teaching Tool Design

## Problem Statement

The Team Builder algorithm is 90% there but makes unexpected decisions in complex multi-variable scenarios. We need a way for league administrators to:
1. Identify bad placements
2. Teach the system what the correct decision should be
3. Have the system learn from these corrections

## Proposed Solution: Decision Override & Learning System

### Core Concept: "Why Not Here?" Analysis

When viewing results, admin can click on any player and ask "Why wasn't this player placed on Team X?"

The system shows:
- What prevented this placement (balance, capacity, request conflict)
- What the algorithm prioritized instead
- Option to override with reasoning

### UI Components

#### 1. Player Decision Inspector (in Results view)

Click any player to see:
```
┌─────────────────────────────────────────────────────┐
│ Jake Bisson - Currently on: Nielsen (Team 2)        │
├─────────────────────────────────────────────────────┤
│ DECISION BREAKDOWN:                                  │
│                                                      │
│ Requests:                                            │
│   • Coach: Hansen (not matched - on Team 4)         │
│   • Friends: [none]                                  │
│   • School: Lincoln Elementary                       │
│                                                      │
│ Why placed on Nielsen?                               │
│   → No satisfiable requests                          │
│   → Balance pick: Nielsen had lowest score (42.1)    │
│                                                      │
│ Alternative Teams Considered:                        │
│   Team 4 (Hansen): Score would be +15.2% above mean  │
│   Team 1 (Smith): No requests, higher score          │
│   Team 3 (Jones): At max capacity                    │
│                                                      │
│ [Move to Different Team ▼] [Flag as Incorrect]       │
└─────────────────────────────────────────────────────┘
```

#### 2. Teaching Mode - Correction Dialog

When admin clicks "Flag as Incorrect":
```
┌─────────────────────────────────────────────────────┐
│ TEACH THE ALGORITHM                                  │
├─────────────────────────────────────────────────────┤
│ Current: Jake Bisson → Nielsen (balance pick)        │
│                                                      │
│ What should have happened?                           │
│ ┌─────────────────────────────────────────────────┐ │
│ │ ○ Honor coach request (go to Hansen/Team 4)     │ │
│ │ ○ Stay with school friends (Lincoln Elementary) │ │
│ │ ○ Different team: [Select Team ▼]               │ │
│ │ ○ Current placement is actually correct         │ │
│ └─────────────────────────────────────────────────┘ │
│                                                      │
│ Why is this the right choice?                        │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Coach requests should be honored even if it     │ │
│ │ means 10-15% score imbalance                    │ │
│ └─────────────────────────────────────────────────┘ │
│                                                      │
│ [Save Correction] [Cancel]                           │
└─────────────────────────────────────────────────────┘
```

#### 3. Rule Builder (Settings/Config)

After collecting corrections, show patterns:
```
┌─────────────────────────────────────────────────────┐
│ LEARNED PREFERENCES                                  │
├─────────────────────────────────────────────────────┤
│ Based on your 12 corrections:                        │
│                                                      │
│ ✓ Coach requests over balance (8 times)              │
│   → Increase coachRequestWeight: 50 → 80            │
│   → Increase balanceTolerance: 10% → 15%            │
│                                                      │
│ ✓ Keep school friends together (3 times)             │
│   → Increase schoolClusterWeight: 5 → 20            │
│                                                      │
│ ✓ Two-way friends are critical (1 time)              │
│   → twoWayTeammateWeight already at 100 (no change) │
│                                                      │
│ [Apply Suggested Weights] [Reset to Defaults]        │
└─────────────────────────────────────────────────────┘
```

### Data Model

```typescript
interface DecisionCorrection {
  id: string;
  playerId: string;
  playerName: string;

  // What happened
  actualTeamId: string;
  actualReason: AssignmentReason;

  // What should have happened
  correctTeamId: string;
  correctReason: 'coach-request' | 'teammate-request' | 'school' | 'balance' | 'other';

  // Context at decision time
  context: {
    playerRequests: {
      coachRequest: string | null;
      teammateRequests: string[];
      school: string | null;
    };
    teamScores: Record<string, number>;
    teamCapacities: Record<string, number>;
    meanScore: number;
    balanceTolerance: number;
  };

  // Admin's reasoning
  reasoning: string;

  createdAt: string;
}

interface LearnedPreferences {
  // Derived from corrections
  suggestedWeights: {
    coachRequestWeight: number;
    oneWayTeammateWeight: number;
    twoWayTeammateWeight: number;
    schoolClusterWeight: number;
    balanceTolerance: number;
  };

  // Supporting evidence
  corrections: DecisionCorrection[];

  // Patterns detected
  patterns: Array<{
    description: string;
    frequency: number;
    suggestedAction: string;
  }>;
}
```

### Implementation Phases

#### Phase 1: Decision Inspector (View Only) ✅ IMPLEMENTED
- Add "Why this team?" breakdown to player details in results
- Show all factors that influenced the decision
- Show alternatives considered and why rejected

**Implementation Details:**
- Enhanced `PlayerDetailDrawer.tsx` with new "Algorithm Decision" section
- Shows assignment reason with descriptive labels and icons (e.g., "Coach's Kid", "Two-Way Friend Request", "Team Balance")
- Shows round and pick number for when player was assigned
- For balance picks: explains why requests couldn't be honored
- For request-based picks: confirms what request was satisfied
- New "Team-by-Team Analysis" collapsible section shows:
  - Current team highlighted with request count
  - All other teams with how many requests would be honored there
  - Highlights teams where more requests could have been honored
  - Shows which friends/coach are on each team

**UX Improvements (January 2025):**
- Teammate request cards show requested player's score
- Teammate request cards show if other friends are on the same team
- Suggested moves go directly to confirm mode (skip team selection step)
- Confirm button in sticky footer (always visible above fold)
- Happiness scores recalculate on every manual move/swap

**Team Score Display:**
- Team headers show Total, Top 8, and Avg scores
- Scores calculated from actual roster data (not stale cache)
- Delta % from mean shown for balance comparison

#### Phase 2: Manual Override with Persistence
- Allow moving players post-algorithm
- Persist these moves to database (already implemented)
- Track that move was a "correction" vs "algorithm result"

#### Phase 3: Correction Capture
- When admin moves a player, prompt for reason
- Store correction data
- Build correction history

#### Phase 4: Pattern Analysis
- Analyze corrections to find patterns
- Suggest weight adjustments
- Allow applying learned weights

#### Phase 5: Pre-Algorithm Training (Advanced)
- Before running algorithm, load learned preferences
- Apply adjusted weights automatically
- Show "confidence" based on similar past scenarios

### Key Insight: The 90% Problem

The algorithm works well when:
- One clear signal (only coach request, or only teammate request)
- Balance isn't a constraint
- No conflicts between request types

The algorithm struggles when:
- Coach request conflicts with friend request
- Balance tolerance forces unexpected placement
- Multiple weak signals vs one strong signal
- Player has requests but none satisfiable

### Specific Fixes Based on Analysis

1. **Coach Request Priority**: Currently weighted same as one-way teammate (50).
   Should coach requests be higher priority in your league?

2. **Balance Tolerance**: 10% default may be too strict.
   Your screenshot shows "+2.5%" which is well within tolerance -
   but did the algorithm reject a better placement due to balance?

3. **No-Request Players**: Currently placed purely by balance.
   Should school clustering be weighted higher for these players?

4. **Deferral Logic**: Players with unsatisfiable requests can be deferred.
   Is this causing players to end up on unexpected teams?
