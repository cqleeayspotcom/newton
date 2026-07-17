# Demo-First Priority Track (HACKATHON)

**This overrides strict top-to-bottom feature selection.** The loop builds the next
`passes:false` feature **in the order below**, not by ascending ID. Goal: the winning
3-minute demo — **Autonomy**, **Idea**, **Technical Implementation**,
**Tool Use (≥3 sponsor tools)**, **Demo**.

Rules:
- Build the earliest not-yet-passing feature in this track. Respect dependencies.
- When the whole track is `passes:true`, fall back to top-to-bottom for the rest.

## ⚠️ STATUS (2026-07-17): which sponsor features are buildable
3 sponsors = **Akash + Zero + Pomerium** (ADR-0014), all buildable with NO blocking key:
- ✅ **Akash DEPLOY (F194)** — `CONSOLE_API_KEY` set; deploy via `console-axi` (ADR-0013).
- ✅ **Zero (F167)** — `zero` CLI set up (no key); free capabilities cost 0.
- ✅ **Pomerium (F193, F204, F205)** — open-source proxy, no key (`docs/pomerium.md`).
- ✅ **Agent memory (F168, F176)** — MySQL (Ghost dropped), no key.
- ⛔ **Only `AKASHML_API_KEY` (LLM brain) is still EMPTY.** Until it's added, **SKIP
  ENTIRELY** (no retry, no faking) the LLM-powered features: **F166**, **F169–F175 &
  F177–F178** (agent reasoning), **F179–F181 & F189** (chatbot), **F190**. Everything
  else — F167, F168, F176, F193/F204/F205, the posture daemon — is buildable now.

---

## ⭐ HACKATHON DELIVERY — BUILD THESE FIRST (operator request 2026-07-17)
These complete the demo. Build in THIS order, BEFORE resuming the daemon polish
(F197–F210) or anything else. Keep everything CLIENT-SIDE (extend the MVP slice —
`analysis/`, `capture/`, `insole/` — no backend/DB needed). Verify each in the
browser with the real-person fake camera (`tools/test_media/person.y4m`) + a screenshot.

1. **Reference-posture ghost overlay (skeleton: normal vs real).**
   - **F071** — draw a SECOND, dimmed "ideal" skeleton on the capture overlay next to
     the detected one: anchored to the user's shoulder/hip midline, but with LEVEL
     shoulders + level hips + vertical spine/head. Extend `capture.ts` `drawSkeleton`.
   - **F074** — highlight the body segments that deviate past threshold (warning color).
   - **F073** — a toggle to show/hide the reference ghost.

2. **Interactive 3D insole (Three.js).** EXTEND the existing `/insole` component.
   - Add Three.js: `docker compose exec frontend npm install three @types/three`
     (and add to frontend/package.json).
   - **F090** — build a parametric insole mesh from the recommended spec
     (length/width/arch height/heel wedge/heel cup) and render it in a Three.js viewer.
   - **F091** rotate (OrbitControls) · **F092** zoom. Client-side only.

3. **STL export for 3D printing.**
   - **F098** — export the generated insole mesh to a valid, watertight BINARY STL
     (Three.js `STLExporter`) with a download button. VALIDATE with
     `node tools/stl_check.js <file>` (must pass watertight + dims).
   - **F099** — the mirrored right-foot STL.

After these, resume Phase 1 daemon polish (F197–F210) then the rest.

---

## Phase 0 — Foundation (mostly done; verify + smoke)
- **F002** ✅ · **F004** ✅ · **F005** HTTPS/secure-context via ngrok (camera)

## Phase 1 — REAL-TIME POSTURE PERCEPTION DAEMON  ⭐ TOP PRIORITY
The headline analysis engine (see `docs/posture-daemon.md`). Build in this order:
- **Camera + pose base:** F026 (preview) · F034 (MediaPipe loads) · F035 (skeleton overlay)
- **Daemon loops:**
  - **F195** inference in a Web Worker (UI stays smooth)
  - **F196** decoupled multi-rate loop pipeline (capture→inference→smoothing→metrics→feedback)
  - **F197** One-Euro smoothing (stable skeleton) · **F198** confidence weighting
  - **F199** persistence/hysteresis gating (no transient false positives)
  - **F200** temporal sequence model (rolling stats → optional TF.js LSTM)
  - **F201** closed-loop coaching + live quality meter
  - **F202** adaptive calibration (tilt / scale / baseline)
  - **F203** privacy-preserving derived-metrics logging (self-improve hook)
  - **Autonomous self-improvement loop (L7) — F206–F210:** scheduled daemon that
    self-tunes thresholds/filters against self-supervised objectives, gated by the
    pose_fixtures (no human intervention, auto-apply + auto-rollback). See
    `docs/self-improve-loop.md`. (Build after F203 provides logs.)
- **Front-view scan → real findings:** F041 (wizard entry) · F042 (FRONT flow) ·
  F044 (countdown) · F048 (accept) · F053 (shoulder tilt) · F056 (knee) ·
  F063 (deficiency report) · F065 (plain-language) · F110 (session id) ·
  F117 (persist) · F126 (disclaimer)

## Phase 2 — Sponsors / autonomous agent (Autonomy + Tool Use)
- ✅ **F194** deploy on Akash via console-axi (runs-on-the-sponsor; buildable now)
- ✅ **F167** Zero CLI web tools · **F168/F176** agent memory in MySQL (buildable now)
- ⛔ (needs `AKASHML_API_KEY`) **F166** LLM brain → **F169, F170, F175, F171, F173,
  F174, F172, F177, F178** Concierge agent reasoning

## Phase 3 — Chatbot (needs AkashML key)
- ⛔ F179 · F180 · F181

## Phase 4 — Landing page (demo front door)
- F182 hero+CTA · F184 privacy+disclaimer · F183 how-it-works ·
  F188 mobile sticky · (⛔ F189 chatbot widget — needs key)

## Phase 5 — Insole payoff (if time)
- F076 foot form · F081 generate · F090 3D view · F098 STL download

## Phase 6 — Progressive identity / lead capture (if time)
- F191 email→STL/plan · F192 retrieve by link · (⛔ F190 needs chat)

## Phase 7 — Pomerium (core sponsor) + extras
- F193 Pomerium reverse proxy · F204 access policy · F205 HTTPS + identity headers

---

### Minimum Viable Demo (cut line)
Smallest winning set: **Phase 1 posture daemon (F026,F034,F035,F195–F203 + a
front-view finding F053/F063) + F194 (runs on Akash) + Phase 4 landing F182/F184.**
That shows: a real-time, self-improving posture analysis (loops/daemon) running on
Akash. Add the agent/chatbot once the AkashML LLM key lands — that's the
Autonomy upside.
