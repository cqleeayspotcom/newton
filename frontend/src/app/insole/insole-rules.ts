import type { Finding } from '../analysis/posture-metrics';

/**
 * Simplified client-side insole rule engine for the POC demo slice
 * (heuristic — see docs/insole-rules.md). Maps foot size + posture findings to a
 * recommended insole spec + print settings, with a plain-language rationale.
 */
export interface InsoleSpec {
  footSizeEu: number;
  lengthMm: number;
  widthMm: number;
  archHeightMm: number;
  heelWedgeDeg: number;
  heelWedgeSide: 'none' | 'medial' | 'lateral';
  heelCupDepthMm: number;
  stiffness: 'soft' | 'medium' | 'firm';
  material: string;
  infillPct: number;
  layerHeightMm: number;
  printOrientation: string;
  rationale: string[];
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function recommendInsole(footSizeEu: number, findings: Finding[]): InsoleSpec {
  const footLen = Math.round((footSizeEu * 20) / 3 - 10);
  const lengthMm = footLen + 5;
  const widthMm = Math.round(0.37 * lengthMm);

  // Neutral baseline.
  let archHeightMm = 3;
  let heelWedgeDeg = 0;
  let heelWedgeSide: InsoleSpec['heelWedgeSide'] = 'none';
  let heelCupDepthMm = 3;
  let stiffness: InsoleSpec['stiffness'] = 'medium';
  const rationale: string[] = [];

  const pelvic = findings.find((f) => f.key === 'pelvic_tilt');
  if (pelvic) {
    const bump = pelvic.severity === 'marked' ? 6 : pelvic.severity === 'moderate' ? 4 : 2;
    heelWedgeDeg = clamp(bump, 0, 8);
    heelWedgeSide = 'medial';
    archHeightMm = clamp(archHeightMm + 3, 0, 12);
    heelCupDepthMm = clamp(heelCupDepthMm + 1, 2, 8);
    stiffness = 'firm';
    rationale.push(
      `Pelvic tilt (${pelvic.valueDeg}°, ${pelvic.severity}) → ${heelWedgeDeg}° medial heel posting + raised arch to help level the pelvis.`,
    );
  }

  const shoulder = findings.find((f) => f.key === 'shoulder_tilt');
  if (shoulder) {
    rationale.push(
      `Shoulder tilt (${shoulder.valueDeg}°) is postural — the insole gives balanced, symmetric support; pair it with the corrective exercises in your plan.`,
    );
  }

  const head = findings.find((f) => f.key === 'head_lean');
  if (head) {
    rationale.push(
      `Head lean (${head.valueDeg}°) is addressed by posture cues, not insole geometry — noted for your report.`,
    );
  }

  if (rationale.length === 0) {
    rationale.push(
      'No significant deviations in this view → a neutral comfort/cushioning insole, sized to your foot.',
    );
  }

  const infillPct: number = stiffness === 'firm' ? 30 : 20;

  return {
    footSizeEu,
    lengthMm,
    widthMm,
    archHeightMm,
    heelWedgeDeg,
    heelWedgeSide,
    heelCupDepthMm,
    stiffness,
    material: 'TPU 95A (flexible, cushioning)',
    infillPct,
    layerHeightMm: 0.2,
    printOrientation: 'Flat, footbed down',
    rationale,
  };
}
