import { test, expect } from '@playwright/test';

/**
 * Guards the COOP/COEP headers that MediaPipe's threaded WASM needs to load
 * reliably ACROSS browsers. Chromium exposes SharedArrayBuffer on desktop even
 * without isolation, so a Chromium-only check hides the bug; Safari/Firefox
 * require cross-origin isolation. If these headers regress, crossOriginIsolated
 * goes false and the pose engine fails to load off-Chromium — assert it here.
 */
test.describe('cross-origin isolation (pose engine prerequisite)', () => {
  test('the app is cross-origin isolated (COOP/COEP present)', async ({ page }) => {
    const resp = await page.goto('/');
    const headers = resp?.headers() ?? {};
    expect(headers['cross-origin-opener-policy']).toBe('same-origin');
    expect(headers['cross-origin-embedder-policy']).toBe('require-corp');

    const isolated = await page.evaluate(
      () => (globalThis as unknown as { crossOriginIsolated?: boolean }).crossOriginIsolated === true,
    );
    expect(
      isolated,
      'crossOriginIsolated must be true so SharedArrayBuffer (MediaPipe threaded WASM) is available',
    ).toBe(true);

    await page.screenshot({ path: 'test-results/cross-origin-isolation.png' });
  });
});
