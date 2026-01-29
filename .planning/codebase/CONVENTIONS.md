# Coding Conventions

**Analysis Date:** 2026-01-29

## Naming Patterns

**Files:**
- React components: PascalCase (e.g., `DraftBoard.tsx`, `PlayerReviewTable.tsx`)
- Utility functions: camelCase (e.g., `draftLogic.ts`, `scoreCalculation.ts`)
- Type definitions: camelCase (e.g., `evaluation.ts`, stored in `types/` directory)
- Context files: Use `*Context.tsx` suffix (e.g., `AuthContext.tsx`, `ViewContext.tsx`)
- Hook files: Use `use*` prefix (e.g., `useDraft.ts`, `useDivisions.ts`)
- Components in subdirectories: Component subdirectories organize by feature (e.g., `components/draft/`, `components/evaluation/`, `components/profile/`)

**Functions:**
- camelCase for all functions (example from `api/client.ts`):
  ```typescript
  function getCSRFToken(): string | null { ... }
  function getDefaultOptions(method: string = 'GET'): RequestInit { ... }
  export function setSessionExpiredCallback(callback: (() => void) | null): void { ... }
  ```
- Hook functions always use `use` prefix and PascalCase component convention:
  ```typescript
  export const useDraft = (_divisionId?: string) => { ... }
  export const useAuth = () => { ... }
  export const usePlayerScoring = (initialPlayers: Player[], teamCount: number = 8) => { ... }
  ```

**Variables:**
- camelCase for all local and exported variables:
  ```typescript
  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
  const DEFAULT_TIMEOUT_MS = 30000;
  const draftStateId = useRef<string | null>(null);
  const operationInProgress = useRef(false);
  ```
- UPPERCASE_SNAKE_CASE for constants (especially configuration):
  ```typescript
  const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds
  ```
- Use descriptive names for state refs and flags (e.g., `sessionExpiredHandled`, `operationInProgress`)

**Types:**
- PascalCase for interfaces and types:
  ```typescript
  interface AuthContextType extends AuthState { ... }
  interface DraftBoardProps { ... }
  export interface MandatoryPickResult { ... }
  ```
- Use descriptive suffix for interface purposes: `Props` suffix for component props, `Type` suffix for context types

## Code Style

**Formatting:**
- ESLint enforced with `--max-warnings 0` (zero-warnings policy)
- TypeScript strict mode enabled (`strict: true`)
- Build command includes type checking: `tsc && vite build`
- No explicit formatter config detected; implicit conventions from code analysis

**Linting:**
- Framework: ESLint v8.55.0
- Plugins: `@typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`
- Strict rules enabled in `tsconfig.json`:
  - `noUnusedLocals: true`
  - `noUnusedParameters: true`
  - `noFallthroughCasesInSwitch: true`
- Run: `npm run lint` (must pass with zero warnings to build)

**Code Examples from Codebase:**
```typescript
// Spacing, multiline patterns (from DraftBoard.tsx)
const { round: nextRound, pickInRound: nextPickInRound } = getNextPick(
  draftState.currentRound,
  draftState.currentPickInRound,
  draftState.teams.length
);

// Object destructuring in parameters (api/client.ts)
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> { ... }
```

## Import Organization

**Order:**
1. External library imports (`react`, `react-dom`, third-party packages)
2. Type imports (`import type { ... } from`)
3. Relative imports from `../` (parent directories, e.g., `../types`, `../api`)
4. Same-level imports from `./` (sibling components/utils)

**Examples from codebase:**
```typescript
// From DraftBoard.tsx
import { useState, useEffect, useRef } from 'react';
import { Undo, ChevronLeft, AlertCircle, ChevronRight, X, Users, Grid3X3, Eye, EyeOff } from 'lucide-react';
import { DraftState, Team, DivisionAgeRange, Player } from '../types';
import { getNextPick, calculateDraftOrder } from '../utils/draftOrder';
import { useViewMode } from '../contexts/ViewContext';
import { getTeamDisplayName } from '../utils/teamUtils';
import { DraftBoardPlayerGrid } from './draft/DraftBoardPlayerGrid';
import { DraftBoardRosterView } from './draft/DraftBoardRosterView';

// From api/client.ts
import type {
  Division,
  DivisionSummary,
  DivisionPreset,
  DivisionAgeRange,
  Player,
  Team,
  // ... more imports
} from '../types';
```

**Path Aliases:**
- No explicit path aliases configured; uses relative paths throughout
- All imports use relative paths (`../` for parent, `./` for siblings)

## Error Handling

**Patterns:**
1. Custom `ApiError` class for API-specific errors (from `api/client.ts`):
   ```typescript
   // Error detection
   if (error instanceof ApiError && error.status === 401) {
     return 'Your session has expired. Please log in again to continue.';
   }

   // Error details extraction
   if (err.details?.error && typeof err.details.error === 'string') {
     return err.details.error;
   }
   if (err.details?.detail && typeof err.details.detail === 'string') {
     return err.details.detail;
   }
   ```

2. Session expiry tracking with refs (from `contexts/AuthContext.tsx`):
   ```typescript
   const sessionExpiredHandled = useRef(false); // Track to avoid loops (Issue #4)
   sessionExpiredHandled.current = false; // Reset on new login attempt (Issue #21)
   ```

3. Try-catch with functional state updates:
   ```typescript
   try {
     const user = await api.login(credentials);
     setState({
       user,
       isAuthenticated: true,
       isLoading: false,
     });
   } catch (error) {
     setState(prev => ({ ...prev, isLoading: false }));
     // Handle specific error types
     if (error instanceof Error && error.name === 'ApiError') {
       const apiError = error as ApiError;
       throw new Error(apiError.details?.error as string || 'Login failed');
     }
     throw error;
   }
   ```

4. Loading state pattern during async operations:
   ```typescript
   const [isLoading, setIsLoading] = useState(false);
   const [error, setError] = useState<string | null>(null);

   try {
     setIsLoading(true);
     // async operation
   } catch (err) {
     setError(getErrorMessage(err, 'Operation failed'));
   } finally {
     setIsLoading(false);
   }
   ```

## Logging

**Framework:** Native browser `console` object (console.log, console.error)

**Patterns:**
- E2E tests use `console.log()` with descriptive prefixes:
  ```typescript
  console.log('[STEP 1] Logging in as admin');
  console.log('[STEP 2] Selecting Alpha AAA division');
  console.log('[AUTH] Logging in as admin for alpha: admin@test-alpha.test');
  console.log('[DRAFT] Starting draft with format: snake');
  console.log('[ERROR] Some error occurred');
  ```
- Use bracketed prefixes for categorization: `[STEP]`, `[AUTH]`, `[NAV]`, `[DRAFT]`, `[SUCCESS]`, `[ERROR]`
- No logging detected in production code (React components, utils)
- All logging is test-focused (E2E tests only)

## Comments

**When to Comment:**
- API endpoints and major functions require JSDoc-style documentation
- Complex algorithms and business logic require inline comments explaining the "why"
- Issue references are included as comments (e.g., `Issue #4`, `Issue #20`, `Issue #23`)

**JSDoc/TSDoc:**
- Standard JSDoc blocks for exported functions:
  ```typescript
  /**
   * Get the effective round for a player (locked round takes precedence over projected)
   */
  function getEffectiveRound(player: Player): number {
    return player.lockedToRound ?? player.projectedRound ?? 999;
  }
  ```

- Multi-line comments for complex business logic (from `draftLogic.ts`):
  ```typescript
  /**
   * Get mandatory pick for a team in a given round.
   * This is the SINGLE SOURCE OF TRUTH for mandatory pick logic.
   * Used by both the real draft (useDraft.ts) and simulation (simulation.ts).
   *
   * Logic:
   * 1. First check if there's a mandatory pick due THIS round (projected/locked round matches)
   * 2. If not, check if we need to force a mandatory pick early because there aren't
   *    enough remaining picks to draft all required players at their projected rounds
   */
  ```

- Property-level comments explaining intent:
  ```typescript
  // Store draft state ID (needed for API draft operations)
  const draftStateId = useRef<string | null>(null);

  // Track the current division ID
  const currentDivisionId = useRef<string | undefined>(_divisionId);

  // Synchronous lock to prevent concurrent operations (prevents race conditions from rapid clicks)
  const operationInProgress = useRef(false);
  ```

## Function Design

**Size:** No hard limit observed, but average utility functions are 10-30 lines. Larger functions (100+ lines) are in:
- `src/components/DraftBoard.tsx` (main orchestration component, 392 lines)
- `src/App.tsx` (main app orchestration, 1168 lines)
- Parser utilities (CSV/Excel, 400-750 lines each)

**Parameters:**
- Functions accept typed parameters (strict typing enforced)
- Optional parameters marked with `?` and given default values where appropriate:
  ```typescript
  export const useDraft = (_divisionId?: string) => { ... }
  function fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeoutMs: number = DEFAULT_TIMEOUT_MS // Default provided
  ): Promise<Response> { ... }
  ```
- Object destructuring used for prop drilling (React components):
  ```typescript
  export const DraftBoard = ({
    draftState,
    onDraftPlayer,
    onSkipPick,
    onUndo,
    // ... more props
  }: DraftBoardProps) => { ... }
  ```

**Return Values:**
- Strict return type annotations on all functions
- Null/undefined used explicitly for optional values:
  ```typescript
  function getCSRFToken(): string | null { ... }
  export function getMandatoryPick(...): MandatoryPickResult | null { ... }
  ```
- Complex returns wrapped in typed interfaces:
  ```typescript
  export interface CalculatedScores {
    fieldingSubtotal: number;
    hittingSubtotal: number;
    pitchingSubtotal: number;
    subjectiveTotal: number;
    objectiveTotal: number;
    totalScore: number;
  }
  ```

## Module Design

**Exports:**
- Named exports preferred for utility functions:
  ```typescript
  export function getMandatoryPick(...): MandatoryPickResult | null { ... }
  export function validateWeights(weights: ScoringWeights): { isValid: boolean; total: number } { ... }
  export const useDraft = (...) => { ... }
  ```
- Type and interface exports alongside implementations:
  ```typescript
  export interface MandatoryPickResult {
    player: Player;
    reason: 'coach-kid' | 'sibling';
    siblingName?: string;
  }
  export function getMandatoryPick(...): MandatoryPickResult | null { ... }
  ```

**Barrel Files:**
- `src/types/index.ts` serves as barrel export for all type definitions (586 lines)
- Component subdirectories do NOT use barrel files (direct imports used)
- API client (`api/client.ts`) does NOT use barrel pattern; all logic in single file

**Patterns for Code Organization:**
- Utility functions grouped by domain (`utils/draftLogic.ts`, `utils/scoreCalculation.ts`, etc.)
- Related types co-located in `types/` directory
- Component hierarchy mirrors feature structure (`components/evaluation/`, `components/draft/`, `components/profile/`)
- API transformations centralized in `api/client.ts` with helper functions

---

*Convention analysis: 2026-01-29*
