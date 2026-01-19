import { test, expect } from '@playwright/test';
import { TEST_USERS } from './fixtures';

/**
 * Debug: check ALL API calls during login flow
 */
test('check all API calls during login flow', async ({ page }) => {
  const user = TEST_USERS.alpha.admin;

  // Collect ALL API responses
  const apiResponses: { url: string; status: number; body: string; time: number }[] = [];
  const startTime = Date.now();

  page.on('response', async response => {
    if (response.url().includes('/api/')) {
      const body = await response.text().catch(() => 'Could not read body');
      apiResponses.push({
        url: response.url(),
        status: response.status(),
        body: body.substring(0, 300),
        time: Date.now() - startTime,
      });
    }
  });

  console.log('=== STARTING: Going to homepage ===');

  // Go to home page
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  console.log('\n=== API calls BEFORE login (on page load) ===');
  apiResponses.forEach(r => {
    console.log(`[${r.time}ms] ${r.status} ${r.url.replace('http://localhost:3001', '')}`);
    console.log(`  Body: ${r.body}`);
  });

  // Fill login form
  const emailInput = page.locator('#email');
  await expect(emailInput).toBeVisible({ timeout: 10000 });
  await emailInput.fill(user.email);
  await page.locator('#password').fill(user.password);

  // Mark time before login
  const loginStartIndex = apiResponses.length;
  console.log(`\n=== CLICKING Sign In (responses so far: ${loginStartIndex}) ===`);

  // Click sign in
  await page.click('button:has-text("Sign In")');

  // Wait longer for all responses
  await page.waitForTimeout(8000);

  console.log('\n=== API calls AFTER login ===');
  for (let i = loginStartIndex; i < apiResponses.length; i++) {
    const r = apiResponses[i];
    console.log(`[${r.time}ms] ${r.status} ${r.url.replace('http://localhost:3001', '')}`);
    console.log(`  Body: ${r.body}`);
  }

  // Final state
  console.log('\n=== Final page content ===');
  const pageText = await page.locator('body').textContent();
  console.log(pageText?.substring(0, 300));

  await page.screenshot({ path: 'test-results/debug-all-network.png' });
});
