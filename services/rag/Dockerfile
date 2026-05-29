# ─── Stage 1: builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy manifests first for better layer caching
COPY package.json package-lock.json* ./

RUN npm ci --ignore-scripts

# Copy source
COPY tsconfig.json tsup.config.ts ./
COPY src ./src
COPY cli.ts ./
COPY data ./data
COPY prompts ./prompts

# Build library + server + CLI
RUN npm run build

# ─── Stage 2: runtime ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

ENV NODE_ENV=production

WORKDIR /app

# Copy manifests and install production deps only
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts

# Copy compiled output and static assets
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/data ./data
COPY --from=builder /app/prompts ./prompts

EXPOSE 7000

# Preload the OpenTelemetry bootstrap so auto-instrumentations patch core
# modules before the server is required. Matches the `npm start` script.
CMD ["node", "-r", "./dist/instrumentation.cjs", "dist/server.cjs"]
