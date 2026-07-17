# Fake-camera test media

These `.y4m` clips feed Chromium's fake camera during browser automation:

```
--use-fake-ui-for-media-stream        # auto-grant getUserMedia
--use-fake-device-for-media-stream    # use a fake camera
--use-file-for-fake-video-capture=<abs path>/front.y4m
```

- `front.y4m`, `side.y4m`, `back.y4m` — 320×240, I420, 12 looping frames each.
- Regenerate with: `node tools/test_media/gen_y4m.js`

## Important limitation

These are **synthetic patterns, not real humans**. They make the camera UI and
`<video>` playback work in automation, but MediaPipe Pose Landmarker will **not**
detect body landmarks in them. Two consequences:

1. Camera-UI / preview / permission features verify fine against these clips.
2. Features that need real detected landmarks (skeleton overlay, angle metrics,
   deficiency report) are verified two ways:
   - **Deterministic unit tests** over `tools/pose_fixtures/` (the source of
     truth for angle math), and
   - Optionally, by dropping a **real royalty-free human posture clip** (front/
     side/back) here — converted to I420 y4m with the same filenames — to drive
     the full in-browser pipeline. Document any such clip's license.
