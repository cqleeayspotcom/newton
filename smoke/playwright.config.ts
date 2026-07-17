import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';

/**
 * Newfoot smoke / regression suite (§5.5).
 * Runs against the live dockerized frontend (default http://localhost:4200).
 *
 * Fake camera: Chromium is launched with the fake device + a default y4m so
 * camera-UI tests work headlessly. Camera tests that need a specific view
 * override the video file per-file with:
 *   test.use({ launchOptions: { args: fakeCameraArgs('side') } })
 * (see smoke/helpers/camera.ts).
 */
const BASE_URL = process.env.SMOKE_BASE_URL ?? 'http://localhost:4200';
const FRONT_VIDEO = path.resolve(__dirname, '../tools/test_media/front.y4m');

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  outputDir: 'test-results',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    launchOptions: {
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        `--use-file-for-fake-video-capture=${FRONT_VIDEO}`,
      ],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
