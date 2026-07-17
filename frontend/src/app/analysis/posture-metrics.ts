/**
 * Front-view posture metrics from MediaPipe 2D landmarks.
 * Angles are computed as acute deviations (0–90°) so mirroring/orientation
 * never flips a sign. Thresholds follow docs/research.md (POC heuristics).
 */
export interface Landmark {
  x: number;
  y: number;
  visibility?: number;
}

export interface PostureMetrics {
  shoulderTiltDeg: number | null;
  hipTiltDeg: number | null;
  headLeanDeg: number | null;
}

export type Severity = 'normal' | 'mild' | 'moderate' | 'marked';

export interface Finding {
  key: string;
  label: string;
  valueDeg: number;
  threshold: number;
  severity: Severity;
  side: 'left' | 'right' | null;
  explanation: string;
}

// BlazePose 33-landmark indices used here.
const L_SHOULDER = 11;
const R_SHOULDER = 12;
const L_HIP = 23;
const R_HIP = 24;
const NOSE = 0;

const MIN_VIS = 0.4;

const vis = (lm?: Landmark) => (lm?.visibility ?? 1) >= MIN_VIS;

/** Acute tilt of the line a→b relative to horizontal, in degrees (0–90). */
function tiltFromHorizontal(a: Landmark, b: Landmark): number {
  const dx = Math.abs(b.x - a.x);
  const dy = Math.abs(b.y - a.y);
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

export function computeMetrics(landmarks: Landmark[] | null): PostureMetrics {
  const empty: PostureMetrics = {
    shoulderTiltDeg: null,
    hipTiltDeg: null,
    headLeanDeg: null,
  };
  if (!landmarks || landmarks.length < 33) return empty;

  const ls = landmarks[L_SHOULDER];
  const rs = landmarks[R_SHOULDER];
  const lh = landmarks[L_HIP];
  const rh = landmarks[R_HIP];
  const nose = landmarks[NOSE];

  const shoulderTiltDeg =
    vis(ls) && vis(rs) ? round1(tiltFromHorizontal(ls, rs)) : null;
  const hipTiltDeg = vis(lh) && vis(rh) ? round1(tiltFromHorizontal(lh, rh)) : null;

  let headLeanDeg: number | null = null;
  if (vis(nose) && vis(ls) && vis(rs)) {
    const midX = (ls.x + rs.x) / 2;
    const midY = (ls.y + rs.y) / 2;
    const dx = nose.x - midX;
    const dy = midY - nose.y; // up is positive
    headLeanDeg = round1(Math.abs((Math.atan2(dx, dy) * 180) / Math.PI));
  }

  return { shoulderTiltDeg, hipTiltDeg, headLeanDeg };
}

// Flag thresholds (deg) — POC heuristics from docs/research.md.
const TH = { shoulder: 3, hip: 6, head: 4 };

function severity(valueDeg: number, threshold: number): Severity {
  const past = valueDeg - threshold;
  if (past <= 0) return 'normal';
  if (past < 3) return 'mild';
  if (past < 7) return 'moderate';
  return 'marked';
}

export function deriveFindings(m: PostureMetrics): Finding[] {
  const out: Finding[] = [];
  const add = (
    key: string,
    label: string,
    value: number | null,
    threshold: number,
    explanation: string,
  ) => {
    if (value == null) return;
    const sev = severity(value, threshold);
    if (sev === 'normal') return;
    out.push({ key, label, valueDeg: value, threshold, severity: sev, side: null, explanation });
  };

  add(
    'shoulder_tilt',
    'Shoulder tilt',
    m.shoulderTiltDeg,
    TH.shoulder,
    'One shoulder sits higher than the other — often linked to uneven muscle tension or carrying loads on one side.',
  );
  add(
    'pelvic_tilt',
    'Pelvic tilt',
    m.hipTiltDeg,
    TH.hip,
    'The hips are not level, which can shift load through the knees and lower back.',
  );
  add(
    'head_lean',
    'Head lateral lean',
    m.headLeanDeg,
    TH.head,
    'The head leans to one side of the body midline — commonly related to screen position or posture habits.',
  );
  return out;
}

export const THRESHOLDS = TH;

/**
 * F071 — an "ideal posture" reference skeleton derived from the detected
 * landmarks. It keeps the user's own scale and vertical position (so it lines
 * up over their body) but corrects the posture: shoulders and hips are made
 * LEVEL, and the spine + head are made VERTICAL through the body midline. This
 * is what a dimmed "ghost" is drawn from, next to the real skeleton.
 */
export interface GhostSkeleton {
  leftShoulder: Landmark;
  rightShoulder: Landmark;
  leftHip: Landmark;
  rightHip: Landmark;
  /** Mid-shoulder point on the vertical midline (top of the spine). */
  neck: Landmark;
  /** Mid-hip point on the vertical midline (base of the spine). */
  pelvis: Landmark;
  /** Head, centered directly above the neck (no lateral lean). */
  nose: Landmark;
}

/**
 * Build the ideal-posture ghost from raw landmarks. Returns null when the
 * shoulders/hips are not confidently visible (nothing sensible to anchor to).
 */
export function buildReferenceGhost(
  landmarks: Landmark[] | null,
): GhostSkeleton | null {
  if (!landmarks || landmarks.length < 33) return null;

  const ls = landmarks[L_SHOULDER];
  const rs = landmarks[R_SHOULDER];
  const lh = landmarks[L_HIP];
  const rh = landmarks[R_HIP];
  const nose = landmarks[NOSE];
  if (!(vis(ls) && vis(rs) && vis(lh) && vis(rh))) return null;

  // Anchor to the user's own shoulder/hip midline + keep their vertical spans.
  const msX = (ls.x + rs.x) / 2;
  const msY = (ls.y + rs.y) / 2;
  const mhX = (lh.x + rh.x) / 2;
  const mhY = (lh.y + rh.y) / 2;
  const midX = (msX + mhX) / 2; // one vertical body midline

  const shoulderHalf = Math.abs(ls.x - rs.x) / 2;
  const hipHalf = Math.abs(lh.x - rh.x) / 2;

  // Keep the head's height but center it (no lean); fall back above the neck.
  const noseY = vis(nose) ? nose.y : msY - (mhY - msY) * 0.4;

  return {
    leftShoulder: { x: midX - shoulderHalf, y: msY },
    rightShoulder: { x: midX + shoulderHalf, y: msY },
    leftHip: { x: midX - hipHalf, y: mhY },
    rightHip: { x: midX + hipHalf, y: mhY },
    neck: { x: midX, y: msY },
    pelvis: { x: midX, y: mhY },
    nose: { x: midX, y: noseY },
  };
}

/** Bone segments (as point pairs) that make up the ghost stick figure. */
export function ghostSegments(g: GhostSkeleton): [Landmark, Landmark][] {
  return [
    [g.leftShoulder, g.rightShoulder], // level shoulder line
    [g.leftHip, g.rightHip], // level hip line
    [g.neck, g.pelvis], // vertical spine
    [g.neck, g.nose], // vertical neck + head
    [g.leftShoulder, g.leftHip], // torso sides
    [g.rightShoulder, g.rightHip],
  ];
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
