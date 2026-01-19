import { test, expect } from '@playwright/test';

test('debug login UI state', async ({ page }) => {
  // Track console messages
  page.on('console', msg => {
    if (msg.type() === 'log' || msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`[browser ${msg.type()}] ${msg.text()}`);
    }
  });

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  console.log('\n=== Starting login flow ===');

  // Fill login form
  const emailInput = page.locator('input[type="email"]');
  await expect(emailInput).toBeVisible({ timeout: 10000 });
  console.log('Email input visible');
  await emailInput.fill('admin@test-alpha.test');

  const passwordInput = page.locator('input[type="password"]');
  await passwordInput.fill('TestPassword123!');
  console.log('Form filled');

  // Click sign in
  await page.click('button:has-text("Sign In")');
  console.log('Sign In clicked');

  // Wait for navigation or state change
  // The app should show division selector after login
  console.log('Waiting for post-login state...');

  // Try to find the division selector or any post-login content
  try {
    // Wait for either:
    // 1. Division selector ("Create New Division")
    // 2. User email showing in the header
    // 3. Any division card
    await page.waitForSelector(
      'text=Create New Division, text=admin@test-alpha.test, [data-testid="division-card"]',
      { timeout: 10000 }
    );
    console.log('SUCCESS: Found post-login content!');
  } catch (e) {
    console.log('TIMEOUT: Post-login content not found');

    // Debug: what IS on the page?
    const pageText = await page.locator('body').textContent();
    console.log('\n=== Page content (first 500 chars) ===');
    console.log(pageText?.substring(0, 500));

    // Check if we're still on login page
    const loginForm = await page.locator('input[type="email"]').isVisible();
    console.log('\nLogin form still visible?', loginForm);

    // Check for any error messages
    const errorElements = await page.locator('.bg-red-900, [class*="error"], [class*="alert"]').all();
    console.log('Error elements count:', errorElements.length);
    for (const el of errorElements) {
      const text = await el.textContent();
      console.log('Error text:', text);
    }
  }

  await page.screenshot({ path: 'test-results/debug-ui-final.png' });
  console.log('\nFinal URL:', page.url());
});
