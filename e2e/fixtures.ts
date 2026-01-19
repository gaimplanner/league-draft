import { test as base, Page, expect } from '@playwright/test';

/**
 * E2E Test Fixtures and Helpers
 *
 * Test credentials (created by: python manage.py seed_e2e --reset):
 *   - admin@test-alpha.test / TestPassword123!
 *   - coach@test-alpha.test / TestPassword123!
 *   - viewer@test-alpha.test / TestPassword123!
 *   (same pattern for test-beta and test-gamma)
 */

// Test user credentials
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

export type OrgKey = keyof typeof TEST_USERS;
export type RoleKey = keyof typeof TEST_USERS.alpha;

/**
 * Login helper - performs login and waits for redirect
 */
export async function login(
  page: Page,
  org: OrgKey,
  role: RoleKey
): Promise<void> {
  const user = TEST_USERS[org][role];

  console.log(`[AUTH] Logging in as ${role} for ${org}: ${user.email}`);

  await page.goto('/');

  // Wait for login page to load
  await expect(page.locator('#email')).toBeVisible({ timeout: 10000 });

  // Fill login form using the form IDs
  await page.fill('#email', user.email);
  await page.fill('#password', user.password);

  // Submit using the Sign In button
  await page.click('button:has-text("Sign In")');

  // Wait for redirect to main app - look for elements that appear after login
  // The division selector shows "Create New Division" button or user email in header
  // Use .first() since both might be visible
  await expect(
    page.locator('text=Create New Division').or(page.locator(`text=${user.email}`)).first()
  ).toBeVisible({ timeout: 15000 });

  // Refresh page to trigger division fetch after login
  // (workaround: useDivisions doesn't re-fetch on auth state change)
  await page.reload();
  await page.waitForLoadState('networkidle');

  console.log(`[AUTH] Successfully logged in as ${role}`);
}

/**
 * Logout helper
 */
export async function logout(page: Page): Promise<void> {
  console.log('[AUTH] Logging out');

  // Click user menu (profile icon or settings)
  const userMenu = page.locator('[data-testid="user-menu"]').or(page.locator('button:has-text("Settings")'));

  if (await userMenu.isVisible()) {
    await userMenu.click();
    await page.click('text=Log Out');
  } else {
    // Fallback: navigate to login page directly
    await page.goto('/');
  }

  // Wait for login page
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10000 });

  console.log('[AUTH] Successfully logged out');
}

/**
 * Select a division by name
 */
export async function selectDivision(page: Page, divisionName: string): Promise<void> {
  console.log(`[NAV] Selecting division: ${divisionName}`);

  // Find the heading with the division name, then go up to the card and find Resume button
  const heading = page.getByRole('heading', { name: divisionName, exact: true });
  await expect(heading).toBeVisible({ timeout: 10000 });

  // The card structure is: div > (div with h3 + info) + (div with buttons)
  // Find the Resume button that's a sibling of the heading's parent
  const card = heading.locator('xpath=ancestor::div[contains(@class, "rounded")]');
  const resumeButton = card.getByRole('button', { name: 'Resume' });
  await expect(resumeButton).toBeVisible({ timeout: 5000 });
  await resumeButton.click();

  // Wait for division to load - could be various phases
  // Config phase shows draft format options (Snake/Straight/Recalculated)
  // Draft phase shows the board (R1, Round 1)
  // Or we might see "Start Draft" button
  await expect(
    page.locator('text=Snake').or(page.locator('text=Straight')).or(page.locator('text=R1')).or(page.locator('text=Round 1')).or(page.locator('button:has-text("Start Draft")')).first()
  ).toBeVisible({ timeout: 15000 });

  console.log(`[NAV] Division loaded: ${divisionName}`);
}

/**
 * Navigate to draft config (if not already there)
 */
export async function goToDraftConfig(page: Page): Promise<void> {
  // If we see "Start Draft" button, we're already on config
  const startDraftBtn = page.locator('button:has-text("Start Draft")');
  if (await startDraftBtn.isVisible()) {
    return;
  }

  // Otherwise navigate via division selector
  console.log('[NAV] Navigating to draft config');
}

/**
 * Start a draft with specified format
 */
export async function startDraft(
  page: Page,
  format: 'straight' | 'snake' | 'recalculated' = 'snake'
): Promise<void> {
  console.log(`[DRAFT] Starting draft with format: ${format}`);

  // Select draft format
  await page.click(`text=${format}`, { exact: false });

  // Click Start Draft button
  await page.click('button:has-text("Start Draft")');

  // Wait for draft board to appear
  await expect(page.locator('text=Round 1')).toBeVisible({ timeout: 10000 });

  console.log('[DRAFT] Draft started successfully');
}

/**
 * Make a draft pick by clicking on a player
 */
export async function makePick(page: Page, playerName?: string): Promise<string> {
  // If no specific player, pick the first available "Draft" button
  if (!playerName) {
    const draftBtn = page.locator('button:has-text("Draft")').first();
    await expect(draftBtn).toBeVisible();

    // Get the player name from the row
    const row = draftBtn.locator('xpath=ancestor::tr');
    const nameCell = row.locator('td').nth(3); // Name is typically 4th column
    const name = await nameCell.textContent() || 'Unknown';

    console.log(`[DRAFT] Drafting player: ${name}`);
    await draftBtn.click();

    // Wait for confirmation or next pick state
    await page.waitForTimeout(500); // Brief wait for state update

    return name.trim();
  }

  // Find specific player and draft them
  console.log(`[DRAFT] Drafting specific player: ${playerName}`);
  const playerRow = page.locator(`tr:has-text("${playerName}")`);
  await playerRow.locator('button:has-text("Draft")').click();

  await page.waitForTimeout(500);

  return playerName;
}

/**
 * Confirm a pending draft pick
 */
export async function confirmPick(page: Page): Promise<void> {
  const confirmBtn = page.locator('button:has-text("Confirm")');
  if (await confirmBtn.isVisible()) {
    console.log('[DRAFT] Confirming pick');
    await confirmBtn.click();
    await page.waitForTimeout(500);
  }
}

/**
 * Get current draft state info
 */
export async function getDraftState(page: Page): Promise<{
  round: number;
  pick: number;
  currentTeam: string;
}> {
  // Look for "R1 · Pick 1/96" format or similar
  const pickInfo = page.locator('text=/R\\d+ · Pick \\d+/');
  const text = await pickInfo.textContent() || '';

  const roundMatch = text.match(/R(\d+)/);
  const pickMatch = text.match(/Pick (\d+)/);

  const round = roundMatch ? parseInt(roundMatch[1]) : 1;
  const pick = pickMatch ? parseInt(pickMatch[1]) : 1;

  // Get current team name
  const teamLabel = page.locator('text=/picking now/i').or(page.locator('[class*="current"]'));
  const currentTeam = await teamLabel.textContent() || 'Unknown';

  return { round, pick, currentTeam: currentTeam.trim() };
}

/**
 * Extended test fixture with authentication helpers
 */
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

export { expect };
