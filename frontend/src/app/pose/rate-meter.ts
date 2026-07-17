/**
 * F196 — a tiny sliding-window rate meter used to measure the throughput of each
 * decoupled loop in the perception pipeline (capture, inference, metrics, render).
 *
 * It counts `tick()`s that fall inside a trailing window (default 1s) and reports
 * the observed frequency in Hz. Because old ticks age out of the window, the
 * reported rate decays toward 0 when a loop stalls — so a slow inference loop
 * genuinely reads lower than a fast render loop instead of reporting a stale peak.
 * No dependencies, ~30 lines (Karpathy ethos).
 */
export class RateMeter {
  private readonly ticks: number[] = [];

  constructor(private readonly windowMs = 1000) {}

  /** Record one loop iteration at `now` (a `performance.now()` timestamp). */
  tick(now: number): void {
    this.ticks.push(now);
    this.prune(now);
  }

  /** Observed frequency (Hz) over the trailing window as of `now`. */
  hzAt(now: number): number {
    this.prune(now);
    if (this.ticks.length < 2) return 0;
    const span = now - this.ticks[0];
    return span > 0 ? ((this.ticks.length - 1) / span) * 1000 : 0;
  }

  private prune(now: number): void {
    const cutoff = now - this.windowMs;
    while (this.ticks.length && this.ticks[0] < cutoff) this.ticks.shift();
  }
}
