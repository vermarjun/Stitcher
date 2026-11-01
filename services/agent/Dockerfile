# syntax=docker/dockerfile:1.7
FROM node:20-bookworm-slim AS builder
WORKDIR /build
ENV NODE_OPTIONS=--max-old-space-size=3072
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
COPY copy-assets.cjs ./copy-assets.cjs
RUN npm run build && npm prune --omit=dev

FROM node:20-bookworm-slim AS runtime
WORKDIR /srv
ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    NODE_ENV=production \
    PYTHON_PATH=/opt/validator/bin/python \
    PATH=/opt/validator/bin:$PATH \
    PORT=4000
# The runner uses ast/compile, not Manim imports or rendering.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-venv curl ca-certificates \
    && python3 -m venv /opt/validator \
    && /opt/validator/bin/pip install --no-cache-dir pyflakes==3.4.0 ruff==0.14.2 \
    && rm -rf /var/lib/apt/lists/*
# /srv is root-owned and the service runs as node; ruff needs a writable cache.
ENV RUFF_CACHE_DIR=/tmp/ruff_cache
COPY --from=builder /build/node_modules ./node_modules
COPY --from=builder /build/dist ./dist
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -fsS http://127.0.0.1:4000/health >/dev/null || exit 1
CMD ["node", "-r", "./dist/instrumentation.js", "dist/index.js"]
