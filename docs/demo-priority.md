# Demo-First Priority Track (HACKATHON)

**This overrides strict top-to-bottom feature selection.** The loop should build
the next `passes:false` feature **in the order below**, not by ascending ID. The
goal is the winning 3-minute demo that scores the judging criteria — **Autonomy**
(an agent acting on the web with real-time data), **Idea**, **Technical
Implementation**, **Tool Use (≥3 sponsor tools)**, **Demo**.

Rules:
- Build the earliest not-yet-passing feature in this track. Respect dependencies
  (a feature listed later assumes earlier ones exist).
- A feature's dependencies inside the core app may pull in a neighbor not listed
  here — that's fine; build the minimum needed, keep it in the track's spirit.
- When this whole track is `passes:true`, fall back to top-to-bottom for the rest.

## ⚠️ STATUS (2026-07-17): sponsor keys NOT set → SKIP these until keys exist
F166/F167/F168 + the agent + the chatbot need keys in `.env` (`AKASHML_API_KEY`,
`ZERO_API_KEY`, `GHOST_DATABASE_URL`). **While those are empty, SKIP ENTIRELY**
(do not spend a session on them, do not retry, do not fake a sponsor call):
- **F166–F168** (Phase 1 sponsors), **F169–F178** (Phase 3 agent),
  **F179–F181 & F189** (Phase 4 chatbot), **F190** (email gate after chat).

Build the buildable phases instead: Phase 0 remainder → **Phase 2** →
**Phase 5 (minus F189)** → **Phase 6** → **F191–F192**. That is ~150 features of
real progress with no keys. **When the keys are added, delete this banner** and the
loop resumes the skipped phases automatically. Get the keys early — they unblock the
headline (Autonomy).

---

## Phase 0 — Foundation quick wins (mostly already true; verify + smoke)
- **F002** backend reachable via same-origin `/api`
- **F004** dockerized stack end-to-end
- **F005** HTTPS/secure-context via ngrok (needed for camera in the live demo)

## Phase 1 — Wire the 3 sponsors (the Tool-Use requirement; unblocks the agent)
- **F166** Akash/AkashML backend client (LLM brain, server-side key, streaming)
- **F167** Zero.xyz tool gateway (agent's real-time web tools)
- **F168** Ghost Postgres agent memory/state

## Phase 2 — Minimal scan that produces findings (feeds the agent)
- **F026** camera preview · **F034** MediaPipe loads · **F035** skeleton overlay
- **F041** wizard entry (3 view cards) · **F042** FRONT capture flow
- **F044** countdown capture · **F046** baked overlay on frozen frame · **F048** accept
- **F053** shoulder-tilt metric · **F056** knee alignment metric (≥1 real finding)
- **F063** per-view deficiency report · **F065** plain-language explanation
- **F110** anonymous session id · **F117** persist analysis · **F126** disclaimer on report

## Phase 3 — The Concierge agent (HEADLINE — Autonomy)
- **F169** agent orchestrator (plan→tool→observe loop; AkashML + Zero + Ghost)
- **F170** one-click "Get my fix" starts it with findings + foot size, no further input
- **F175** live agent activity feed (SSE) — visibly acting on the web autonomously
- **F171** real-time filament price/availability (Zero) · **F173** evidence-based exercises (cited)
- **F174** compiled action plan + print/purchase quote
- **F172** nearby print-service/podiatrist finder · **F176** run persisted to Ghost
- **F177** graceful tool-failure/timeout · **F178** agent run log (steps/tokens/cost)

## Phase 4 — Chatbot (reuses AkashML; cheap, demoable)
- **F179** SSE chat proxy · **F180** grounded widget that refuses medical advice · **F181** rate limits

## Phase 5 — Landing page (the demo's front door + funnel)
- **F182** hero + single CTA · **F184** privacy banner + disclaimer · **F183** how-it-works
- **F189** chatbot widget on landing · **F188** mobile sticky CTA / responsive

## Phase 6 — Minimal insole payoff (if time)
- **F076** foot-size form · **F081** generate insole · **F090** interactive 3D view · **F098** STL download

## Phase 7 — Progressive identity / lead capture (if time)
- **F190** soft email gate · **F191** email to receive STL/plan · **F192** retrieve by link

## Phase 8 — Optional 4th sponsor / hosting (only if ahead)
- **F193** Pomerium secure ingress · **F194** deploy to Akash Network

---

### Minimum Viable Demo (cut line)
If time is short, the smallest set that still wins on Autonomy + Tool Use is:
**Phase 1 (F166–F168) + a trimmed Phase 2 (F026, F034, F035, F042, F044, F048,
F053, F063, F110) + Phase 3 core (F169, F170, F175, F171, F174) + Phase 5 F182/F184.**
That demonstrates: scan → one-click autonomous agent acting live on the web via
3 sponsor tools → concrete plan. Everything else is upside.
