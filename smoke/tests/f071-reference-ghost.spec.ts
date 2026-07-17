import { test, expect } from '@playwright/test';
import * as path from 'path';

/**
 * F071 (reference-comparison) — a dimmed reference-posture "ghost" skeleton
 * (ideal: LEVEL shoulders + LEVEL hips + VERTICAL spine/head) is drawn on the
 * capture overlay next to the user's detected skeleton.
 *
 * Uses the real-person clip (tools/test_media/person.y4m) so MediaPipe detects
 * a body — the ghost is anchored to that detection. Verifies TWO skeletons are
 * present: the detected one (33 landmarks, solid) and the ideal ghost overlay.
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

test.describe('F071 — reference-posture ghost overlay', () => {
  test('draws an ideal ghost skeleton next to the detected one', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // Complete a FRONT capture with the real-person fake camera.
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

    // The user's detected skeleton is present (33 landmarks).
    const badge = page.getByTestId('landmark-count');
    await expect(badge).toHaveAttribute('data-landmarks', '33', {
      timeout: 20_000,
    });

    // The reference ghost becomes active and reports its bone segments.
    const stage = page.getByTestId('capture-front').locator('.nf-capture__stage');
    await expect(stage).toHaveAttribute('data-ghost-active', 'true', {
      timeout: 20_000,
    });
    await expect(stage).toHaveAttribute('data-ghost-segments', '6');
    await expect(page.getByTestId('reference-ghost-status')).toHaveText(
      'ideal ghost overlay shown',
    );

    // Two distinct skeletons render on the overlay: the solid detected one
    // (orange joints #f97316 / blue bones #38bdf8) AND the dashed emerald
    // "ideal" ghost (rgba(52,211,153,...)). Assert BOTH colour families exist.
    const overlay = page.getByTestId('skeleton-overlay');
    const colours = await overlay.evaluate((el) => {
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
        // Detected skeleton: warm orange or saturated blue.
        if ((r > 180 && g > 80 && g < 180 && b < 80) || (b > 180 && r < 120)) {
          detected++;
        }
        // Ghost: emerald green — green channel clearly dominant.
        if (g > 130 && g > r + 35 && g > b + 20) {
          ghost++;
        }
      }
      return { detected, ghost };
    });
    expect(colours.detected, 'detected skeleton pixels').toBeGreaterThan(0);
    expect(colours.ghost, 'ghost skeleton pixels').toBeGreaterThan(0);

    // Wellness disclaimer stays visible.
    await expect(page.getByTestId('capture-disclaimer')).toBeVisible();

    await page.screenshot({
      path: 'test-results/f071-reference-ghost.png',
      fullPage: true,
    });

    expect(
      consoleErrors,
      `console errors: ${consoleErrors.join('\n')}`,
    ).toEqual([]);
  });
});
