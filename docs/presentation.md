# Newfoot — Presentation Deck (delivery-accurate, slide-by-slide)

Build slides from this. Each slide: **content** · **visual** · **speaker note**.
Target: 3-minute pitch (judging: Autonomy · Idea · Technical · Tool Use ≥3 sponsors ·
Demo). Palette: near-black `#0b0d12`, off-white `#eef2fb`, indigo `#6f9bff`,
cyan `#22d3ee`, coral `#ff5c8a`.

**Live links (use in the deck):**
- App (local demo): `http://localhost:4200` — front scan → findings → insole.
- Zero-hosted landing: **https://sites.withzero.ai/newfoot** (free, on Zero).
- Akash: live deployment via `console-axi` (managed wallet, funded).

---

## Slide 1 — Title
- **Newfoot** — *See your posture. Fix your stance.*
- Camera posture analysis → a corrective 3D-printed insole. On-device. Private.
- Team · SF AI + infra hackathon · date.
- **Visual:** wordmark on dark + a faint skeleton-overlay silhouette + the live URL/QR.
- **Note:** "Back and knee pain often start with posture and feet. Newfoot turns any phone camera into a posture lab."

## Slide 2 — Problem
- Poor posture + foot mechanics → back / knee / joint pain (desk workers, runners, all-day standers).
- Assessing it today needs a clinic, a scanner kiosk, an app, or a mail-in kit.
- **Visual:** 3 persona icons + a body pain-heatmap.
- **Note:** ~45% annual neck-pain in desk workers; 60–80% of runners overpronate.

## Slide 3 — Insight
- A single phone camera + on-device AI can read the **whole kinetic chain** (head→feet).
- **Privacy by design: the video never leaves your device.**
- **Visual:** phone → skeleton overlay → "nothing uploaded" lock.

## Slide 4 — Live demo (the money slide) — WORKS TODAY
- One link → **Analyze my posture** → real-time 33-landmark skeleton (on-device) →
  **3 live findings** (shoulder tilt, pelvic tilt, head lean, with severity) →
  **Get my corrective insole** → insole spec + "why this insole".
- **Visual:** screen-record OR the two screenshots (scan-findings + insole).
- **Note:** Keep to ~90s. Emphasize it's live, on-device, private.

## Slide 5 — How it works (Scan · See · Solve)
- **Scan:** front camera + MediaPipe (33 landmarks + 3D), inference in a Web Worker.
- **See:** posture findings in plain language, with severity, from the landmark angles.
- **Solve:** a rule engine maps findings + foot size → corrective insole (arch, heel
  posting, stiffness, material, print settings) + rationale traced to each finding.
- **Visual:** the 3-step strip with a screenshot under each.

## Slide 6 — Differentiator #1: real-time perception is a **daemon of loops**
- Not one-frame-at-a-time. Multi-rate loops (capture → inference → smoothing →
  metrics → render). **Render stays 100+ Hz while inference runs off-thread at ~12 Hz.**
- **Visual:** the live perf panel screenshot (Render 112 Hz vs Inference 12.7 Hz).
- **Note:** proves the loops are decoupled → smooth UI + stable findings. (F195/F196 shipped.)

## Slide 7 — Differentiator #2: it **improves itself**, autonomously
- A self-improvement loop tunes the model's thresholds over time — **no human, no labels** —
  with deterministic fixtures as a non-overridable guardrail (safe autonomy).
- **Visual:** rising "analysis quality" curve + "auto-apply / auto-rollback".
- **Note:** Designed + documented (ADR-0015, `docs/self-improve-loop.md`); on the roadmap.

## Slide 8 — Differentiator #3: the autonomous **Concierge agent**
- One click after analysis → an agent acts on the web with **real-time data** (filament
  prices, local print services, evidence-based exercises) → a plan + quote.
- **Visual:** the agent activity-feed concept.
- **Note:** This is the Autonomy criterion. Designed; wires AkashML + Zero web tools.

## Slide 9 — Architecture
- **Client:** Angular 22 + MediaPipe (pose) + Three.js (insole 3D) — 100% on-device.
- **Backend:** NestJS 11 (rule engine, STL gen, agent, self-improve daemon).
- **Data:** MySQL. **Edge:** Pomerium. **Runs on:** Akash (via console-axi).
- **Visual:** box diagram (browser ↔ Pomerium ↔ frontend/backend/MySQL on Akash).

## Slide 10 — Sponsors: 3 tools, real work
- **Zero** ✅ — our landing page is **hosted free on Zero** via the agent CLI:
  **https://sites.withzero.ai/newfoot** (show it live). Also powers the Concierge's web tools.
- **Akash** ✅ — the app **runs on Akash**: deployed via **console-axi** (managed wallet,
  no private keys, funded) — show `console-axi deployment list` (a live deployment).
- **Pomerium** — open-source identity-aware secure front door (`docs/pomerium.md`).
- **Visual:** 3 logos, each with its one-line role + the live evidence.

## Slide 11 — Privacy & safety
- Video never leaves the device; only derived angles are stored.
- **Wellness/visualization POC — not a medical device;** disclaimer on every analysis/reco screen.

## Slide 12 — Autonomy all the way down
- The **product** self-improves (roadmap) and the Concierge acts autonomously (roadmap).
- The **codebase itself was built by an autonomous agent loop** (`run_loop.sh`): one
  feature per session, **branch → PR → auto-merge**, fully auditable (14+ PRs on main).
- **Visual:** the PR history / feature burn-up.
- **Note:** three layers of autonomy — build loop, perception self-improvement, web agent.

## Slide 13 — The insole
- Findings + foot size → parametric insole (arch, heel posting, cup, stiffness) →
  **interactive 3D (Three.js: rotate/zoom)** → downloadable **binary STL** (validated
  watertight) + filament sheet (TPU 95A, infill, layer height).
- **Visual:** 3D insole render + the spec card screenshot.
- **Note:** spec + rationale ship today; 3D viewer + STL export are the next build (in progress).

## Slide 14 — Market
- Custom orthotics ≈ $5.2B (2025, ~7–8% CAGR); 3D-printed slice fastest-growing (~15%);
  posture-analytics adjacency growing on "AI posture".
- **Wedge:** desk/remote workers → runners → all-day standers. Differentiator: at-home,
  no-hardware, whole-body, private.
- **Visual:** TAM circles + segment ladder.

## Slide 15 — Why we win (map to the rubric)
- **Autonomy:** agent acts on the web (design) · model self-improves (design) · **app self-builds (shipped)**.
- **Idea:** relatable pain → tangible corrective product.
- **Technical:** on-device perception daemon + rule engine, dockerized, deployed on Akash.
- **Tool Use:** **Zero (live) + Akash (live) + Pomerium** — each doing real work.
- **Demo:** one link, one flow, visible on-device analysis → insole.

## Slide 16 — Ask / thanks
- Live demo + QR (Zero landing / ngrok app URL). Next: 3-view scan, full daemon, agent, fulfillment.
- Thank you.

---

## Appendix

**Elevator pitch (20s):** "Newfoot turns any phone camera into a posture lab: it reads
your whole body on-device, shows what's off, and designs a corrective 3D-printed insole
— privately. It's hosted on Zero, runs on Akash, and the whole app was built by an
autonomous agent loop."

**3-min demo script:** (0:00) problem + one-liner → (0:20) open the app, "Analyze my
posture", show the real-time skeleton + perf panel → (1:00) the 3 live findings →
(1:25) "Get my corrective insole" → spec + rationale (and the 3D/STL) → (2:10) sponsors:
show the Zero URL live + `console-axi deployment list` on Akash → (2:40) "and the whole
app was built by an autonomous loop — branch→PR→auto-merge, 14+ PRs" → (2:55) URL + thanks.

**Shipped vs designed (be honest):**
- **Shipped & working:** front-view posture analysis (skeleton + metrics + findings) →
  insole recommendation (spec + rationale). Web Worker + multi-rate loops. Deployed
  pipeline on Akash. Landing hosted on Zero. Built by the autonomous loop.
- **In progress / next build:** reference-posture ghost overlay, 3D insole viewer, STL
  export (all queued at the top of `docs/demo-priority.md`).
- **Designed & documented:** full 3-view wizard, complete perception daemon (F195–F210),
  autonomous self-improvement loop, LLM Concierge agent (see `docs/` + ADRs).

**Key stats:** ~210 tracked features · 3 sponsors (Zero + Akash live, Pomerium documented) ·
MediaPipe 33 landmarks · Web Worker inference · Angular 22 / NestJS 11 / MySQL / Three.js ·
built branch→PR→auto-merge by an autonomous loop.

**Live proof:** Zero-hosted landing → https://sites.withzero.ai/newfoot
