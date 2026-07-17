# Newfoot — Initializer Agent (session 0 prompt)

This is the **session-0** role. It runs **once** to produce the environment every
later coding session depends on. It does **NOT** implement product features.

If you are reading this in a fresh clone that already has `feature_list.json`,
`init.sh`, `CLAUDE.md`, and `docs/research.md`, initialization is already done —
switch to `prompts/coding_agent.md` instead.

## Deliverables (build in this order)
1. `docs/research.md` — state of the art for client-side pose estimation, the
   posture-metric → threshold table per view, and insole 3D-printing filament
   guidance, with citations. Pick MediaPipe Pose Landmarker unless research
   justifies otherwise.
2. `docs/insole-rules.md` — explicit, testable rule table: posture findings +
   foot size → insole parameters (arch height, heel wedge angle, heel cup depth,
   thickness, material, print settings). Include worked JSON examples as fixtures.
3. `feature_list.json` — `{ "version": 1, "features": [ ... ] }` with 100–200+
   end-to-end, user-visible features, each `{ id, category, description, steps[],
   passes:false }`. Include error states, empty states, responsive, dark mode,
   accessibility, disclaimer, and observability as first-class features.
4. `init.sh` — idempotent: build/start the Docker stack, wait for healthchecks,
   run migrations, print the frontend URL and the ngrok command.
5. Deterministic tools (`tools/`): `db.sh`, `stl_check.js`, `pose_fixtures/`,
   `test_media/*.y4m` + generator, `expose.sh`. Browser MCP config in `.mcp.json`.
6. Application **skeleton only**: the stack boots and an empty shell page renders
   (frontend + backend health + DB wiring proven). **Zero product features.**
7. Harness: `prompts/initializer.md` (this file), `prompts/coding_agent.md`,
   `run_loop.sh`, `smoke/` suite (with a skeleton guard test), `CLAUDE.md`,
   `claude-progress.txt` (first entry), `docs/decisions.md` (ADRs).
8. `git init` (already done), a real `.gitignore`, and an initial commit.

## Principles
- Follow Anthropic's guidance: *Building Effective Agents*, *Effective Context
  Engineering*, *Effective Harnesses for Long-Running Agents*, *Writing Effective
  Tools for AI Agents*, and the `autonomous-coding` quickstart.
- Keep state **outside the context window**: `feature_list.json` (goal),
  `claude-progress.txt` (narrative), git (code), `docs/decisions.md` (ADRs).
- Prefer the simplest thing that works. You may delegate bounded research/drafting
  to subagents that return condensed summaries; do not build an orchestration
  framework.
- Verify the skeleton the same way coding agents will: `./init.sh` then the
  Playwright smoke suite renders the shell in a real browser with a screenshot.

## Definition of done for session 0
`./init.sh` brings the stack up from clean; `cd smoke && npm test` is green; the
shell renders with a screenshot; `feature_list.json` has 100+ features all
`passes:false`; docs, tools, prompts, and `run_loop.sh` exist; `git status` clean
after the initial commit.
