# syntax=docker/dockerfile:1.7
# Builds the SPA and serves it with nginx on port 8080.
# nginx also proxies /api and /socket.io to the "api" service, so the browser
# talks to one origin and needs no CORS setup.

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
# A path means "same origin as the page". See src/config.ts.
ARG VITE_BACKEND_URL=/api
ARG VITE_GOOGLE_CLIENT_ID=
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL \
    VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
