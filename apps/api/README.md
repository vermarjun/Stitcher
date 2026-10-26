# Stitcher API

Express and TypeScript backend. It handles accounts, projects and the timeline, and it runs the queue workers that turn a prompt into a video by calling the RAG, agent and render services.

One user owns each project. There are no plans, credits, teams or admin pages.

## Requirements

- Node.js 20 or newer
- MongoDB (a standalone server is enough, no replica set needed)
- Redis
- `ffmpeg` and `ffprobe` on the PATH (thumbnails, upload probing, timeline export)
- The RAG, agent and render services running (see the repo root)

## Run it

```bash
npm install
cp .env.example .env     # set at least the required block
npm run dev
```

The API listens on port 3000 and serves everything under `/api`. `GET /api/health` returns 200 when MongoDB and Redis are reachable.

With `EMAIL_PROVIDER=console` (the default) the signup code is printed in the API log. Look for `[email:console]`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start with tsx |
| `npm run build` | Compile to `dist/` |
| `npm start` | Run the compiled output |
| `npm test` | Run the unit tests |
| `npm run lint` | Run ESLint |
| `npm run smoke:mock` | Check that the dependencies of the smoke test are reachable |
| `npm run smoke` | Generate one real video end to end through a running API |

## Environment variables

The full list, with a comment for each, is in `.env.example`. The API refuses to boot if a required value is missing, and `JWT_SECRET` must have at least 32 characters.

Required: `MONGODB_URL`, `REDIS_HOST`, `JWT_SECRET`, and a URL and key for each of the three services (`RAG_*`, `AGENT_*`, `RENDER_*`).

Optional groups:

- **LLM**: `LLM_PROVIDER` (default `openai`), `LLM_MODEL`, `LLM_API_KEY`, `LLM_BASE_URL`. Override one role with `CODER_*`, `DEBUGGER_*` or `QUERY_TRANSFORM_*`. Supported providers: openai, anthropic, gemini, openrouter, groq, ollama, opencodego. A role that uses a different provider than `LLM_PROVIDER` does not inherit its key or model.
- **Embedder**: `EMBEDDER_*`. Leave unset to use the RAG service's own embedder.
- **Voiceover**: `TTS_PROVIDER` (`gtts` needs no key, or `azure`).
- **Storage**: `STORAGE` (`local` or `cloudinary`), `STORAGE_DIR`, `MAX_UPLOAD_MB`.
- **Email**: `EMAIL_PROVIDER` (`console`, `smtp` or `gmail`) and `SMTP_*`.
- **Google sign-in**: `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. When unset, `GET /api/users/google` returns 404 `google_auth_disabled`.
- **OpenTelemetry**: `OTEL_EXPORTER_OTLP_ENDPOINT`. Telemetry is off until it is set.

## Storage

By default files are written to `STORAGE_DIR` (`./data/media`) and served by the API at `/api/media/<key>`. Media URLs are built from `PUBLIC_API_URL`, so set it to the address the browser uses to reach the API when that is not `http://localhost:PORT`. The media route is public. File names contain random ids.

The render service writes each video to its own volume and returns a URL. The API downloads it and stores it. If the render service returns a `file://` URL, set `LOCAL_STORAGE_PUBLIC_URL_BASE` on the render service so the API can fetch the file.

With `STORAGE=cloudinary` the same calls go to Cloudinary instead. Set the three `CLOUDINARY_*` values.

## Routes

All paths start with `/api`. Every route needs a bearer token except the ones marked public.

| Area | Routes |
|---|---|
| Health | `GET /health` (public) |
| Media | `GET /media/*` (public, only with `STORAGE=local`) |
| Users | `POST /users/signup/start`, `/signup/verify`, `/signup/resend`, `/login`, `/request-password-reset`, `/reset-password/:token`, `/resend-verification`, `GET /users/google`, `GET /users/verify-email/:token` (all public); `GET`, `PUT`, `DELETE /users/me`, `POST /users/me/onboarding/complete`, `PUT /users/change-password`, `POST /users/profile-photo` |
| Projects | `POST /project`, `GET /project/user/:userId`, `GET`, `PUT`, `DELETE /project/:id` |
| Generate | `POST /generatechat`, `GET /generatechat/update/:chatId`, `/latest-message/:chatId`, `/jobs`, `/project/:projectId`, `/:chatId/status`, `/:chatId`, `POST /generatechat/cancel/:chatId` |
| Edit | `POST /editchat/process`, `GET /editchat/history/:projectId`, `POST /editchat/rollback` |
| Timeline | `GET /timeline/project/:projectId`, `PUT /timeline/:timelineId`, `POST /timeline/project/:projectId/export` |
| Tracks | `GET /track/timeline/:timelineId`, `POST /track/:trackId/asset`, `POST /track/:trackId/text`, `PUT /track/items/:itemId`, `DELETE /track/items/:timelineItemId` |
| Assets | `POST /asset/upload` (multipart: `file`, `projectId`, optional `name`), `POST /asset`, `GET /asset`, `GET /asset/stats`, `GET /asset/project/:projectId`, `GET /asset/type/:type`, `GET /asset/origin/:origin`, `GET`, `PUT /asset/:id`, `DELETE /asset/:assetId` |
| Script | `GET`, `PUT`, `PATCH /script/:projectId` |
| Memory | `GET`, `POST /memory`, `POST /memory/reflect`, `PATCH`, `DELETE /memory/:id` |

Progress events go over Socket.IO on the same port. A client sends its token in the handshake `auth.token`, then emits `join_chat` with a chat id or `join_project` with a project id. Events arrive as `chat_update`.

## Smoke test

`scripts/smoke.ts` creates a test user directly in MongoDB, submits a prompt to a running API and waits for the `job_complete` event. It needs the real RAG, agent and render services and a working LLM key.

```bash
npm run smoke:mock                           # checks reachability only, makes no LLM calls
npm run smoke                                # full run, takes a few minutes
SMOKE_API_BASE_URL=http://host:3000 npm run smoke
SMOKE_TIMEOUT_SEC=600 npm run smoke
```
