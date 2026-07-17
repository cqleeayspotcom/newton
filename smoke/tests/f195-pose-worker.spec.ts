import { test, expect } from '@playwright/test';
import * as path from 'path';

/**
 * F195 (perception-daemon) — pose inference runs in a dedicated Web Worker
 * (off the main thread) as a background daemon, so the UI and the skeleton
 * overlay stay smooth while inference runs.
 *
 * This feeds the fake camera a REAL full-body photo (person.y4m) so MediaPipe
 * actually detects a pose, then proves the inference is off-main-thread three
 * ways: (1) the app's own debug hook data-in-worker="true", (2) Playwright sees
 * a live dedicated Web Worker on the page, and (3) a main-thread responsiveness
 * probe shows no long-task jank while inference is running.
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

test.describe('F195 — pose inference runs in a Web Worker (off main thread)', () => {
  test('inference runs in a worker while the main thread stays responsive', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // Step 1: open the live analysis screen with the real-person camera.
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

    // Step 2: the skeleton overlay renders (33-landmark BlazePose topology).
    const overlay = page.getByTestId('skeleton-overlay');
    await expect(overlay).toBeAttached();
    const badge = page.getByTestId('landmark-count');
    await expect(badge).toHaveAttribute('data-landmarks', '33', {
      timeout: 20_000,
    });
    const drawnPixels = await overlay.evaluate((el) => {
      const canvas = el as HTMLCanvasElement;
      const ctx = canvas.getContext('2d');
      if (!ctx || !canvas.width || !canvas.height) return 0;
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let n = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i] > 0) n++;
      return n;
    });
    expect(drawnPixels).toBeGreaterThan(0);

    // Step 3a: the app's own debug hook confirms inference is in the worker.
    await expect(page.getByTestId('inference-worker')).toHaveAttribute(
      'data-in-worker',
      'true',
    );
    await expect(page.locator('[data-testid="capture-front"] .nf-capture__stage'))
      .toHaveAttribute('data-in-worker', 'true');

    // Step 3b: Playwright sees a live dedicated Web Worker running on the page.
    const workers = page.workers();
    expect(
      workers.length,
      `expected a pose Web Worker, saw: ${workers.map((w) => w.url()).join(', ')}`,
    ).toBeGreaterThan(0);
    expect(workers.some((w) => /worker/i.test(w.url()))).toBe(true);

    // Step 3c: main-thread responsiveness probe — measure requestAnimationFrame
    // frame gaps for ~1.5s while inference is running. If inference were on the
    // main thread the heavy detectForVideo call would produce long gaps; in a
    // worker the main thread stays smooth.
    const maxGapMs = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          let last = performance.now();
          let max = 0;
          const end = last + 1500;
          const tick = (now: number) => {
            max = Math.max(max, now - last);
            last = now;
            if (now < end) requestAnimationFrame(tick);
            else resolve(max);
          };
          requestAnimationFrame(tick);
        }),
    );
    expect(
      maxGapMs,
      `main-thread max rAF gap ${maxGapMs.toFixed(0)}ms — inference is blocking the UI`,
    ).toBeLessThan(300);

    // Disclaimer stays visible on the analysis screen.
    await expect(page.getByTestId('capture-disclaimer')).toBeVisible();

    // Step 4: screenshot the live overlay with inference running in the worker.
    await page.screenshot({
      path: 'test-results/f195-pose-worker.png',
      fullPage: true,
    });

    expect(
      consoleErrors,
      `console errors: ${consoleErrors.join('\n')}`,
    ).toEqual([]);
  });
});
