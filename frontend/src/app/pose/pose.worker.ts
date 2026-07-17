/// <reference lib="webworker" />
import {
  FilesetResolver,
  PoseLandmarker,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision';

/**
 * F195 — pose inference runs here, in a dedicated Web Worker, so the heavy
 * MediaPipe `detectForVideo` call never blocks the main thread (the UI +
 * skeleton overlay stay smooth). The main thread grabs each camera frame as an
 * `ImageBitmap` and transfers it in; this worker runs inference and posts the
 * landmarks back. This is the first of the F195–F203 daemon loops.
 */

type InboundMessage =
  | { type: 'init'; wasmPath: string; modelPath: string }
  | {
      type: 'detect';
      bitmap: ImageBitmap;
      timestampMs: number;
      frameId: number;
    };

export type WorkerLandmark = Pick<NormalizedLandmark, 'x' | 'y'> & {
  visibility?: number;
};

type OutboundMessage =
  | { type: 'ready'; delegate: 'GPU' | 'CPU' }
  | { type: 'error'; message: string }
  | {
      type: 'result';
      landmarks: WorkerLandmark[] | null;
      landmarkCount: number;
      frameId: number;
    };

const ctx = self as unknown as DedicatedWorkerGlobalScope;
let landmarker: PoseLandmarker | null = null;

const post = (msg: OutboundMessage) => ctx.postMessage(msg);

ctx.onmessage = async (event: MessageEvent<InboundMessage>) => {
  const msg = event.data;

  if (msg.type === 'init') {
    try {
      // `useModule: true` selects the ESM WASM glue (vision_wasm_module_internal.js).
      // Angular bundles this file as an ES *module* worker, in which the classic
      // `importScripts` loader is unavailable and the non-module glue never sets
      // `self.ModuleFactory` ("ModuleFactory not set"). The module variant loads
      // via dynamic import() and registers correctly.
      const fileset = await FilesetResolver.forVisionTasks(msg.wasmPath, true);
      const create = (delegate: 'GPU' | 'CPU') =>
        PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: msg.modelPath, delegate },
          runningMode: 'VIDEO',
          numPoses: 1,
        });

      // Prefer the GPU (WebGL) delegate; fall back to CPU where a worker has no
      // usable WebGL2 context so inference still runs off the main thread.
      try {
        landmarker = await create('GPU');
        post({ type: 'ready', delegate: 'GPU' });
      } catch {
        landmarker = await create('CPU');
        post({ type: 'ready', delegate: 'CPU' });
      }
    } catch (err) {
      post({
        type: 'error',
        message: (err as Error)?.message ?? 'Failed to load the pose model.',
      });
    }
    return;
  }

  if (msg.type === 'detect') {
    if (!landmarker) {
      msg.bitmap.close();
      return;
    }
    try {
      const result = landmarker.detectForVideo(msg.bitmap, msg.timestampMs);
      const landmarks = result?.landmarks?.[0] ?? null;
      post({
        type: 'result',
        landmarks: landmarks
          ? landmarks.map((l) => ({ x: l.x, y: l.y, visibility: l.visibility }))
          : null,
        landmarkCount: landmarks ? landmarks.length : 0,
        frameId: msg.frameId,
      });
    } catch {
      post({ type: 'result', landmarks: null, landmarkCount: 0, frameId: msg.frameId });
    } finally {
      // Free the transferred frame; the main thread cannot reuse it.
      msg.bitmap.close();
    }
  }
};
