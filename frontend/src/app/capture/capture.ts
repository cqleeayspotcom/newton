import {
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';

import { Router } from '@angular/router';

import { PoseEngine } from '../pose/pose-engine';
import { RateMeter } from '../pose/rate-meter';
import { AnalysisStore } from '../analysis/analysis-store';
import {
  computeMetrics,
  deriveFindings,
  type Finding,
  type PostureMetrics,
} from '../analysis/posture-metrics';

/** A `<video>` that may expose the (non-standard) rVFC capture hook. */
type RvfcVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: (now: number) => void) => number;
};

/** Lifecycle of the live camera preview shown in a wizard capture step. */
type CaptureState = 'requesting' | 'live' | 'denied' | 'error';

/**
 * F026 — wizard FRONT capture step.
 * Requests camera access on entry and streams the live preview into a <video>.
 * Later features attach pose inference (F034/F035) and the daemon loops on top.
 */
@Component({
  selector: 'nf-capture',
  standalone: true,
  templateUrl: './capture.html',
  styleUrl: './capture.scss',
})
export class Capture implements OnDestroy {
  private readonly videoRef =
    viewChild.required<ElementRef<HTMLVideoElement>>('video');
  private readonly overlayRef =
    viewChild.required<ElementRef<HTMLCanvasElement>>('overlay');

  private readonly poseEngine = inject(PoseEngine);
  private readonly router = inject(Router);
  private readonly store = inject(AnalysisStore);

  protected readonly state = signal<CaptureState>('requesting');
  protected readonly errorMessage = signal('');

  /** Live posture findings derived from the latest landmarks (metrics loop). */
  protected readonly liveFindings = signal<Finding[]>([]);
  protected readonly hasPerson = signal(false);
  private lastMetrics: PostureMetrics | null = null;

  /** F034 — MediaPipe model-loading lifecycle, surfaced to the template. */
  protected readonly poseState = this.poseEngine.state;
  protected readonly poseError = this.poseEngine.errorMessage;

  /**
   * F035 — number of landmarks detected in the latest frame (0 when no person
   * is in view). Sourced from the worker via the engine so the overlay can be
   * verified.
   */
  protected readonly landmarkCount = this.poseEngine.landmarkCount;

  /**
   * F195 — true once inference is confirmed running off the main thread in the
   * Web Worker. Surfaced as a debug hook (data-in-worker) for verification.
   */
  protected readonly inWorker = this.poseEngine.inWorker;

  /**
   * F196 — the perception pipeline runs as decoupled multi-rate loops:
   *   L1 Capture (~camera rate, rVFC)  → hands frames to the inference worker
   *   L2 Inference (worker, MediaPipe) → its rate is measured in the engine
   *   L4 Metrics  (~10Hz, self-timed)  → computes findings + publishes rates
   *   L5 Render   (rAF, ~display rate) → draws the overlay
   * Each loop is timed by its own {@link RateMeter}; the metrics loop samples all
   * four and publishes them to these signals for the live perf panel. Render
   * stays high even while inference runs slower — proving they are decoupled.
   */
  protected readonly captureHz = signal(0);
  protected readonly inferenceHz = signal(0);
  protected readonly metricsHz = signal(0);
  protected readonly renderHz = signal(0);

  private readonly captureMeter = new RateMeter();
  private readonly renderMeter = new RateMeter();
  private readonly metricsMeter = new RateMeter();

  private stream: MediaStream | null = null;
  private rafId = 0;
  private captureId = 0;
  private captureTimer: ReturnType<typeof setTimeout> | null = null;
  private metricsTimer: ReturnType<typeof setTimeout> | null = null;
  private lastTimestamp = -1;
  private destroyed = false;

  constructor() {
    // The <video> is always in the DOM, so the ref resolves before start().
    afterNextRender(() => void this.start());
  }

  private async start(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.state.set('error');
      this.errorMessage.set(
        'Camera API unavailable — a secure (HTTPS) context is required.',
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      this.stream = stream;

      const video = this.videoRef().nativeElement;
      video.srcObject = stream;
      // Autoplay is set in the template; play() covers stricter policies.
      await video.play().catch(() => undefined);
      this.state.set('live');

      // Once the preview is live, load the pose model (F034). Kept off the
      // camera-start critical path; failures surface via poseState/poseError
      // and never break the live preview.
      void this.poseEngine.load().catch(() => undefined);

      // F035/F196 — start the decoupled multi-rate pipeline (capture / render /
      // metrics loops). Each self-guards on the engine being ready + a decoded
      // frame, so it is safe to start now.
      this.startPipeline();
    } catch (err) {
      const name = (err as DOMException)?.name;
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        this.state.set('denied');
      } else {
        this.state.set('error');
        this.errorMessage.set(
          (err as Error)?.message ?? 'Could not start the camera.',
        );
      }
    }
  }

  /**
   * F196 — the decoupled multi-rate perception pipeline. Three loops run at
   * their own independent rates so slow inference never blocks rendering:
   *
   *  • L1 Capture — driven by `requestVideoFrameCallback` (one tick per decoded
   *    camera frame, ~30Hz; falls back to a ~30Hz timer). It hands frames to the
   *    inference worker; the engine drops frames while one is in flight, so the
   *    worker's own (lower) inference rate never stalls capture.
   *  • L5 Render — a `requestAnimationFrame` loop (~display rate) that only draws
   *    the latest skeleton the worker has returned. Cheap and never awaits
   *    inference, so it stays high regardless of the inference rate.
   *  • L4 Metrics — a ~10Hz self-timed loop, decoupled from render, that samples
   *    each loop's {@link RateMeter} and publishes the rates for the perf panel
   *    (later F199/F200 findings hang off this same loop).
   */
  private startPipeline(): void {
    const video = this.videoRef().nativeElement as RvfcVideo;
    const canvas = this.overlayRef().nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // L1 — Capture loop (camera-frame driven). Submits frames to the worker.
    const capture = () => {
      if (this.destroyed) return;
      if (video.readyState >= 2 && video.videoWidth > 0) {
        const ts = performance.now();
        if (ts > this.lastTimestamp) {
          this.lastTimestamp = ts;
          this.captureMeter.tick(ts);
          void this.poseEngine.submitFrame(video, ts);
        }
      }
      this.scheduleCapture(video, capture);
    };
    this.scheduleCapture(video, capture);

    // L5 — Render loop (rAF). Only draws the latest worker skeleton.
    const render = () => {
      if (this.destroyed) return;
      this.renderMeter.tick(performance.now());
      if (video.readyState >= 2 && video.videoWidth > 0) {
        if (canvas.width !== video.videoWidth) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
        this.drawSkeleton(ctx, canvas, this.poseEngine.landmarks());
      }
      this.rafId = requestAnimationFrame(render);
    };
    this.rafId = requestAnimationFrame(render);

    // L4 — Metrics loop (~10Hz). Decoupled from render; publishes the rates.
    const metrics = () => {
      if (this.destroyed) return;
      const now = performance.now();
      this.metricsMeter.tick(now);
      this.captureHz.set(round1(this.captureMeter.hzAt(now)));
      this.renderHz.set(round1(this.renderMeter.hzAt(now)));
      this.inferenceHz.set(round1(this.poseEngine.inferenceRate(now)));
      this.metricsHz.set(round1(this.metricsMeter.hzAt(now)));

      // Posture analysis: compute front-view metrics + findings from the latest
      // landmarks. Cheap, so it rides the ~10Hz metrics loop.
      const m = computeMetrics(this.poseEngine.landmarks());
      this.lastMetrics = m;
      this.liveFindings.set(deriveFindings(m));
      this.hasPerson.set(this.poseEngine.landmarkCount() > 0);

      this.metricsTimer = setTimeout(metrics, METRICS_INTERVAL_MS);
    };
    metrics();
  }

  /**
   * Schedule the next capture tick on the camera's frame cadence via
   * `requestVideoFrameCallback` (so capture tracks real ~30Hz camera frames),
   * falling back to a ~30Hz timer where rVFC is unavailable.
   */
  private scheduleCapture(video: RvfcVideo, cb: () => void): void {
    if (typeof video.requestVideoFrameCallback === 'function') {
      this.captureId = video.requestVideoFrameCallback(() => cb());
    } else {
      this.captureTimer = setTimeout(cb, CAPTURE_INTERVAL_MS);
    }
  }

  /** Clear the overlay and draw the skeleton for the given landmarks (if any). */
  private drawSkeleton(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    landmarks: { x: number; y: number; visibility?: number }[] | null,
  ): void {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!landmarks || landmarks.length === 0) return;

    const px = (n: number, size: number) => n * size;

    // Bones first, then joints on top.
    ctx.lineWidth = Math.max(2, canvas.width / 200);
    ctx.strokeStyle = '#38bdf8';
    for (const { start, end } of this.poseEngine.connections) {
      const a = landmarks[start];
      const b = landmarks[end];
      if (!a || !b) continue;
      ctx.beginPath();
      ctx.moveTo(px(a.x, canvas.width), px(a.y, canvas.height));
      ctx.lineTo(px(b.x, canvas.width), px(b.y, canvas.height));
      ctx.stroke();
    }

    const r = Math.max(3, canvas.width / 120);
    ctx.fillStyle = '#f97316';
    for (const lm of landmarks) {
      ctx.beginPath();
      ctx.arc(px(lm.x, canvas.width), px(lm.y, canvas.height), r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** Snapshot the current analysis and move to the insole recommendation. */
  protected analyze(): void {
    this.store.capture(
      this.lastMetrics ?? {
        shoulderTiltDeg: null,
        hipTiltDeg: null,
        headLeanDeg: null,
      },
    );
    void this.router.navigate(['/insole']);
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.captureTimer) clearTimeout(this.captureTimer);
    if (this.metricsTimer) clearTimeout(this.metricsTimer);
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }
}

/** L4 metrics loop target period (~10Hz). */
const METRICS_INTERVAL_MS = 100;
/** L1 capture fallback period when rVFC is unavailable (~30Hz). */
const CAPTURE_INTERVAL_MS = 33;

/** Round to one decimal for a stable, readable perf-panel reading. */
function round1(hz: number): number {
  return Math.round(hz * 10) / 10;
}
