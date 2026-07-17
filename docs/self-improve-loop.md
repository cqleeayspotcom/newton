# Autonomous Self-Improvement Loop (L7)

The loop that **makes the posture analysis better over time on its own** — no human
in the loop, no manual labels, no approval step. Features **F206–F210**. It is the
L7 of the perception daemon (`docs/posture-daemon.md`) and it never regresses the
deterministic ground truth.

Grounded in the reference approach (Pandey, Medium): angles → compare to **ideal
ranges** → detect, with a **temporal/LSTM** model. Those "ideal ranges" and the
filter/temporal parameters are exactly what this loop tunes.

## Why it can run with zero human intervention
The hard part of "self-improving" is usually needing labeled ground truth. We avoid
that with **self-supervised objectives** + a **deterministic guardrail**:

- **Self-supervised quality signals (no labels needed):**
  - **Temporal stability** — a correct measurement is steady frame-to-frame; a good
    parameter set lowers per-metric variance without adding lag.
  - **Cross-view agreement** — front/side/back metrics that should correlate (e.g.
    pelvic obliquity) must agree; disagreement signals bad params.
  - **Invariance** — mirroring or rescaling the input must not change a normalized
    angle; calibration (L6) should absorb it. Violations penalize the objective.
  - **Confidence-weighted consistency** — high-visibility landmarks should dominate.
- **Deterministic guardrail (ground truth we DO have):** `tools/pose_fixtures/`
  encode known-correct landmark→angle math. **Any parameter change that breaks a
  fixture is rejected, always.** This is the safety floor that makes autonomy safe.

## The loop (scheduled daemon — F206)
```
 (cron / interval, no human trigger)
        │
        ▼
 1. AGGREGATE   derived-metric logs (F203, angles/stats only — never video)
        │        + replay buffer of logged landmark sequences
        ▼
 2. SCORE       compute the self-supervised objective for the CURRENT params (F207)
        │        → "analysis quality" score, tracked over time (should trend up)
        ▼
 3. PROPOSE     bounded gradient-free search over params (F208):
        │        ideal angle thresholds, One-Euro beta/mincutoff, persistence
        │        window N, hysteresis enter/exit  (optional: retrain temporal/LSTM)
        ▼
 4. VALIDATE    each candidate: replay objective must improve by a margin AND
        │        every pose_fixtures assertion must still pass — else REJECT (F208)
        ▼
 5. APPLY       auto-apply the best non-regressing candidate, no human step (F209)
        │        write an audit record: params before/after, objective delta, result
        ▼
 6. WATCH       if a later window regresses, AUTO-ROLLBACK to prior params (F209)
```

## Safety rails (F210)
- **Bounds/clamps** — every tunable has a sane min/max; proposals are clamped.
- **Kill-switch** — a flag freezes auto-tuning instantly (no changes while frozen).
- **Fixtures are non-overridable** — no applied change can make a fixture fail.
- **Audit trail** — every change (and rollback) is recorded and viewable in-app.

## Relationship to the other loops
- **Runtime perception loops (L1–L6)** analyze in real time (`docs/posture-daemon.md`).
- **This loop (L7)** tunes their *parameters/model* offline, autonomously.
- **The build loop (`run_loop.sh`)** autonomously improves the *code*. Distinct
  autonomy layers: L7 improves the model without shipping code; run_loop ships code.

## Implementation notes
- Backend daemon (NestJS scheduled task / interval), reads/writes params + audit in
  MySQL; optimization is plain, dependency-light (random/grid/CMA-ES — no heavy deps).
- The objective and validation are **unit-tested**; a noisier stream must score lower,
  and a fixture-breaking candidate must be rejected (F207/F208 tests).
- Everything is derived-metrics only — **video never leaves the device** (privacy).
