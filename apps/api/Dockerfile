# syntax=docker/dockerfile:1.7
#
# Multi-stage build for the Stitcher API
#   Stage 1 (builder): compile TypeScript → dist/
#   Stage 2 (runtime): production deps only + ffmpeg

# ─── Stage 1: builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy manifests first for better layer caching
COPY package.json package-lock.json* ./

RUN npm ci

# Copy source files
COPY tsconfig.json ./
COPY src ./src

# Compile TypeScript
RUN npm run build

# ─── Stage 2: runtime ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

# ffmpeg is required by the BullMQ video worker. fontconfig + a DejaVu font are
# required by ffmpeg's drawtext filter when burning in text overlays — without
# a font on the host, drawtext falls back to the "Sans" family and fails.
# APK_MIRROR replaces the Alpine mirror root, for slow networks, for example
# --build-arg APK_MIRROR=https://mirrors.edge.kernel.org/alpine (default: unchanged).
ARG APK_MIRROR=""
RUN if [ -n "$APK_MIRROR" ]; then \
      sed -i "s|https\?://dl-cdn.alpinelinux.org/alpine|${APK_MIRROR%/}|g" /etc/apk/repositories; \
    fi \
    && apk add --no-cache ffmpeg fontconfig font-dejavu

ENV NODE_ENV=production

WORKDIR /app

# Copy manifests and install production deps only
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/index.js"]
