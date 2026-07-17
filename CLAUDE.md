# CLAUDE.md — Newfoot

Camera-based **posture analysis + corrective shoe-insole recommendation** POC,
plus an autonomous **Concierge agent** that acts on the web with real-time data
(the hackathon's Autonomy criterion). Wellness/visualization only — **not a medical
device**. A disclaimer ("Not medical advice — consult a healthcare professional")
must be visible on analysis and recommendation screens.

**Hackathon framing (see docs/decisions.md ADR-0008/0014):** judged on Autonomy,
Idea, Technical Implementation, Tool Use (**≥3 sponsor tools**), and Demo. The 3
sponsor tools (all usable with NO blocking key): **Akash** = deploy via console-axi
(+ optional AkashML LLM brain), **Zero** = the agent's real-time web tools (`zero`
CLI), **Pomerium** = identity-aware secure front door. Agent memory lives in MySQL.

**New session? Read `prompts/coding_agent.md` and follow its startup routine.**
This file is high-signal context only — it points to where things live.

## Stack
- **Frontend:** Angular 22 (standalone components + signals, SCSS), Three.js for 3D.
  Pose estimation in-browser via MediaPipe Pose Landmarker (`@mediapipe/tasks-vision`).
  Dev-server on :4200, reverse-proxies `/api` → backend (`frontend/proxy.conf.json`).
- **Backend:** NestJS 11, routes under `/api` (global prefix). Raw `mysql2` (no ORM).
  Structured logs via pino (nestjs-pino). On :3000.
- **DB:** MySQL 8.4 in Docker. DB name `newfoot`. SQL migrations in `db/migrations/`.
- **Everything dockerized:** `docker-compose.yml` → services `frontend`, `backend`,
  `mysql` (+ `mysql-data` volume, healthchecks).

## Directory map
- `frontend/` — Angular app (`src/app/` components; `proxy.conf.json`).
- `backend/` — NestJS app (`src/` modules; `database/`, `health/`, `client-logs/`).
- `db/migrations/` — numbered SQL migrations (`001_init.sql` = sessions, analyses,
  insole_recommendations). Never edit an applied migration; add a new number.
- `docs/` — `research.md` (pose SOTA + metric thresholds), `insole-rules.md` (rule
  table posture+size → insole params), `decisions.md` (ADRs — read before changing
  architecture).
- `feature_list.json` — the roadmap (210 features; F001–F165 core app, F166–F194
  agent + sponsors + landing, F195–F203 posture daemon, F204–F205 Pomerium,
  F206–F210 autonomous self-improvement). Build order is `docs/demo-priority.md`
  (posture daemon is the TOP priority).
- `docs/posture-daemon.md` — real-time posture analysis loop/daemon architecture.
- `docs/self-improve-loop.md` — the autonomous (no-human) model self-improvement loop.
- `docs/pomerium.md` — Pomerium (secure front door) integration.
- `docs/presentation.md` — slide-by-slide pitch deck for the whole solution.
- `docs/market-landing.md` — market analysis behind the landing-page features.
- `tools/` — `db.sh`, `stl_check.js`, `expose.sh`, `pose_fixtures/`, `test_media/`.
- `smoke/` — Playwright regression suite (one test per passing feature).
- `prompts/` — `initializer.md`, `coding_agent.md`. `run_loop.sh` — headless loop.
- `logs/` — `session-NN.jsonl` per-turn logs, `session-NN.json` summaries,
  `screens/` screenshots, `app/` backend logs.
- `claude-progress.txt` — session journal (narrative memory).

## Commands
- `./init.sh` — build/start the stack, wait for health, run migrations, print URLs.
  Idempotent. Frontend http://localhost:4200 · Backend http://localhost:3000/api/health
- `tools/db.sh [migrate|status|reset|seed]` — DB migrations (via the mysql container).
- `node tools/stl_check.js <file.stl>` — validate STL (parses/watertight/dims). `--json`.
  `node tools/stl_check.js --selftest` to sanity-check the tool.
- `./tools/expose.sh` — ngrok HTTPS tunnel (`ngrok http 4200 --host-header=rewrite`).
- `cd smoke && npm test` — run the Playwright regression suite.
- `cd backend && npm run test` / `npm run lint` — backend unit tests / lint.
- `cd frontend && npm run test` — frontend unit tests.
- `docker compose logs -f <service>` — tail logs. `POST /api/client-logs` — browser → backend logs.
- `./run_loop.sh [n]` — run n headless coding sessions (`NEWFOOT_MODEL`, `MAX_TURNS` env).
- `tools/land.sh` — land the current `feat/` branch: push → PR → squash auto-merge →
  back to a clean `main` (`LAND_MERGE_MODE=admin|auto`).

## Browser verification & fake camera
- Verify features **through the browser** (Playwright MCP in `.mcp.json`, or add a
  `smoke/` test) — never mark a feature passing on unit tests / `curl` alone.
- Fake camera flags for Chromium:
  `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream
  --use-file-for-fake-video-capture=tools/test_media/<front|side|back>.y4m`
  In smoke tests use `fakeCameraArgs(view)` from `smoke/helpers/camera.ts`.
- **Test clips are synthetic (no real human)** → they verify camera UI, NOT landmark
  detection. Pose-metric math is verified by unit tests over `tools/pose_fixtures/`.
- **Camera needs a secure context (HTTPS).** ngrok's https URL works; plain
  `http://<LAN-IP>` will NOT grant the camera.

## Conventions
- Angular: standalone components, signals, `inject()`. `data-testid` on elements the
  smoke suite asserts. Same-origin relative API calls (`/api/...`).
- Backend: one module per concern; parameterized SQL only; keep the rule engine and
  STL generator minimal and dependency-light.
- Schema changes = new numbered migration + `tools/db.sh migrate`.
- Base design tokens live in `frontend/src/styles.scss` (`--nf-*`, dark-mode aware);
  the full design system is a feature.

## Sponsors, agent & identity
- **AkashML** (`https://api.akashml.com/v1`, OpenAI-compatible, SSE): the LLM brain
  for the Concierge agent and the chatbot. Key in `AKASHML_API_KEY` — **server-side
  only, never in the browser**; the NestJS backend proxies it. PAID (trial credits)
  → enforce rate limits + `max_completion_tokens`. Do not confuse with the free
  `chat.akash.network` app (no API) or renting raw Akash Network compute (F194).
- **Zero** (NO key): the agent's real-time web tools via the `zero` CLI (installed
  globally by `zero init`; `zero auth agent register` for an anonymous session).
  Loop: `zero search → get → fetch → review`. Free capabilities cost 0; paid ones
  need `zero wallet fund`. This is what makes the agent "act on the web in real time."
- **Pomerium** (NO key, open-source): identity-aware reverse proxy / secure front
  door + access policy (F193, F204, F205); config via `pomerium/config.yaml`
  (`autocert` or hosted authenticate). See `docs/pomerium.md`.
- **Agent memory** lives in the app **MySQL** DB (a migration adds agent_runs/plans);
  Ghost is dropped (ADR-0014).
- **Akash deploy** via **console-axi** (`CONSOLE_API_KEY`, an Akash *Console* key —
  NOT AkashML): deploy the stack to Akash Network with no private keys (ADR-0013,
  F194). `console-axi login --with-key $CONSOLE_API_KEY`; `sdl init` → `deploy`.
  Distinct from AkashML (LLM) which needs its own `AKASHML_API_KEY`.
- **Identity = progressive (ADR-0009, supersedes the old "no login" rule):** landing
  page + camera analysis stay anonymous (session id); a lightweight email/lead-capture
  gate triggers only at high intent (after ~3 free chatbot/agent messages, or to
  receive the STL/plan). No passwords/accounts.
- The autonomous **Concierge agent** (F166–F178) is the headline: one click after
  analysis → agent plans (AkashML) → calls web tools (Zero) → persists state (MySQL)
  → streams a visible activity feed. Keep it genuinely autonomous (no manual steps
  mid-run) and bounded (step cap, cost cap).

## HARD RULES (verbatim — do not violate)
- **One feature per session.** Leave the repo mergeable (no half-finished work;
  revert rather than leave a mess).
- **Never commit or push to `main` directly (ADR-0011).** Each session works on a
  dedicated `feat/Fxxx-<slug>` branch and lands it via `tools/land.sh` (push → PR →
  squash auto-merge → delete branch). Every session ends on a clean `main`.
- **`feature_list.json` is append-only in spirit:** it is unacceptable to remove,
  rewrite, or weaken a feature — only flip `passes` to `true` after verified
  end-to-end success. New discovered requirements may be appended as new entries.
- **Never mark a feature passing based on unit tests or `curl` alone** — verify as a
  human user would, through the browser, and save a screenshot to `logs/screens/`.
- If the app is **broken at startup, fixing it IS the feature** for that session; flip
  any regressed feature back to `passes:false` first.
