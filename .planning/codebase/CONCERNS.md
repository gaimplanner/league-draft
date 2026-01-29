# Codebase Concerns

**Analysis Date:** 2026-01-29

## Tech Debt

**Email Delivery in Production:**
- Issue: Email backend is hardcoded to console output
- Files: `server/league_draft/settings.py:132-134`
- Impact: Password reset emails, team invitations, and any email notifications will not be sent in production. Users cannot reset passwords or receive invitations.
- Fix approach: Replace `EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"` with a real SMTP provider (SendGrid, SES, or similar) in production. Pattern already exists in gaimplan_b2b project.

**Complex Team Builder Parser (2193 lines):**
- Issue: Single file handles registration parsing, name matching, request resolution, clustering, and confirmation
- Files: `src/utils/teamBuilderParser.ts`
- Impact: Difficult to test individual functions, high cognitive load, changes to one feature risk breaking another
- Fix approach: Split into modules: parser.ts (registration data parsing), matching.ts (name matching), resolution.ts (request resolution), clustering.ts (cluster building)

**Complex Team Builder Flow Component (1937 lines):**
- Issue: Single component orchestrates entire multi-step Team Builder flow with request confirmation, name resolution, algorithm execution
- Files: `src/components/TeamBuilderFlow.tsx`
- Impact: Hard to test individual steps, state management is fragmented, difficult to add new features
- Fix approach: Extract step components (NameMatchingStep, RequestConfirmationStep, AlgorithmExecutionStep) and use a step-based reducer pattern

**Monolithic Team Builder Algorithm (1521 lines):**
- Issue: `runTeamBuilderAlgorithm` implements requests-first and balance-first modes in single function with many conditional branches
- Files: `src/utils/teamBuilderAlgorithm.ts`
- Impact: Hard to test individual assignment strategies, difficult to add new assignment rules
- Fix approach: Create strategy pattern with separate classes for each algorithm mode, shared interface for assignment logic

**API Client Data Transformations (1225 lines):**
- Issue: Large API client with extensive snake_case/camelCase transformations, issue tracking in comments
- Files: `src/api/client.ts`
- Impact: Hard to trace data flow, issue fixes scattered throughout, no centralized approach to type mismatches
- Fix approach: Extract transformers into separate module (`transformers.ts`), create builder pattern for API responses to handle optional/nullable fields consistently

## Known Bugs

**Issue #3 - DecimalField Serialization:**
- Symptoms: Player scores (field_score, total_score, etc.) sometimes come from API as strings instead of numbers
- Files: `src/api/client.ts:108-119` (safeParseNumber functions implemented but used throughout client)
- Trigger: Django DecimalField can serialize to either number or string depending on context
- Workaround: All numeric field reads use safeParseNumber() which handles both string and number types
- Status: Mitigated by defensive parsing; root cause in Django DRF is not addressed

**Issue #6 - Phase Update Race Conditions:**
- Symptoms: Rapid phase changes (e.g., upload → review → config) may overwrite previous saves to API
- Files: `src/App.tsx:178-179` (isUpdatingPhase.current ref), `src/hooks/useDraft.ts`
- Trigger: User rapidly clicking "Next" on phase transitions without waiting for save to complete
- Workaround: isUpdatingPhase.current flag prevents concurrent updates, but state can still become inconsistent
- Status: Partially fixed; needs more robust state machine for phase transitions

**Issue #8 - Null vs Undefined Handling:**
- Symptoms: API returns null for optional fields (e.g., coachTeamId), frontend expects undefined
- Files: `src/api/client.ts:142, 173-177` (multiple coalescing operations)
- Trigger: Type checking code uses `field !== undefined` to check for presence, but API sends null
- Workaround: Transformers convert all nulls to undefined before returning from API
- Status: Works but adds complexity; should standardize on one approach (prefer undefined for frontend optionals)

**Issue #15 - Timestamp Parsing Without Validation:**
- Symptoms: If API returns invalid timestamp, date parsing fails silently
- Files: `src/api/client.ts:271` (new Date() without error handling)
- Trigger: Malformed timestamp from API or network corruption
- Workaround: None currently; will result in undefined timestamp
- Status: Should validate timestamp format before parsing or handle exceptions

**Issue #18 - Coach Kids Array Validation:**
- Symptoms: If API returns malformed coach_kids array, will silently filter invalid entries
- Files: `src/api/client.ts:238-241` (filter validates id field)
- Trigger: API returns coach_kids with missing id field
- Workaround: Filter removes invalid entries but doesn't warn
- Status: Works but silent data loss; should log warning if filtering occurs

**Issue #21 - Session Expiry Loop Prevention:**
- Symptoms: If session expires while viewing public draft, could trigger repeated logout attempts
- Files: `src/contexts/AuthContext.tsx:39-40, 61-62, 119-120` (sessionExpiredHandled flag)
- Trigger: Session expires during activity
- Workaround: sessionExpiredHandled ref prevents re-triggering, but reset is fragile
- Status: Implemented but relies on manual flag management; could be improved with AbortController

**Issue #22 - Cross-Tab Logout Sync:**
- Symptoms: If user logs out in one tab while another tab is active, state may not sync immediately
- Files: `src/contexts/AuthContext.tsx:164-187` (localStorage storage event listener)
- Trigger: User logs out in Tab A while Tab B is making API request
- Workaround: Storage event listener syncs logout across tabs, but timing dependent
- Status: Works for logout but not for other session state changes (e.g., membership changes)

**Issue #23 - Request Timeout Handling:**
- Symptoms: Very large draft or slow network may cause 30-second timeout
- Files: `src/api/client.ts:52-81` (DEFAULT_TIMEOUT_MS = 30000)
- Trigger: Bulk operations (save 200+ players) or slow network
- Workaround: 30-second timeout is reasonable default, but not configurable
- Status: Implemented; could allow per-request timeout override for large operations

**Issue #27 - Data Shape Mismatch Between API and Frontend:**
- Symptoms: API response includes division_id but frontend expects it in different location
- Files: `src/api/client.ts:141-142, 245-246` (explicit extraction of division_id)
- Trigger: Backend returns nested data structure that doesn't match expected shape
- Workaround: Transformers explicitly extract and remap fields
- Status: Worked around in transformers; indicates schema mismatch should be fixed in backend

## Security Considerations

**Default SECRET_KEY in Development:**
- Risk: If .env is missing, Django uses insecure hardcoded secret key
- Files: `server/league_draft/settings.py:17-20`
- Current mitigation: Fallback secret key only for development (DEBUG mode)
- Recommendations:
  - Make SECRET_KEY required in production (raise error if missing)
  - Rotate all session tokens if default key was ever used in production
  - Add pre-startup check that verifies SECRET_KEY != default

**CSRF_COOKIE_HTTPONLY = False:**
- Risk: JavaScript can access CSRF token, making it vulnerable to XSS attacks
- Files: `server/league_draft/settings.py:121`
- Current mitigation: Token is still validated server-side
- Recommendations:
  - This is intentional (JavaScript needs to read token for non-form requests), but document the XSS risk
  - Ensure no user-controlled data is reflected in responses without proper escaping
  - Consider using double-submit cookie pattern instead

**Email Field Not Updatable (Security Feature, Not a Bug):**
- Risk: Email change would allow account takeover if not carefully managed
- Files: `server/draft/input_validators.py:157-163` (email field excluded from profile updates)
- Current mitigation: Email is read-only after account creation
- Status: Correct approach; no action needed

**Password Reset Token Not Validated:**
- Risk: Password reset links expire but no check for multiple reset requests
- Files: `server/league_draft/settings.py:138` (PASSWORD_RESET_TIMEOUT = 3600)
- Current mitigation: Token expires after 1 hour
- Recommendations:
  - Invalidate all previous tokens when new reset is requested
  - Rate limit password reset requests (already done: 3/hour in throttling)
  - Log password reset attempts

**API Rate Limiting Present:**
- Status: Good - throttling.py implements AuthRateThrottle (5/min for login/register) and PasswordResetRateThrottle (3/hour)
- Recommendation: Document rate limits in API documentation

**Multi-Tenancy Authorization Check:**
- Risk: TenantMiddleware relies on correct request.organization being set
- Files: `server/draft/middleware.py:20-51`
- Current mitigation: Users can only access organizations they're members of
- Recommendations:
  - Add assertions in views that request.organization is not None for tenant-dependent endpoints
  - Consider explicit @require_organization decorator for views that need tenant context

## Performance Bottlenecks

**Sibling Chain Following in Draft Pick:**
- Problem: When sibling locking occurs, traverses sibling chains for every pick
- Files: `server/draft/services_draft.py:123-124` (_lock_sibling_chain method)
- Cause: No caching of sibling relationships; re-queries database for each chain member
- Improvement path: Pre-compute sibling groups at draft start, store as lookup map in DraftState

**Team Score Recalculation on Every Pick:**
- Problem: `team.total_score = sum(p.total_score for p in team.roster.all())` runs on every pick
- Files: `server/draft/services_draft.py:116`
- Cause: Recalculating from entire roster instead of incrementing
- Improvement path: Change to `team.total_score += player.total_score` when picking, subtract when undoing

**Name Matching in Team Builder (O(n²) complexity):**
- Problem: Fuzzy matching against all players for every player's requests
- Files: `src/utils/teamBuilderParser.ts:541-613` (matchRegistrationToEval), `src/utils/teamBuilderParser.ts:1072-1336` (resolveTeammateRequests)
- Cause: Comparing each request string against all possible players
- Current performance: ~500ms for 200 players with 1 request each
- Improvement path: Create inverted index of player names, use trie for prefix matching, cache Levenshtein distances

**Coach Request Resolution (O(n*m) complexity):**
- Problem: Resolve each player's coach request against all coaches
- Files: `src/utils/teamBuilderParser.ts:734-852` (resolveCoachRequest)
- Cause: No pre-indexing of coach names
- Improvement path: Create coach name index with fuzzy match thresholds pre-computed

**Large Excel File Processing:**
- Problem: Reading entire Excel workbook into memory before processing
- Files: `src/utils/excelParser.ts`, `src/components/evaluation/PlayerSummaryTable.tsx`
- Cause: XLSX library loads entire file in memory
- Improvement path: For files > 10MB, implement streaming parser or chunk processing

## Fragile Areas

**Sibling Link Resolution During Draft:**
- Files: `server/draft/services_draft.py:123-124` (_lock_sibling_chain), `src/utils/draftLogic.ts` (lockSiblingToTeam)
- Why fragile: Multiple places manage sibling locking (backend service AND frontend logic), can become desynchronized
- Safe modification: Add integration tests that exercise sibling locking in multiple scenarios (2-way, 3-way, conflicts)
- Test coverage: Moderate - service has unit tests but draft UI doesn't test sibling scenarios thoroughly

**Request Confirmation Status Tracking:**
- Files: `src/utils/teamBuilderParser.ts:1815-1838` (determineRequestStatus), `src/components/teamBuilder/RequestConfirmation.tsx`
- Why fragile: Three different status values (auto-confirmed, needs-review, unresolvable) determined by thresholds; threshold changes break assumptions
- Safe modification: Extract status thresholds to configuration object, add validation tests for boundary cases
- Test coverage: Low - no explicit tests for confirmation status logic

**Team Roster Mutation During Draft:**
- Files: `server/draft/services_draft.py:115-121` (team.roster updates), `src/hooks/useDraft.ts` (frontend roster sync)
- Why fragile: Team roster updated via ORM relationships; if relationship definition changes, pick logic breaks
- Safe modification: Use explicit ForeignKey operations (team.roster.add()) instead of bulk assignment
- Test coverage: High - draft service has test coverage

**Player Draft State Synchronization:**
- Files: `server/draft/services_draft.py:108-113` (player.is_drafted, drafted_by_team, etc.), `src/hooks/useDraft.ts` (frontend Player.isDrafted)
- Why fragile: Multiple fields must be updated together (is_drafted + drafted_by_team + drafted_in_round + drafted_at_pick)
- Safe modification: Create DraftPlayer model or transaction-protected method that updates all fields atomically
- Test coverage: Moderate - database schema ensures fields exist but no single-transaction assertion

**Coach Kid Assignment Detection:**
- Files: `src/utils/coachKidDetection.ts`, `src/components/CoachKidPreviewGrid.tsx`
- Why fragile: Detects coach kids by name matching; name changes or inconsistent capitalization break detection
- Safe modification: Add integration tests with various name formats (partial, nicknames, different cases)
- Test coverage: Low - no unit tests for name matching logic

## Scaling Limits

**Lightweight Draft Board Grid (DraftBoardPlayerGrid):**
- Current capacity: ~500 players before noticeable UI lag
- Limit: React re-renders entire table on each draft pick
- Scaling path: Virtualize table rows (react-window), memoize player rows, use useMemo for sorts/filters

**Roster View Grid (DraftBoardRosterView):**
- Current capacity: ~8 teams × ~13 players = ~100 cells before lag
- Limit: Updates full grid on every pick to reflect current pick marker
- Scaling path: Use CSS-based animations for pick indicator instead of React state updates

**Database Query on Draft Pick:**
- Current capacity: ~1000 picks per draft without timeout
- Limit: Each pick runs multiple queries (select_for_update, team.roster.all(), sibling chain traversal)
- Scaling path: Batch queries, use select_related/prefetch_related, reduce N+1 queries

**Excel Parsing for Large Evaluations:**
- Current capacity: ~500 players before > 1s parse time
- Limit: XLSX library parses all cells, even empty ones
- Scaling path: Stream-based parsing, lazy cell evaluation

**Name Matching Algorithm:**
- Current capacity: ~200-player evaluation × ~200-player registration (40k comparisons)
- Limit: O(n²) Levenshtein distance for fuzzy matching
- Scaling path: Pre-compute common name variations, use trie for exact prefix matching, limit candidates to top 10

## Dependencies at Risk

**xlsx Library:**
- Risk: Library is widely used but has large bundle size (~1MB uncompressed)
- Impact: Slower initial page load, especially on mobile
- Migration plan: Consider papaparse for CSV-only flows, keep xlsx only for Excel evaluation feature

**Levenshtein Distance Calculation:**
- Risk: Implemented inline in teamBuilderParser.ts (lines 486-519), not using optimized library
- Impact: Large fuzzy matching workloads are CPU-intensive
- Migration plan: Evaluate js-levenshtein or fuzzy-string-match libraries for performance

**Chart Libraries (if used):**
- Risk: Age breakdown and team balance visualizations may use heavy charting library
- Impact: Additional bundle size
- Current status: Using native charts (DivisionSelector, DraftComplete) - no concern

**Django ORM for Complex Queries:**
- Risk: Some draft logic requires complex multi-table queries that ORM may optimize poorly
- Impact: Slow draft picking with many players
- Mitigation: Use select_related/prefetch_related; database schema is optimized

## Missing Critical Features

**Password Reset Email Flow:**
- Problem: Password reset endpoint exists but emails use console backend in dev/prod
- Blocks: Users cannot self-recover lost passwords in production
- Impact: Support burden increases, accounts become locked if users forget passwords

**Email Notifications for Invitations:**
- Problem: Team invitations created but emails not sent
- Blocks: Coaches cannot invite players via email
- Impact: Only join links work, email invitations silently fail

**Audit Logging for Draft Changes:**
- Problem: No audit trail of who made which pick, trade, or draft change
- Blocks: Cannot investigate disputes about draft integrity
- Impact: Low trust in recorded results, difficult to resolve conflicts

## Test Coverage Gaps

**Name Matching Logic (Sibling and Teammate Detection):**
- What's not tested: Edge cases in fuzzy matching (typos, nicknames, partial matches, unicode)
- Files: `src/utils/teamBuilderParser.ts:524-535` (nameSimilarity), `src/utils/teamBuilderParser.ts:1071-1336` (resolveTeammateRequests)
- Risk: Incorrect matches silently accepted, causing wrong team assignments
- Priority: High

**Request Confirmation Thresholds:**
- What's not tested: Boundary cases at 0.9 threshold (auto-confirm) and 0.5 threshold (needs-review)
- Files: `src/utils/teamBuilderParser.ts:1819-1838` (determineRequestStatus)
- Risk: Edge cases fall between thresholds unexpectedly
- Priority: Medium

**Sibling Locking Edge Cases:**
- What's not tested: 3+ sibling groups, siblings in conflict (one locked to team, one to different team), sibling chains
- Files: `server/draft/services_draft.py` (_lock_sibling_chain), `src/utils/draftLogic.ts`
- Risk: Sibling rules enforced inconsistently, leading to rule violations
- Priority: High

**Multi-Tenancy Authorization:**
- What's not tested: Users accessing organization they're not members of, master admin isolation
- Files: `server/draft/middleware.py`, all division/team/draft views
- Risk: Data leakage between organizations
- Priority: Critical

**Coach Request Matching:**
- What's not tested: Partial name matches (e.g., "Coach Smith" vs "Smith"), case insensitivity edge cases
- Files: `src/utils/teamBuilderParser.ts:734-833` (resolveCoachRequest)
- Risk: Valid coach requests marked as unresolvable
- Priority: Medium

**API Error Handling:**
- What's not tested: Network errors, malformed responses, timeout scenarios
- Files: `src/api/client.ts`, all API calls in components
- Risk: Silent failures, unclear error messages to users
- Priority: Medium

**Draft State Consistency After Undo:**
- What's not tested: Undo after mandatory pick, undo sibling lock, undo trade with multiple dependencies
- Files: `server/draft/services_draft.py:177-225` (undo_last_pick)
- Risk: Draft state becomes inconsistent after undo
- Priority: High

---

*Concerns audit: 2026-01-29*
