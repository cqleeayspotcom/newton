# Newfoot — Insole Rule Engine Specification

**Project:** Newfoot — posture findings + foot size → corrective insole parameters (LEFT + RIGHT independently).
**Date:** 2026-07-17
**Upstream:** `docs/research.md` (posture metrics §2, thresholds §2.4, filament materials §3). Finding IDs below map 1:1 to threshold-table rows in research.md §2.4.
**Status:** Source of truth for the backend rule engine. Deterministic, unit-testable. No randomness, no ML — pure table lookup + additive deltas + clamping.

> ## 🟡 POC HEURISTIC DEFAULTS — read this first
> Every **delta magnitude** in §3, the **severity bands** in §1.2, and the **geometry formulas** in §1.3 are POC heuristics chosen for plausibility and demo value, **not clinical prescriptions**. The *structure* (which finding maps to which parameter, and the direction of each correction) follows standard orthotic conventions (e.g. overpronation → medial posting + arch support); the *numbers* are tunable constants. Implement every number in this file as named config constants, not inline literals. See §5 for the safety note.

---

## 1. Inputs

### 1.1 Posture findings

The rule engine consumes a list of `Finding` objects produced by the posture-analysis layer (which applies the thresholds of research.md §2.4 to the measured angles):

```ts
type Side = "left" | "right";
type Severity = "mild" | "moderate" | "marked";

interface Finding {
  id: FindingId;        // enumerated below
  severity: Severity;   // derived from excess past threshold, §1.2
  excess_deg: number;   // raw degrees past threshold (for audit/debug; engine uses severity only)
}
```

**Finding enumeration.** Sided findings carry the side in the ID; the engine applies their deltas to that side's insole only (except where a row in §3 says "both"). Unsided findings apply to both insoles or are informational.

| `FindingId` | research.md §2.4 row | Trigger condition (from research.md) | Sided? |
|---|---|---|---|
| `shoulder_tilt_low_left` / `shoulder_tilt_low_right` | 1 — Shoulder horizontal tilt | tilt > 3°; ID names the **lower** shoulder side | per-side |
| `pelvic_obliquity_low_left` / `pelvic_obliquity_low_right` | 2 — Pelvic obliquity | tilt > 6°; ID names the **lower** hip side | per-side |
| `head_lean_left` / `head_lean_right` | 3 — Head lateral lean | lean > 4° toward named side | per-side (informational) |
| `knee_valgus_left` / `knee_valgus_right` | 4 — Knee FPPA (Q-angle proxy) | FPPA proxy > 18° medial deviation | per-side |
| `knee_varus_left` / `knee_varus_right` | 4 — Knee FPPA (varus direction) 🟡 | FPPA proxy > 18° lateral deviation (🟡 same cutoff mirrored) | per-side |
| `forward_head` | 5 — Craniovertebral angle proxy | CVA proxy < 50° | unsided (informational) |
| `thoracic_slump` | 6 — Thoracic slump | trunk flexion > 10° | unsided (informational) |
| `pelvic_tilt_anterior` / `pelvic_tilt_posterior` | 7 — Sagittal pelvic tilt proxy | tilt > 15° ant/post | unsided (applies to both) |
| `spine_dev_left` / `spine_dev_right` | 8 — Spine lateral deviation proxy | offset angle > 5°, leaning toward named side | per-side |
| `overpronation_left` / `overpronation_right` | 9 — Rearfoot pronation proxy | calcaneal eversion > 8° | per-side |
| `supination_left` / `supination_right` | 9 — Rearfoot supination proxy | calcaneal eversion < 0° (inversion) 🟡 | per-side |

The engine MUST reject unknown finding IDs (throw), and MUST treat `overpronation_X` + `supination_X` on the **same side** as invalid input (mutually exclusive by construction).

### 1.2 Severity bands 🟡 POC HEURISTIC DEFAULTS

Severity is derived from `excess_deg` = how far the measured angle is **past** its flag threshold, in degrees. For metrics where *lower* is worse (CVA row 5: threshold 50°, lower = worse), `excess_deg = threshold − measured`; for all others `excess_deg = measured − threshold`. `excess_deg` is always ≥ 0 for a flagged finding.

| Severity | Band |
|---|---|
| `mild` | `0 < excess_deg ≤ 5` |
| `moderate` | `5 < excess_deg ≤ 10` |
| `marked` | `excess_deg > 10` |

Boundary rule: bands are half-open `(lo, hi]` — exactly 5.0° past threshold is `mild`, 5.01° is `moderate`. `excess_deg == 0` (exactly at threshold) is **not** a finding.

### 1.3 Foot size → geometry 🟡 POC HEURISTIC DEFAULTS

Input is EU size (integer or half size, valid range **35–48**) or US size (converted to EU first). Foot geometry scales from foot length.

```
// US → EU (POC approximation; if both given, EU wins)
eu_size = us_size_men   + 33
eu_size = us_size_women + 31.5

// EU size → foot length in mm.
// EU (Paris point) system: last length = eu_size × (20/3) mm ≈ eu_size × 6.667 mm;
// last length includes ≈10 mm toe allowance over anatomical foot length.
foot_length_mm   = round(eu_size * 20 / 3 - 10)

// Insole geometry 🟡
insole_length_mm = foot_length_mm + 5                  // 5 mm toe clearance
insole_width_mm  = round(0.37 * insole_length_mm)      // forefoot width heuristic
```

Reference values (unit-test anchors): EU 35 → foot 223, insole 228, width 84 · EU 38 → 243 / 248 / 92 · EU 42 → 270 / 275 / 102 · EU 45 → 290 / 295 / 109 · EU 48 → 310 / 315 / 117.

Inputs outside EU 35–48 → validation error (no clamping of size).

### 1.4 Handedness of asymmetry

The engine produces **two independent parameter objects, LEFT and RIGHT**. Both start from the identical neutral baseline (§2.3). A sided finding's deltas apply only to its named side; rows marked "both" in §3 apply the same delta to both sides. There is no cross-side coupling beyond what §3 states explicitly.

---

## 2. Insole parameters (output schema)

### 2.1 Per-side parameter object

Every field below is emitted for **each** side. Units, valid range (post-clamp), and neutral default:

| Parameter | Type / unit | Valid range | Neutral default | Meaning |
|---|---|---|---|---|
| `length_mm` | number, mm | 228–315 (from EU 35–48) | from §1.3 | Insole overall length |
| `width_mm` | number, mm | 84–117 | from §1.3 | Forefoot width |
| `arch_height_mm` | number, mm | 0–12 | **3** | Medial longitudinal arch support peak height above footbed plane |
| `heel_wedge_angle_deg` | number, deg | 0–8 | **0** | Heel post/wedge angle in frontal plane |
| `heel_wedge_side` | enum | `none` \| `medial` \| `lateral` | **`none`** | Which edge the wedge is thick on (`medial` = anti-pronation posting) |
| `heel_cup_depth_mm` | number, mm | 2–8 | **3** | Heel cup wall depth (rearfoot containment) |
| `forefoot_thickness_mm` | number, mm | 2–6 | **3** | Base thickness under forefoot (cushioning) |
| `heel_thickness_mm` | number, mm | 3–12 | **5** | Base thickness under heel (cushioning + any lift) |
| `arch_stiffness` | enum | `soft` \| `medium` \| `firm` | **`medium`** | Arch-zone stiffness class; drives infill % + shore (§2.2) |
| `material` | enum | `TPU` | **`TPU`** | POC is single-material TPU per research.md §3.3 |
| `shore_hardness` | enum | `85A` \| `90A` \| `95A` | **`90A`** | Derived from `arch_stiffness` (§2.2) |
| `infill_pct` | integer, % | 15–30 | **20** | Gyroid infill density; derived from `arch_stiffness` (§2.2) |
| `infill_pattern` | const | `gyroid` | `gyroid` | Fixed (research.md §3.2) |
| `layer_height_mm` | const, mm | 0.2 | 0.2 | Fixed (research.md §3.2) |
| `nozzle_temp_c` | const, °C | 235 | 235 | Fixed TPU profile (research.md §3.2) |
| `bed_temp_c` | const, °C | 55 | 55 | Fixed TPU profile (research.md §3.2) |
| `print_orientation` | const | `flat_footbed_down` | `flat_footbed_down` | Print flat, footbed face down (research.md §3.2) |

### 2.2 `arch_stiffness` → print/material mapping 🟡 POC HEURISTIC DEFAULTS

Consistent with research.md §3.1 shore guidance (85A soft/sensitive, 90A all-day, 95A stability/overpronation control) and §3.2 infill tuning band (15–30%):

| `arch_stiffness` | `infill_pct` | `shore_hardness` |
|---|---|---|
| `soft` | 15 | `85A` |
| `medium` | 20 | `90A` |
| `firm` | 30 | `95A` |

Stiffness is ordinal: `soft < medium < firm`. **Conflict resolution:** if rules demand both a downgrade (`soft`) and an upgrade (`firm`) on the same side, **`firm` wins** (stability corrections take precedence over cushioning). Implement as: collect all demanded stiffness values for the side; result = max(demands ∪ {`medium`}) unless the only demand is `soft`, in which case `soft`.

### 2.3 Neutral baseline insole (no findings), explicit

For EU size *S*, both sides identically:

```json
{
  "length_mm": "<foot_length_mm(S) + 5>",
  "width_mm": "<round(0.37 * length_mm)>",
  "arch_height_mm": 3.0,
  "heel_wedge_angle_deg": 0.0,
  "heel_wedge_side": "none",
  "heel_cup_depth_mm": 3.0,
  "forefoot_thickness_mm": 3.0,
  "heel_thickness_mm": 5.0,
  "arch_stiffness": "medium",
  "material": "TPU",
  "shore_hardness": "90A",
  "infill_pct": 20,
  "infill_pattern": "gyroid",
  "layer_height_mm": 0.2,
  "nozzle_temp_c": 235,
  "bed_temp_c": 55,
  "print_orientation": "flat_footbed_down"
}
```

---

## 3. Rule table 🟡 POC HEURISTIC DEFAULTS (magnitudes)

### 3.1 Evaluation algorithm

1. Build LEFT and RIGHT objects from the neutral baseline (§2.3) for the given size.
2. For each finding, look up its row below and **add** the deltas to the target side(s). Deltas are additive across findings (order-independent).
3. Wedge accounting: track `net_wedge_deg = Σ(medial deltas) − Σ(lateral deltas)` per side. After summing: `heel_wedge_side = medial` if net > 0, `lateral` if net < 0, `none` if net == 0; `heel_wedge_angle_deg = |net_wedge_deg|`.
4. Stiffness: resolve per §2.2 (firm > medium > soft precedence on conflict), then derive `infill_pct` and `shore_hardness`.
5. **Clamp** every numeric parameter to its valid range in §2.1 (clamp after summing, once, at the end).
6. Informational findings produce `notes[]` entries (strings below) on the result envelope, never geometry changes.

### 3.2 Deltas per finding × severity

Notation: target **S** = the side named in the finding ID; **both** = apply to left and right. All deltas relative to neutral baseline, additive.

| Finding | Severity | Target | `arch_height_mm` | wedge (deg, side) | `heel_cup_depth_mm` | `forefoot_thickness_mm` | `heel_thickness_mm` | `arch_stiffness` demand |
|---|---|---|---|---|---|---|---|---|
| `overpronation_S` | mild | S | +2 | +2 medial | +1 | 0 | 0 | — |
| | moderate | S | +4 | +4 medial | +2 | 0 | 0 | `firm` |
| | marked | S | +6 | +6 medial | +3 | 0 | 0 | `firm` |
| `supination_S` | mild | S | 0 | +2 lateral | 0 | +1 | +1 | `soft` |
| | moderate | S | 0 | +3 lateral | +1 | +2 | +2 | `soft` |
| | marked | S | 0 | +4 lateral | +2 | +3 | +3 | `soft` |
| `knee_valgus_S` | mild | S | +1 | +2 medial | 0 | 0 | 0 | — |
| | moderate | S | +2 | +3 medial | +1 | 0 | 0 | — |
| | marked | S | +3 | +5 medial | +1 | 0 | 0 | `firm` |
| `knee_varus_S` | mild | S | 0 | +2 lateral | 0 | 0 | 0 | — |
| | moderate | S | 0 | +3 lateral | +1 | 0 | 0 | — |
| | marked | S | 0 | +5 lateral | +1 | 0 | 0 | `firm` |
| `pelvic_obliquity_low_S` | mild | S | 0 | 0 | 0 | 0 | +2 | — |
| | moderate | S | 0 | 0 | +1 | 0 | +4 | — |
| | marked | S | 0 | 0 | +1 | 0 | +6 | — |
| `shoulder_tilt_low_S` | mild | S | 0 | 0 | 0 | 0 | +1 | — |
| | moderate | S | 0 | 0 | 0 | 0 | +1 | — |
| | marked | S | 0 | 0 | 0 | 0 | +2 | — |
| `spine_dev_S` (lean toward S) | mild | S | 0 | 0 | 0 | 0 | +1 | — |
| | moderate | S | 0 | 0 | 0 | 0 | +2 | — |
| | marked | S | 0 | 0 | 0 | 0 | +3 | — |
| `pelvic_tilt_anterior` | mild | both | 0 | 0 | 0 | 0 | −1 | — |
| | moderate | both | 0 | 0 | 0 | 0 | −2 | — |
| | marked | both | 0 | 0 | 0 | 0 | −2 | — |
| `pelvic_tilt_posterior` | mild | both | 0 | 0 | 0 | 0 | +1 | — |
| | moderate | both | 0 | 0 | 0 | 0 | +2 | — |
| | marked | both | 0 | 0 | 0 | 0 | +2 | — |
| `forward_head` | any | note only | 0 | 0 | 0 | 0 | 0 | — |
| `thoracic_slump` | any | note only | 0 | 0 | 0 | 0 | 0 | — |
| `head_lean_S` | any | note only | 0 | 0 | 0 | 0 | 0 | — |

Rationale, one line each (direction is conventional orthotics practice; magnitudes are 🟡):

- **Overpronation** → medial arch support + medial (varus) heel posting + deeper heel cup + firm arch (research.md §3.1: 95A = "stability/overpronation control").
- **Supination** → lateral posting + extra cushioning (soft/85A per §3.1 "soft/sensitive"), no added arch (a high arch is typically already present).
- **Knee valgus** → medial posting + arch support (valgus commonly co-presents with pronation); **varus** mirrors laterally, without arch change.
- **Pelvic obliquity / shoulder tilt / spine deviation** → small heel lift on the low/lean side (leg-length-style compensation; shoulder tilt is a weaker secondary signal, hence smaller deltas).
- **Sagittal pelvic tilt** → reduce (anterior) or increase (posterior) effective heel-to-toe drop, bilaterally.
- **Forward head / thoracic slump / head lean** → not meaningfully correctable via insole geometry in this POC; emit note strings, e.g. `"forward_head (moderate): not addressed by insole; posture exercise recommended"`.

### 3.3 Clamping and conflicts (normative)

- Clamp **after** summing all deltas: `clamp(value, min, max)` per §2.1 ranges. Example: neutral heel 5 + pelvic obliquity marked (+6) + spine_dev marked (+3) = 14 → clamped to **12**.
- Wedge: net signed sum then absolute value + side (§3.1 step 3); clamp angle to 0–8 after netting. `heel_wedge_side` must be `none` iff angle is 0.
- Stiffness: `firm` beats `soft` beats nothing; `medium` only when no demands (§2.2).
- Same finding ID appearing twice in the input → validation error (findings are a set).
- Output numbers: round geometry to 1 decimal mm / deg; `infill_pct` integer.

---

## 4. Worked examples (unit-test fixtures)

### Example A — moderate right overpronation + mild left-low pelvic obliquity, EU 42

Input:

```json
{
  "eu_size": 42,
  "findings": [
    { "id": "overpronation_right", "severity": "moderate", "excess_deg": 7.0 },
    { "id": "pelvic_obliquity_low_left", "severity": "mild", "excess_deg": 1.5 }
  ]
}
```

Geometry: EU 42 → foot 270 mm → length 275, width 102.

Output:

```json
{
  "left": {
    "length_mm": 275, "width_mm": 102,
    "arch_height_mm": 3.0,
    "heel_wedge_angle_deg": 0.0, "heel_wedge_side": "none",
    "heel_cup_depth_mm": 3.0,
    "forefoot_thickness_mm": 3.0, "heel_thickness_mm": 7.0,
    "arch_stiffness": "medium", "material": "TPU", "shore_hardness": "90A",
    "infill_pct": 20, "infill_pattern": "gyroid", "layer_height_mm": 0.2,
    "nozzle_temp_c": 235, "bed_temp_c": 55, "print_orientation": "flat_footbed_down"
  },
  "right": {
    "length_mm": 275, "width_mm": 102,
    "arch_height_mm": 7.0,
    "heel_wedge_angle_deg": 4.0, "heel_wedge_side": "medial",
    "heel_cup_depth_mm": 5.0,
    "forefoot_thickness_mm": 3.0, "heel_thickness_mm": 5.0,
    "arch_stiffness": "firm", "material": "TPU", "shore_hardness": "95A",
    "infill_pct": 30, "infill_pattern": "gyroid", "layer_height_mm": 0.2,
    "nozzle_temp_c": 235, "bed_temp_c": 55, "print_orientation": "flat_footbed_down"
  },
  "notes": []
}
```

### Example B — bilateral mild supination + moderate forward head, EU 38

Input:

```json
{
  "eu_size": 38,
  "findings": [
    { "id": "supination_left", "severity": "mild", "excess_deg": 3.0 },
    { "id": "supination_right", "severity": "mild", "excess_deg": 2.0 },
    { "id": "forward_head", "severity": "moderate", "excess_deg": 8.0 }
  ]
}
```

Geometry: EU 38 → foot 243 mm → length 248, width 92. Both sides identical (symmetric findings); forward_head is note-only.

Output (`left` == `right`):

```json
{
  "left": {
    "length_mm": 248, "width_mm": 92,
    "arch_height_mm": 3.0,
    "heel_wedge_angle_deg": 2.0, "heel_wedge_side": "lateral",
    "heel_cup_depth_mm": 3.0,
    "forefoot_thickness_mm": 4.0, "heel_thickness_mm": 6.0,
    "arch_stiffness": "soft", "material": "TPU", "shore_hardness": "85A",
    "infill_pct": 15, "infill_pattern": "gyroid", "layer_height_mm": 0.2,
    "nozzle_temp_c": 235, "bed_temp_c": 55, "print_orientation": "flat_footbed_down"
  },
  "right": { "...": "identical to left" },
  "notes": [
    "forward_head (moderate): not addressed by insole; posture exercise recommended"
  ]
}
```

### Example C — marked left knee valgus + mild left overpronation, EU 45 (delta stacking + stiffness precedence)

Input:

```json
{
  "eu_size": 45,
  "findings": [
    { "id": "knee_valgus_left", "severity": "marked", "excess_deg": 12.0 },
    { "id": "overpronation_left", "severity": "mild", "excess_deg": 4.0 }
  ]
}
```

Geometry: EU 45 → foot 290 mm → length 295, width 109.
Left stacking: arch 3 + 3 (valgus marked) + 2 (overpron mild) = 8; wedge net = 5 + 2 = 7° medial (≤ 8, no clamp); cup 3 + 1 + 1 = 5; stiffness demands {firm} → firm.

Output:

```json
{
  "left": {
    "length_mm": 295, "width_mm": 109,
    "arch_height_mm": 8.0,
    "heel_wedge_angle_deg": 7.0, "heel_wedge_side": "medial",
    "heel_cup_depth_mm": 5.0,
    "forefoot_thickness_mm": 3.0, "heel_thickness_mm": 5.0,
    "arch_stiffness": "firm", "material": "TPU", "shore_hardness": "95A",
    "infill_pct": 30, "infill_pattern": "gyroid", "layer_height_mm": 0.2,
    "nozzle_temp_c": 235, "bed_temp_c": 55, "print_orientation": "flat_footbed_down"
  },
  "right": {
    "length_mm": 295, "width_mm": 109,
    "arch_height_mm": 3.0,
    "heel_wedge_angle_deg": 0.0, "heel_wedge_side": "none",
    "heel_cup_depth_mm": 3.0,
    "forefoot_thickness_mm": 3.0, "heel_thickness_mm": 5.0,
    "arch_stiffness": "medium", "material": "TPU", "shore_hardness": "90A",
    "infill_pct": 20, "infill_pattern": "gyroid", "layer_height_mm": 0.2,
    "nozzle_temp_c": 235, "bed_temp_c": 55, "print_orientation": "flat_footbed_down"
  },
  "notes": []
}
```

---

## 5. Safety / disclaimer

Newfoot is a wellness/POC demonstration, **not a medical device**, and this rule table is **not a clinical prescription system**. The posture findings derive from single-camera 2D photogrammetry with meaningful error versus radiographic measurement (research.md §2 caveats); the deltas in §3 are heuristic, illustrative defaults chosen for a plausible demo, not validated orthotic dosages. Outputs must be presented to users as illustrative estimates, must not claim to diagnose, treat, or correct any condition, and anyone with pain, marked asymmetry, or a known musculoskeletal condition should be directed to a qualified clinician (podiatrist/orthotist) rather than a generated insole. Do not remove the in-app disclaimer that accompanies every recommendation.
