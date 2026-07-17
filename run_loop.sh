#!/usr/bin/env bash
# run_loop.sh — headless Newfoot coding-agent loop.
#
# Each session: runs `claude -p` with the coding-agent prompt, one feature per
# session, logging every model turn/tool-call to logs/session-NN.jsonl and a
# summary to logs/session-NN.json. After each session it ENFORCES the contract:
# fails loudly if the repo is left dirty, and reports features-passing count and
# cost per session (§5.5, §5.8).
#
# Usage:
#   ./run_loop.sh [num_sessions]        # default 1
# Env:
#   NEWFOOT_MODEL   model id (default claude-fable-5; override e.g. claude-opus-4-8
#                   for harder features)
#   MAX_TURNS       per-session turn cap (default 200)
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

SESSIONS="${1:-1}"
MAX_TURNS="${MAX_TURNS:-200}"
MODEL="${NEWFOOT_MODEL:-claude-fable-5}"

command -v claude >/dev/null 2>&1 || { echo "error: claude CLI not found." >&2; exit 1; }
mkdir -p logs

count_passing() {
  node -e 'const d=require("./feature_list.json");console.log(d.features.filter(f=>f.passes).length+"/"+d.features.length)'
}

next_num() {
  local n=1
  while [ -f "$(printf 'logs/session-%03d.jsonl' "$n")" ]; do n=$((n+1)); done
  printf '%03d' "$n"
}

BOOTSTRAP='Read prompts/coding_agent.md and CLAUDE.md in full, then complete EXACTLY ONE failing feature from feature_list.json following the startup routine. Run ./init.sh, run the smoke suite, pick one passes:false feature, implement it, verify it end-to-end through the browser (screenshot to logs/screens/), add a smoke test, flip passes:true only after real verification, commit with a descriptive message, and append an entry to claude-progress.txt. Leave the repo clean.'

for ((s=1; s<=SESSIONS; s++)); do
  NN="$(next_num)"
  LOG="logs/session-${NN}.jsonl"
  SUMMARY="logs/session-${NN}.json"

  before="$(count_passing)"
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

  # Summarize from the final stream-json "result" event.
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

  after="$(count_passing)"
  echo "▸ Session ${NN} done | passing ${before} -> ${after} | exit ${code}"

  # Contract: repo must be clean after every session.
  if [ -n "$(git status --porcelain)" ]; then
    echo "✗ CONTRACT VIOLATION: repo is dirty after session ${NN}." >&2
    git status --short >&2
    echo "  Stopping loop. Inspect and clean before continuing." >&2
    exit 2
  fi
done

echo "▸ Loop complete. Final: $(count_passing) features passing."
