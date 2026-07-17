# Newfoot — Presentation Deck (slide-by-slide)

Build slides from this. Each slide has **content**, a **visual** suggestion, and a
**speaker note**. Target: a 3-minute pitch (judging: Autonomy · Idea · Technical
Implementation · Tool Use ≥3 sponsors · Demo). Suggested palette: near-black
`#0e1013`, off-white `#f2f4f7`, electric indigo `#6f9bff`, cyan `#22d3ee`, coral
`#ff5c8a` (matches the app tokens).

---

## Slide 1 — Title
- **Newfoot** — *See your posture. Fix your stance.*
- Camera-based posture analysis → a custom 3D-printed corrective insole, with an AI agent that does the legwork.
- Team · hackathon · date.
- **Visual:** the wordmark on dark, a faint skeleton-overlay silhouette, live demo URL.
- **Note:** "Everyday back/knee pain often starts at your feet and posture. Newfoot turns any phone camera into a posture lab."

## Slide 2 — The problem
- Poor posture & foot mechanics → back, knee, joint pain (desk workers, runners, people who stand all day).
- Assessing it today needs a clinic, a scanner kiosk, an app, or a mail-in kit.
- **Visual:** 3 persona icons (desk worker / runner / nurse) + pain heatmap on a body.
- **Note:** ~45% annual neck-pain prevalence in desk workers; 60–80% of runners overpronate.

## Slide 3 — The insight
- A single RGB camera + on-device AI can analyze the **whole kinetic chain** (head→feet), not just the foot.
- **Privacy by design:** the video never leaves your device.
- **Visual:** phone → skeleton overlay → "nothing uploaded" lock badge.
- **Note:** No hardware, no app install, no upload. A browser link does it.

## Slide 4 — What Newfoot does (Scan → See → Solve)
- **Scan:** front/side/back via camera, real-time skeleton overlay (MediaPipe, 33 landmarks + 3D).
- **See:** deficiency report (shoulder/pelvic tilt, forward head, knee valgus, overpronation…) in plain language.
- **Solve:** parametric corrective insole → interactive 3D → downloadable STL + filament sheet; an AI agent sources your fix.
- **Visual:** the three-step strip with a screenshot under each.

## Slide 5 — Live demo (the money slide)
- One link → analyze posture (60s) → see findings → **one click → the agent acts** → insole in 3D + plan.
- **Visual:** screen-record embedded / QR to the live demo.
- **Note:** Keep it to 90s. Show the agent's live activity feed acting on the web.

## Slide 6 — Differentiator #1: the real-time perception **daemon**
- Not one-frame-at-a-time. A **multi-rate loop daemon** (Web Workers): capture → inference → One-Euro smoothing → persistence-gated analysis → coaching → adaptive calibration.
- Result: stable angles, no false positives, guided capture, smooth UI.
- **Visual:** the loop diagram from `docs/posture-daemon.md`.
- **Note:** Temporal fusion + persistence gating = trustworthy findings, not jitter.

## Slide 7 — Differentiator #2: it **improves itself**, autonomously
- A self-improvement loop tunes the model's thresholds/filters over time — **no human, no labels**.
- Self-supervised objectives (stability, cross-view agreement, invariance) + deterministic fixtures as a **non-overridable guardrail** → safe autonomy.
- **Visual:** rising "analysis quality" curve + "auto-applied / auto-rollback" badges.
- **Note:** The model literally gets better between demos, and can never regress the known-correct math.

## Slide 8 — Differentiator #3: the autonomous **Concierge agent**
- One click after analysis, **no further input**: the agent acts on the web with **real-time data** — filament prices, local print services/podiatrists, evidence-based exercises — and compiles a plan + quote.
- **Visual:** the streaming agent activity feed.
- **Note:** This is the "Autonomy" criterion — an agent acting on the web without manual intervention.

## Slide 9 — Architecture
- **Client:** Angular 22 + MediaPipe (pose) + Three.js (3D) — 100% on-device.
- **Backend:** NestJS 11 — insole rule engine, STL generation, agent orchestrator, self-improvement daemon.
- **Data:** MySQL (analyses, insoles, agent memory, tuning audit).
- **Edge:** Pomerium secure front door; **deployed on Akash**.
- **Visual:** the box diagram (browser ↔ Pomerium ↔ frontend/backend/MySQL on Akash).

## Slide 10 — Sponsors: 3 tools, real work
- **Akash** — the app *runs on Akash* (deployed via `console-axi`, managed wallet, no private keys).
- **Zero** — the agent's real-time web tools (`zero` CLI: search → fetch → pay-per-use).
- **Pomerium** — open-source identity-aware proxy = secure HTTPS front door + access policy.
- **Visual:** 3 sponsor logos, each with its one-line role.
- **Note:** Each does real work in the product — not logos on a slide.

## Slide 11 — Privacy & safety
- Video never leaves the device; only derived angles are stored.
- **Wellness/visualization POC — not a medical device;** disclaimer on every analysis/recommendation screen.
- **Visual:** lock + "not medical advice" banner.

## Slide 12 — Autonomy all the way down
- The **product** self-improves (L7) and the Concierge agent acts autonomously.
- The **codebase itself was built by an autonomous agent loop** (`run_loop.sh`): 210 tracked features, one-feature-per-session, branch → PR → auto-merge, fully auditable.
- **Visual:** feature-burnup + the PR history.
- **Note:** Three layers of autonomy: build loop, perception self-improvement, web agent.

## Slide 13 — The insole
- Posture findings + foot size → parametric insole (arch, heel wedge, cup, thickness) → interactive 3D (rotate/zoom/exploded) → valid watertight **STL** (L+R) + printable filament sheet (TPU, infill, layer height).
- **Visual:** 3D insole render + a snippet of the recommendation sheet.

## Slide 14 — Market
- Custom orthotics ≈ $5.2B (2025, ~7–8% CAGR); 3D-printed slice fastest-growing (~15%); posture-analytics adjacency growing on "AI posture."
- **Wedge:** desk/remote workers → runners → all-day standers. Differentiator: at-home, no-hardware, whole-body, private.
- **Visual:** TAM circles + segment ladder.

## Slide 15 — Why we win (map to the rubric)
- **Autonomy:** agent acts on the web live; model self-improves; app self-builds.
- **Idea:** relatable pain → tangible corrective product.
- **Technical:** on-device perception daemon + rule engine + STL + agent, dockerized, deployed.
- **Tool Use:** Akash + Zero + Pomerium, each doing real work.
- **Demo:** one link, one click, visible autonomy.

## Slide 16 — Ask / thanks
- Live demo URL + QR. What's next (real print fulfillment, more views, clinician mode).
- Thank you.

---

## Appendix

**Elevator pitch (20s):** "Newfoot turns any phone camera into a posture lab: it
analyzes your whole kinetic chain on-device, then an AI agent designs and sources a
custom 3D-printed insole for you — and the analysis model improves itself
autonomously. It runs on Akash, uses Zero for live web tools, and Pomerium as its
secure gateway."

**3-minute demo script:** (0:00) problem + one-liner → (0:20) open the link, scan
front view, show the live skeleton daemon → (1:00) deficiency report → (1:20) one
click "Get my fix" → agent activity feed acts on the web live → (2:10) insole in 3D
+ STL + plan → (2:40) "and it self-improves + self-builds" (autonomy slide) → (2:55)
URL + thanks.

**Key stats:** 210 tracked features · 3 sponsors (Akash/Zero/Pomerium), no blocking
keys · MediaPipe 33 landmarks + 3D · One-Euro smoothing · self-supervised
self-improvement gated by deterministic fixtures · Angular 22 / NestJS 11 / MySQL /
Three.js · built by an autonomous loop with branch→PR→auto-merge.

**Live proof already up:** a Zero-hosted page (free) at
https://sites.withzero.ai/newfoot-hello-world
