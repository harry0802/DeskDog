#!/usr/bin/env bash
# Shared by once.sh and afk.sh: start the Podman sandbox for one iteration.

if ! command -v cygpath >/dev/null; then
  echo "Ralph needs Git Bash, but this is another bash (likely WSL)." >&2
  echo "From PowerShell run: .\\ralph\\afk.ps1 <iterations>  or  .\\ralph\\once.ps1" >&2
  exit 1
fi

# Stop Git Bash from rewriting container paths like /work into C:\...
export MSYS_NO_PATHCONV=1

# C:/... form: with path conversion off, native git.exe can't read /c/...
root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -W)
env_file="$root/ralph/.env"
image="sandcastle:deskdog"
podman=$(command -v podman || echo "/c/Program Files/RedHat/Podman/podman.exe")

if [ ! -f "$env_file" ]; then
  echo "Missing ralph/.env — run: cp ralph/.env.example ralph/.env and fill in the tokens." >&2
  exit 1
fi

if ! "$podman" image exists "$image"; then
  echo "Missing image $image — run: pnpm exec sandcastle podman build-image --image-name $image" >&2
  exit 1
fi

# Usage: run_sandbox once|afk
run_sandbox() {
  local tty=()
  [ "$1" = once ] && tty=(-it)

  # node_modules lives in a named volume so the Linux install never
  # overwrites the host's Windows node_modules.
  "$podman" run --rm "${tty[@]}" \
    --env-file "$(cygpath -w "$env_file")" \
    -e ELECTRON_SKIP_BINARY_DOWNLOAD=1 \
    -e GIT_AUTHOR_NAME="$(git -C "$root" config user.name)" \
    -e GIT_AUTHOR_EMAIL="$(git -C "$root" config user.email)" \
    -e GIT_COMMITTER_NAME="$(git -C "$root" config user.name)" \
    -e GIT_COMMITTER_EMAIL="$(git -C "$root" config user.email)" \
    -v "$(cygpath -w "$root"):/work" \
    -v deskdog-ralph-node-modules:/work/node_modules:U \
    -w /work \
    --entrypoint bash \
    "$image" ralph/inside.sh "$1"
}
