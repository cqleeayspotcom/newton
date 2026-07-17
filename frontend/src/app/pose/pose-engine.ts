import { Injectable, signal } from '@angular/core';
import {
  FilesetResolver,
  PoseLandmarker,
  type PoseLandmarkerResult,
} from '@mediapipe/tasks-vision';

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
 * F034 — loads the MediaPipe Pose Landmarker client-side with an observable
 * loading state before detection starts. F035+ use `detect()` for the live
 * skeleton overlay and the daemon loops build on top.
 */
@Injectable({ providedIn: 'root' })
export class PoseEngine {
  /** Observable model-loading lifecycle for the UI. */
  readonly state = signal<PoseEngineState>('idle');
  readonly errorMessage = signal('');
  /** Which inference delegate actually loaded ('GPU' or 'CPU'). */
  readonly delegate = signal<'GPU' | 'CPU' | null>(null);

  private landmarker: PoseLandmarker | null = null;
  private loadPromise: Promise<PoseLandmarker> | null = null;

  /**
   * Idempotently initialise the landmarker. Multiple callers share one load;
   * the returned promise resolves to the ready landmarker (or rejects on error).
   */
  async load(): Promise<PoseLandmarker> {
    if (this.landmarker) return this.landmarker;
    if (this.loadPromise) return this.loadPromise;

    this.state.set('loading');
    this.errorMessage.set('');

    this.loadPromise = (async () => {
      const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
      const create = (delegate: 'GPU' | 'CPU') =>
        PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_PATH, delegate },
          runningMode: 'VIDEO',
          numPoses: 1,
        });

      // Prefer the GPU (WebGL) delegate; fall back to CPU on machines/headless
      // browsers without a usable WebGL2 context so the engine still loads.
      let landmarker: PoseLandmarker;
      try {
        landmarker = await create('GPU');
        this.delegate.set('GPU');
      } catch {
        landmarker = await create('CPU');
        this.delegate.set('CPU');
      }
      this.landmarker = landmarker;
      this.state.set('ready');
      return landmarker;
    })();

    try {
      return await this.loadPromise;
    } catch (err) {
      this.state.set('error');
      this.errorMessage.set(
        (err as Error)?.message ?? 'Failed to load the pose model.',
      );
      this.loadPromise = null;
      throw err;
    }
  }

  /**
   * Run pose detection on the current video frame. Returns null until the model
   * is ready. Used by F035 (skeleton overlay) and the daemon loops.
   */
  detect(video: HTMLVideoElement, timestampMs: number): PoseLandmarkerResult | null {
    if (!this.landmarker) return null;
    return this.landmarker.detectForVideo(video, timestampMs);
  }

  get ready(): boolean {
    return this.landmarker !== null;
  }

  /**
   * The BlazePose 33-landmark skeleton topology (pairs of landmark indices that
   * form a bone). Used by F035 to draw connecting lines over the live preview.
   */
  readonly connections: ReadonlyArray<{ start: number; end: number }> =
    PoseLandmarker.POSE_CONNECTIONS;
}
