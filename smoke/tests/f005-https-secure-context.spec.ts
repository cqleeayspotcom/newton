import { test, expect } from '@playwright/test';
import { startTunnel, Tunnel } from '../helpers/ngrok';

/**
 * F005 (foundation) — the app is served over HTTPS through the ngrok tunnel and
 * reports a secure context, so the camera APIs (getUserMedia) are available. A
 * plain http://<LAN-IP> would NOT grant the camera; only an https origin does.
 *
 * This drives a REAL browser against the REAL public https ngrok URL (not
 * localhost), then asserts window.isSecureContext, that getUserMedia is exposed,
 * and that the served origin really is https://.
 *
 * The `ngrok-skip-browser-warning` header bypasses the free-tier interstitial so
 * the actual Newfoot app loads instead of ngrok's warning page.
 */
test.describe('F005 — HTTPS secure context via ngrok', () => {
  let tunnel: Tunnel;

  test.beforeAll(async () => {
    tunnel = await startTunnel(4200);
  });

  test.afterAll(async () => {
    await tunnel?.stop();
  });

  test.use({ extraHTTPHeaders: { 'ngrok-skip-browser-warning': 'true' } });

  test('served over https, reports secure context with getUserMedia available', async ({
    page,
  }) => {
    await page.goto(tunnel.url, { waitUntil: 'domcontentloaded' });

    // Address-bar context is https (step 4).
    expect(page.url().startsWith('https://')).toBe(true);

    const ctx = await page.evaluate(() => ({
      secure: window.isSecureContext,
      getUserMedia: typeof navigator.mediaDevices?.getUserMedia,
      protocol: window.location.protocol,
    }));

    // Secure context true (step 2) + camera API present (step 3).
    expect(ctx.secure).toBe(true);
    expect(ctx.getUserMedia).toBe('function');
    expect(ctx.protocol).toBe('https:');

    // The real app (not the ngrok interstitial) rendered over https.
    await expect(page.locator('app-root')).toBeVisible();

    await page.screenshot({
      path: 'test-results/f005-https-secure-context.png',
      fullPage: true,
    });
  });
});
