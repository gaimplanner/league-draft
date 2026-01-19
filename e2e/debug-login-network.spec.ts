import { test, expect } from '@playwright/test';

test('debug login with network monitoring', async ({ page }) => {
  // Collect all network requests
  const requests: { url: string; method: string; status?: number; body?: string }[] = [];

  page.on('request', request => {
    requests.push({
      url: request.url(),
      method: request.method(),
      body: request.postData() || undefined,
    });
  });

  page.on('response', response => {
    const req = requests.find(r => r.url === response.url() && !r.status);
    if (req) {
      req.status = response.status();
    }
  });

  // Collect console logs
  const consoleLogs: string[] = [];
  page.on('console', msg => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
  });

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  console.log('=== Initial page load requests ===');
  requests.forEach(r => {
    if (r.url.includes('/api/')) {
      console.log(`${r.method} ${r.url} -> ${r.status}`);
    }
  });

  // Fill login form
  const emailInput = page.locator('input[type="email"]');
  await expect(emailInput).toBeVisible({ timeout: 10000 });
  await emailInput.fill('admin@test-alpha.test');

  const passwordInput = page.locator('input[type="password"]');
  await passwordInput.fill('TestPassword123!');

  // Clear request log before submit
  requests.length = 0;

  // Click sign in and wait for response
  const [response] = await Promise.all([
    page.waitForResponse(resp => resp.url().includes('/api/auth/login'), { timeout: 10000 }).catch(() => null),
    page.click('button:has-text("Sign In")'),
  ]);

  // Wait a bit for any additional requests
  await page.waitForTimeout(2000);

  console.log('\n=== Login attempt requests ===');
  requests.forEach(r => {
    console.log(`${r.method} ${r.url} -> ${r.status}`);
    if (r.body) {
      console.log(`  Body: ${r.body}`);
    }
  });

  if (response) {
    console.log('\n=== Login response ===');
    console.log(`Status: ${response.status()}`);
    const body = await response.text().catch(() => 'Could not read body');
    console.log(`Body: ${body}`);
  } else {
    console.log('\n=== No login API response captured ===');
  }

  console.log('\n=== Console logs ===');
  consoleLogs.forEach(log => console.log(log));

  // Check current state
  await page.screenshot({ path: 'test-results/debug-network-final.png' });
  console.log('\nFinal URL:', page.url());
});
