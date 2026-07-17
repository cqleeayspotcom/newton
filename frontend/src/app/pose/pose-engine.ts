import { Injectable, signal } from '@angular/core';
import { PoseLandmarker } from '@mediapipe/tasks-vision';

import { RateMeter } from './rate-meter';
import type { WorkerLandmark } from './pose.worker';

/** Lifecycle of the client-side MediaPipe pose model. */
export type PoseEngineState = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Self-hosted MediaPipe asset paths (see frontend/public/mediapipe). The WASM
 * runtime + the BlazePose GHUM "full" `.task` model are bundled so the engine
 * loads entirely from our own origin — no CDN dependency at demo time
 * (docs/research.md §1.2, ADR pending).
 */
const WASM_PATH = '/mediapipe/wasm';
const MODEL_PATH = '/mediapipe/models/pose_landmarker_full.task';

/**
 * F034/F035/F195 — client-side MediaPipe Pose Landmarker.
 *
 * F195: inference runs OFF the main thread in a dedicated Web Worker
 * (`pose.worker.ts`). The UI grabs each camera frame as an `ImageBitmap` via
 * {@link submitFrame} and transfers it to the worker; the worker runs the heavy
 * `detectForVideo` call and posts landmarks back, which land in the
 * {@link landmarks} signal. The main thread never blocks on inference, so the
 * live preview + skeleton overlay stay smooth. This is the first of the
 * F195–F203 daemon loops.
 */
@Injectable({ providedIn: 'root' })
export class PoseEngine {
  /** Observable model-loading lifecycle for the UI. */
  readonly state = signal<PoseEngineState>('idle');
  readonly errorMessage = signal('');
  /** Which inference delegate actually loaded ('GPU' or 'CPU'). */
  readonly delegate = signal<'GPU' | 'CPU' | null>(null);

  /** F195 — true once inference is confirmed running in the Web Worker. */
  readonly inWorker = signal(false);

  /** Latest landmarks posted back by the worker (null when no person). */
  readonly landmarks = signal<WorkerLandmark[] | null>(null);
  /** Landmark count of the latest frame (0 when no person is in view). */
  readonly landmarkCount = signal(0);

  /**
   * F196 — measures the inference loop's throughput. Ticked every time the
   * worker posts a detection result back, so the perf panel can show the real
   * (lower) inference rate versus the fast render rate — proving the loops are
   * decoupled and slow inference never throttles rendering.
   */
  private readonly inferenceMeter = new RateMeter();

  private worker: Worker | null = null;
  private loadPromise: Promise<void> | null = null;
  private readyResolve: (() => void) | null = null;
  private readyReject: ((err: Error) => void) | null = null;

  /** Backpressure: only one frame in flight at a time (drop, don't queue). */
  private busy = false;
  private frameId = 0;

  /**
   * Idempotently spin up the inference worker and load the model inside it.
   * Multiple callers share one load; the returned promise resolves once the
   * worker reports ready (or rejects on error).
   */
  async load(): Promise<void> {
    if (this.worker && this.state() === 'ready') return;
    if (this.loadPromise) return this.loadPromise;

    this.state.set('loading');
    this.errorMessage.set('');

    this.loadPromise = new Promise<void>((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;

      // Angular's esbuild builder bundles this worker from the `new URL(...)`.
      const worker = new Worker(new URL('./pose.worker', import.meta.url));
      worker.onmessage = (e) => this.onWorkerMessage(e.data);
      worker.onerror = (e) => {
        this.state.set('error');
        this.errorMessage.set(e.message || 'Pose worker crashed.');
        this.readyReject?.(new Error(e.message));
      };
      this.worker = worker;

      // Assets are served from our origin; the worker needs absolute URLs.
      const origin = self.location.origin;
      worker.postMessage({
        type: 'init',
        wasmPath: origin + WASM_PATH,
        modelPath: origin + MODEL_PATH,
      });
    });

    try {
      await this.loadPromise;
    } catch (err) {
      this.loadPromise = null;
      throw err;
    }
  }

  private onWorkerMessage(
    msg:
      | { type: 'ready'; delegate: 'GPU' | 'CPU' }
      | { type: 'error'; message: string }
      | {
          type: 'result';
          landmarks: WorkerLandmark[] | null;
          landmarkCount: number;
          frameId: number;
        },
  ): void {
    switch (msg.type) {
      case 'ready':
        this.delegate.set(msg.delegate);
        this.inWorker.set(true);
        this.state.set('ready');
        this.readyResolve?.();
        break;
      case 'error':
        this.state.set('error');
        this.errorMessage.set(msg.message);
        this.readyReject?.(new Error(msg.message));
        break;
      case 'result':
        this.inferenceMeter.tick(performance.now());
        this.landmarks.set(msg.landmarks);
        this.landmarkCount.set(msg.landmarkCount);
        this.busy = false;
        break;
    }
  }

  /**
   * F195 — grab the current video frame as an `ImageBitmap` and hand it to the
   * worker for inference. Cheap on the main thread (a GPU copy); the expensive
   * detection runs in the worker. Frames are dropped while one is in flight so
   * the pipeline never backs up. Results arrive asynchronously in
   * {@link landmarks} / {@link landmarkCount}.
   */
  async submitFrame(video: HTMLVideoElement, timestampMs: number): Promise<void> {
    if (!this.worker || this.state() !== 'ready' || this.busy) return;
    this.busy = true;
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(video);
    } catch {
      this.busy = false;
      return;
    }
    this.frameId += 1;
    this.worker.postMessage(
      { type: 'detect', bitmap, timestampMs, frameId: this.frameId },
      [bitmap],
    );
  }

  get ready(): boolean {
    return this.worker !== null && this.state() === 'ready';
  }

  /**
   * F196 — the inference loop's current throughput (Hz) as of `now`. Reads the
   * sliding-window meter that is ticked on each worker result, so it decays to 0
   * when detection stalls. The metrics loop samples this for the perf panel.
   */
  inferenceRate(now: number): number {
    return this.inferenceMeter.hzAt(now);
  }

  /**
   * The BlazePose 33-landmark skeleton topology (pairs of landmark indices that
   * form a bone). A plain static constant — no WASM — so it is safe to read on
   * the main thread for drawing the overlay (F035).
   */
  readonly connections: ReadonlyArray<{ start: number; end: number }> =
    PoseLandmarker.POSE_CONNECTIONS;
}
