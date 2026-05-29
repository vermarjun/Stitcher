#!/usr/bin/env bash
# verify-ingestion.sh — smoke-test a running ManimRAG service end-to-end.
#
# Usage:
#   ./scripts/verify-ingestion.sh
#   MANIMRAG_URL=http://localhost:7000 MANIMRAG_API_KEY=... ./scripts/verify-ingestion.sh
#
# Requires: curl, python3.

set -euo pipefail

BASE_URL="${MANIMRAG_URL:-http://localhost:7000}"
API_KEY="${MANIMRAG_API_KEY:-local_dev_rag_key_change_me_16char_min}"

pp() { python3 -m json.tool 2>/dev/null || cat; }

echo "=== ManimRAG verification — $BASE_URL ==="

echo "--- GET /health ---"
curl -s "$BASE_URL/health" | pp

echo "--- GET /capabilities ---"
curl -s "$BASE_URL/capabilities" | pp

echo "--- GET /corpus/stats ---"
curl -s "$BASE_URL/corpus/stats" -H "x-api-key: $API_KEY" | pp

PROMPTS=(
  "animate bubble sort with bars swapping heights"
  "explain binary search on a sorted array"
  "draw and transform a square into a circle"
  "plot sin(x) on axes and trace the curve"
  "visualize a fully connected neural network with signal flow"
)

for q in "${PROMPTS[@]}"; do
  echo "--- POST /enhance — \"$q\" ---"
  curl -s "$BASE_URL/enhance" \
    -H "x-api-key: $API_KEY" -H 'content-type: application/json' \
    -d "{\"prompt\":\"$q\",\"options\":{\"topK\":5}}" \
  | python3 -c "
import sys, json
d = json.load(sys.stdin)
if 'error' in d:
    print('  ERROR:', d); sys.exit(0)
sc, tr, ex = d['structuredContext'], d['retrievalTrace'], d['execution']
print(f\"  apiExamples={len(sc['apiExamples'])} similarScripts={len(sc['similarScripts'])} \"
      f\"style={len(sc['styleRecommendations'])} pitfalls={len(sc['pitfalls'])}\")
print(f\"  trace: dense={tr['denseCandidates']} merged={tr['mergedCandidates']} \"
      f\"afterRerank={tr['afterRerank']} transformed={tr['queryTransformed']}\")
print(f\"  exec(ms): total={ex['totalMs']} qt={ex['queryTransformMs']} embed={ex['embeddingMs']} \"
      f\"vsearch={ex['vectorSearchMs']} rerank={ex['rerankMs']} llmCalls={ex['llmCalls']}\")
top = (sc['apiExamples'] or sc['similarScripts'])
if top: print('  top hit:', top[0].get('symbol') or top[0].get('title'), '| score', top[0].get('score'))
"
done
echo "=== done ==="
