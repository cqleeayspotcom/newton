import {
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  signal,
  viewChild,
} from '@angular/core';

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

  protected readonly state = signal<CaptureState>('requesting');
  protected readonly errorMessage = signal('');

  private stream: MediaStream | null = null;

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

  ngOnDestroy(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }
}
