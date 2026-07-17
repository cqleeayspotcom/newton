import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AnalysisStore } from '../analysis/analysis-store';
import { recommendInsole } from './insole-rules';
import { InsoleViewer } from './insole-viewer';

/**
 * Insole recommendation screen (POC demo slice). Reads the posture findings from
 * the AnalysisStore, takes a foot size, and shows a rule-based corrective insole
 * spec + print settings + rationale. Heuristic — not medical advice.
 */
@Component({
  selector: 'nf-insole',
  standalone: true,
  imports: [RouterLink, InsoleViewer],
  templateUrl: './insole.html',
  styleUrl: './insole.scss',
})
export class Insole {
  private readonly store = inject(AnalysisStore);

  protected readonly findings = this.store.findings;
  protected readonly hasAnalysis = this.store.hasAnalysis;

  protected readonly footSizeEu = signal(42);

  protected readonly spec = computed(() =>
    recommendInsole(this.footSizeEu(), this.findings()),
  );

  protected onSize(value: string): void {
    const n = Number(value);
    if (!Number.isNaN(n)) this.footSizeEu.set(Math.max(35, Math.min(48, n)));
  }
}
