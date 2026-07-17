import { test, expect } from '@playwright/test';

/**
 * Skeleton smoke test — guards the base app shell that every feature builds on.
 * This is NOT a feature_list feature; it is the baseline the coding agent's
 * startup routine relies on. Each feature flipped to passes:true adds its own
 * spec file alongside this one (§5.5).
 */
test.describe('app shell', () => {
  test('renders the Newfoot shell with a live backend + DB status', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/');

    // Title + shell present
    await expect(page).toHaveTitle(/Newfoot/);
    await expect(page.getByTestId('app-shell')).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Newfoot' }),
    ).toBeVisible();

    // Stack status card proves frontend -> /api proxy -> DB wiring
    await expect(page.getByTestId('status-frontend')).toHaveText('ready');
    await expect(page.getByTestId('status-backend')).toHaveText('ok', {
      timeout: 10_000,
    });
    await expect(page.getByTestId('status-db')).toHaveText('ok', {
      timeout: 10_000,
    });

    // Disclaimer is present in the base chrome
    await expect(page.getByText(/not medical advice/i)).toBeVisible();

    await page.screenshot({
      path: 'test-results/skeleton-shell.png',
      fullPage: true,
    });

    expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual(
      [],
    );
  });
});
