#!/usr/bin/env bash
# Bring up the full Stitcher local dev stack in dependency order.
# Assumes sibling repos at ../../Manim-Agent-Service, ../../ManimRAG, ../../manim-render-service.
# Logs land in /tmp/stitcher-logs/<service>.log.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DESKTOP="$(cd "$ROOT/../.." && pwd)"
LOGDIR="/tmp/stitcher-logs"
mkdir -p "$LOGDIR"

color() { printf "\033[1;%sm%s\033[0m\n" "$1" "$2"; }
info()  { color 36 "[dev-up] $1"; }
ok()    { color 32 "[dev-up] ✔ $1"; }
err()   { color 31 "[dev-up] ✗ $1"; }

wait_for_url() {
  local url="$1"; local name="$2"; local timeout="${3:-60}"
  for ((i=0; i<timeout; i++)); do
    if curl -sf --max-time 3 "$url" >/dev/null 2>&1; then
      ok "$name reachable at $url"
      return 0
    fi
    sleep 1
  done
  err "$name timed out waiting for $url"
  return 1
}

# ─── 1. Mongo ────────────────────────────────────────────────────────────────
info "Ensuring stitcher-mongo container is up…"
if ! docker ps --format '{{.Names}}' | grep -q '^stitcher-mongo$'; then
  if docker ps -a --format '{{.Names}}' | grep -q '^stitcher-mongo$'; then
    docker start stitcher-mongo >/dev/null
  else
    docker run -d --name stitcher-mongo -p 27017:27017 \
      -e MONGO_INITDB_ROOT_USERNAME=admin \
      -e MONGO_INITDB_ROOT_PASSWORD=stitcherlocal \
      mongo:7 >/dev/null
  fi
fi
ok "Mongo container up"

# ─── 2. Redis ────────────────────────────────────────────────────────────────
info "Ensuring redis on :6379…"
if ! (echo > /dev/tcp/localhost/6379) 2>/dev/null; then
  docker run -d --name stitcher-redis -p 6379:6379 redis:7-alpine >/dev/null
fi
ok "Redis up"

# ─── 3. Render service (must be local Linux container — bubblewrap needed) ──
info "Ensuring manim-render-service on :8000…"
if ! curl -sf --max-time 2 http://localhost:8000/health >/dev/null 2>&1; then
  if docker ps -a --format '{{.Names}}' | grep -q '^manim-render-service$'; then
    docker start manim-render-service >/dev/null
  else
    err "manim-render-service container not found. Build it first:"
    err "  cd $DESKTOP/manim-render-service && docker compose up -d --build"
    exit 1
  fi
  wait_for_url "http://localhost:8000/health" "Render" 30 || exit 1
else
  ok "Render already up"
fi

# ─── 4. ManimRAG ─────────────────────────────────────────────────────────────
info "Starting ManimRAG on :7001…"
if ! curl -sf --max-time 2 http://localhost:7001/health >/dev/null 2>&1; then
  (cd "$DESKTOP/ManimRAG/pipeline" && npm run dev > "$LOGDIR/rag.log" 2>&1 &)
  wait_for_url "http://localhost:7001/health" "RAG" 30 || exit 1
else
  ok "RAG already up"
fi

# ─── 5. Manim Agent Service ──────────────────────────────────────────────────
info "Starting Manim-Agent-Service on :4000…"
if ! curl -sf --max-time 2 http://localhost:4000/health >/dev/null 2>&1; then
  (cd "$DESKTOP/Manim-Agent-Service" && npm run dev > "$LOGDIR/agent.log" 2>&1 &)
  wait_for_url "http://localhost:4000/health" "Agent" 30 || exit 1
else
  ok "Agent already up"
fi

# ─── 6. Stitcher API ─────────────────────────────────────────────────────────
API_PORT="${API_PORT:-3100}"
info "Starting Stitcher API on :$API_PORT…"
if ! curl -sf --max-time 2 "http://localhost:$API_PORT/api/health" >/dev/null 2>&1; then
  (cd "$ROOT/API" && npm run dev > "$LOGDIR/api.log" 2>&1 &)
  wait_for_url "http://localhost:$API_PORT/api/health" "API" 30 || exit 1
else
  ok "API already up"
fi

echo
ok "Full stack is up."
echo "  Mongo:  :27017"
echo "  Redis:  :6379"
echo "  Render: :8000"
echo "  RAG:    :7001"
echo "  Agent:  :4000"
echo "  API:    :$API_PORT"
echo
echo "Logs: $LOGDIR/{api,agent,rag}.log"
echo "Health: curl http://localhost:$API_PORT/api/health"
