#!/usr/bin/env bash
# Human-in-the-loop Ralph: one interactive iteration in the sandbox. Watch what
# it does and tune ralph/prompt.md before going AFK.
# Usage: ralph/once.sh
set -euo pipefail
source "$(dirname "$0")/lib.sh"

run_sandbox once
