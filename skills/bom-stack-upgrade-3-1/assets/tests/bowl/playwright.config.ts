import { defineConfig, devices } from '@playwright/test';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
import 'dotenv/config';

const port = Number(process.env.PORT || 4000);
const basePath = process.env.PAYLOAD_PUBLIC_BASE_PATH ?? '/bowl';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* The suite shares one in-memory database, run it in a single worker. */
  workers: 1,
  /* Dev compilation of the first admin routes can take minutes. */
  timeout: 10 * 60_000,
  expect: { timeout: 60_000 },
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: process.env.CI ? 'list' : [['list'], ['html', { open: 'never' }]],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    baseURL: `http://localhost:${port}`,
    navigationTimeout: 5 * 60_000,
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
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
    env: {
      // in-memory database, no mongo required
      BOM_DB: process.env.BOM_DB || 'memory',
    },
    reuseExistingServer: !process.env.CI,
    timeout: 10 * 60_000,
    url: `http://localhost:${port}${basePath}/api/access`,
  },
});
