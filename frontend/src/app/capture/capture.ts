import {
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';

import { PoseEngine } from '../pose/pose-engine';

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

  protected readonly state = signal<CaptureState>('requesting');
  protected readonly errorMessage = signal('');

  /** F034 — MediaPipe model-loading lifecycle, surfaced to the template. */
  protected readonly poseState = this.poseEngine.state;
  protected readonly poseError = this.poseEngine.errorMessage;

  /**
   * F035 — number of landmarks detected in the latest frame (0 when no person
   * is in view). Surfaced as a debug hook so the overlay can be verified.
   */
  protected readonly landmarkCount = signal(0);

  private stream: MediaStream | null = null;
  private rafId = 0;
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

      // F035 — start the per-frame skeleton overlay loop. It self-guards on the
      // engine being ready + a decoded frame, so it is safe to start now.
      this.startDetectLoop();
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
   * F035 — requestAnimationFrame loop: detect the pose on each new video frame
   * and draw a 33-landmark skeleton (bones + joints) onto the overlay canvas.
   * The canvas mirrors the video's intrinsic resolution + cover crop so the
   * skeleton lines up with the mirrored preview.
   */
  private startDetectLoop(): void {
    const video = this.videoRef().nativeElement;
    const canvas = this.overlayRef().nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const loop = () => {
      if (this.destroyed) return;

      if (this.poseEngine.ready && video.readyState >= 2 && video.videoWidth > 0) {
        if (canvas.width !== video.videoWidth) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }

        // detectForVideo requires a strictly increasing timestamp.
        const ts = performance.now();
        if (ts > this.lastTimestamp) {
          this.lastTimestamp = ts;
          let landmarks: { x: number; y: number; visibility?: number }[] | null =
            null;
          try {
            const result = this.poseEngine.detect(video, ts);
            landmarks = result?.landmarks?.[0] ?? null;
          } catch {
            landmarks = null;
          }
          this.drawSkeleton(ctx, canvas, landmarks);
          this.landmarkCount.set(landmarks ? landmarks.length : 0);
        }
      }

      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
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

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }
}
