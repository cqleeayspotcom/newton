import { test, expect } from '@playwright/test';
import * as path from 'path';

// Full demo slice: scan → live findings → insole recommendation.
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

test('scan → findings → insole recommendation', async ({ page }) => {
  await page.goto('/scan/front');
  await expect(page.getByTestId('pose-engine-status')).toHaveText(/ready/i, {
    timeout: 25000,
  });
  await expect(page.getByTestId('landmark-count')).toContainText(/landmarks/i, {
    timeout: 25000,
  });
  // let the ~10Hz metrics loop compute findings
  await page.waitForTimeout(2500);
  await expect(page.getByTestId('findings')).toBeVisible();
  await page.screenshot({ path: 'test-results/demo-scan-findings.png', fullPage: true });

  await page.getByTestId('get-insole').click();
  await expect(page).toHaveURL(/\/insole/);
  await expect(page.getByTestId('insole-spec')).toBeVisible();
  await page.screenshot({ path: 'test-results/demo-insole.png', fullPage: true });
});
