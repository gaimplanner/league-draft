import { test, expect } from '@playwright/test';

test('debug login with cookie monitoring', async ({ page, context }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Get cookies before login
  let cookies = await context.cookies();
  console.log('=== Cookies BEFORE login ===');
  cookies.forEach(c => console.log(`  ${c.name}: ${c.value.substring(0, 30)}... (domain: ${c.domain})`));

  // Fill login form
  const emailInput = page.locator('input[type="email"]');
  await expect(emailInput).toBeVisible({ timeout: 10000 });
  await emailInput.fill('admin@test-alpha.test');

  const passwordInput = page.locator('input[type="password"]');
  await passwordInput.fill('TestPassword123!');

  // Click sign in and wait for response
  const [response] = await Promise.all([
    page.waitForResponse(resp => resp.url().includes('/api/auth/login'), { timeout: 10000 }),
    page.click('button:has-text("Sign In")'),
  ]);

  console.log('\n=== Login response ===');
  console.log(`Status: ${response.status()}`);

  // Check Set-Cookie header
  const setCookieHeaders = response.headers()['set-cookie'];
  console.log('Set-Cookie headers:', setCookieHeaders || 'NONE');

  // Wait for any redirects/state updates
  await page.waitForTimeout(2000);

  // Get cookies after login
  cookies = await context.cookies();
  console.log('\n=== Cookies AFTER login ===');
  cookies.forEach(c => console.log(`  ${c.name}: ${c.value.substring(0, 30)}... (domain: ${c.domain})`));

  // Check if sessionid cookie exists
  const sessionCookie = cookies.find(c => c.name === 'sessionid');
  console.log('\n=== Session Cookie ===');
  if (sessionCookie) {
    console.log('Session cookie found:', sessionCookie);
  } else {
    console.log('NO SESSION COOKIE - This is the problem!');
  }

  // Check what page we're on
  console.log('\nFinal URL:', page.url());

  // Take screenshot
  await page.screenshot({ path: 'test-results/debug-cookies-final.png' });
});
