import { test, expect } from '@playwright/test';
import * as path from 'path';

/**
 * F074 (reference-comparison) — body segments that deviate past threshold are
 * highlighted in a warning colour on the DETECTED skeleton, directly showing
 * the difference from the ideal reference ghost.
 *
 * Uses the real-person clip (tools/test_media/person.y4m) so MediaPipe detects
 * a body whose posture actually deviates on at least one metric. Verifies:
 *  - at least one live finding is reported,
 *  - the `data-deviated-segments` hook matches those findings,
 *  - warning-red pixels (#ff3b30) are painted on the overlay while the neutral
 *    blue detected skeleton is also present.
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

test.describe('F074 — deviated-segment highlight', () => {
  test('highlights the deviating skeleton segment in the warning colour', async ({
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

    // The user's detected skeleton is present (33 landmarks).
    await expect(page.getByTestId('landmark-count')).toHaveAttribute(
      'data-landmarks',
      '33',
      { timeout: 20_000 },
    );

    // At least one metric deviates → at least one finding is listed.
    await expect(page.getByTestId('finding').first()).toBeVisible({
      timeout: 20_000,
    });
    const findingCount = await page.getByTestId('finding').count();
    expect(findingCount, 'live findings').toBeGreaterThan(0);

    // The deviated-segment highlight hook reflects those findings.
    const stage = page.getByTestId('capture-front').locator('.nf-capture__stage');
    await expect(stage).toHaveAttribute('data-deviated-count', /[1-9]/, {
      timeout: 20_000,
    });
    await expect(page.getByTestId('deviation-highlight-status')).toContainText(
      'highlighted on your skeleton',
    );

    // The overlay carries BOTH the neutral blue detected skeleton AND the
    // warning-red highlight (#ff3b30 → r high, g/b low) on the deviated segment.
    const overlay = page.getByTestId('skeleton-overlay');
    const colours = await overlay.evaluate((el) => {
      const canvas = el as HTMLCanvasElement;
      const ctx = canvas.getContext('2d')!;
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let blue = 0;
      let warn = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        if (a === 0) continue;
        // Neutral detected bones: saturated blue.
        if (b > 180 && r < 120) blue++;
        // Warning highlight: bright red — red dominant, green & blue both low.
        if (r > 190 && g < 110 && b < 110) warn++;
      }
      return { blue, warn };
    });
    expect(colours.blue, 'neutral detected skeleton pixels').toBeGreaterThan(0);
    expect(colours.warn, 'warning-highlight pixels').toBeGreaterThan(0);

    // Wellness disclaimer stays visible.
    await expect(page.getByTestId('capture-disclaimer')).toBeVisible();

    await page.screenshot({
      path: 'test-results/f074-deviation-highlight.png',
      fullPage: true,
    });

    expect(
      consoleErrors,
      `console errors: ${consoleErrors.join('\n')}`,
    ).toEqual([]);
  });
});
