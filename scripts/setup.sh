#!/usr/bin/env bash
# Create .env for Docker Compose: random secrets, your LLM provider and key.
#
#   ./scripts/setup.sh                                  asks for provider and key
#   ./scripts/setup.sh --provider gemini --key <key>    no questions
#   ./scripts/setup.sh --provider ollama --model llama3.1   no key, local model
#
# It never overwrites an existing .env unless you pass --force (the old file is
# saved as .env.bak first). Works with the bash 3.2 that ships with macOS.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/.env"
TEMPLATE="$ROOT/.env.example"

PROVIDER=""
MODEL=""
KEY=""
EMBEDDER="local"
EMBEDDER_KEY=""
PORT=""
FORCE=0

usage() {
  cat <<'EOF'
Usage: scripts/setup.sh [options]

Options:
  --provider NAME     openai, anthropic, gemini, openrouter, groq, ollama or opencodego
  --model NAME        model name (default depends on the provider)
  --key KEY           API key for the provider (or set LLM_API_KEY in the environment)
  --embedder NAME     local (default, no key), openai, gemini or ollama
  --embedder-key KEY  key for openai or gemini embeddings (defaults to the LLM key
                      when the provider is the same)
  --port PORT         host port for the web app (default 8080)
  --force             replace an existing .env (the old one is saved as .env.bak)
  -h, --help          show this help

With no options in a terminal, the script asks for the provider and key.
EOF
}

die() { echo "setup.sh: $*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --provider)     [ $# -ge 2 ] || die "--provider needs a value"; PROVIDER="$2"; shift 2 ;;
    --model)        [ $# -ge 2 ] || die "--model needs a value"; MODEL="$2"; shift 2 ;;
    --key)          [ $# -ge 2 ] || die "--key needs a value"; KEY="$2"; shift 2 ;;
    --embedder)     [ $# -ge 2 ] || die "--embedder needs a value"; EMBEDDER="$2"; shift 2 ;;
    --embedder-key) [ $# -ge 2 ] || die "--embedder-key needs a value"; EMBEDDER_KEY="$2"; shift 2 ;;
    --port)         [ $# -ge 2 ] || die "--port needs a value"; PORT="$2"; shift 2 ;;
    --force)        FORCE=1; shift ;;
    -h|--help)      usage; exit 0 ;;
    *)              usage >&2; die "unknown option: $1" ;;
  esac
done

case "$PORT" in
  *[!0-9]*) die "--port must be a number" ;;
esac

[ -f "$TEMPLATE" ] || die "missing $TEMPLATE (run this from a full clone)"

if [ -f "$ENV_FILE" ] && [ "$FORCE" -ne 1 ]; then
  echo ".env already exists, leaving it alone. Use --force to replace it."
  echo "Next: docker compose up -d"
  exit 0
fi

command -v openssl >/dev/null 2>&1 || die "openssl is required to generate secrets"

lower() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]'; }
INTERACTIVE=0
[ -t 0 ] && INTERACTIVE=1

# ── Provider ────────────────────────────────────────────────────────────────
if [ -z "$PROVIDER" ]; then
  [ "$INTERACTIVE" -eq 1 ] || die "pass --provider (and --key) when not running in a terminal"
  cat <<'EOF'
Which LLM provider do you want to use?
  1) gemini      (has a free tier)
  2) openai
  3) anthropic
  4) openrouter
  5) groq
  6) ollama      (models on this computer, no key)
  7) opencodego
EOF
  printf 'Choose 1-7 or type a name [1]: '
  read -r choice
  case "$(lower "${choice:-1}")" in
    1|gemini) PROVIDER=gemini ;;
    2|openai) PROVIDER=openai ;;
    3|anthropic) PROVIDER=anthropic ;;
    4|openrouter) PROVIDER=openrouter ;;
    5|groq) PROVIDER=groq ;;
    6|ollama) PROVIDER=ollama ;;
    7|opencodego) PROVIDER=opencodego ;;
    *) die "unknown provider: $choice" ;;
  esac
fi
PROVIDER="$(lower "$PROVIDER")"
case "$PROVIDER" in
  openai|anthropic|gemini|openrouter|groq|ollama|opencodego) ;;
  *) die "unknown provider '$PROVIDER'. Use openai, anthropic, gemini, openrouter, groq, ollama or opencodego." ;;
esac

# ── Key ─────────────────────────────────────────────────────────────────────
KEY="${KEY:-${LLM_API_KEY:-}}"
if [ "$PROVIDER" != "ollama" ] && [ -z "$KEY" ]; then
  [ "$INTERACTIVE" -eq 1 ] || die "$PROVIDER needs an API key. Pass --key or set LLM_API_KEY."
  printf 'API key for %s (input is hidden): ' "$PROVIDER"
  read -r -s KEY
  echo
  [ -n "$KEY" ] || die "no key entered"
fi

# ── Model ───────────────────────────────────────────────────────────────────
default_model() {
  case "$1" in
    openai) echo "gpt-4.1-mini" ;;
    anthropic) echo "claude-sonnet-5-5" ;;
    gemini) echo "gemini-2.5-flash" ;;
    groq) echo "llama-3.3-70b-versatile" ;;
    ollama) echo "llama3.1" ;;
    opencodego) echo "glm-5.1" ;;
    *) echo "" ;;
  esac
}
if [ -z "$MODEL" ]; then
  MODEL="$(default_model "$PROVIDER")"
  if [ "$INTERACTIVE" -eq 1 ]; then
    if [ -n "$MODEL" ]; then
      printf 'Model [%s]: ' "$MODEL"
    else
      printf 'Model name (required for %s): ' "$PROVIDER"
    fi
    read -r answer
    [ -z "$answer" ] || MODEL="$answer"
  fi
  [ -n "$MODEL" ] || die "$PROVIDER has no default model. Pass --model."
  if [ "$PROVIDER" = "ollama" ] && [ "$INTERACTIVE" -ne 1 ]; then
    echo "No --model given. Using $MODEL. Pull it first with: ollama pull $MODEL"
  fi
fi

# ── Embedder ────────────────────────────────────────────────────────────────
EMBEDDER="$(lower "$EMBEDDER")"
case "$EMBEDDER" in
  local) ;;
  openai|gemini)
    if [ -z "$EMBEDDER_KEY" ]; then
      if [ "$PROVIDER" = "$EMBEDDER" ] && [ -n "$KEY" ]; then
        EMBEDDER_KEY="$KEY"
      elif [ "$INTERACTIVE" -eq 1 ]; then
        printf 'API key for %s embeddings (input is hidden): ' "$EMBEDDER"
        read -r -s EMBEDDER_KEY
        echo
      fi
      [ -n "$EMBEDDER_KEY" ] || die "--embedder $EMBEDDER needs a key. Pass --embedder-key."
    fi
    ;;
  ollama) ;;
  *) die "unknown embedder '$EMBEDDER'. Use local, openai, gemini or ollama." ;;
esac
if [ "$PROVIDER" = "anthropic" ] && [ "$EMBEDDER" = "local" ]; then
  echo "Anthropic has no embeddings API, so retrieval uses the local embedder (no key needed)."
fi

# ── Write .env ──────────────────────────────────────────────────────────────
if [ -f "$ENV_FILE" ]; then
  cp -p "$ENV_FILE" "$ENV_FILE.bak"
  echo "Saved the old file as .env.bak"
fi
cp "$TEMPLATE" "$ENV_FILE"
chmod 600 "$ENV_FILE"

# Replace "KEY=..." or "# KEY=..." with "KEY=value", or append when absent.
set_var() {
  local tmp
  tmp="$(mktemp "$ROOT/.env.XXXXXX")"
  KEY_NAME="$1" KEY_VALUE="$2" awk '
    BEGIN { k = ENVIRON["KEY_NAME"]; v = ENVIRON["KEY_VALUE"]; done = 0 }
    !done && (index($0, k "=") == 1 || index($0, "# " k "=") == 1) { print k "=" v; done = 1; next }
    { print }
    END { if (!done) print k "=" v }
  ' "$ENV_FILE" > "$tmp"
  mv "$tmp" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
}

secret() { openssl rand -hex 32; }

set_var JWT_SECRET "$(secret)"
set_var REDIS_PASSWORD "$(secret)"
set_var AGENT_API_KEY "$(secret)"
set_var RAG_API_KEY "$(secret)"
set_var RENDER_API_KEY "$(secret)"
# Only used with --profile obs.
set_var GRAFANA_ADMIN_PASSWORD "$(openssl rand -hex 12)"
set_var LANGFUSE_DB_PASSWORD "$(openssl rand -hex 12)"
set_var LANGFUSE_NEXTAUTH_SECRET "$(secret)"
set_var LANGFUSE_SALT "$(secret)"
set_var LANGFUSE_ENCRYPTION_KEY "$(secret)"

set_var LLM_PROVIDER "$PROVIDER"
set_var LLM_MODEL "$MODEL"
[ -z "$KEY" ] || set_var LLM_API_KEY "$KEY"

if [ "$PROVIDER" = "ollama" ]; then
  # Ollama runs on the host. compose.yaml maps host.docker.internal for Linux.
  set_var LLM_BASE_URL "http://host.docker.internal:11434/v1"
fi

# The RAG service speaks to openai, gemini, openrouter, ollama and opencodego.
# For anthropic and groq it uses their OpenAI-compatible endpoints instead.
case "$PROVIDER" in
  anthropic)
    set_var RAG_LLM_PROVIDER openai
    set_var RAG_LLM_BASE_URL "https://api.anthropic.com/v1"
    set_var RAG_LLM_API_KEY "$KEY"
    set_var RAG_LLM_MODEL "$MODEL"
    ;;
  groq)
    set_var RAG_LLM_PROVIDER openai
    set_var RAG_LLM_BASE_URL "https://api.groq.com/openai/v1"
    set_var RAG_LLM_API_KEY "$KEY"
    set_var RAG_LLM_MODEL "$MODEL"
    ;;
esac

if [ "$EMBEDDER" != "local" ]; then
  set_var EMBEDDER_PROVIDER "$EMBEDDER"
  [ -z "$EMBEDDER_KEY" ] || set_var EMBEDDER_API_KEY "$EMBEDDER_KEY"
  if [ "$EMBEDDER" = "ollama" ]; then
    set_var EMBEDDER_OLLAMA_BASE_URL "http://host.docker.internal:11434"
  fi
fi

if [ -n "$PORT" ]; then
  set_var WEB_PORT "$PORT"
  set_var PUBLIC_URL "http://localhost:$PORT"
fi

echo "Wrote .env (provider: $PROVIDER, model: $MODEL, embeddings: $EMBEDDER)."
if [ "$PROVIDER" = "ollama" ]; then
  echo "Ollama must run on this computer with the model pulled: ollama pull $MODEL"
  echo "On Linux, start it with OLLAMA_HOST=0.0.0.0 so containers can reach it."
fi
echo
echo "Next:"
echo "  docker compose up -d"
echo "  open http://localhost:${PORT:-8080}"
echo "  the signup code is printed in: docker compose logs api | grep -i otp"
