# Pose-metric unit-test fixtures (Newfoot POC)

Golden fixtures for the not-yet-written angle-computation functions. Each fixture
encodes a BlazePose 33-landmark result plus the **expected metric angles** (degrees,
rounded to 1 decimal) that the documented formulas below MUST produce from those
exact coordinates. Formulas and thresholds mirror `docs/research.md` §2 (metrics
tables and threshold table §2.4).

## Fixture JSON schema

```jsonc
{
  "name": "front_neutral",
  "view": "front",                    // "front" | "side" | "back"
  "description": "…",
  "_math": ["…"],                     // human-readable arithmetic for each expected value
  "landmarks": [                      // 33 entries, MediaPipe normalized image coords
    { "x": 0.5, "y": 0.3, "z": 0, "visibility": 0.95 }, …
  ],
  "worldLandmarks": [                 // 33 entries, meters, origin at hip center
    { "x": 0.0, "y": -0.45, "z": -0.15 }, …
  ],
  "expected": { "<metricName>": 7.1, … },          // degrees, 1 decimal
  "expectedFindings": [                             // deficiencies the analyzer must flag
    { "metric": "shoulderTilt", "side": null,       // "left" | "right" | null
      "severity": "moderate" }                      // "none"|"mild"|"moderate"|"marked"
  ]
}
```

`manifest.json` lists every fixture (`file`, `view`, `expectedFindings` count) for
test discovery.

Only the landmarks used by the view's metrics are precise; the rest are plausible
filler (e.g. side-view `landmarks` are derived filler — side metrics read
`worldLandmarks` only). Filler visibility < 0.5 marks occluded points (face in
back view).

## Coordinate conventions (MediaPipe)

- **`landmarks` (image):** `x`,`y` normalized `0..1`; `x` grows right, **`y` grows
  DOWN**; `z` ~ same scale as `x`; `visibility` in `0..1`.
- **`worldLandmarks`:** meters, origin at hip center, same axis orientation
  (`y` DOWN — head has negative `y`).
- **FRONT view is mirrored:** subject faces the camera, so the subject's LEFT
  landmarks (odd-side indices 11, 23, 25, 27…) appear at **larger** image `x`.
- **BACK view is not mirrored:** subject's left = image left (smaller `x`).
- **SIDE view fixtures:** subject's left side toward camera, facing `-x`
  (anterior = `-x`). Metrics use `worldLandmarks`.

## Landmark indices used (BlazePose 33)

0 nose, 2/5 eyes, 7/8 ears, 11/12 shoulders, 23/24 hips, 25/26 knees,
27/28 ankles, 29/30 heels, 31/32 foot-index. (Full map: research.md §1.2.)

## Metric formulas (the contract)

All results in **degrees**: `deg(r) = r * 180/π`. `L[i]` = image landmark i,
`W[i]` = world landmark i. All metrics below are reported as non-negative
magnitudes except rearfoot eversion, which is signed (+ = everted).

### FRONT view (image landmarks)

| Metric | Formula |
|---|---|
| `shoulderTilt` | `deg(atan2(\|L[11].y − L[12].y\|, \|L[11].x − L[12].x\|))` — tilt of the shoulder line from horizontal |
| `pelvicTilt` | `deg(atan2(\|L[23].y − L[24].y\|, \|L[23].x − L[24].x\|))` |
| `headLateralLean` | `mid = ((L[11]+L[12])/2)`; `deg(atan2(\|L[0].x − mid.x\|, \|L[0].y − mid.y\|))` — mid-shoulder→nose vector vs vertical |
| `kneeFPPALeft` / `kneeFPPARight` | `u = hip − knee`, `v = ankle − knee` (left: 23,25,27; right: 24,26,28). `angleAtKnee = deg(atan2(\|u.x·v.y − u.y·v.x\|, u.x·v.x + u.y·v.y))`. **FPPA deviation = 180 − angleAtKnee** (0 = straight leg). Direction: **valgus** if the knee lies on the *medial* side of the hip→ankle line (medial = toward mid-hip `x`; for the left leg in the mirrored front view, medial = −x). |

### SIDE view (world landmarks; left side toward camera → indices 7, 11)

| Metric | Formula |
|---|---|
| `cva` (craniovertebral-angle proxy) | ear 7 (tragus proxy), shoulder 11 (C7 proxy): `deg(atan2(W[11].y − W[7].y, \|W[7].x − W[11].x\|))` — angle of ear→shoulder line above horizontal. `W[11].y − W[7].y > 0` because the ear is above the shoulder and y points down. **Lower = more forward head.** (If the right side faces the camera, use 8/12.) |
| `trunkFlexion` (thoracic slump) | `mS = (W[11]+W[12])/2`, `mH = (W[23]+W[24])/2`: `deg(atan2(\|mH.x − mS.x\|, \|mH.y − mS.y\|))` — shoulder→hip trunk vector vs vertical |

### BACK view (image landmarks)

| Metric | Formula |
|---|---|
| `shoulderTilt` | same as front: `deg(atan2(\|L[11].y − L[12].y\|, \|L[11].x − L[12].x\|))` |
| `spineDeviation` | `mS = (L[11]+L[12])/2`, `mH = (L[23]+L[24])/2`: `deg(atan2(\|mS.x − mH.x\|, \|mH.y − mS.y\|))` — mid-hip→mid-shoulder line vs vertical |
| `rearfootEversionLeft` | ankle 27, heel 29: `deg(atan2(L[27].x − L[29].x, L[29].y − L[27].y))` — signed angle of the heel→ankle (calcaneal-axis proxy) line from vertical. **Positive = ankle displaced MEDIAL of the heel = eversion/pronation.** In the unmirrored back view, medial for the left foot is +x. |
| `rearfootEversionRight` | ankle 28, heel 30: `deg(atan2(L[30].x − L[28].x, L[30].y − L[28].y))` — medial for the right foot is −x, hence the flipped operand order keeps positive = everted. |

## Severity thresholds (from research.md §2.4; 🟡 = POC heuristic)

| Metric | none | mild | moderate | marked |
|---|---|---|---|---|
| `shoulderTilt` | ≤ 3° | > 3° | > 5° | — |
| `pelvicTilt` | ≤ 6° | > 6° | — | — |
| `headLateralLean` 🟡 | ≤ 4° | > 4° | — | — |
| `kneeFPPA` (deviation) | ≤ 13° | > 13° (dynamic-valgus cut) | > 18° (Q-proxy cut) | — |
| `cva` (lower is worse) | ≥ 50° | < 50° | < 48° | < 44° |
| `trunkFlexion` 🟡 | ≤ 10° | > 10° | — | > 20° |
| `spineDeviation` 🟡 | ≤ 5° | > 5° | — | — |
| `rearfootEversion` | 0–8° (4–8° typical) | > 8° | > 12° 🟡 | — |

A fixture's `expectedFindings` contains one entry per metric that crosses its
"mild" threshold, at the highest severity band it reaches. Neutral fixtures have
an empty array.

## Fixtures

| File | View | Findings |
|---|---|---|
| `front_neutral.json` | front | none |
| `front_shoulder_tilt.json` | front | shoulderTilt 7.1° → moderate |
| `front_knee_valgus_left.json` | front | kneeFPPA left 16.7° → mild |
| `side_neutral.json` | side | none (CVA 55.0°) |
| `side_forward_head.json` | side | cva 45.0° → moderate; trunkFlexion 12.5° → mild |
| `back_neutral.json` | back | none (eversion 5.7° both, within 4–8° normal) |
| `back_overpronation_right.json` | back | rearfootEversion right 10.2° → mild |

Each fixture's `_math` array shows the exact arithmetic for every expected value.

## Test harness sketch

```js
for (const { file } of require("./manifest.json")) {
  const fx = require(`./${file}`);
  const metrics = computeMetrics(fx.view, fx.landmarks, fx.worldLandmarks);
  for (const [name, deg] of Object.entries(fx.expected))
    expect(metrics[name]).toBeCloseTo(deg, 1);   // 1-decimal tolerance
  expect(classifyFindings(metrics)).toEqual(fx.expectedFindings);
}
```
