import { test, expect } from '@playwright/test';
import { TEST_USERS } from './fixtures';

/**
 * Simple login test to verify login works
 */
test('simple login test', async ({ page }) => {
  const user = TEST_USERS.alpha.admin;

  // Go to home page
  await page.goto('/');

  // Wait for page to load
  await page.waitForLoadState('networkidle');

  // Debug: log what's on the page
  console.log('URL:', page.url());
  const emailInput = page.locator('#email');
  const isVisible = await emailInput.isVisible();
  console.log('Email input visible:', isVisible);

  if (!isVisible) {
    // Take screenshot to see what's there
    await page.screenshot({ path: 'test-results/simple-login-no-form.png' });
    const bodyText = await page.locator('body').textContent();
    console.log('Page content:', bodyText?.substring(0, 300));
    throw new Error('Email input not found');
  }

  // Fill login form
  await emailInput.fill(user.email);
  await page.locator('#password').fill(user.password);

  console.log('Form filled, clicking Sign In');

  // Click sign in
  await page.click('button:has-text("Sign In")');

  // Wait for navigation
  await page.waitForTimeout(3000);

  // Check what happened
  console.log('After submit URL:', page.url());
  const pageContent = await page.locator('body').textContent();
  console.log('Page content after login:', pageContent?.substring(0, 300));

  // Take screenshot
  await page.screenshot({ path: 'test-results/simple-login-after.png' });

  // Verify we're logged in by checking for user email or divisions
  const hasUserEmail = pageContent?.includes(user.email);
  const hasDivisions = pageContent?.includes('Create New Division');

  console.log('Has user email:', hasUserEmail);
  console.log('Has divisions UI:', hasDivisions);

  expect(hasUserEmail || hasDivisions).toBe(true);
});
