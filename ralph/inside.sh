#!/usr/bin/env bash
# Runs inside the sandbox container: one Ralph iteration against /work.
# Usage: ralph/inside.sh once|afk
set -euo pipefail

mode="$1"

# The repo is a Windows checkout bind-mounted into Linux: trust it, and read it
# the way the host's git does so files don't all show up as modified.
git config --global --add safe.directory /work
git config --global core.autocrlf true
git config --global core.filemode false

pnpm install --frozen-lockfile --reporter=silent

issues=$(gh issue list --state open --label ready-for-agent --limit 100 \
  --json number,title,body,labels,comments \
  --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]')

# Nothing to do: skip the model call entirely.
if [ "$issues" = "[]" ]; then
  echo "No open ready-for-agent issues. <promise>COMPLETE</promise>"
  exit 0
fi

recent=$(git log --oneline --grep="^RALPH:" -10)

prompt="$(cat ralph/prompt.md)

# RECENT RALPH COMMITS

${recent:-(none yet)}

# OPEN ISSUES

$issues"

if [ "$mode" = once ]; then
  exec claude --permission-mode acceptEdits "$prompt"
else
  # Safe only because this runs in the container, which sees nothing but /work.
  exec claude -p --dangerously-skip-permissions "$prompt"
fi
