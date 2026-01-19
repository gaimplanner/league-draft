import { test, expect } from '@playwright/test';
import { TEST_USERS } from './fixtures';

/**
 * Debug: check what divisions API returns after login
 */
test('check divisions API after login', async ({ page }) => {
  const user = TEST_USERS.alpha.admin;

  // Collect API responses
  const apiResponses: { url: string; status: number; body: string }[] = [];
  page.on('response', async response => {
    if (response.url().includes('/api/')) {
      const body = await response.text().catch(() => 'Could not read body');
      apiResponses.push({
        url: response.url(),
        status: response.status(),
        body: body.substring(0, 500),
      });
    }
  });

  // Go to home page and login
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Fill login form
  const emailInput = page.locator('#email');
  await expect(emailInput).toBeVisible({ timeout: 10000 });
  await emailInput.fill(user.email);
  await page.locator('#password').fill(user.password);

  // Clear responses before login
  apiResponses.length = 0;

  // Click sign in
  await page.click('button:has-text("Sign In")');

  // Wait for divisions to load
  await page.waitForTimeout(5000);

  // Log all API responses
  console.log('\n=== API Responses after login ===');
  apiResponses.forEach(r => {
    console.log(`${r.status} ${r.url}`);
    if (r.body) {
      console.log(`  Body: ${r.body}`);
    }
  });

  // Check for divisions response specifically
  const divisionsResponse = apiResponses.find(r => r.url.includes('/api/divisions'));
  if (divisionsResponse) {
    console.log('\n=== Divisions API Response ===');
    console.log(`Status: ${divisionsResponse.status}`);
    console.log(`Body: ${divisionsResponse.body}`);
  } else {
    console.log('\n=== NO DIVISIONS API CALL FOUND ===');
  }

  // Take screenshot
  await page.screenshot({ path: 'test-results/debug-divisions-api.png' });
});
