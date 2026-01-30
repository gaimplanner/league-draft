# Testing Patterns

**Analysis Date:** 2026-01-29

## Test Framework

**Runner:**
- Playwright v1.57.0 (E2E testing)
- Config: `playwright.config.ts`

**Assertion Library:**
- Playwright's built-in assertions (`expect` from `@playwright/test`)

**Run Commands:**
```bash
npm run test:e2e              # Run all E2E tests
npm run test:e2e:ui          # Run tests with interactive UI
npm run test:e2e:headed      # Run tests in headed mode (visible browser)
```

## Test File Organization

**Location:**
- E2E tests stored in `e2e/` directory at project root
- Tests are co-located with fixtures and helpers

**Naming:**
- Files: `*.spec.ts` suffix (e.g., `draft-flow.spec.ts`, `admin-draft.spec.ts`)
- Fixtures/helpers: `fixtures.ts` and `*.fixtures.ts` pattern

**Structure:**
```
e2e/
├── fixtures.ts                    # Shared test utilities and credentials
├── draft-flow.spec.ts             # Complete draft workflow tests
├── admin-draft.spec.ts            # Admin-specific draft tests
├── debug-login-cookies.spec.ts    # Debug tests for authentication
├── debug-login-ui.spec.ts         # Debug tests for login UI
├── simple-login.spec.ts           # Smoke test for login
├── debug-divisions-api.spec.ts    # Debug tests for API division endpoints
└── [more debug tests]
```

## Test Structure

**Suite Organization:**
```typescript
// From draft-flow.spec.ts
test.describe('Complete Draft Flow', () => {
  test('admin can complete a full draft workflow', async ({ page }) => {
    // Test implementation
  });

  test('admin can undo a draft pick', async ({ page }) => {
    // Test implementation
  });
});
```

**Patterns:**
- Use `test.describe()` blocks to group related tests by feature
- Each test is a standalone `test()` block with async function
- Playwright provides `page` fixture via context parameters
- Tests follow setup → action → assertion pattern

**Setup Pattern:**
```typescript
test('admin can complete a full draft workflow', async ({ page }) => {
  // Step 1: Login as admin
  console.log('[STEP 1] Logging in as admin');
  await login(page, 'alpha', 'admin');

  // Verify we see the divisions
  await expect(page.getByRole('heading', { name: 'Alpha Majors' })).toBeVisible();
  console.log('[STEP 1] Login successful - divisions visible');
});
```

**Teardown Pattern:**
- No explicit teardown in test code (backend handles test data reset via `seed_e2e --reset`)
- Page context cleaned up automatically by Playwright after each test

## Mocking

**Framework:** No unit test mocking framework detected. Tests are E2E focused.

**Patterns:**
- No mocking at library level (no Jest/Vitest mocks, no MSW)
- All API calls hit real backend (docker compose backend required)
- E2E tests interact with real seeded database state

**What to Mock:**
- No mocking patterns in codebase
- Tests operate against real APIs (integration testing approach)

**What NOT to Mock:**
- API endpoints (tests hit real backend)
- Database operations (tests use real seeded data)

## Fixtures and Factories

**Test Data:**
```typescript
// From fixtures.ts - Test user credentials
export const TEST_USERS = {
  alpha: {
    admin: { email: 'admin@test-alpha.test', password: 'TestPassword123!' },
    coach: { email: 'coach@test-alpha.test', password: 'TestPassword123!' },
    viewer: { email: 'viewer@test-alpha.test', password: 'TestPassword123!' },
  },
  beta: {
    admin: { email: 'admin@test-beta.test', password: 'TestPassword123!' },
    coach: { email: 'coach@test-beta.test', password: 'TestPassword123!' },
    viewer: { email: 'viewer@test-beta.test', password: 'TestPassword123!' },
  },
  gamma: {
    admin: { email: 'admin@test-gamma.test', password: 'TestPassword123!' },
    coach: { email: 'coach@test-gamma.test', password: 'TestPassword123!' },
    viewer: { email: 'viewer@test-gamma.test', password: 'TestPassword123!' },
  },
} as const;
```

**Location:**
- `e2e/fixtures.ts` - Centralized test credentials and helper functions
- Test data seeded via Django management command: `docker compose exec api python manage.py seed_e2e --reset`

**Factories:**
- No explicit factory pattern; fixtures provide test user credentials
- Backend provides pre-seeded divisions, teams, and players via `seed_e2e` command

## Helper Functions

Reusable test helpers defined in `e2e/fixtures.ts`:

```typescript
// Login helper - performs authentication and waits for redirect
export async function login(
  page: Page,
  org: OrgKey,
  role: RoleKey
): Promise<void> {
  const user = TEST_USERS[org][role];
  console.log(`[AUTH] Logging in as ${role} for ${org}: ${user.email}`);

  await page.goto('/');
  await expect(page.locator('#email')).toBeVisible({ timeout: 10000 });

  await page.fill('#email', user.email);
  await page.fill('#password', user.password);
  await page.click('button:has-text("Sign In")');

  await expect(
    page.locator('text=Create New Division').or(page.locator(`text=${user.email}`)).first()
  ).toBeVisible({ timeout: 15000 });

  await page.reload();
  await page.waitForLoadState('networkidle');

  console.log(`[AUTH] Successfully logged in as ${role}`);
}

// Division selection helper
export async function selectDivision(page: Page, divisionName: string): Promise<void> {
  console.log(`[NAV] Selecting division: ${divisionName}`);

  const heading = page.getByRole('heading', { name: divisionName, exact: true });
  await expect(heading).toBeVisible({ timeout: 10000 });

  const card = heading.locator('xpath=ancestor::div[contains(@class, "rounded")]');
  const resumeButton = card.getByRole('button', { name: 'Resume' });
  await expect(resumeButton).toBeVisible({ timeout: 5000 });
  await resumeButton.click();

  await expect(
    page.locator('text=Snake').or(page.locator('text=Straight')).or(page.locator('text=R1')).first()
  ).toBeVisible({ timeout: 15000 });

  console.log(`[NAV] Division loaded: ${divisionName}`);
}

// Draft picking helper
export async function makePick(page: Page, playerName?: string): Promise<string> {
  if (!playerName) {
    const draftBtn = page.locator('button:has-text("Draft")').first();
    await expect(draftBtn).toBeVisible();

    const row = draftBtn.locator('xpath=ancestor::tr');
    const nameCell = row.locator('td').nth(3);
    const name = await nameCell.textContent() || 'Unknown';

    console.log(`[DRAFT] Drafting player: ${name}`);
    await draftBtn.click();
    await page.waitForTimeout(500);

    return name.trim();
  }

  console.log(`[DRAFT] Drafting specific player: ${playerName}`);
  const playerRow = page.locator(`tr:has-text("${playerName}")`);
  await playerRow.locator('button:has-text("Draft")').click();
  await page.waitForTimeout(500);

  return playerName;
}

// Draft state inspection helper
export async function getDraftState(page: Page): Promise<{
  round: number;
  pick: number;
  currentTeam: string;
}> {
  const pickInfo = page.locator('text=/R\\d+ · Pick \\d+/');
  const text = await pickInfo.textContent() || '';

  const roundMatch = text.match(/R(\d+)/);
  const pickMatch = text.match(/Pick (\d+)/);

  const round = roundMatch ? parseInt(roundMatch[1]) : 1;
  const pick = pickMatch ? parseInt(pickMatch[1]) : 1;

  const teamLabel = page.locator('text=/picking now/i').or(page.locator('[class*="current"]'));
  const currentTeam = await teamLabel.textContent() || 'Unknown';

  return { round, pick, currentTeam: currentTeam.trim() };
}
```

**Extended Fixture Pattern:**
```typescript
export const test = base.extend<{
  loginAs: (org: OrgKey, role: RoleKey) => Promise<void>;
}>({
  loginAs: async ({ page }, use) => {
    const loginFn = async (org: OrgKey, role: RoleKey) => {
      await login(page, org, role);
    };
    await use(loginFn);
  },
});
```

## Coverage

**Requirements:** No coverage enforcement detected (no nyc config, no thresholds)

**View Coverage:**
- No coverage tool configured
- E2E tests verify UI workflows end-to-end
- No unit test coverage tracking

## Test Types

**Unit Tests:**
- None detected
- Codebase uses only E2E testing approach

**Integration Tests:**
- All E2E tests are integration tests by nature (interact with backend API)
- Tests verify full workflows: login → division selection → draft → pick → undo → complete

**E2E Tests:**
- Framework: Playwright v1.57.0
- Location: `e2e/` directory
- Prerequisites:
  ```bash
  docker compose up -d                          # Start backend
  docker compose exec api python manage.py seed_e2e --reset  # Seed test data
  npm run dev                                   # Start frontend on port 5175
  ```
- Configuration: `playwright.config.ts`
  - Sequential execution (workers: 1, fullyParallel: false)
  - Timeout: 60 seconds per test
  - Screenshot/video on failure
  - HTML reporter

## Common Patterns

**Navigation/Wait Patterns:**
```typescript
// Wait for elements to appear with timeouts
await expect(page.getByRole('heading', { name: 'Alpha Majors' })).toBeVisible({ timeout: 15000 });

// Network idle wait for SPA navigation
await page.waitForLoadState('networkidle');

// Explicit waits for state changes
await page.waitForTimeout(2000);
```

**Element Interaction:**
```typescript
// Fill forms
await page.fill('#email', user.email);
await page.fill('#password', user.password);

// Click buttons
await page.click('button:has-text("Sign In")');
await page.getByRole('button', { name: 'Draft' }).click();

// XPath navigation
const card = heading.locator('xpath=ancestor::div[contains(@class, "rounded")]');
const nameCell = row.locator('td').nth(3);
```

**Assertions:**
```typescript
// Visibility assertions
await expect(page.getByRole('heading', { name: 'Alpha Majors' })).toBeVisible();

// Text matching
await expect(page.getByText('Straight')).toBeVisible();

// OR conditions for multiple possible states
await expect(
  page.locator('text=Snake').or(page.locator('text=Straight')).or(page.locator('text=R1')).first()
).toBeVisible({ timeout: 15000 });
```

**Logging in Tests:**
```typescript
// Prefix pattern for test step tracking
console.log('[STEP 1] Logging in as admin');
console.log('[AUTH] Logging in as admin for alpha: admin@test-alpha.test');
console.log('[DRAFT] Starting draft with format: snake');
console.log('[SUCCESS] Complete draft flow test passed!');
```

## Backend Test Support

**Prerequisites:**
1. Backend running: `docker compose up -d`
2. Test data seeded: `docker compose exec api python manage.py seed_e2e --reset`
3. Frontend dev server: `npm run dev` (port 5175)

**Seeded Test Data:**
- Three test organizations: `test-alpha`, `test-beta`, `test-gamma`
- Three user roles per org: admin, coach, viewer
- Pre-configured divisions with teams and players
- Credentials: `{role}@test-{org}.test` / `TestPassword123!`

**Configuration:**
```typescript
// From playwright.config.ts
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,              // Sequential execution
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,                        // Single worker
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL: 'http://localhost:5175',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
});
```

## Test Coverage Areas

**Covered:**
- Complete draft workflow (login → division → config → draft → picks → complete)
- Draft undo operations
- Admin draft board interactions
- Navigation and routing

**Not Covered:**
- Unit tests (no unit testing framework)
- Component isolation tests
- Error scenarios (negative testing)
- Concurrent user scenarios
- Performance testing

---

*Testing analysis: 2026-01-29*
