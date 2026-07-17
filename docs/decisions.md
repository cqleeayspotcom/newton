# Architecture Decision Records (ADRs)

Append-only. Every non-trivial architecture choice gets an entry so later
sessions don't relitigate or regress it. Newest at the bottom.

---

## ADR-0001 — Pose estimation: MediaPipe Pose Landmarker (Tasks Vision)
**Date:** 2026-07-17 · **Status:** accepted
**Context:** Need client-side, single-RGB-camera pose estimation with 3D landmarks
for sagittal (side-view) metrics, running on laptop + phone, no video leaving the
device.
**Decision:** Use `@mediapipe/tasks-vision` (v0.10.35, Apache-2.0) PoseLandmarker
— 33 landmarks + 3D world landmarks, WASM + GPU delegate. Default to the Full
model, drop to Lite on mobile. Chosen over TF.js MoveNet (17 kpts, 2D, no feet)
and BlazePose-tfjs (stale package). See `docs/research.md`.
**Consequences:** Sagittal metrics (CVA, trunk flexion) use worldLandmarks. WASM
assets + model must be hosted/served; note model download size on first load.

## ADR-0002 — Frontend: Angular 22 (standalone + signals) + Three.js
**Date:** 2026-07-17 · **Status:** accepted
**Context:** Spec mandates latest stable Angular; needs interactive 3D.
**Decision:** Angular 22.0.7, standalone components, signals, SCSS. Three.js
0.185.1 for the insole 3D viewer. Scaffolded with `--skip-install` (Docker
installs deps). Angular 22 requires Node ≥24.15, so scaffolding and the frontend
container both run on the `node:24` image (local Node 24.11 is too old — used a
container to scaffold).
**Consequences:** All frontend work happens through Docker or a node:24 image.

## ADR-0003 — Backend: NestJS 11 over bare Express
**Date:** 2026-07-17 · **Status:** accepted
**Context:** Backend has several concerns (analysis persistence, insole rule
engine, STL generation) built incrementally by many autonomous sessions.
**Decision:** NestJS 11. DI + module boundaries keep the rule engine, STL service,
and persistence cleanly separated and discoverable across sessions, and its
testing utilities support the smoke/verify contract. The rule engine and STL
generator themselves stay minimal and dependency-light (Karpathy ethos) inside
their modules.
**Consequences:** More framework structure than a minimal Express app; justified
by long-lived multi-agent maintainability.

## ADR-0004 — Database access: raw mysql2 + SQL migrations (no ORM)
**Date:** 2026-07-17 · **Status:** accepted
**Context:** MySQL required; migrations must be versioned in the repo.
**Decision:** Access MySQL via the `mysql2` pool directly (no TypeORM/Prisma).
Migrations are plain numbered SQL files in `db/migrations/`, applied by
`tools/db.sh` and tracked in a `schema_migrations` table. Never edit an applied
migration — add a new numbered one.
**Consequences:** Transparent, dependency-light SQL. Devs write SQL by hand;
always use parameterized queries.

## ADR-0005 — Single tunnel: frontend dev-server reverse-proxies /api
**Date:** 2026-07-17 · **Status:** accepted
**Context:** One `ngrok http 4200` must serve the whole app; camera needs HTTPS
(secure context).
**Decision:** The frontend Angular dev-server proxies `/api` → `backend:3000` via
`frontend/proxy.conf.json`. `tools/expose.sh` runs `ngrok http 4200
--host-header=rewrite` so any dynamic ngrok URL passes the dev-server host check.
Plain `http://<LAN-IP>` will NOT grant camera access — documented.
**Consequences:** All frontend API calls are same-origin relative (`/api/...`).
Dev-server (not nginx) chosen for agent-friendly hot reload; smoke tests hit
`localhost:4200` directly so HMR-over-ngrok fragility never affects verification.

## ADR-0006 — Verification: Playwright smoke suite + deterministic fixtures
**Date:** 2026-07-17 · **Status:** accepted
**Context:** Features must be verified as a human would (browser), and pose-metric
math must be correct despite synthetic fake-camera clips.
**Decision:** Two layers. (1) `smoke/` Playwright suite drives the real UI against
the live stack; one test is added per feature flipped to `passes:true`, and the
suite is the regression gate. (2) `tools/pose_fixtures/` provide landmark→angle
fixtures that unit-test the metric functions deterministically. The fake-camera
y4m clips (`tools/test_media/`) are synthetic patterns (no real human), so they
verify camera UI but NOT landmark detection — the fixtures cover metric math.
**Consequences:** Pose-dependent in-browser features may need a real royalty-free
human clip dropped into `tools/test_media/` to exercise the full pipeline.

## ADR-0007 — Loop model defaults to Fable 5, overridable
**Date:** 2026-07-17 · **Status:** accepted
**Context:** Operator preference to prioritize the Fable 5 model where suitable.
**Decision:** `run_loop.sh` defaults `NEWFOOT_MODEL=claude-fable-5`, overridable
per run (e.g. `NEWFOOT_MODEL=claude-opus-4-8 ./run_loop.sh` for harder features).
**Consequences:** Sessions run on Fable 5 unless overridden; escalate the model
for features that need more capability.
