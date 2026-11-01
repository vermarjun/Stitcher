# ─── Stage 1: builder ─────────────────────────────────────────────────────────
# Debian (glibc) base: onnxruntime-node, used by the local embedder, has no musl build.
FROM node:20-slim AS builder

WORKDIR /app

# Copy manifests first for better layer caching
COPY package.json package-lock.json* ./

RUN npm ci --ignore-scripts

# Copy source
COPY tsconfig.json tsup.config.ts seed.ts ./
COPY src ./src
COPY data ./data
COPY prefetch-model.mjs ./

# Build library + server + CLI
RUN npm run build

# Bake the local embedding model into the image (no network needed at runtime)
ENV MODELS_DIR=/app/models
RUN node prefetch-model.mjs

# ─── Stage 2: runtime ─────────────────────────────────────────────────────────
FROM node:20-slim AS runtime

ENV NODE_ENV=production \
    MODELS_DIR=/app/models \
    EMBEDDER_OFFLINE=true

WORKDIR /app

# Copy manifests and install production deps only
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts \
 && rm -rf node_modules/onnxruntime-web \
    node_modules/onnxruntime-node/bin/napi-v6/darwin \
    node_modules/onnxruntime-node/bin/napi-v6/win32 \
 && npm cache clean --force

# Copy compiled output, static assets and model weights
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/data ./data
COPY --from=builder /app/models ./models

EXPOSE 7000

# Preload the OpenTelemetry bootstrap so auto-instrumentations patch core
# modules before the server is required. Matches the `npm start` script.
CMD ["node", "-r", "./dist/instrumentation.cjs", "dist/server.cjs"]
