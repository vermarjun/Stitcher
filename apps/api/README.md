# Stitcher API

Express + TypeScript backend that orchestrates RAG, agent, and render services for Manim-based video generation.

## Prerequisites

- Node.js >= 18
- A running MongoDB instance
- A running Redis instance

## Setup

```bash
npm install
cp .env.example .env
# Edit .env and fill in all required values
npm run dev
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start in development mode via ts-node |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled output |

## Required Environment Variables

Copy `.env.example` to `.env` and set every value. The server will exit at boot with a clear error listing any missing keys.

| Variable | Description |
|---|---|
| `NODE_ENV` | `development` / `production` / `test` |
| `PORT` | HTTP port (e.g. `3000`) |
| `API_PREFIX` | Route prefix (e.g. `/api`) |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins (e.g. `http://localhost:5173`) |
| `LOG_LEVEL` | `debug` / `info` / `warn` / `error` |
| `MONGODB_URL` | MongoDB connection string |
| `REDIS_HOST` | Redis hostname |
| `REDIS_PORT` | Redis port (default `6379`) |
| `REDIS_PASSWORD` | Redis password |
| `JWT_SECRET` | Secret for signing JWTs |
| `EMAIL_USER` | Gmail address for transactional email |
| `EMAIL_APP_PASSWORD` | Gmail App Password |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 client secret |
| `RZP_KEY_ID` | Razorpay key ID |
| `RZP_KEY_SECRET` | Razorpay key secret |
| `RAG_SERVICE_URL` | URL of the ManimRAG service |
| `RAG_API_KEY` | API key for ManimRAG service |
| `AGENT_SERVICE_URL` | URL of the Manim agent service |
| `AGENT_API_KEY` | API key for Manim agent service |
| `RENDER_SERVICE_URL` | URL of the Manim render service |
| `RENDER_API_KEY` | API key for Manim render service |

## Smoke test

`scripts/smoke.ts` is an end-to-end test that exercises the full generation pipeline from HTTP request through BullMQ worker, RAG/Agent/Render service calls, ffmpeg concat, and Cloudinary upload — verifying a `job_complete` Socket.IO event with a valid `finalUrl` is received within the timeout window.

### Prerequisites

The smoke test checks all of these before doing anything else:

- MongoDB reachable at `MONGODB_URL`
- Redis reachable at `REDIS_HOST:REDIS_PORT`
- RAG service responding at `RAG_SERVICE_URL/health`
- Agent service responding at `AGENT_SERVICE_URL/health`
- Render service responding at `RENDER_SERVICE_URL/health`
- Cloudinary credentials present (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`)
- `ffmpeg` available in `PATH`
- `JWT_SECRET` set in env

### Running

```bash
# Pre-flight only — confirms all dependencies are reachable; no LLM credits consumed
npm run smoke:mock

# Full end-to-end run — generates a real video (takes a few minutes)
npm run smoke

# Target a remote dev instance instead of localhost
SMOKE_API_BASE_URL=https://api.dev.stitcher.app npm run smoke

# Extend the timeout (default 300 s) for slow render services
SMOKE_TIMEOUT_SEC=600 npm run smoke
```

`smoke:mock` completes in seconds.  
`smoke` (live) takes 1–5 minutes depending on render service speed.

On failure the script prints a copy-pasteable fix command for each broken dependency and exits with code 1.
