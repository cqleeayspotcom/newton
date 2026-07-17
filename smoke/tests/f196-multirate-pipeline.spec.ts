import { test, expect } from '@playwright/test';
import * as path from 'path';

/**
 * F196 (perception-daemon) — the perception pipeline runs as decoupled
 * multi-rate loops (capture → inference → smoothing/metrics → render) so slow
 * inference never blocks rendering.
 *
 * Feeds the fake camera a REAL full-body photo (person.y4m) so MediaPipe
 * actually runs, then reads the live perf panel and asserts:
 *  1. it shows separate, independently-measured rates for the capture,
 *     inference and metrics loops (all live, > 0 Hz);
 *  2. the overlay RENDER rate stays high even though the INFERENCE rate is
 *     lower — proving the loops are decoupled and inference doesn't throttle
 *     rendering.
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

const num = async (locator: import('@playwright/test').Locator, attr: string) =>
  Number((await locator.getAttribute(attr)) ?? 'NaN');

test.describe('F196 — decoupled multi-rate perception pipeline', () => {
  test('perf panel shows separate loop rates; render stays high vs inference', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // Open the live analysis screen with the real-person camera.
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

    // A person is detected so the inference loop is genuinely doing work.
    await expect(page.getByTestId('landmark-count')).toHaveAttribute(
      'data-landmarks',
      '33',
      { timeout: 20_000 },
    );

    // The perf panel exists and exposes each loop's measured rate.
    const panel = page.getByTestId('perf-panel');
    await expect(panel).toBeVisible();

    // Let all loops warm up so their sliding-window meters are populated.
    await page.waitForTimeout(2500);

    const captureHz = await num(panel, 'data-capture-hz');
    const inferenceHz = await num(panel, 'data-inference-hz');
    const metricsHz = await num(panel, 'data-metrics-hz');
    const renderHz = await num(panel, 'data-render-hz');

    // Step: separate, live rates for capture, inference and metrics loops.
    expect(captureHz, `capture Hz=${captureHz}`).toBeGreaterThan(0);
    expect(inferenceHz, `inference Hz=${inferenceHz}`).toBeGreaterThan(0);
    expect(metricsHz, `metrics Hz=${metricsHz}`).toBeGreaterThan(0);
    expect(renderHz, `render Hz=${renderHz}`).toBeGreaterThan(0);

    // The metrics loop is throttled near its ~10Hz target, independent of the
    // faster capture/render loops — evidence the loops truly run at own rates.
    expect(metricsHz).toBeLessThanOrEqual(15);

    // Step: the overlay render rate stays HIGH even though inference is LOWER.
    // Rendering never awaits inference, so it must not be throttled down to it.
    expect(
      renderHz,
      `render ${renderHz}Hz should stay above inference ${inferenceHz}Hz`,
    ).toBeGreaterThan(inferenceHz);
    expect(renderHz, `render Hz=${renderHz}`).toBeGreaterThanOrEqual(20);

    // Step: screenshot the perf panel.
    await page.screenshot({
      path: '../logs/screens/f196-perf-panel.png',
      fullPage: true,
    });

    expect(
      consoleErrors,
      `console errors: ${consoleErrors.join('\n')}`,
    ).toEqual([]);
  });
});
