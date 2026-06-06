# syntax=docker/dockerfile:1.7
#
# Multi-stage build:
#   1. base     — Node 20 + Python + system deps (manim, ffmpeg for validation)
#   2. pydeps   — install Python validation deps
#   3. nodedeps — install Node deps
#   4. build    — TypeScript compile + build manim API index
#   5. runtime  — lean production image

ARG NODE_VERSION=20
ARG PY_VERSION=3.11

# ── stage 1: base ─────────────────────────────────────────────────────────────
FROM python:${PY_VERSION}-slim-bookworm AS base

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# Node.js
RUN apt-get update && apt-get install -y --no-install-recommends \
      curl ca-certificates gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# ── stage 2: pydeps ───────────────────────────────────────────────────────────
FROM base AS pydeps

RUN pip install manim pyflakes && \
    pip install ruff || true  # ruff is optional; validator degrades gracefully

# ── stage 3: nodedeps ─────────────────────────────────────────────────────────
FROM pydeps AS nodedeps

WORKDIR /build
COPY package*.json ./
RUN npm ci --omit=dev

# ── stage 4: assets ────────────────────────────────────────────────────────────
# Use pre-built dist to avoid tsc OOM on large @langchain type graphs in ARM64 containers.
# Run `npm run build` on the host before `docker compose up --build`.
# src/assets/manim_api_index.json is pre-generated; copy it directly.
FROM scratch AS builder

WORKDIR /build
COPY dist/ ./dist/
COPY src/assets/manim_api_index.json ./dist/assets/manim_api_index.json
COPY src/assets/manim_cheatsheet.json ./dist/assets/manim_cheatsheet.json
COPY src/assets/ruff_manim.toml ./dist/assets/ruff_manim.toml

# ── stage 5: runtime ──────────────────────────────────────────────────────────
FROM pydeps AS runtime

WORKDIR /srv

# Node modules (prod only)
COPY --from=nodedeps /build/node_modules ./node_modules
# Compiled JS + assets
COPY --from=builder /build/dist ./dist

ENV NODE_ENV=production \
    MANIM_API_INDEX_PATH=/srv/dist/assets/manim_api_index.json \
    MANIM_CHEATSHEET_PATH=/srv/dist/assets/manim_cheatsheet.json \
    RUFF_CONFIG_PATH=/srv/dist/assets/ruff_manim.toml \
    SKILLS_DIR=/srv/dist/prompts/skills \
    PYTHON_PATH=python3 \
    PORT=4000

RUN useradd --system --uid 10001 --home-dir /srv --shell /usr/sbin/nologin agent && \
    chown -R agent:agent /srv
USER agent

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -fsS http://127.0.0.1:4000/health >/dev/null || exit 1

CMD ["node", "dist/index.js"]
