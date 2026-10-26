#!/usr/bin/env bash
# Usage: ./examples/render.sh <file.json>
set -euo pipefail

: "${RENDER_API_KEY:?set RENDER_API_KEY in your env first}"
: "${HOST:=http://localhost:8000}"

if [[ $# -lt 1 ]]; then
  echo "usage: $0 <payload.json>" >&2
  exit 2
fi

curl -sS -X POST "${HOST}/render" \
  -H "X-Api-Key: ${RENDER_API_KEY}" \
  -H "Content-Type: application/json" \
  --data-binary "@$1" \
  | jq .
