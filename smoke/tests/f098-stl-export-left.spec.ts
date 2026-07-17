import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

/**
 * F098 — Download left insole (STL).
 *
 * Drives the real demo path (scan → live findings → insole recommendation) so a
 * genuine InsoleSpec reaches the export button, then clicks "Download left insole
 * (STL)" and verifies:
 *  - a file download completes with an `.stl` extension and `left` in the filename,
 *  - the downloaded file is well over 10 KB, and
 *  - it is a valid binary STL: byte length === 84 + 50 × (triangle count in the
 *    header), i.e. an 80-byte header + uint32 count + 50 bytes per triangle.
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

test.describe('F098 — download left insole STL', () => {
  test('downloads a valid non-trivial binary STL named for the left side', async ({
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

    // 3) Click the left STL download and capture the file.
    const btn = page.getByTestId('stl-download-left');
    await expect(btn).toBeVisible();
    await page.screenshot({
      path: path.resolve(__dirname, '../../logs/screens/f098-stl-download.png'),
      fullPage: true,
    });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      btn.click(),
    ]);

    // Filename: .stl extension + labelled for the left side.
    const filename = download.suggestedFilename();
    expect(filename).toMatch(/\.stl$/i);
    expect(filename.toLowerCase()).toContain('left');

    // Save it and assert size + binary-STL structure.
    const outPath = path.resolve(__dirname, '../test-results/f098-insole-left.stl');
    await download.saveAs(outPath);
    const buf = fs.readFileSync(outPath);
    expect(buf.byteLength, 'STL > 10 KB').toBeGreaterThan(10 * 1024);

    // Binary STL: 80-byte header, uint32 triangle count at offset 80, 50 B/triangle.
    const triangles = buf.readUInt32LE(80);
    expect(triangles, 'triangle count is present').toBeGreaterThan(100);
    expect(
      buf.byteLength,
      'byte length matches 84 + 50 × triangles (well-formed binary STL)',
    ).toBe(84 + 50 * triangles);

    expect(
      consoleErrors,
      `console errors: ${consoleErrors.join('\n')}`,
    ).toEqual([]);
  });
});
