import { test, expect } from '@playwright/test';

/**
 * F002 (foundation) — the backend API is reachable through the frontend origin
 * at `/api`, so the whole app works over a single (ngrok) tunnel. Verifies the
 * same-origin `/api/health` fetch returns 200 with `status: 'ok'`, that the
 * request truly stays same-origin (no cross-origin hop), and that no CORS error
 * surfaces in the console.
 */
test.describe('F002 — backend reachable via same-origin /api', () => {
  test('same-origin /api/health returns 200 status:ok with no CORS error', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/');

    // Fetch /api/health from page context — this is the SAME origin the app is
    // served from (relative URL), proving the single-origin proxy path.
    const result = await page.evaluate(async () => {
      const requestUrl = new URL('/api/health', window.location.href).href;
      const res = await fetch('/api/health');
      const body = (await res.json()) as { status?: string };
      return {
        origin: window.location.origin,
        requestUrl,
        status: res.status,
        statusField: body?.status,
      };
    });

    // The resolved request URL is same-origin as the app.
    expect(result.requestUrl.startsWith(result.origin)).toBe(true);

    // 200 + JSON body with status === 'ok'.
    expect(result.status).toBe(200);
    expect(result.statusField).toBe('ok');

    // Screenshot evidence (backend + DB badges reflect the live same-origin call).
    await expect(page.getByTestId('status-backend')).toHaveText('ok');
    await page.screenshot({
      path: 'test-results/f002-same-origin-api.png',
      fullPage: true,
    });

    // No CORS / console errors.
    expect(
      consoleErrors,
      `console errors: ${consoleErrors.join('\n')}`,
    ).toEqual([]);
  });
});
