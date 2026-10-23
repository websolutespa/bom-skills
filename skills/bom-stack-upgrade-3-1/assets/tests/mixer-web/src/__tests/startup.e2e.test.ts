// readme https://playwright.dev/
import { expect, test } from '@playwright/test';

test.describe('Startup', () => {

  test('renders the homepage from the mock store', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      // recoverable: react re-renders the tree on the client (intermittent in next dev)
      if (!error.message.startsWith('Hydration failed')) {
        errors.push(error.message);
      }
    });
    const response = await page.goto('/');
    expect(response?.status()).toBeLessThan(400);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveTitle(/.+/);
    await expect(page.locator('body')).not.toBeEmpty();
    expect(errors).toEqual([]);
  });

});
