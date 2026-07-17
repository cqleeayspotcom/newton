import { test, expect } from '@playwright/test';

/**
 * F001 (foundation) — the Newfoot SPA loads at the root URL with the page
 * title 'Newfoot' and no console errors; header + main content are visible.
 */
test.describe('F001 — app loads at root', () => {
  test('root URL renders the shell with title Newfoot and zero console errors', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/');

    // Title contains 'Newfoot'
    await expect(page).toHaveTitle(/Newfoot/);

    // App shell: header and main content area are visible
    await expect(page.getByTestId('app-header')).toBeVisible();
    await expect(page.getByTestId('app-shell')).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Newfoot' }),
    ).toBeVisible();

    // Screenshot evidence
    await page.screenshot({
      path: 'test-results/f001-home-loads.png',
      fullPage: true,
    });

    // No error-level console messages
    expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual(
      [],
    );
  });
});
