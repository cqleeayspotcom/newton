import { test, expect } from '@playwright/test';
import { fakeCameraArgs } from '../helpers/camera';

/**
 * F026 (camera) — opening the wizard FRONT capture step requests camera access
 * and shows the live preview once granted.
 *
 * Chromium is launched with the FRONT fake-camera y4m so getUserMedia resolves
 * headlessly and the <video> plays synthetic content — this verifies the camera
 * UI + preview plumbing (not landmark detection; that is unit-tested over
 * tools/pose_fixtures/ and built in later features F034/F035).
 */
test.use({ launchOptions: { args: fakeCameraArgs('front') } });

test.describe('F026 — wizard FRONT capture shows live preview', () => {
  test('navigating to the FRONT step streams a playing <video> preview', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // Step 2: navigate to the wizard FRONT capture step (via the home CTA).
    await page.goto('/');
    await page.getByTestId('start-scan').click();
    await expect(page).toHaveURL(/\/scan\/front$/);

    // Step 3: a <video> becomes visible and is actually playing.
    const video = page.getByTestId('capture-video');
    await expect(video).toBeVisible();

    // The overlay is only shown before the stream is live; wait for it to clear.
    await expect(page.getByTestId('capture-status')).toHaveText('live', {
      timeout: 10_000,
    });

    const media = await video.evaluate((el) => {
      const v = el as HTMLVideoElement;
      return { readyState: v.readyState, videoWidth: v.videoWidth, paused: v.paused };
    });
    expect(media.readyState).toBeGreaterThanOrEqual(2);
    expect(media.videoWidth).toBeGreaterThan(0);
    expect(media.paused).toBe(false);

    // Wellness disclaimer must be visible on the analysis/capture screen.
    await expect(page.getByTestId('capture-disclaimer')).toBeVisible();

    // Step 4: screenshot the live preview as evidence.
    await page.screenshot({
      path: 'test-results/f026-front-capture-preview.png',
      fullPage: true,
    });

    expect(
      consoleErrors,
      `console errors: ${consoleErrors.join('\n')}`,
    ).toEqual([]);
  });
});
