import { test, expect } from '@playwright/test';

/**
 * F004 (foundation) — the dockerized stack serves the app end-to-end: frontend,
 * backend, and database are all up from one docker-compose environment. Verifies
 * the home page renders, `/api/health` reports database connectivity as healthy,
 * and the live status card reflects the full stack (frontend + backend + DB).
 *
 * Note: the healthcheck that gates docker-compose reporting the stack "healthy"
 * was fixed this session — the in-container probes used `localhost` (which
 * resolves to IPv6 `::1`) against IPv4-only listeners, so they always failed with
 * "Connection refused". Switching to `127.0.0.1` lets all three services report
 * healthy, which is what makes this an end-to-end dockerized stack.
 */
test.describe('F004 — dockerized stack serves end-to-end', () => {
  test('home renders and /api/health reports db healthy from the docker stack', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // Step 1: navigate to the app URL served by the docker-compose stack.
    await page.goto('/');

    // Step 2: the home page renders (app shell + header visible).
    await expect(page.locator('app-root')).toBeVisible();
    await expect(page.locator('header')).toBeVisible();

    // Step 3: fetch /api/health and assert the JSON reports DB connectivity healthy.
    const health = await page.evaluate(async () => {
      const res = await fetch('/api/health');
      const body = (await res.json()) as { status?: string; db?: string };
      return { httpStatus: res.status, status: body?.status, db: body?.db };
    });
    expect(health.httpStatus).toBe(200);
    expect(health.status).toBe('ok');
    expect(health.db).toBe('ok');

    // The live status card reflects the full stack being served by docker-compose.
    await expect(page.getByTestId('status-frontend')).toHaveText('ready');
    await expect(page.getByTestId('status-backend')).toHaveText('ok');
    await expect(page.getByTestId('status-db')).toHaveText('ok');

    // Step 4: screenshot as evidence the full stack is serving.
    await page.screenshot({
      path: 'test-results/f004-dockerized-stack.png',
      fullPage: true,
    });

    expect(
      consoleErrors,
      `console errors: ${consoleErrors.join('\n')}`,
    ).toEqual([]);
  });
});
