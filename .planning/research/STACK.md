# Stack Research: Evaluation System Additions

**Domain:** Mobile-friendly evaluation/scoring system within an existing Django + React app
**Researched:** 2026-01-29
**Confidence:** MEDIUM (training data through May 2025; WebSearch/WebFetch unavailable for version verification)

> **Important:** Version numbers below reflect my training data (cut off May 2025). Before installing, run `npm info <package> version` to confirm the latest release. I was unable to verify current versions via WebSearch or npm during this research session.

## Existing Stack (Already in Place)

These are already installed and should NOT be re-added. Listed for context:

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.2.0 | UI framework |
| TypeScript | 5.2.2 | Type safety |
| Vite | 5.0.8 | Build tool + dev server |
| Tailwind CSS | 3.3.6 | Utility-first styling |
| Django | 5.2.7 | Backend framework |
| PostgreSQL | 16 | Database |
| PapaParse | 5.4.1 | CSV parsing |
| xlsx | 0.18.5 | Excel parsing |
| lucide-react | 0.294.0 | Icons |
| Playwright | 1.57.0 | E2E testing |

## Recommended Additions

### Category 1: Mobile Form Management

The evaluation system's core UX is volunteers entering scores on phones. This needs a form library that handles touch-friendly inputs, validation, and performance on low-end devices.

| Library | Version (approx.) | Purpose | Why Recommended | Confidence |
|---------|-------------------|---------|-----------------|------------|
| react-hook-form | ^7.51+ | Form state, validation, submission | Uncontrolled-component approach = fewer re-renders = faster on phones. The existing app has NO form library (all state is managed via raw useState). Adding RHF specifically for evaluation forms gives us field-level validation, dirty tracking, and submission handling without retrofitting the rest of the app. | MEDIUM |
| @hookform/resolvers | ^3.9+ | Connect Zod schemas to RHF | Bridge between RHF and Zod validation. Enables schema-first form validation. | MEDIUM |
| zod | ^3.23+ | Schema validation (shared frontend/backend) | TypeScript-native schema validation. Schemas can define evaluation template structure AND validate form inputs. Zod schemas can be shared between template config and scoring forms. Alternative (yup) has weaker TS inference. | MEDIUM |

**Why react-hook-form over alternatives:**
- **vs Formik:** RHF uses uncontrolled components by default, meaning each keystroke/touch does NOT trigger a React re-render of the entire form. For a scoring form with 10-20 numeric fields on a phone, this performance difference is material. Formik re-renders the full form on every field change.
- **vs raw useState (current approach):** The existing app manages form state via useState + useCallback everywhere. This works for the draft board (few inputs) but will not scale to multi-field scoring forms with validation, error display, and submission states. RHF provides this without pulling in a heavyweight framework.
- **vs no form library:** A station scoring form needs: field-level validation (score within range), dirty tracking (warn before navigating away), submission state management (prevent double-submit on slow connection), and accessible error messages. Building all this from scratch is unnecessary.

### Category 2: Data Fetching and Server State

The existing app uses raw `fetch` via `src/api/client.ts` with manual cache management. The evaluation system adds new data flows: loading templates, submitting scores with optimistic updates, polling for tryout progress. A server-state library prevents reinventing caching, retry, and staleness logic.

| Library | Version (approx.) | Purpose | Why Recommended | Confidence |
|---------|-------------------|---------|-----------------|------------|
| @tanstack/react-query | ^5.56+ | Server state management, caching, mutations | Provides automatic caching, background refetch, optimistic updates for score submissions, and retry logic. The evaluation flow has multiple data dependencies (template, player list, group assignments, existing scores) that benefit from query caching. Evaluation progress polling becomes trivial with `refetchInterval`. | MEDIUM |

**Why TanStack Query over alternatives:**
- **vs raw fetch (current):** The existing `api` client is fine for request-response flows (load division, save players). But evaluation day involves: loading templates, fetching player groups, submitting scores rapidly, showing other stations' progress, and handling intermittent connectivity. TanStack Query's automatic retry, deduplication, and stale-while-revalidate pattern handles all of this.
- **vs SWR:** TanStack Query has better mutation support (optimistic updates, rollback on failure), which matters for score submission. SWR focuses more on read caching.
- **vs Redux/RTK Query:** Would require adopting Redux for the entire app. Overkill when TanStack Query handles server state independently alongside existing React hooks.

**Integration note:** TanStack Query wraps around the existing `api` client -- it does NOT replace it. The `api.client.ts` methods become the `queryFn`/`mutationFn` functions inside `useQuery`/`useMutation` hooks. Existing code can be migrated incrementally.

### Category 3: Offline/PWA Capability (Conditional)

Tryout day scoring on phones may face intermittent connectivity (outdoor fields, poor cell service). The question is whether to add offline support now or treat it as a future enhancement.

| Library | Version (approx.) | Purpose | Why Recommended | Confidence |
|---------|-------------------|---------|-----------------|------------|
| workbox (via vite-plugin-pwa) | ^7.1+ | Service worker generation, offline caching | If offline scoring is required, Vite's PWA plugin generates service workers automatically. Caches static assets and can queue API requests for later replay. | LOW |
| vite-plugin-pwa | ^0.20+ | PWA integration for Vite | Adds manifest, service worker, and installability to the Vite build. Zero-config for basic offline shell. | LOW |
| idb-keyval | ^6.2+ | Simple IndexedDB wrapper | If implementing offline queue: stores pending score submissions in IndexedDB until connectivity resumes. Much simpler than raw IndexedDB API. | LOW |

**Recommendation: DEFER offline to a later phase.** Rationale:
1. The PROJECT.md explicitly requires "bulk entry fallback" for tryout scoring -- this means paper-then-enter is the established backup, not offline-first mobile.
2. PWA + offline queue adds significant complexity (conflict resolution, sync state UI, data versioning).
3. Build the mobile scoring flow first with standard online-only operation. If field testing reveals connectivity is a real problem, add offline in a subsequent phase.
4. TanStack Query's retry + mutation queue provides basic resilience (retries failed submissions) without full offline support.

### Category 4: Mobile Touch UX

Station scoring on phones needs touch-optimized number input. The current app is desktop-first.

| Library | Version (approx.) | Purpose | Why Recommended | Confidence |
|---------|-------------------|---------|-----------------|------------|
| (none -- use native HTML + Tailwind) | n/a | Touch-friendly number inputs | Use `<input type="number" inputMode="numeric">` with large touch targets via Tailwind (`min-h-12 text-lg`). Stepper buttons (+ / -) built with Tailwind. No library needed -- native inputs with `inputMode="numeric"` trigger the numeric keyboard on iOS/Android. Custom stepper buttons give precise control. | HIGH |

**Why no touch/mobile component library:**
- **vs React Native / Capacitor:** The project constraint says "phone browsers, not a native app." A responsive web app with touch-optimized inputs is the right approach.
- **vs Headless UI / Radix / shadcn:** The existing app has no component library -- everything is custom Tailwind. Adding a component library for the evaluation system alone would create inconsistency. Build touch components in Tailwind to match the existing design language.
- **vs react-mobile-number-input or similar:** Niche libraries with small user bases. Native `<input type="number" inputMode="numeric">` with custom styling is more reliable and has zero dependency cost.

**Key mobile UX patterns (no library needed):**
- `inputMode="numeric"` on score fields -- triggers numeric keyboard on mobile
- Large touch targets: `min-h-12 min-w-12` (48px minimum per WCAG)
- Stepper buttons (plus/minus) for quick score adjustment
- Swipe or tab to next player (CSS scroll-snap + JS navigation)
- Sticky header showing current player bib/name while scrolling through fields
- Auto-advance to next player after submitting scores

### Category 5: Real-Time/Live Updates (Evaluation Day Progress)

During tryout day, admins want to see which groups have completed which stations. This needs some form of live data.

| Approach | Implementation | Why Recommended | Confidence |
|----------|---------------|-----------------|------------|
| Polling via TanStack Query | `refetchInterval: 10000` on progress queries | Simplest approach. Django does not have built-in WebSocket support (would require Django Channels + Redis). Polling every 10 seconds is sufficient for tryout progress monitoring -- this is not a chat app or stock ticker. TanStack Query makes polling trivial (one config option). | HIGH |

**Why polling over WebSockets/SSE:**
- **vs Django Channels (WebSockets):** Requires adding `channels`, `daphne` or `uvicorn`, and Redis as a channel layer. This is a major infrastructure change for a feature that only needs "refresh progress every 10 seconds." Overkill.
- **vs Server-Sent Events (SSE):** Django can do SSE with `StreamingHttpResponse`, but Gunicorn (the production WSGI server) does not handle long-lived connections well. Would need to switch to an ASGI server. Again, overkill for this use case.
- **vs no live updates:** Admins would need to manually refresh to see progress. A 10-second auto-refresh via TanStack Query is trivially easy and provides good enough UX.

**If real-time becomes critical later:** The path forward would be Django Channels + WebSockets. But that is a separate infrastructure decision, not needed for evaluation scoring.

### Category 6: Backend Libraries (Python/Django)

| Library | Version (approx.) | Purpose | Why Recommended | Confidence |
|---------|-------------------|---------|-----------------|------------|
| (none new required) | n/a | Core evaluation models + API | Django's built-in ORM, JSON fields, and function-based views are sufficient. The existing pattern (models.py + views/ + services/ + transformers.py) handles the evaluation system's needs without new Python dependencies. | HIGH |

**Why no new Django libraries:**
- **Django REST Framework:** The existing app deliberately does NOT use DRF (uses plain function-based views with `@require_http_methods`). Adding DRF for evaluation APIs would create two API patterns in the same codebase. Keep using the established pattern.
- **django-filter:** Filtering can be done with simple ORM querysets in views. Not enough filter complexity to justify a dependency.
- **django-channels:** Not needed (see polling rationale above).
- **celery:** No async tasks needed. Score computation is fast (arithmetic). Composite blending is a simple weighted average, not a background job.

**PostgreSQL features to leverage (already available):**
- `JSONField` for evaluation template definitions (station configs, scoring scales)
- `DecimalField` for precise score storage (already used in Player model)
- Composite indexes for player + season + league lookups
- `django.db.models.functions` for server-side score aggregation if needed

### Category 7: Testing

| Library | Status | Purpose | Notes |
|---------|--------|---------|-------|
| Playwright | Already installed (^1.57.0) | E2E testing | Add mobile viewport tests for station scoring. Use `devices['iPhone 13']` in Playwright config. | HIGH |
| (no unit test lib currently) | Not installed | Unit testing evaluation logic | **Recommend adding** `vitest` for unit testing score calculation, template validation, and composite blending functions. The existing codebase has no unit tests -- only E2E. Evaluation logic (weighted blending, normalization, template validation) is complex enough to warrant unit tests. | MEDIUM |

| Library | Version (approx.) | Purpose | Why Recommended | Confidence |
|---------|-------------------|---------|-----------------|------------|
| vitest | ^2.0+ | Unit test runner | Native Vite integration (zero extra config), TypeScript-first, Jest-compatible API. Testing evaluation pure functions (score calculation, template validation, blending) is critical and E2E tests are too slow for this. | MEDIUM |
| @testing-library/react | ^16.0+ | React component testing | Test evaluation form components (score input, template config UI) in isolation. Standard React testing library. | MEDIUM |
| @testing-library/jest-dom | ^6.4+ | DOM assertion matchers | Extended matchers (toBeInTheDocument, toHaveValue) for component tests. | MEDIUM |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Django REST Framework | Existing app uses plain function-based views. Mixing DRF serializers with the existing transformer pattern creates confusion. Would require refactoring existing code for consistency. | Continue using function-based views + `transformers.py` pattern |
| Formik | Re-renders entire form on every field change. On mobile with 10+ score fields, this causes visible lag. Weaker TypeScript support than RHF + Zod. | react-hook-form + zod |
| Redux / RTK Query | Would require adopting Redux for the whole app. The existing app uses React hooks for state. Adding Redux for one feature creates two state management paradigms. | TanStack Query for server state; continue using hooks for local state |
| Django Channels + WebSockets | Requires Redis, ASGI server swap (daphne/uvicorn instead of gunicorn), and significant infrastructure changes. Only benefit: sub-second updates for tryout progress, which is not needed. | Polling via TanStack Query (refetchInterval) |
| Native app (React Native / Capacitor) | Project constraint explicitly requires "phone browsers, not a native app." Would require maintaining two codebases. | Responsive web app with touch-optimized inputs |
| shadcn/ui or Radix UI | Existing app has zero component library -- all custom Tailwind. Adding a component library for evaluation forms would create inconsistent UI. Would need to migrate existing components for consistency. | Custom Tailwind components matching existing design language |
| Service Worker / PWA (in Phase 1) | Adds conflict resolution, sync UI, and offline data versioning complexity. Paper-then-bulk-entry is the established fallback. Build online-first, add offline later if field testing shows need. | Online-only with TanStack Query retry for resilience |
| Yup (validation) | Weaker TypeScript type inference than Zod. Zod infers TypeScript types from schemas; Yup requires separate type definitions. In an evaluation template system with dynamic fields, Zod's inference is critical. | Zod |
| Socket.io | JavaScript-focused real-time library. Requires socket.io backend (not Django-native). If WebSockets are ever needed, Django Channels is the standard Django approach. | Polling, or Django Channels if real-time is later required |

## Installation

```bash
# Frontend - Core additions
npm install react-hook-form @hookform/resolvers zod @tanstack/react-query

# Frontend - Testing (dev dependencies)
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

```bash
# Backend - No new pip packages needed
# The existing Django + PostgreSQL stack handles all evaluation data requirements
```

**Optional (defer to later phase):**
```bash
# PWA / Offline support (only if field testing reveals connectivity issues)
npm install -D vite-plugin-pwa
npm install idb-keyval
```

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| react-hook-form ^7.x | React 18.x | Stable, widely adopted. Uses React's useRef/useCallback internally. |
| @tanstack/react-query ^5.x | React 18.x | v5 requires React 18+. Uses React's Suspense-compatible patterns. |
| zod ^3.x | TypeScript 5.x | Pure TypeScript, no React dependency. Works on both frontend and backend (if using Node). |
| vitest ^2.x | Vite 5.x | Uses Vite's transform pipeline. Zero-config with existing vite.config.ts. |
| @hookform/resolvers ^3.x | react-hook-form ^7.x, zod ^3.x | Bridge package -- versions must match RHF and Zod majors. |

## Stack Patterns by Variant

**If building Phase 1 (Template Config + Basic Scoring):**
- Use: react-hook-form + zod + TanStack Query
- Skip: vitest (add in Phase 2), PWA (defer), mobile polish (iterative)
- Because: Get the data model and API working first, then polish

**If building with offline requirement from day one:**
- Add: vite-plugin-pwa + workbox + idb-keyval
- Also add: conflict resolution strategy (last-write-wins or queue-based)
- Because: Offline changes the architecture fundamentally (local-first vs server-first)

**If coach ratings are built before tryout scoring:**
- TanStack Query is still valuable (caching player lists, roster data)
- react-hook-form is still valuable (rating forms with 6-8 categories)
- Mobile UX is less critical (coaches likely use laptop/tablet for ratings)
- Because: Coach ratings are a simpler form (one player at a time, fewer fields)

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|------------------------|
| react-hook-form | Formik | If team already knows Formik well and performance on mobile is acceptable after testing |
| zod | yup | If project already uses yup elsewhere (it does not) |
| @tanstack/react-query | SWR | If only doing read caching (no mutations/optimistic updates needed) |
| Polling (TanStack Query) | Django Channels + WebSocket | If sub-second live scoring feeds become a requirement (live leaderboard during tryouts) |
| vitest | jest | If project used Create React App or non-Vite bundler. Vitest integrates natively with Vite. |
| Custom Tailwind components | shadcn/ui | If starting a new project from scratch where a component library makes sense from day one |
| Online-first | Offline-first (PWA) | If field testing shows >5% of score submissions fail due to connectivity |

## Sources

- Existing codebase analysis: `package.json`, `requirements.txt`, `src/api/client.ts`, `src/utils/scoreCalculation.ts`, `server/draft/models.py`
- Existing planning docs: `.planning/codebase/STACK.md`, `.planning/codebase/ARCHITECTURE.md`, `.planning/PROJECT.md`
- Training data knowledge (May 2025 cutoff) for library capabilities and ecosystem positioning -- **versions should be verified before installation**
- react-hook-form official docs (https://react-hook-form.com/) -- MEDIUM confidence on exact latest version
- TanStack Query official docs (https://tanstack.com/query/latest) -- MEDIUM confidence on exact latest version
- Zod official docs (https://zod.dev/) -- MEDIUM confidence on exact latest version
- Vitest official docs (https://vitest.dev/) -- MEDIUM confidence on exact latest version

---
*Stack research for: Youth sports evaluation system additions to existing Little League Draft app*
*Researched: 2026-01-29*
*Confidence caveat: WebSearch and WebFetch were unavailable during research. All version numbers are approximate based on May 2025 training data. Run `npm info <package> version` to verify before installing.*
