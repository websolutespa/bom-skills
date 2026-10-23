import { expect, type Page } from '@playwright/test';

export const basePath = process.env.PAYLOAD_PUBLIC_BASE_PATH ?? '/bowl';
export const adminPath = `${basePath}/admin`;
export const apiPath = `${basePath}/api`;

export const admin = {
  email: 'e2e-admin@example.com',
  password: 'E2e-Password-123!',
};

/**
 * REST api calls with the admin session cookie of the page.
 * Since payload 3.90 cookie authentication requires the request origin (csrf), as a browser sends it.
 */
export function api(page: Page) {
  const headers = { Origin: new URL(page.url()).origin };
  return {
    get: (path: string) => page.request.get(`${apiPath}${path}`, { headers }),
    delete: (path: string) => page.request.delete(`${apiPath}${path}`, { headers }),
  };
}

/**
 * Collects uncaught page errors and 5xx responses, the failures a smoke test should catch.
 * Console errors and recoverable hydration errors (dev mode) are kept apart and only reported.
 */
export function trackErrors(page: Page) {
  const errors: string[] = [];
  const warnings: string[] = [];
  page.on('pageerror', (error) => {
    // recoverable: react re-renders the tree on the client (intermittent in next dev)
    if (error.message.startsWith('Hydration failed')) {
      warnings.push(`pageerror: ${error.message}`);
    } else {
      errors.push(`pageerror: ${error.message}`);
    }
  });
  page.on('response', (response) => {
    if (response.status() >= 500) {
      errors.push(`http ${response.status()} ${response.request().method()} ${response.url()}`);
    }
  });
  page.on('console', (message) => {
    if (message.type() === 'error') {
      warnings.push(message.text());
    }
  });
  return {
    errors,
    warnings,
    reset() {
      errors.length = 0;
      warnings.length = 0;
    },
  };
}

/**
 * Logs in as the e2e admin, creating it on the first run (empty in-memory database).
 */
export async function login(page: Page) {
  await page.goto(adminPath);
  await page.waitForURL(/\/(login|create-first-user)/);
  await expect(page.locator('#field-email')).toBeVisible();
  await page.fill('#field-email', admin.email);
  await page.fill('#field-password', admin.password);
  if (page.url().includes('create-first-user')) {
    await page.fill('#field-confirm-password', admin.password);
    await page.locator('#field-roles').click();
    await page.getByRole('option', { name: /^admin$/i }).click();
    await page.getByRole('button', { name: 'Create' }).click();
  } else {
    await page.getByRole('button', { name: /login/i }).click();
  }
  await page.waitForURL((url) => !/\/(login|create-first-user)/.test(url.pathname));
}

/**
 * Admin routes linked from the navigation, excluding logout.
 */
export async function getNavRoutes(page: Page): Promise<string[]> {
  await page.goto(adminPath);
  await expect(page.locator('nav').first()).toBeAttached();
  const hrefs = await page.locator(`a[href^="${adminPath}/"]`).evaluateAll(
    (links) => links.map((link) => link.getAttribute('href') || '')
  );
  return [...new Set(hrefs)].filter((href) => href && !href.includes('/logout'));
}
