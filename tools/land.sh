#!/usr/bin/env bash
# tools/land.sh — land the CURRENT feature branch into main, CI/CD style:
#   push → open PR → squash auto-merge → delete branch → back to a clean main.
#
# POC workflow (ADR-0011): sessions never commit to main directly. Each session
# works on a feat/Fxxx-<slug> branch and lands it through a PR.
#
# Env:
#   LAND_MERGE_MODE=admin|auto   admin (default) = merge immediately (admin bypass);
#                                auto = enable GitHub auto-merge (waits for required
#                                checks — use once CI like Buildkite/Actions gates PRs).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BRANCH="$(git branch --show-current)"
MERGE_MODE="${LAND_MERGE_MODE:-admin}"

if [ "$BRANCH" = "main" ] || [ -z "$BRANCH" ]; then
  echo "✗ refusing to land: not on a feature branch (on '$BRANCH'). Create feat/Fxxx-<slug> first." >&2
  exit 1
fi
if [ -n "$(git status --porcelain)" ]; then
  echo "✗ working tree is dirty — commit your work on '$BRANCH' before landing." >&2
  git status --short >&2
  exit 1
fi

have_remote_gh() {
  git remote get-url origin >/dev/null 2>&1 &&
    command -v gh >/dev/null 2>&1 &&
    gh auth status >/dev/null 2>&1
}

if have_remote_gh; then
  echo "▸ Landing '$BRANCH' via GitHub PR (mode=$MERGE_MODE)…"
  git push -u origin "$BRANCH" --quiet

  if ! gh pr view "$BRANCH" >/dev/null 2>&1; then
    gh pr create --base main --head "$BRANCH" --fill
  fi

  if [ "$MERGE_MODE" = "auto" ]; then
    gh pr merge "$BRANCH" --squash --auto --delete-branch
  else
    gh pr merge "$BRANCH" --squash --admin --delete-branch
  fi

  # Return to a clean, updated main.
  git checkout main --quiet 2>/dev/null || true
  git pull --ff-only origin main --quiet
  git branch -D "$BRANCH" 2>/dev/null || true
  git remote prune origin >/dev/null 2>&1 || true
else
  echo "▸ No GitHub remote/gh available — landing locally (no-ff merge into main)…"
  git checkout main
  git merge --no-ff "$BRANCH" -m "Merge $BRANCH"
  git branch -d "$BRANCH"
fi

echo "✓ Landed '$BRANCH' into main. Now on: $(git branch --show-current)"
