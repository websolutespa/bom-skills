import { expect, test, type Page } from '@playwright/test';
import { adminPath, api, getNavRoutes, login, trackErrors } from './helpers';

/**
 * Admin smoke suite: renders every admin route of the bowl app and exercises the
 * plugin components most coupled to Payload internals (localized field modal).
 * Runs against `BOM_DB=memory`, see playwright.config.ts.
 */
test.describe.serial('Admin', () => {
  let page: Page;
  let tracker: ReturnType<typeof trackErrors>;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    tracker = trackErrors(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test.afterEach(async ({}, testInfo) => {
    if (tracker.warnings.length) {
      testInfo.annotations.push({ type: 'console errors', description: tracker.warnings.join('\n---\n') });
    }
    tracker.reset();
  });

  test('logs in (creates the first user on an empty database)', async () => {
    await login(page);
    await expect(page).toHaveTitle(/Dashboard/);
    expect(tracker.errors).toEqual([]);
  });

  test('renders every navigation route', async () => {
    const routes = await getNavRoutes(page);
    expect(routes.length).toBeGreaterThan(10);
    for (const route of routes) {
      await test.step(route, async () => {
        tracker.reset();
        await page.goto(route);
        await page.waitForLoadState('networkidle');
        // still authenticated (a collection may be named login, compare the admin login path)
        expect(new URL(page.url()).pathname).not.toBe(`${adminPath}/login`);
        // custom views (e.g. llm-test) have no h1: assert the admin template rendered and no not-found page
        await expect(page.locator('.template-default').first()).toBeVisible();
        await expect(page.locator('.not-found')).toHaveCount(0);
        expect(tracker.errors, route).toEqual([]);
      });
    }
  });

  test('creates a label and localizes it through the localized field modal', async () => {
    const id = `e2e.label.${Date.now()}`;
    // the admin keeps the last used locale (user preference): start explicitly from en
    await page.goto(`${adminPath}/collections/label/create?locale=en`);
    await page.fill('#field-id', id);
    await page.fill('#field-text', 'Hello');
    await page.click('#action-save');
    await page.waitForURL((url) => url.pathname.endsWith(`/collections/label/${id}`));
    await expect(page.getByText('Label successfully created.')).toBeVisible();

    await page.locator('button.btn--localize').first().click();
    const modal = page.locator('.localized-field-modal__wrap');
    await expect(modal).toBeVisible();
    // wait for the it locale to be active before typing, otherwise the value would be saved in en
    await modal.getByRole('button', { name: /^it/i }).click();
    await expect(modal.locator('button.active', { hasText: /^it$/i })).toBeVisible();
    await expect(modal.locator('input#field-text')).toHaveValue('');
    await modal.locator('input#field-text').fill('Ciao');
    await modal.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(modal).toBeHidden();

    await expect.poll(async () => {
      const response = await api(page).get(`/label/${id}?locale=it&fallback-locale=none`);
      return (await response.json()).text;
    }).toBe('Ciao');
    const en = await api(page).get(`/label/${id}?locale=en&fallback-locale=none`);
    expect((await en.json()).text).toBe('Hello');

    const deleted = await api(page).delete(`/label/${id}`);
    expect(deleted.ok()).toBe(true);
    expect(tracker.errors).toEqual([]);
  });
});
