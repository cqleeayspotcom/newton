import { describe, expect, it } from 'vitest';

import { buildReferenceGhost, ghostSegments, type Landmark } from './posture-metrics';

/**
 * A 33-landmark set mirroring tools/pose_fixtures/front_shoulder_tilt.json:
 * tilted shoulders (a real posture finding) so we can prove the ghost corrects
 * it to LEVEL + VERTICAL. Only the indices the ghost reads need real values.
 */
function tiltedShoulderPose(): Landmark[] {
  const lm: Landmark[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    visibility: 0.95,
  }));
  lm[0] = { x: 0.5, y: 0.18, visibility: 0.95 }; // nose
  lm[11] = { x: 0.62, y: 0.29, visibility: 0.95 }; // left shoulder (higher)
  lm[12] = { x: 0.38, y: 0.32, visibility: 0.95 }; // right shoulder (lower)
  lm[23] = { x: 0.58, y: 0.55, visibility: 0.95 }; // left hip
  lm[24] = { x: 0.42, y: 0.55, visibility: 0.95 }; // right hip
  return lm;
}

describe('F071 — buildReferenceGhost (ideal-posture reference)', () => {
  it('returns null without a full 33-landmark set', () => {
    expect(buildReferenceGhost(null)).toBeNull();
    expect(buildReferenceGhost(tiltedShoulderPose().slice(0, 10))).toBeNull();
  });

  it('returns null when shoulders/hips are not confidently visible', () => {
    const lm = tiltedShoulderPose();
    lm[11] = { x: 0.62, y: 0.29, visibility: 0.1 };
    expect(buildReferenceGhost(lm)).toBeNull();
  });

  it('produces LEVEL shoulders even from a tilted detection', () => {
    const g = buildReferenceGhost(tiltedShoulderPose());
    expect(g).not.toBeNull();
    expect(g!.leftShoulder.y).toBeCloseTo(g!.rightShoulder.y, 6);
  });

  it('produces LEVEL hips', () => {
    const g = buildReferenceGhost(tiltedShoulderPose())!;
    expect(g.leftHip.y).toBeCloseTo(g.rightHip.y, 6);
  });

  it('produces a VERTICAL spine + centered head (no lateral lean)', () => {
    const g = buildReferenceGhost(tiltedShoulderPose())!;
    expect(g.neck.x).toBeCloseTo(g.pelvis.x, 6);
    expect(g.nose.x).toBeCloseTo(g.neck.x, 6);
  });

  it('keeps the user scale + vertical span (anchored to their body)', () => {
    const g = buildReferenceGhost(tiltedShoulderPose())!;
    expect(g.neck.y).toBeLessThan(g.pelvis.y);
    expect(g.nose.y).toBeLessThan(g.neck.y);
    expect(g.rightShoulder.x - g.leftShoulder.x).toBeGreaterThan(0.1);
  });

  it('exposes six stick-figure bone segments to draw', () => {
    const g = buildReferenceGhost(tiltedShoulderPose())!;
    expect(ghostSegments(g)).toHaveLength(6);
  });
});
