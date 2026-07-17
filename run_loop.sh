#!/usr/bin/env bash
# run_loop.sh — headless Newfoot coding-agent loop.
#
# Each session: runs `claude -p` with the coding-agent prompt, one feature per
# session, logging every model turn/tool-call to logs/session-NN.jsonl and a
# summary to logs/session-NN.json. Work happens on a feat/ branch and lands via
# a PR (tools/land.sh). After each session it ENFORCES the contract: fails loudly
# if the session doesn't end on a clean main, and reports passing-count + cost.
#
# Usage:
#   ./run_loop.sh [N]        # run N sessions (default 1)
#   ./run_loop.sh all        # run UNTIL all features pass (or the loop stalls)
# Env:
#   NEWFOOT_MODEL   model id (default claude-opus-4-8; override e.g. claude-sonnet-5)
#   MAX_TURNS       per-session turn cap (default 200)
#   STALL_LIMIT     'all' mode: stop after this many no-progress sessions (default 4)
#   MAX_SESSIONS    'all' mode: hard safety cap on total sessions (default 300)
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

ARG="${1:-1}"
MAX_TURNS="${MAX_TURNS:-200}"
MODEL="${NEWFOOT_MODEL:-claude-opus-4-8}"
STALL_LIMIT="${STALL_LIMIT:-4}"
MAX_SESSIONS="${MAX_SESSIONS:-300}"

command -v claude >/dev/null 2>&1 || { echo "error: claude CLI not found." >&2; exit 1; }
mkdir -p logs

pass_num()  { node -e 'const d=require("./feature_list.json");console.log(d.features.filter(f=>f.passes).length)'; }
total_num() { node -e 'const d=require("./feature_list.json");console.log(d.features.length)'; }

next_num() {
  local n=1
  while [ -f "$(printf 'logs/session-%03d.jsonl' "$n")" ]; do n=$((n+1)); done
  printf '%03d' "$n"
}

BOOTSTRAP='Read prompts/coding_agent.md and CLAUDE.md in full, then complete EXACTLY ONE failing feature following the startup routine. Run ./init.sh, run the smoke suite, and pick the next passes:false feature from docs/demo-priority.md (demo-first order, NOT ascending id). Create a feat/<Fxxx>-<slug> branch off main (never commit to main). Implement it, verify end-to-end through the browser (screenshot to logs/screens/), add a smoke test, flip passes:true only after real verification, append an entry to claude-progress.txt, commit on the branch, then run tools/land.sh to open a PR and squash auto-merge into main. End on a clean main.'

# Run one coding session. Exits the whole script (2) on a contract violation.
run_session() {
  local NN LOG SUMMARY before after code
  NN="$(next_num)"
  LOG="logs/session-${NN}.jsonl"
  SUMMARY="logs/session-${NN}.json"

  # Start each session from a clean, up-to-date main (work happens on a branch).
  git checkout main --quiet 2>/dev/null || true
  git pull --ff-only origin main --quiet 2>/dev/null || true

  before="$(pass_num)/$(total_num)"
  echo "==================================================================="
  echo "▸ Session ${NN} | model=${MODEL} | max-turns=${MAX_TURNS} | passing ${before}"
  echo "==================================================================="

  printf '%s' "$BOOTSTRAP" | claude -p \
    --model "$MODEL" \
    --max-turns "$MAX_TURNS" \
    --output-format stream-json --verbose \
    --dangerously-skip-permissions \
    | tee "$LOG"
  code="${PIPESTATUS[1]}"

  node -e '
    const fs=require("fs");
    const lines=fs.readFileSync(process.argv[1],"utf8").trim().split("\n");
    let res=null;
    for(const l of lines){ try{const o=JSON.parse(l); if(o.type==="result") res=o;}catch{} }
    const out=res?{
      session: process.argv[2],
      is_error: res.is_error ?? null,
      num_turns: res.num_turns ?? null,
      duration_ms: res.duration_ms ?? null,
      total_cost_usd: res.total_cost_usd ?? null,
      result: (res.result||"").slice(0,500)
    }:{session:process.argv[2],note:"no result event found"};
    fs.writeFileSync(process.argv[3], JSON.stringify(out,null,2));
    console.log("  cost=$"+(out.total_cost_usd??"?")+" turns="+(out.num_turns??"?")+" error="+(out.is_error??"?"));
  ' "$LOG" "$NN" "$SUMMARY" || echo "  (could not summarize session ${NN})"

  after="$(pass_num)/$(total_num)"
  echo "▸ Session ${NN} done | passing ${before} -> ${after} | exit ${code}"

  # Contract: session must land its branch and return to a clean main.
  local CUR_BRANCH
  CUR_BRANCH="$(git branch --show-current)"
  if [ "$CUR_BRANCH" != "main" ]; then
    echo "✗ CONTRACT VIOLATION: session left branch '${CUR_BRANCH}' checked out (expected main)." >&2
    echo "  Did tools/land.sh run? Stopping loop." >&2
    exit 2
  fi
  if [ -n "$(git status --porcelain)" ]; then
    echo "✗ CONTRACT VIOLATION: repo is dirty after session ${NN}." >&2
    git status --short >&2
    echo "  Stopping loop. Inspect and clean before continuing." >&2
    exit 2
  fi
}

# --- mode detection --------------------------------------------------------
MODE="count"; SESSIONS=1
if [ "$ARG" = "all" ] || [ "$ARG" = "until-done" ]; then
  MODE="until-done"
else
  case "$ARG" in
    ''|*[!0-9]*) echo "usage: ./run_loop.sh [N|all]" >&2; exit 2 ;;
    *) SESSIONS="$ARG" ;;
  esac
fi

# --- driver ----------------------------------------------------------------
s=0; stall=0
while :; do
  s=$((s+1))

  if [ "$MODE" = "count" ]; then
    [ "$s" -gt "$SESSIONS" ] && break
  else
    if [ "$s" -gt "$MAX_SESSIONS" ]; then
      echo "▸ Reached MAX_SESSIONS=${MAX_SESSIONS}; stopping."; break
    fi
    if [ "$(pass_num)" -ge "$(total_num)" ]; then
      echo "▸ All $(total_num) features passing — solution complete. 🎉"; break
    fi
  fi

  before_n="$(pass_num)"
  run_session
  after_n="$(pass_num)"

  if [ "$MODE" = "until-done" ]; then
    if [ "$after_n" -le "$before_n" ]; then
      stall=$((stall+1))
      echo "▸ No new passing feature (${stall}/${STALL_LIMIT} no-progress sessions)."
      if [ "$stall" -ge "$STALL_LIMIT" ]; then
        echo "✗ Stopping: ${STALL_LIMIT} consecutive sessions with no progress." >&2
        echo "  Likely blocked (e.g. missing sponsor keys in .env) or a hard bug. Inspect logs/." >&2
        break
      fi
    else
      stall=0
    fi
  fi
done

echo "▸ Loop finished. Final: $(pass_num)/$(total_num) features passing."
