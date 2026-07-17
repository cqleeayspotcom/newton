import { test, expect } from '@playwright/test';
import * as path from 'path';

/**
 * F073 (reference-comparison) — a toggle shows/hides the reference-posture
 * ghost on the capture screen. When toggled off, the ideal ghost disappears
 * while the user's detected skeleton (and deviation highlights) keep rendering;
 * toggling back on brings the ghost back.
 *
 * Uses the real-person clip so MediaPipe detects a body (the ghost anchors to
 * it). Asserts the emerald ghost pixels vanish/return across the toggle while
 * the detected orange/blue skeleton pixels persist in BOTH states.
 */
const personClip = path.resolve(__dirname, '../../tools/test_media/person.y4m');

test.use({
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-video-capture=${personClip}`,
    ],
  },
});

/** Count detected (orange/blue) vs ghost (emerald) pixels on the overlay. */
async function countOverlayColours(overlay: import('@playwright/test').Locator) {
  return overlay.evaluate((el) => {
    const canvas = el as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let detected = 0;
    let ghost = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a === 0) continue;
      // Detected skeleton: warm orange joints / warning red / saturated blue.
      if ((r > 180 && g < 180 && b < 90) || (b > 180 && r < 120)) detected++;
      // Ghost: emerald green — green channel clearly dominant.
      if (g > 130 && g > r + 35 && g > b + 20) ghost++;
    }
    return { detected, ghost };
  });
}

test.describe('F073 — reference-ghost show/hide toggle', () => {
  test('toggles the ghost off and back on while the skeleton stays', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/');
    await page.getByTestId('start-scan').click();
    await expect(page).toHaveURL(/\/scan\/front$/);

    await expect(page.getByTestId('capture-status')).toHaveText('live', {
      timeout: 10_000,
    });
    await expect(page.getByTestId('pose-engine-status')).toHaveText(
      'Pose engine ready',
      { timeout: 45_000 },
    );
    await expect(page.getByTestId('landmark-count')).toHaveAttribute(
      'data-landmarks',
      '33',
      { timeout: 20_000 },
    );

    const stage = page
      .getByTestId('capture-front')
      .locator('.nf-capture__stage');
    const overlay = page.getByTestId('skeleton-overlay');
    const toggle = page.getByTestId('ghost-toggle');

    // Default ON: the ghost is drawn (active + emerald pixels present).
    await expect(stage).toHaveAttribute('data-ghost-active', 'true', {
      timeout: 20_000,
    });
    await expect(toggle).toHaveAttribute('data-ghost-enabled', 'true');
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    const on = await countOverlayColours(overlay);
    expect(on.ghost, 'ghost pixels while on').toBeGreaterThan(0);
    expect(on.detected, 'detected pixels while on').toBeGreaterThan(0);
    await page.screenshot({
      path: 'test-results/f073-ghost-on.png',
      fullPage: true,
    });

    // Toggle OFF: ghost stops rendering; detected skeleton remains.
    await toggle.click();
    await expect(toggle).toHaveAttribute('data-ghost-enabled', 'false');
    await expect(toggle).toHaveText('Reference off');
    await expect(stage).toHaveAttribute('data-ghost-active', 'false');
    await expect(stage).toHaveAttribute('data-ghost-segments', '0');
    // Let a couple of render frames repaint the overlay without the ghost.
    await expect
      .poll(async () => (await countOverlayColours(overlay)).ghost, {
        timeout: 5_000,
      })
      .toBe(0);
    const off = await countOverlayColours(overlay);
    expect(off.detected, 'detected pixels while off').toBeGreaterThan(0);
    await page.screenshot({
      path: 'test-results/f073-ghost-off.png',
      fullPage: true,
    });

    // Toggle BACK ON: the ghost returns.
    await toggle.click();
    await expect(toggle).toHaveAttribute('data-ghost-enabled', 'true');
    await expect(stage).toHaveAttribute('data-ghost-active', 'true', {
      timeout: 10_000,
    });
    await expect
      .poll(async () => (await countOverlayColours(overlay)).ghost, {
        timeout: 5_000,
      })
      .toBeGreaterThan(0);

    await expect(page.getByTestId('capture-disclaimer')).toBeVisible();
    expect(
      consoleErrors,
      `console errors: ${consoleErrors.join('\n')}`,
    ).toEqual([]);
  });
});
