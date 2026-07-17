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

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
