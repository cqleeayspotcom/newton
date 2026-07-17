# Demo-First Priority Track (HACKATHON)

**This overrides strict top-to-bottom feature selection.** The loop builds the next
`passes:false` feature **in the order below**, not by ascending ID. Goal: the winning
3-minute demo — **Autonomy**, **Idea**, **Technical Implementation**,
**Tool Use (≥3 sponsor tools)**, **Demo**.

Rules:
- Build the earliest not-yet-passing feature in this track. Respect dependencies.
- When the whole track is `passes:true`, fall back to top-to-bottom for the rest.

## ⚠️ STATUS (2026-07-17): which sponsor features are buildable
- ✅ **Akash DEPLOY (F194)** is UNBLOCKED — `CONSOLE_API_KEY` is set and we use the
  `console-axi` CLI/skill to deploy (see ADR-0013). Buildable any time.
- ⛔ **AkashML (LLM), Zero.xyz, Ghost** keys are still EMPTY. While they are, **SKIP
  ENTIRELY** (no retry, no faking): F166–F168, F169–F178, F179–F181 & F189, F190.
  When those keys are added, delete this line and the loop resumes those phases.

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
- **Front-view scan → real findings:** F041 (wizard entry) · F042 (FRONT flow) ·
  F044 (countdown) · F048 (accept) · F053 (shoulder tilt) · F056 (knee) ·
  F063 (deficiency report) · F065 (plain-language) · F110 (session id) ·
  F117 (persist) · F126 (disclaimer)

## Phase 2 — Sponsors / autonomous agent (Autonomy + Tool Use)
- ✅ **F194** deploy on Akash via console-axi (runs-on-the-sponsor; buildable now)
- ⛔ (needs keys) **F166–F168** wire AkashML + Zero + Ghost → **F169, F170, F175,
  F171, F173, F174, F172, F176, F177, F178** Concierge agent

## Phase 3 — Chatbot (needs AkashML key)
- ⛔ F179 · F180 · F181

## Phase 4 — Landing page (demo front door)
- F182 hero+CTA · F184 privacy+disclaimer · F183 how-it-works ·
  F188 mobile sticky · (⛔ F189 chatbot widget — needs key)

## Phase 5 — Insole payoff (if time)
- F076 foot form · F081 generate · F090 3D view · F098 STL download

## Phase 6 — Progressive identity / lead capture (if time)
- F191 email→STL/plan · F192 retrieve by link · (⛔ F190 needs chat)

## Phase 7 — Optional extras
- F193 Pomerium ingress

---

### Minimum Viable Demo (cut line)
Smallest winning set: **Phase 1 posture daemon (F026,F034,F035,F195–F203 + a
front-view finding F053/F063) + F194 (runs on Akash) + Phase 4 landing F182/F184.**
That shows: a real-time, self-improving posture analysis (loops/daemon) running on
Akash. Add the agent/chatbot once the AkashML/Zero/Ghost keys land — that's the
Autonomy upside.
