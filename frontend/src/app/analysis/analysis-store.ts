import { Injectable, signal, computed } from '@angular/core';
import { deriveFindings, type Finding, type PostureMetrics } from './posture-metrics';

/**
 * Shares the captured posture analysis between the scan and the insole screens
 * (no backend needed for the POC demo slice).
 */
@Injectable({ providedIn: 'root' })
export class AnalysisStore {
  readonly metrics = signal<PostureMetrics | null>(null);
  readonly findings = computed<Finding[]>(() =>
    this.metrics() ? deriveFindings(this.metrics()!) : [],
  );
  readonly hasAnalysis = computed(() => this.metrics() !== null);

  capture(m: PostureMetrics): void {
    this.metrics.set(m);
  }

  reset(): void {
    this.metrics.set(null);
  }
}
