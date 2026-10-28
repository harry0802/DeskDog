#!/usr/bin/env bash
# AFK Ralph: run one-issue iterations in the sandbox until the agent reports
# the backlog is done or the iteration cap is hit.
# Usage: ralph/afk.sh <iterations>
set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Usage: $0 <iterations>" >&2
  exit 1
fi

source "$(dirname "$0")/lib.sh"

for ((i = 1; i <= $1; i++)); do
  echo "=== Ralph iteration $i/$1 ==="
  # claude -p prints only when the iteration ends, so there is nothing to
  # stream. (tee /dev/stderr reopens the log under Git Bash and garbles it.)
  result=$(run_sandbox afk)
  echo "$result"

  # Whole-line match only: the agent sometimes mentions the tag in prose
  # ("I haven't output <promise>COMPLETE</promise>").
  if grep -qxE '[[:space:]]*<promise>COMPLETE</promise>[[:space:]]*' <<<"$result"; then
    echo "=== Backlog done after $i iteration(s) ==="
    exit 0
  fi
done

echo "=== Stopped at the $1-iteration cap; issues may remain ==="
