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

## ADR-0007 — Loop model default (now claude-opus-4-8)
**Date:** 2026-07-17 · **Status:** amended
**Context:** Initially defaulted to Fable 5 per operator preference. Fable 5 usage
credits were exhausted mid-build (subagents failed with "Usage credits are
required for this model"), and the operator switched back to Opus.
**Decision:** `run_loop.sh` defaults `NEWFOOT_MODEL=claude-opus-4-8`, overridable
per run (e.g. `NEWFOOT_MODEL=claude-sonnet-5 ./run_loop.sh`).
**Consequences:** Sessions run on Opus 4.8 unless overridden. Re-enable Fable 5
only after credits are topped up.

## ADR-0008 — Autonomous "Concierge" agent + 3-sponsor stack (hackathon pivot)
**Date:** 2026-07-17 · **Status:** accepted
**Context:** The hackathon judging criteria (AWS Builder Loft / "Ship to Prod")
weight **Autonomy** first ("how well does the agent act on the web using real-time
data without manual intervention?") and require **Tool Use of ≥3 sponsor tools**.
A static posture→insole app scores well on Idea but poorly on Autonomy.
**Decision:** Keep the posture-analysis + insole recommendation as the product
(the "Idea" / real-world value) and ADD an autonomous **Concierge agent** that,
after analysis, acts on the web with real-time data in one click, no further input:
real-time filament price/availability, local print-service/podiatrist lookup,
evidence-based corrective exercises, and a compiled action plan + quote — streamed
live to a visible agent activity feed. Three sponsor tools, each doing real work:
- **Akash / AkashML** (`api.akashml.com/v1`, OpenAI-compatible, SSE) = the LLM brain.
- **Zero.xyz** (AI-agent tool marketplace) = the agent's real-time web tools → the
  core of the Autonomy criterion.
- **Ghost** (Postgres for AI agents, MCP) = agent memory/state (ephemeral per-session).
Optional 4th for margin: Pomerium (secure HTTPS ingress) or Akash Network hosting.
**Consequences:** New backend agent orchestrator (bounded plan→tool→observe loop);
API keys (`AKASHML_API_KEY`, `ZERO_API_KEY`) stay server-side. AkashML is PAID
(trial credits) — enforce rate limits + `max_completion_tokens`. Ghost is Postgres,
so agent-state persistence uses `pg` (the app's core tables can stay MySQL for now;
revisit if we consolidate). Features appended as F166–F194.

## ADR-0009 — Progressive identity instead of "no login"
**Date:** 2026-07-17 · **Status:** accepted · **Supersedes** the §3 "No login/auth" constraint
**Context:** Adding a sales landing page + an LLM chatbot/agent that burns paid
AkashML credits changes the calculus: we want lead capture and abuse/cost control,
but not to add funnel friction.
**Decision:** No full accounts/passwords. **Progressive identity:** landing page and
the camera analysis stay anonymous (client session id). A lightweight **email /
lead-capture gate** triggers only at high-intent moments — after ~3 free chatbot/
agent messages, and to receive the STL / action plan / pre-order. Returning users
retrieve saved results via an emailed link (no password).
**Consequences:** The old "no login" rule in CLAUDE.md is replaced by this. Leads are
persisted keyed by session. Chatbot/agent get per-IP/session rate limits.

## ADR-0010 — Akash hosting is optional; ngrok stays the default demo path
**Date:** 2026-07-17 · **Status:** accepted
**Context:** The 3-sponsor requirement is already met by AkashML + Zero.xyz + Ghost;
deploying the whole stack on Akash Network adds effort (SDL, TLS, MySQL persistence).
**Decision:** Treat Akash Network deployment (F194) + a production frontend image as
OPTIONAL. Default demo path remains `tools/expose.sh` (ngrok HTTPS). If time allows,
deploy to Akash for a persistent public URL and an extra "runs on the sponsor" point.
**Consequences:** No hard dependency on Akash hosting for the demo; camera secure-
context still satisfied by ngrok.

## ADR-0011 — Branch per session + PR auto-merge (no direct commits to main)
**Date:** 2026-07-17 · **Status:** accepted · **Supersedes** the initial "commit to main each session"
**Context:** Committing straight to `main` every session is messy and gives no
review/CI gate. It's a POC, so we want a lightweight CI/CD-style flow, not manual PRs.
**Decision:** Sessions never touch `main` directly. Each session: branches
`feat/Fxxx-<slug>` off an up-to-date main → commits the whole feature (code +
`passes:true` flip + smoke test + progress entry) in one commit → runs
`tools/land.sh`, which pushes, opens a PR (`gh pr create --fill`), and squash
auto-merges (`gh pr merge --squash`), deletes the branch, and returns to a clean
main. `run_loop.sh` starts each session on a fresh main and treats "not on main /
dirty tree afterwards" as a contract violation.
**Merge mode:** `LAND_MERGE_MODE=admin` (default) merges immediately via admin
bypass — fine for a POC with no required checks. Switch to `LAND_MERGE_MODE=auto`
once a CI gate (GitHub Actions or **Buildkite**, a sponsor) runs the smoke suite on
the PR, so merges wait for green. `tools/land.sh` also has a no-remote fallback
(local `--no-ff` merge) for portability.
**Consequences:** Requires `gh` authenticated + an `origin` remote (present here:
github.com/cqleeayspotcom/newton, admin). Clean per-feature squash history on main;
each feature is one revert-able PR.

## ADR-0012 — Real-time posture analysis as a multi-loop perception daemon
**Date:** 2026-07-17 · **Status:** accepted · **Priority:** top build priority
**Context:** Single-frame pose→angle analysis is noisy (jitter, false positives,
aberrant angles from occluded joints, setup-dependent thresholds). Reference
approach (Pandey, Medium: "Perfecting Posture") = landmarks → angles → compare →
detect, frame-by-frame, with a temporal (LSTM) model.
**Decision:** Implement posture analysis as a **client-side perception daemon** of
multi-rate cooperating loops in Web Workers (see `docs/posture-daemon.md`):
capture (L1) → inference (L2) → One-Euro smoothing + confidence weighting (L3) →
angle analysis with persistence/hysteresis gating + a temporal sequence model (L4)
→ closed-loop coaching/quality UI (L5) → adaptive calibration daemon (L6) →
privacy-preserving self-improvement hook driven by run_loop (L7). Features F195–F203,
prioritized at the top of `docs/demo-priority.md`.
**Consequences:** Better precision/robustness (temporal fusion, persistence gating,
confidence weighting, calibration) and a smooth UI (multi-rate decoupling). Video
never leaves the device; only derived metrics feed L7. Landmark math is unit-tested
against `tools/pose_fixtures/`; synthetic fake-camera clips verify UI/daemon but not
real detection (use a real human y4m for the full pipeline).

## ADR-0013 — Akash deployment via console-axi (managed wallet, agent-friendly)
**Date:** 2026-07-17 · **Status:** accepted
**Context:** We want the "runs on the sponsor" Akash story without handling
blockchain private keys, and ideally agent-drivable.
**Decision:** Use **console-axi** (github.com/baktun14/console-axi) — an AXI CLI for
the Akash Console **managed-wallet** API (USD-priced, server-side signing, no private
keys). It ships a **Claude Code Agent Skill**, so the loop's agent can deploy. Auth
via `CONSOLE_API_KEY` (an Akash **Console** key `ac.sk.*`, stored in gitignored
`.env`; `console-axi login --with-key $CONSOLE_API_KEY`). Flow: `sdl init` from our
compose → `deploy` → `logs`/`events` → `deployment close`. This powers F194.
**IMPORTANT:** the Console key is for **deployment only** — it is NOT an AkashML
(LLM inference) key. The Concierge agent/chatbot brain still needs a separate
`AKASHML_API_KEY` from akashml.com (still empty → those features stay skipped).
**Consequences:** F194 is unblocked and buildable now. Install:
`curl -fsSL https://raw.githubusercontent.com/baktun14/console-axi/main/install.sh | sh`.
Rotate the Console key after the hackathon (it was pasted in chat).
