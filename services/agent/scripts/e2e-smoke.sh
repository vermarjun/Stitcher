#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  Manim Agent Service — end-to-end smoke test
#
#  Tests the full pipeline: /plan → /code → async /generate (SSE)
#
#  Usage:
#    chmod +x scripts/e2e-smoke.sh
#    ./scripts/e2e-smoke.sh
#
#  Requirements: curl, jq
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

BASE_URL="${MANIM_BASE_URL:-http://localhost:4000}"
API_KEY="${MANIM_API_KEY:-REDACTED}"
PROMPT="Animate a blue circle moving across the screen for 3 seconds."

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

pass() { echo -e "${GREEN}[PASS]${NC} $1"; }
fail() { echo -e "${RED}[FAIL]${NC} $1"; exit 1; }
info() { echo -e "${YELLOW}[INFO]${NC} $1"; }

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Manim Agent Service — E2E Smoke Test"
echo "  Base URL : $BASE_URL"
echo "  Provider : OpenCode Go (glm-5.1)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── 1. Health check ───────────────────────────────────────────────────────────

info "Step 1: Health check"
HEALTH=$(curl -sf "$BASE_URL/health" \
  -H "X-Api-Key: $API_KEY" \
  --max-time 10 2>&1) || fail "/health request failed"

echo "$HEALTH" | jq . 2>/dev/null || echo "$HEALTH"
STATUS=$(echo "$HEALTH" | jq -r '.status' 2>/dev/null)
[ "$STATUS" = "ok" ] || fail "Health status not ok: $STATUS"
pass "/health returned status=ok"
echo ""

# ── 2. POST /plan ─────────────────────────────────────────────────────────────

info "Step 2: POST /plan — planner agent (sync, ~10–30s)"
PLAN_RESP=$(curl -sf -X POST "$BASE_URL/plan" \
  -H "X-Api-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"prompt\": \"$PROMPT\",
    \"constraints\": { \"maxScenes\": 1 },
    \"limits\": { \"timeoutSec\": 120 }
  }" \
  --max-time 130 2>&1) || fail "/plan request failed"

echo "$PLAN_RESP" | jq '{success,jobId,error,sceneCount: (.output.scenes | length)}' 2>/dev/null || echo "$PLAN_RESP"

PLAN_SUCCESS=$(echo "$PLAN_RESP" | jq -r '.success' 2>/dev/null)
[ "$PLAN_SUCCESS" = "true" ] || fail "/plan returned success=false: $(echo "$PLAN_RESP" | jq -r '.error')"

SCENE_COUNT=$(echo "$PLAN_RESP" | jq '.output.scenes | length')
[ "$SCENE_COUNT" -ge 1 ] || fail "/plan returned 0 scenes"

STYLE_PRIMARY=$(echo "$PLAN_RESP" | jq -r '.output.styleManifest.primaryColor // empty')
[ -n "$STYLE_PRIMARY" ] || fail "/plan missing styleManifest.primaryColor"

pass "/plan returned $SCENE_COUNT scene(s), styleManifest.primaryColor=$STYLE_PRIMARY"
echo ""

# Extract the first scene for /code test
SCENE_PLAN=$(echo "$PLAN_RESP" | jq '.output.scenes[0]')
STYLE_MANIFEST=$(echo "$PLAN_RESP" | jq '.output.styleManifest')

# ── 3. POST /code ─────────────────────────────────────────────────────────────

info "Step 3: POST /code — coder + validator loop for scene 0 (~20–60s)"
CODE_RESP=$(curl -sf -X POST "$BASE_URL/code" \
  -H "X-Api-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"scenePlan\": $SCENE_PLAN,
    \"styleManifest\": $STYLE_MANIFEST,
    \"codeExamples\": [],
    \"limits\": { \"timeoutSec\": 120 }
  }" \
  --max-time 130 2>&1) || fail "/code request failed"

echo "$CODE_RESP" | jq '{success,jobId,status: .output.status,codeLength: (.output.code | length), error}' 2>/dev/null || echo "$CODE_RESP"

CODE_SUCCESS=$(echo "$CODE_RESP" | jq -r '.success' 2>/dev/null)
[ "$CODE_SUCCESS" = "true" ] || fail "/code returned success=false: $(echo "$CODE_RESP" | jq -r '.error')"

CODE_STATUS=$(echo "$CODE_RESP" | jq -r '.output.status')
[ "$CODE_STATUS" = "done" ] || fail "/code scene status not done: $CODE_STATUS"

CODE_LENGTH=$(echo "$CODE_RESP" | jq -r '.output.code | length')
[ "$CODE_LENGTH" -gt 100 ] || fail "/code returned too-short code ($CODE_LENGTH chars)"

# Verify it looks like Python Manim code
CODE_TEXT=$(echo "$CODE_RESP" | jq -r '.output.code')
echo "$CODE_TEXT" | grep -q "from manim import" || fail "Generated code missing 'from manim import'"
echo "$CODE_TEXT" | grep -q "class Scene" || fail "Generated code missing class definition"

pass "/code returned valid Manim Python ($CODE_LENGTH chars, status=done)"
echo ""

# ── 4. POST /generate (async + SSE) ──────────────────────────────────────────

info "Step 4: POST /generate (async) + GET /stream/:jobId — full pipeline (~30–120s)"
GEN_RESP=$(curl -sf -X POST "$BASE_URL/generate" \
  -H "X-Api-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"prompt\": \"$PROMPT\",
    \"constraints\": { \"maxScenes\": 1 },
    \"limits\": { \"timeoutSec\": 240 }
  }" \
  --max-time 15 2>&1) || fail "/generate request failed"

JOB_ID=$(echo "$GEN_RESP" | jq -r '.jobId' 2>/dev/null)
[ -n "$JOB_ID" ] && [ "$JOB_ID" != "null" ] || fail "/generate did not return a jobId"
pass "/generate returned jobId=$JOB_ID"
info "Streaming SSE from /stream/$JOB_ID ..."
echo ""

# Stream SSE until job_complete or job_failed (or 240s timeout)
STREAM_OUTPUT=$(curl -sN \
  -H "X-Api-Key: $API_KEY" \
  -H "Accept: text/event-stream" \
  "$BASE_URL/stream/$JOB_ID" \
  --max-time 240 2>&1)

# Capture last data line of job_complete event
JOB_COMPLETE_DATA=$(echo "$STREAM_OUTPUT" | grep -A1 "^event: job_complete" | grep "^data:" | tail -1 | sed 's/^data: //')
JOB_FAILED_DATA=$(echo "$STREAM_OUTPUT" | grep -A1 "^event: job_failed" | grep "^data:" | tail -1 | sed 's/^data: //')

if [ -n "$JOB_FAILED_DATA" ]; then
  echo "$JOB_FAILED_DATA" | jq . 2>/dev/null || echo "$JOB_FAILED_DATA"
  fail "/generate job_failed event received"
fi

[ -n "$JOB_COMPLETE_DATA" ] || fail "No job_complete event received within timeout"

FINAL_CODE=$(echo "$JOB_COMPLETE_DATA" | jq -r '.output.scenes[0].code // empty' 2>/dev/null)
FINAL_STATUS=$(echo "$JOB_COMPLETE_DATA" | jq -r '.output.scenes[0].status // empty' 2>/dev/null)

echo "$JOB_COMPLETE_DATA" | jq '{type,sceneCount: (.output.scenes | length), status: .output.scenes[0].status, codeLength: (.output.scenes[0].code | length)}' 2>/dev/null || echo "$JOB_COMPLETE_DATA"

[ "$FINAL_STATUS" = "done" ] || fail "/generate scene status not done: $FINAL_STATUS"
CODE_LEN=${#FINAL_CODE}
[ "$CODE_LEN" -gt 50 ] || fail "/generate returned empty/short code"

echo "$FINAL_CODE" | grep -q "from manim import" || fail "/generate code missing 'from manim import'"

pass "/generate happy path complete — scene status=done, code=$CODE_LEN chars"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}  All smoke tests passed!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
