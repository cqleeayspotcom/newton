import { test, expect } from '@playwright/test';
import * as path from 'path';

/**
 * F090 / F091 / F092 — Interactive 3D insole viewer (Three.js).
 *
 * Drives the real demo path (scan → live findings → insole recommendation) with
 * the real-person clip so an actual InsoleSpec reaches the viewer, then verifies:
 *  - F090: the recommended insole renders as a WebGL <canvas> in the viewer,
 *  - F091: dragging the canvas rotates the model (orbit azimuth changes),
 *  - F092: scrolling zooms the model within limits (camera distance changes,
 *          stays inside OrbitControls min/max bounds).
 *
 * Orbit state is read from the viewer's `data-az` / `data-dist` test hooks
 * (written every animation frame by the component).
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

test.describe('F090/F091/F092 — interactive 3D insole viewer', () => {
  test('renders the insole in Three.js and supports orbit + zoom', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // 1) Run a real scan so findings → an InsoleSpec exist.
    await page.goto('/');
    await page.getByTestId('start-scan').click();
    await expect(page).toHaveURL(/\/scan\/front$/);
    await expect(page.getByTestId('pose-engine-status')).toHaveText(
      'Pose engine ready',
      { timeout: 45_000 },
    );
    await expect(page.getByTestId('landmark-count')).toHaveAttribute(
      'data-landmarks',
      '33',
      { timeout: 20_000 },
    );
    await expect(page.getByTestId('finding').first()).toBeVisible({
      timeout: 20_000,
    });

    // 2) Go to the insole recommendation.
    await page.getByTestId('get-insole').click();
    await expect(page).toHaveURL(/\/insole/);
    await expect(page.getByTestId('insole-spec')).toBeVisible();

    // F090 — the viewer mounts a real WebGL canvas with non-zero size.
    const viewer = page.getByTestId('insole-viewer');
    await expect(viewer).toBeVisible();
    const canvas = viewer.locator('canvas');
    await expect(canvas).toBeVisible({ timeout: 10_000 });
    const box = await canvas.boundingBox();
    expect(box, 'canvas has layout box').not.toBeNull();
    expect(box!.width, 'canvas width').toBeGreaterThan(50);
    expect(box!.height, 'canvas height').toBeGreaterThan(50);

    const isWebGL = await canvas.evaluate((el) => {
      const c = el as HTMLCanvasElement;
      return !!(c.getContext('webgl2') || c.getContext('webgl'));
    });
    expect(isWebGL, 'canvas backed by a WebGL context').toBe(true);

    // Wait for the render loop to publish initial orbit state.
    await expect(viewer).toHaveAttribute('data-dist', /\d/, { timeout: 10_000 });
    const az0 = Number(await viewer.getAttribute('data-az'));
    const dist0 = Number(await viewer.getAttribute('data-dist'));
    expect(Number.isFinite(az0)).toBe(true);
    expect(dist0).toBeGreaterThan(0);

    // Capture the clean, default-framed 3D model for the demo record.
    await page.screenshot({
      path: path.resolve(__dirname, '../../logs/screens/f090-insole-3d-viewer.png'),
      fullPage: true,
    });

    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;

    // F092 — scroll to zoom in; camera distance decreases but stays within limits.
    await page.mouse.move(cx, cy);
    await page.mouse.wheel(0, -600);
    await expect
      .poll(async () => Number(await viewer.getAttribute('data-dist')), {
        timeout: 5_000,
      })
      .toBeLessThan(dist0 - 1);
    const distZoom = Number(await viewer.getAttribute('data-dist'));
    expect(distZoom, 'zoom respects minDistance').toBeGreaterThanOrEqual(89);

    // F091 — drag horizontally to orbit; azimuth angle changes.
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 140, cy, { steps: 12 });
    await page.mouse.up();
    await expect
      .poll(async () => Math.abs(Number(await viewer.getAttribute('data-az')) - az0), {
        timeout: 5_000,
      })
      .toBeGreaterThan(0.1);

    // Disclaimer stays visible on the recommendation screen.
    await expect(page.locator('.nf-insole__disclaimer')).toContainText(
      /not medical advice/i,
    );

    expect(
      consoleErrors,
      `console errors: ${consoleErrors.join('\n')}`,
    ).toEqual([]);
  });
});
