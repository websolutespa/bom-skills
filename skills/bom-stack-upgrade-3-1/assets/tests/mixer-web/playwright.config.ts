import { defineConfig, devices } from '@playwright/test';

const port = 3000;

/**
 * See https://playwright.dev/docs/test-configuration.
 * The dev server runs on the mock store (STORE_STRATEGY=mock in .env), no bowl instance is needed.
 */
export default defineConfig({
  testDir: './src/__tests',
  testMatch: '**/*.e2e.test.ts',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  /* Dev compilation of the first route can take minutes. */
  timeout: 10 * 60_000,
  expect: { timeout: 60_000 },
  reporter: process.env.CI ? 'list' : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${port}`,
    navigationTimeout: 5 * 60_000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    reuseExistingServer: !process.env.CI,
    timeout: 10 * 60_000,
    url: `http://localhost:${port}`,
  },
});
