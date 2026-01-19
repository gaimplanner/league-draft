import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for E2E tests.
 *
 * Tests run against the local dev server (frontend: 5173, backend: 3001).
 * Before running tests, ensure:
 *   1. docker compose up -d (backend)
 *   2. npm run dev (frontend)
 *   3. docker compose exec api python manage.py seed_e2e --reset
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // Run tests sequentially for draft state consistency
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker for sequential execution
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
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Timeout settings
  timeout: 60000, // 60 seconds per test
  expect: {
    timeout: 10000, // 10 seconds for expect assertions
  },
});
