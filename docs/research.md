# Newfoot — State-of-the-Art Research

**Project:** Newfoot — camera-based posture analysis + corrective shoe-insole recommendation, running 100% client-side in the browser (privacy by design).
**Date:** 2026-07-17
**Status:** Research document for downstream implementation agents.

> **Reading key**
> - ✅ **VERIFIED FACT** — sourced from vendor docs, peer-reviewed literature, or package registries (cited inline).
> - 🟡 **POC HEURISTIC DEFAULT** — a pragmatic value chosen for this POC. Not clinically validated. Safe to tune. Downstream code should treat these as configurable constants, not medical truth.
>
> **Medical disclaimer:** Newfoot is a wellness/POC tool, not a medical device. None of the thresholds below are diagnostic. 2D single-camera photogrammetry has meaningful error vs. radiography; all outputs are estimates.

---

## 1. Client-side browser pose estimation — approach comparison

### 1.1 Candidates

#### MediaPipe Pose Landmarker (Tasks Vision) ✅
- **npm package:** `@mediapipe/tasks-vision` — latest **`0.10.35`**, published **2026-04-27**, license **Apache-2.0** (verified via npm registry: `https://registry.npmjs.org/@mediapipe/tasks-vision`).
- **Model:** BlazePose GHUM. Detects **33 pose landmarks**, delivered in **two coordinate systems simultaneously**: (a) normalized image coordinates `[0..1]` and (b) **world landmarks** — 3D metric coordinates in meters, origin at the hip center. GHUM (a 3D human shape model) is used to lift the 2D detection to full 3D body pose. ([Google AI Edge — Pose Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker))
- **Model variants** (BlazePose GHUM 3D model card): **Lite ≈ 3 MB, Full ≈ 6 MB, Heavy ≈ 26 MB**, all float16. Accuracy increases lite → heavy; inference speed decreases. ([Model Card BlazePose GHUM 3D, PDF](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20BlazePose%20GHUM%203D.pdf))
- **In-browser execution:** ships a **WASM runtime**; the inference graph runs on the **GPU (WebGL/WebGPU) delegate** or **CPU delegate**. The WASM/GPU assets are loaded via `FilesetResolver.forVisionTasks(...)`. Runs entirely in-page; no server round-trip. ([Pose Landmarker Web guide](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js))
- **JS API surface (verified):**
  ```js
  import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

  const vision = await FilesetResolver.forVisionTasks(
    // WASM bundle — pin the version, see §4
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm"
  );

  const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: "/models/pose_landmarker_full.task",
      delegate: "GPU"            // or "CPU"
    },
    runningMode: "VIDEO",         // "IMAGE" | "VIDEO" | "LIVE_STREAM"
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
    outputSegmentationMasks: false
  });

  // Per video frame (VIDEO mode):
  const result = poseLandmarker.detectForVideo(videoEl, performance.now());
  // result.landmarks       -> [pose][33] normalized {x,y,z,visibility}
  // result.worldLandmarks  -> [pose][33] metric meters {x,y,z,visibility}
  ```
  Key calls: **`FilesetResolver.forVisionTasks`**, **`PoseLandmarker.createFromOptions`**, **`detectForVideo(videoFrame, timestampMs)`** for VIDEO mode and **`detect(image)`** for IMAGE mode. `detectForVideo` returns synchronously; it copies masks and is not intended for extreme-throughput use. ([PoseLandmarker web guide](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js))

#### TensorFlow.js `@tensorflow-models/pose-detection` ✅
- **npm package:** `@tensorflow-models/pose-detection` — latest **`2.1.3`**, published **2023-08-29**, license **Apache-2.0** (verified via npm registry). Note: notably older/less-maintained than tasks-vision.
- **MoveNet:** **17 keypoints, 2D only.** Two variants — *Lightning* (fast) and *Thunder* (accurate). No 3D output. ([tfjs-models pose-detection README](https://github.com/tensorflow/tfjs-models/blob/master/pose-detection/README.md))
- **BlazePose (tfjs):** **33 keypoints, 2D + 3D** (same GHUM lineage as MediaPipe), plus segmentation mask; lite/full/heavy variants. ([3D Pose Detection with BlazePose GHUM, TF Blog](https://blog.tensorflow.org/2021/08/3d-pose-detection-with-mediapipe-blazepose-ghum-tfjs.html))
- **PoseNet (legacy):** 17 keypoints, 2D — deprecated, not recommended.

### 1.2 Chosen DEFAULT: **MediaPipe Pose Landmarker (`@mediapipe/tasks-vision`), Full model, GPU delegate**

**Justification against Newfoot's hard requirements:**

| Requirement | How MediaPipe satisfies it |
|---|---|
| 100% client-side (no video leaves device) | WASM + in-browser GPU/CPU inference; frames never uploaded. ✅ |
| Single commodity RGB camera, no depth sensor | BlazePose GHUM lifts monocular RGB → 3D world landmarks. ✅ |
| Works on laptop + phone | WASM/WebGL runs on desktop + mobile browsers; model variants let us drop to Lite on weak phones. ✅ |
| Secure context (HTTPS) camera access | Unchanged — `getUserMedia` requires HTTPS regardless of model (§4). ✅ |
| License | **Apache-2.0** — permissive, commercial-friendly. ✅ |
| 3D metric data for posture angles | Emits `worldLandmarks` in **meters** natively (front/side/back geometry needs this). ✅ |

**Why not TF.js:** MoveNet gives only 17 2D keypoints — no world landmarks, no toe/heel/foot-index points, insufficient for foot/pelvis 3D metrics. BlazePose-via-tfjs is equivalent in capability but its `pose-detection` package is on a **2023** release with less active maintenance, whereas `tasks-vision` shipped **2026-04**. MediaPipe Tasks is the better-supported path to the same GHUM model.

**Default model choice:** **Full** (6 MB) as the baseline balance. 🟡 POC default: fall back to **Lite** (3 MB) on detected mobile/low-power devices; offer **Heavy** (26 MB) as an opt-in "high accuracy" toggle.

**Relevant landmark indices (BlazePose 33):** 0 nose; 2/5 eyes; 7/8 ears; 11/12 shoulders; 13/14 elbows; 15/16 wrists; 23/24 hips; 25/26 knees; 27/28 ankles; 29/30 heels; 31/32 foot-index (toe). These are the atoms for §2 formulas. ([tfjs-models pose-detection README](https://github.com/tensorflow/tfjs-models/blob/master/pose-detection/README.md))

---

## 2. Computable posture metrics per capture view

**Conventions.** Image axes: `x` right, `y` down (normalized `0..1`). For a segment between points A and B, tilt from horizontal = `atan2(|Ay−By|, |Ax−Bx|)`; a signed left/right tilt = `atan2(By−Ay, Bx−Ax)`. Use **world landmarks (meters)** for anything sagittal-depth-dependent (craniovertebral, thoracic slump), and image landmarks for in-plane frontal tilts. All formulas return **degrees** (`* 180/π`).

> ⚠️ 2D-from-single-camera caveat: frontal tilts are robust; sagittal (side-view) angles inherit BlazePose's monocular depth error. Back-view foot pronation from RGB alone is the least reliable — treat as a screening proxy, not a measurement (🟡).

### 2.1 FRONT view

| Metric | Landmarks | Formula (degrees) | Notes |
|---|---|---|---|
| **Shoulder horizontal tilt** | L/R shoulder (11,12) | `atan2(y12−y11, x12−x11)`, report `|angle|` from horizontal | Frontal plane, image coords. |
| **Pelvic horizontal tilt (obliquity)** | L/R hip (23,24) | `atan2(y24−y23, x24−x23)`, `|angle|` from horizontal | Frontal plane. |
| **Head lateral lean** | nose (0) vs shoulder midpoint ((11+12)/2) | angle of vector (mid-shoulder → nose) from vertical | Positive = lean to one side. |
| **Knee valgus/varus (Q-angle proxy, FPPA)** | hip(23/24), knee(25/26), ankle(27/28) | Frontal-plane projection angle = angle at knee between hip→knee and ankle→knee vectors; deviation from 180° | Per leg. This is a **frontal plane projection angle (FPPA)** proxy, not a true radiographic Q-angle (🟡). |

### 2.2 SIDE view (use world landmarks)

| Metric | Landmarks | Formula (degrees) | Notes |
|---|---|---|---|
| **Craniovertebral angle proxy (forward-head)** | ear tragus ≈ ear(7 or 8), C7 ≈ shoulder(11 or 12) as proxy | Angle between the ear→C7 line and the horizontal | True CVA uses tragus–C7 vs horizontal; here shoulder substitutes for C7 (🟡 proxy). Lower angle = more forward head. |
| **Thoracic slump / trunk flexion** | ear(7/8) or shoulder(11/12), hip(23/24) | Angle of shoulder→hip trunk vector from vertical | Larger forward angle = more slump. |
| **Pelvic tilt proxy (sagittal)** | hip(23/24), knee(25/26) | Sagittal angle of hip→knee vs vertical, or ASIS-proxy line vs horizontal | BlazePose lacks true ASIS/PSIS; anterior/posterior tilt is a coarse proxy (🟡). |

### 2.3 BACK view

| Metric | Landmarks | Formula (degrees) | Notes |
|---|---|---|---|
| **Scapular / shoulder symmetry** | L/R shoulder (11,12) | Same as front shoulder tilt; height delta of shoulders | Screens scapular asymmetry. |
| **Spine lateral deviation proxy** | mid-shoulder ((11+12)/2), mid-hip ((23+24)/2) | Horizontal offset of mid-shoulder vs mid-hip; angle of the connecting line from vertical | Coarse scoliosis-screen proxy, NOT a Cobb angle (🟡). |
| **Rearfoot / ankle angle (pronation/supination proxy)** | knee(25/26), ankle(27/28), heel(29/30) | Calcaneal-axis proxy: angle of the ankle→heel (or shank knee→ankle) vector from vertical; medial deviation ⇒ pronation | RGB rearfoot estimation is low-reliability; screening only (🟡). |

### 2.4 Threshold table (metric → normal → flag)

| # | Metric | View | Normal range | Flag-as-deficiency | Basis |
|---|---|---|---|---|---|
| 1 | Shoulder horizontal tilt | Front/Back | ≤ ~2–3° asymmetry | **> 3°** flag; **> 5°** notable | Healthy shoulder obliquity ≈ 1.9–2.7°; scoliosis screens use higher limits. ([Photogrammetry scoliosis study](https://www.sciencedirect.com/science/article/abs/pii/S0161475416300884)) 🟡 3° POC cutoff. |
| 2 | Pelvic horizontal tilt (obliquity) | Front | ≤ ~6° | **> 6°** | "Slight pelvic obliquity is normal"; instability risk rises > 6°. ([PMC10229507](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10229507/)) |
| 3 | Head lateral lean | Front | ≤ ~4° | **> 4°** | 🟡 POC heuristic (no strong single-source norm). |
| 4 | Knee FPPA / valgus (Q-angle proxy) | Front | Men ~8–14°, Women ~11–20° (static Q); dynamic valgus men 3–8°, women 7–13° | **> 18°** (Q proxy) / dynamic **> 13°** | Q-angle norms and dynamic valgus ranges. ([Physiopedia Q Angle](https://www.physio-pedia.com/Q_Angle), [PMC7344677](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7344677/)) |
| 5 | Craniovertebral angle proxy | Side | ≥ ~53–55° (normal) | **< 50°** forward-head; **< 44–48°** severe | CVA < 48–50° = forward head posture (no universal consensus). ([Physiopedia CVA](https://www.physio-pedia.com/Craniovertebral_angle), [PMC11012400](https://pmc.ncbi.nlm.nih.gov/articles/PMC11012400/)) |
| 6 | Thoracic slump (trunk flexion from vertical) | Side | ≤ ~10° | **> 10°** mild; **> 20°** marked | 🟡 POC heuristic. |
| 7 | Pelvic tilt proxy (sagittal) | Side | ~ ±10° | **> 15°** ant/post | 🟡 POC heuristic (BlazePose lacks ASIS/PSIS). |
| 8 | Spine lateral deviation proxy | Back | mid-shoulder ≈ mid-hip vertical | offset angle **> 5°** | 🟡 POC heuristic; scoliosis screening flags shoulder asymmetry ~ up to 15° limit. |
| 9 | Rearfoot / ankle pronation proxy | Back | Calcaneal eversion 4–8° normal | **> 8°** eversion ⇒ overpronation; strong inversion ⇒ supination | Normal calcaneal eversion 4–8°; FPI +6..+9 = pronated. ([JOSPT normal foot](https://www.jospt.org/doi/pdf/10.2519/jospt.1995.22.5.216), [PMC2894016](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC2894016/)) |

Rows 3, 6, 7, 8 are **POC heuristic defaults** — expose as tunable config. Rows 1, 2, 4, 5, 9 are anchored to literature but the exact cut-points are still POC choices given the 2D-camera error budget.

---

## 3. Insole / 3D-printing filament materials

Corrective 3D-printed orthotics typically use a **flexible cushioning material** (TPU) for the footbed, optionally over a **semi-rigid shell** (PETG/PLA) for arch support. A single-material **TPU gradient** (softer top, firmer base) is the most common POC-friendly approach. ([3DShoemaker — How to 3D Print Orthotics](https://3dshoemaker.com/how-to-3d-print-orthotics/), [ChanHonTech TPU footwear guide](https://chanhontech.com/tpu-in-footwear-consumer-products-the-complete-fdm-3d-printing-application-guide/))

### 3.1 Material tradeoffs ✅

| Material | Role | Shore / rigidity | Pros | Cons |
|---|---|---|---|---|
| **TPU (flexible)** | Footbed / cushioning | 70–80A soft top, 85–95A firmer base | Cushioning, energy return, durable, skin-safe; hardness selectable | Slow to print, needs direct-drive extruder, stringing |
| **PETG** | Semi-rigid arch shell | Semi-rigid | Good stiffness-to-weight, tougher than PLA, some flex | May be too flexible unless shell ≥ 3 mm; needs stiffness tuning |
| **PLA** | Rigid shell / prototype | Rigid, brittle | Cheap, easy, dimensionally accurate | Brittle, low heat resistance, not for load-bearing flex |
| **PP (polypropylene)** | Rigid-but-tough shell | Semi-rigid, fatigue-resistant | Fatigue/flex durability (traditional orthotic material) | Hard to print, warps, poor bed adhesion |

Shore guidance for orthotics: **70–80A top layer (cushioning) → 85–90A structural base (arch support)**; 85A soft/sensitive feet, 90A all-day, 95A stability/overpronation control. ([ChanHonTech TPU footwear guide](https://chanhontech.com/tpu-in-footwear-consumer-products-the-complete-fdm-3d-printing-application-guide/))

### 3.2 Per-material print guidance ✅

| Setting | TPU (95A footbed) | PETG (arch shell) | PLA (rigid proto) |
|---|---|---|---|
| Nozzle temp | ~**235 °C** (220–245°) | ~230–245 °C | ~200–215 °C |
| Bed temp | ~**55 °C** | ~70–80 °C | ~60 °C |
| Layer height | 0.2 mm (0.15–0.25) | 0.2 mm | 0.2 mm |
| Infill | **~20% gyroid** (tune 15–30% to plantar pressure) | 30–50% (or solid ≥3 mm shell) | 20–40% |
| Infill pattern | **Gyroid** (uniform, isotropic) | Gyroid/grid | Gyroid/grid |
| Print speed | **25–50 mm/s** | 40–60 mm/s | 50–60 mm/s |
| Retraction | **Off / minimal** | Standard | Standard |
| Orientation | Print **flat** (footbed face down) for smooth top + strong layer adhesion under compression | Flat/shell-up | Flat |

TPU baseline (95A, 235 °C nozzle, 55 °C bed, 20% gyroid, 25–50 mm/s, retraction off) is a verified reliable starting profile. **Infill density can be mapped to peak plantar pressure** to personalize cushioning per zone. ([ChanHonTech](https://chanhontech.com/tpu-in-footwear-consumer-products-the-complete-fdm-3d-printing-application-guide/), [Snapmaker TPU shoe guide](https://www.snapmaker.com/blog/how-to-3d-print-shoes/), [ScienceDirect — TPU comfort insoles](https://www.sciencedirect.com/science/article/pii/S0142941824001946))

### 3.3 Recommended DEFAULT for Newfoot
🟡 **POC default:** single-material **TPU 95A, printed flat, 0.2 mm layers, 20% gyroid infill, 235 °C / 55 °C bed, retraction off.** Vary **infill density by pressure zone** (softer/lower % under diagnosed high-pressure or pronation regions from §2). Reserve PETG/PLA shell for a future "rigid support" variant.

---

## 4. Recommended stack / implementation notes

- **WASM asset hosting ✅:** load the vision WASM bundle from a **version-pinned** URL, e.g. `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm`. Do **not** use `@latest` in production (breaking changes). For fully-offline/privacy builds, **self-host** the `/wasm` folder and the `.task` model file. ([npm @mediapipe/tasks-vision](https://www.npmjs.com/package/@mediapipe/tasks-vision), [Pose Landmarker web guide](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js))
- **Model download size ✅:** Lite ≈ 3 MB, Full ≈ 6 MB, Heavy ≈ 26 MB (`.task` files) + WASM runtime (a few MB). Preload/cache with a service worker for repeat visits. ([BlazePose GHUM model card](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20BlazePose%20GHUM%203D.pdf))
- **FPS 🟡:** GPU delegate on modern laptop/phone typically yields real-time (≈30 FPS with Lite/Full); Heavy is heavier and may drop on low-end phones. Benchmark on target devices — vendor docs publish no fixed number. Consider running inference in a **Web Worker** to keep the UI thread responsive.
- **Secure context ✅:** `navigator.mediaDevices.getUserMedia` requires a **secure context (HTTPS, or `localhost`)**; camera is blocked on plain HTTP. Plan HTTPS for all deploys.
- **iOS Safari getUserMedia gotchas ✅/🟡:** historically iOS Safari only exposes `getUserMedia` in Safari itself (in-app WKWebViews were long restricted); autoplay of the `<video>` requires `playsinline` + `muted` + a user-gesture to start; and `facingMode` handling differs. Test the camera-start flow explicitly on iOS. Always feature-detect `navigator.mediaDevices?.getUserMedia`.
- **Capture UX:** Newfoot needs three deliberate captures (front / side / back). Guide the user with on-screen silhouette/countdown; validate landmark `visibility` before accepting a frame (reject if key landmarks < ~0.5 visibility).
- **Threading:** `detectForVideo` is synchronous and copies masks — call once per animation frame, disable segmentation mask output unless needed.

---

## Sources

- MediaPipe Pose Landmarker (Google AI Edge): https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker
- MediaPipe Pose Landmarker — Web guide: https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js
- BlazePose GHUM 3D model card (sizes, landmarks): https://storage.googleapis.com/mediapipe-assets/Model%20Card%20BlazePose%20GHUM%203D.pdf
- npm `@mediapipe/tasks-vision`: https://www.npmjs.com/package/@mediapipe/tasks-vision (v0.10.35, Apache-2.0, verified via https://registry.npmjs.org/@mediapipe/tasks-vision)
- npm `@tensorflow-models/pose-detection`: https://www.npmjs.com/package/@tensorflow-models/pose-detection (v2.1.3, Apache-2.0)
- tfjs-models pose-detection README (MoveNet/BlazePose keypoints): https://github.com/tensorflow/tfjs-models/blob/master/pose-detection/README.md
- 3D Pose Detection with BlazePose GHUM (TF Blog): https://blog.tensorflow.org/2021/08/3d-pose-detection-with-mediapipe-blazepose-ghum-tfjs.html
- Craniovertebral angle (Physiopedia): https://www.physio-pedia.com/Craniovertebral_angle
- Forward head posture assessment (radiography vs posture): https://pmc.ncbi.nlm.nih.gov/articles/PMC11012400/
- Q Angle (Physiopedia): https://www.physio-pedia.com/Q_Angle
- Dynamic knee valgus norms (PMC7344677): https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7344677/
- Pelvic obliquity in healthy population (PMC10229507): https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10229507/
- Photogrammetry scoliosis school screening: https://www.sciencedirect.com/science/article/abs/pii/S0161475416300884
- Normal foot alignment/joint motion (JOSPT): https://www.jospt.org/doi/pdf/10.2519/jospt.1995.22.5.216
- Foot type and rearfoot frontal plane motion (PMC2894016): https://www.ncbi.nlm.nih.gov/pmc/articles/PMC2894016/
- TPU in footwear FDM guide (ChanHonTech): https://chanhontech.com/tpu-in-footwear-consumer-products-the-complete-fdm-3d-printing-application-guide/
- How to 3D Print Orthotics (3DShoemaker): https://3dshoemaker.com/how-to-3d-print-orthotics/
- Snapmaker — 3D printing flexible shoes with TPU: https://www.snapmaker.com/blog/how-to-3d-print-shoes/
- TPU compressive behavior for comfort insoles (ScienceDirect): https://www.sciencedirect.com/science/article/pii/S0142941824001946
