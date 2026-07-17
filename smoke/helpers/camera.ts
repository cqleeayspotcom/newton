import * as path from 'path';

export type PostureView = 'front' | 'side' | 'back';

/**
 * Chromium launch args that feed the fake camera the y4m clip for a given view.
 * Use in a camera spec:
 *   test.use({ launchOptions: { args: fakeCameraArgs('side') } });
 */
export function fakeCameraArgs(view: PostureView): string[] {
  const video = path.resolve(__dirname, `../../tools/test_media/${view}.y4m`);
  return [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    `--use-file-for-fake-video-capture=${video}`,
  ];
}

/** Chromium launch args that DENY camera permission (for error-state tests). */
export function deniedCameraArgs(): string[] {
  return ['--use-fake-device-for-media-stream', '--deny-permission-prompts'];
}
