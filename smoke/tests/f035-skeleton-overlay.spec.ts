import { test, expect } from '@playwright/test';
import * as path from 'path';

/**
 * F035 (pose-engine) — a real-time 33-landmark skeleton overlay (joints +
 * connecting bones) is drawn over the live camera preview.
 *
 * The synthetic front/side/back clips contain no human and yield no landmarks,
 * so this test feeds the fake camera a REAL full-body photo converted to an
 * I420 y4m clip (tools/test_media/person.y4m, built by gen_person_y4m.mjs).
 * MediaPipe then detects all 33 landmarks, which are drawn onto the overlay
 * canvas — the same pipeline the daemon loops (F195+) build on.
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

test.describe('F035 — 33-landmark skeleton overlay over the live preview', () => {
  test('detects a person and draws the skeleton on the overlay canvas', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // Step 1: open the wizard FRONT capture step with the real-person camera.
    await page.goto('/');
    await page.getByTestId('start-scan').click();
    await expect(page).toHaveURL(/\/scan\/front$/);

    // Preview goes live and the pose engine loads (F034).
    await expect(page.getByTestId('capture-status')).toHaveText('live', {
      timeout: 10_000,
    });
    await expect(page.getByTestId('pose-engine-status')).toHaveText(
      'Pose engine ready',
      { timeout: 45_000 },
    );

    // Step 2: an overlay canvas is rendered above the video.
    const overlay = page.getByTestId('skeleton-overlay');
    await expect(overlay).toBeAttached();

    // Step 3: the app reports 33 detected landmarks (BlazePose full topology).
    const badge = page.getByTestId('landmark-count');
    await expect(badge).toHaveAttribute('data-landmarks', '33', {
      timeout: 20_000,
    });
    await expect(badge).toHaveText(/33 landmarks tracked/);

    // The overlay canvas actually has pixels drawn on it (non-empty bitmap).
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

    // Wellness disclaimer stays visible on the analysis screen.
    await expect(page.getByTestId('capture-disclaimer')).toBeVisible();

    // Step 4: screenshot the skeleton drawn over the body.
    await page.screenshot({
      path: 'test-results/f035-skeleton-overlay.png',
      fullPage: true,
    });

    expect(
      consoleErrors,
      `console errors: ${consoleErrors.join('\n')}`,
    ).toEqual([]);
  });
});
