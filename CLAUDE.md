# CLAUDE.md — Newfoot

Camera-based **posture analysis + corrective shoe-insole recommendation** POC,
plus an autonomous **Concierge agent** that acts on the web with real-time data
(the hackathon's Autonomy criterion). Wellness/visualization only — **not a medical
device**. A disclaimer ("Not medical advice — consult a healthcare professional")
must be visible on analysis and recommendation screens.

**Hackathon framing (see docs/decisions.md ADR-0008):** judged on Autonomy, Idea,
Technical Implementation, Tool Use (**≥3 sponsor tools**), and Demo. The 3 sponsor
tools each do real work: **Akash/AkashML** = LLM brain (agent + chatbot),
**Zero.xyz** = the agent's real-time web tools, **Ghost** = agent memory (Postgres
for AI agents). Optional 4th: Pomerium (secure ingress) or Akash Network hosting.

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
- `feature_list.json` — the roadmap (194 features; F001–F165 core app, F166–F194
  agent + 3 sponsors + landing page). Source of truth for what to build.
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
- **Zero.xyz**: the agent's real-time web tools/APIs. Key in `ZERO_API_KEY`
  (server-side). This is what makes the agent "act on the web with real-time data."
- **Ghost** (Postgres for AI agents, MCP): agent memory/state, ephemeral per-session
  DB. Uses `pg` (config via `GHOST_DATABASE_URL`); core app tables stay MySQL for now.
- **Identity = progressive (ADR-0009, supersedes the old "no login" rule):** landing
  page + camera analysis stay anonymous (session id); a lightweight email/lead-capture
  gate triggers only at high intent (after ~3 free chatbot/agent messages, or to
  receive the STL/plan). No passwords/accounts.
- The autonomous **Concierge agent** (F166–F178) is the headline: one click after
  analysis → agent plans (AkashML) → calls web tools (Zero) → persists state (Ghost)
  → streams a visible activity feed. Keep it genuinely autonomous (no manual steps
  mid-run) and bounded (step cap, cost cap).

## HARD RULES (verbatim — do not violate)
- **One feature per session.** Leave the repo mergeable (no half-finished work;
  revert rather than leave a mess).
- **`feature_list.json` is append-only in spirit:** it is unacceptable to remove,
  rewrite, or weaken a feature — only flip `passes` to `true` after verified
  end-to-end success. New discovered requirements may be appended as new entries.
- **Never mark a feature passing based on unit tests or `curl` alone** — verify as a
  human user would, through the browser, and save a screenshot to `logs/screens/`.
- If the app is **broken at startup, fixing it IS the feature** for that session; flip
  any regressed feature back to `passes:false` first.
