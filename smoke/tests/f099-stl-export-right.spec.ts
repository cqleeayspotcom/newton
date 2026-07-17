import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

/**
 * F099 — Download right insole (STL), mirrored from the left model.
 *
 * Drives the real demo path (scan → live findings → insole recommendation) so a
 * genuine InsoleSpec reaches the export buttons, then clicks "Download right
 * insole (STL)" and verifies:
 *  - a file download completes with an `.stl` extension and `right` in the filename,
 *  - the downloaded file is well over 10 KB,
 *  - it is a valid binary STL (byte length === 84 + 50 × triangle-count), and
 *  - the UI labels the right insole as mirrored from the left model.
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

test.describe('F099 — download right insole STL (mirrored)', () => {
  test('downloads a valid non-trivial binary STL named for the right side', async ({
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

    // 3) The UI must label the right insole as mirrored from the left model.
    const note = page.getByTestId('insole-export-note');
    await expect(note).toBeVisible();
    await expect(note).toContainText(/mirrored from the left model/i);

    // 4) Click the right STL download and capture the file.
    const btn = page.getByTestId('stl-download-right');
    await expect(btn).toBeVisible();
    await page.screenshot({
      path: path.resolve(
        __dirname,
        '../../logs/screens/f099-stl-download-right.png',
      ),
      fullPage: true,
    });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      btn.click(),
    ]);

    // Filename: .stl extension + labelled for the right side.
    const filename = download.suggestedFilename();
    expect(filename).toMatch(/\.stl$/i);
    expect(filename.toLowerCase()).toContain('right');

    // Save it and assert size + binary-STL structure.
    const outPath = path.resolve(
      __dirname,
      '../test-results/f099-insole-right.stl',
    );
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
