import { test, expect } from '@playwright/test';

test('debug login form', async ({ page }) => {
  await page.goto('/');

  // Wait for page to load
  await page.waitForLoadState('networkidle');

  // Take screenshot before anything
  await page.screenshot({ path: 'test-results/debug-1-initial.png' });

  // Check what's on the page
  const html = await page.content();
  console.log('Page title:', await page.title());

  // Check for email input
  const emailInput = page.locator('#email');
  const emailVisible = await emailInput.isVisible().catch(() => false);
  console.log('Email input #email visible:', emailVisible);

  // Try alternate selectors
  const emailByType = page.locator('input[type="email"]');
  const emailByTypeVisible = await emailByType.isVisible().catch(() => false);
  console.log('Email input by type visible:', emailByTypeVisible);

  // Try filling and take screenshot
  if (emailByTypeVisible) {
    await emailByType.fill('admin@test-alpha.test');
    await page.screenshot({ path: 'test-results/debug-2-after-email.png' });

    // Find password
    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.fill('TestPassword123!');
    await page.screenshot({ path: 'test-results/debug-3-after-password.png' });

    // Click sign in
    await page.click('button:has-text("Sign In")');

    // Wait for response
    await page.waitForTimeout(5000);
    await page.screenshot({ path: 'test-results/debug-4-after-submit.png' });

    // Check for error message
    const errorMsg = await page.locator('.bg-red-900, [class*="error"], [class*="alert"]').textContent().catch(() => 'No error found');
    console.log('Error message:', errorMsg);

    // Check current URL
    console.log('Current URL:', page.url());

    // Check page content for clues
    const pageText = await page.locator('body').textContent();
    if (pageText?.includes('Create New Division')) {
      console.log('SUCCESS: Logged in - see Create New Division');
    } else if (pageText?.includes('Sign in to your account')) {
      console.log('FAILED: Still on login page');
    }
  }
});
