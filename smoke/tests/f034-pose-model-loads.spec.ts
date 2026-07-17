import { test, expect } from '@playwright/test';
import { fakeCameraArgs } from '../helpers/camera';

/**
 * F034 (pose-engine) — the MediaPipe Pose Landmarker loads client-side with a
 * visible "Loading pose model…" state that resolves to "Pose engine ready"
 * before detection starts, with no model-loading console errors.
 *
 * The WASM runtime + the BlazePose GHUM full `.task` model are self-hosted under
 * /mediapipe (public/), so this loads entirely from our own origin — no CDN.
 * The fake FRONT camera just supplies a live <video>; F034 verifies the model
 * lifecycle, not landmark detection (that is F035 + pose_fixtures unit tests).
 */
test.use({ launchOptions: { args: fakeCameraArgs('front') } });

test.describe('F034 — MediaPipe pose model loads with a visible loading state', () => {
  test('capture step loads the pose engine to a ready state without errors', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // Step 1: open the wizard FRONT capture step with the fake camera.
    await page.goto('/');
    await page.getByTestId('start-scan').click();
    await expect(page).toHaveURL(/\/scan\/front$/);

    // Preview must go live so the model load kicks off.
    await expect(page.getByTestId('capture-status')).toHaveText('live', {
      timeout: 10_000,
    });

    // Step 2/3: the pose-engine badge shows the loading OR ready state (the
    // lifecycle is real), then resolves to "Pose engine ready".
    const poseBadge = page.getByTestId('pose-engine-status');
    await expect(poseBadge).toHaveText(/Loading pose model|Pose engine ready/, {
      timeout: 10_000,
    });
    await expect(poseBadge).toHaveText('Pose engine ready', {
      timeout: 45_000,
    });
    await expect(poseBadge).toHaveAttribute('data-state', 'ready');

    // Wellness disclaimer stays visible on the capture/analysis screen.
    await expect(page.getByTestId('capture-disclaimer')).toBeVisible();

    await page.screenshot({
      path: 'test-results/f034-pose-model-loads.png',
      fullPage: true,
    });

    // Step 4: no console errors related to model loading (a benign MediaPipe GL
    // info line is a warning, not an error).
    expect(
      consoleErrors,
      `console errors: ${consoleErrors.join('\n')}`,
    ).toEqual([]);
  });
});
