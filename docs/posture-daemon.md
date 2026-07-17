# Real-Time Posture Perception Daemon

**Priority feature set (F195–F203).** How Newfoot analyzes posture in real time,
and why a loop/daemon architecture analyzes *better* than one call per frame.

Reference approach: Pandey, "Perfecting Posture: How AI Is Making Us Stand Taller"
(Medium) — identify landmarks → calculate joint angles → compare to ideal ranges →
detect/flag, processed frame-by-frame with a temporal (LSTM) model for smoothing
and sequence recognition. Newfoot implements this as cooperating loops.

## Why single-shot (one frame → one angle) is not enough
- Landmark **jitter** (±3–8°) makes single-frame angles unstable.
- Transient movement causes **false positives**.
- Low-visibility landmarks (occluded feet, blur) yield **aberrant angles**.
- **Fixed thresholds** ignore morphology, camera tilt, and distance.
- No **feedback** to guide the user into a valid capture.

## Architecture: a perception daemon of multi-rate cooperating loops
Runs 100% client-side in **Web Workers** (privacy: video never leaves the device).
Loops are decoupled via ring buffers / message passing, each at its own rate.

```
 camera ~30Hz
   │
   ▼
 L1 Capture (requestVideoFrameCallback) ──► ring buffer
   │
   ▼
 L2 Inference (Worker, MediaPipe detectForVideo) ── 33 landmarks + visibility
   │
   ▼
 L3 Smoothing (One-Euro / Kalman per landmark, confidence-weighted) ── stable skeleton
   │
   ▼
 L4 Analysis (~5–10Hz): angles + sliding-window stats + persistence/hysteresis gate
   │                    + temporal sequence model (rolling stats → optional TF.js LSTM)
   ├──────────────► L5 Feedback/UI (~30Hz): overlay, reference ghost, coaching, quality meter
   └──────────────► L6 Calibration daemon (~0.1Hz): camera tilt, scale, per-user baseline
                         │  (only DERIVED metrics may leave device — never frames)
                         ▼
                    L7 Self-improvement daemon (offline): tune thresholds/filters
                    from aggregate metrics — driven by our run_loop. (F203 hook)
```

| Loop | Rate | Feature | Role |
|---|---|---|---|
| L1 Capture | ~30Hz | F196 | frames → buffer (rVFC) |
| L2 Inference | ~15–30Hz | F195 | MediaPipe in a Worker |
| L3 Smoothing | =L2 | F197, F198 | One-Euro + confidence weighting |
| L4 Analysis | ~5–10Hz | F199, F200 | angles, persistence gate, temporal model |
| L5 Feedback | ~30Hz | F201 | overlay, coaching, quality meter |
| L6 Calibration | ~0.1Hz | F202 | tilt/scale/baseline normalization |
| L7 Self-improve | offline | F203 | privacy-preserving tuning via run_loop |

## Why this analyzes better
1. **Temporal fusion / denoising (L3):** jitter is filtered out → stable, trustworthy
   angles, with One-Euro removing noise without perceptible lag.
2. **Persistence gating (L4):** a finding requires a sustained breach over a window
   → kills transient false positives. ↑ precision.
3. **Confidence weighting (L3):** occluded/low-visibility joints are attenuated or
   interpolated instead of producing garbage. ↑ robustness.
4. **Closed-loop human guidance (L5):** coaching drives the user into a valid capture
   (full body, still, correct distance) — the biggest real-world error source.
5. **Adaptive calibration (L6):** normalizes morphology, camera tilt, distance so a
   threshold means the same thing across setups. ↓ systematic error.
6. **Multi-rate decoupling:** heavy inference never blocks the 30fps overlay.
7. **Continuous self-improvement (L7):** heuristics improve over time from aggregate
   (privacy-preserving) metrics — the run_loop is the vehicle.

## In-browser implementation notes
- `requestVideoFrameCallback` (capture) + `requestAnimationFrame` (render) + a
  worker message loop (metrics, lower rate).
- MediaPipe `@mediapipe/tasks-vision` runs in a Web Worker; shared state via
  `SharedArrayBuffer`/ring buffer or `postMessage`.
- One-Euro filter (~40 lines) or 1D Kalman per angle; **hysteresis** (distinct
  enter/exit thresholds) for stable flags.
- Calibration: vertical reference from hip–shoulder–ankle line; scale from
  inter-shoulder pixel distance.
- The temporal model starts as rolling-window stats; upgrade path is a small
  TF.js LSTM over a landmark-angle sequence (the article's approach).
- Landmark-angle math is unit-tested against `tools/pose_fixtures/`; the synthetic
  fake-camera clips verify UI/daemon behavior but not real detection (drop a real
  human y4m to exercise the full pipeline).
