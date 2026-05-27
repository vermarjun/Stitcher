#!/usr/bin/env bash
# Stop the Stitcher local dev stack.
# Does NOT remove containers — just kills Node processes and stops containers.

set -uo pipefail

color() { printf "\033[1;%sm%s\033[0m\n" "$1" "$2"; }
info()  { color 36 "[dev-down] $1"; }

# Kill any node process owning :3100, :4000, :7001
for port in 3100 4000 7001; do
  pid="$(lsof -ti tcp:$port 2>/dev/null || true)"
  if [ -n "$pid" ]; then
    info "Killing PID $pid on :$port"
    kill "$pid" 2>/dev/null || true
  fi
done

# Stop containers (keep them around for next dev-up)
for name in stitcher-mongo stitcher-redis manim-render-service; do
  if docker ps --format '{{.Names}}' | grep -q "^${name}$"; then
    info "Stopping container: $name"
    docker stop "$name" >/dev/null || true
  fi
done

info "Done. Logs preserved in /tmp/stitcher-logs/."
