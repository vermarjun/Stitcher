# Stitcher

Open-source AI video generation pipeline using Manim.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node-20%2B-brightgreen)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3.11%2B-blue)](https://www.python.org/)

---

## Overview

Stitcher is a backend orchestration system that turns a plain-text prompt into an animated
educational or explanatory video. It coordinates four services — a retrieval service, an LLM
agent, a sandboxed renderer, and the central API — to plan scenes, write Manim Python code,
render each scene, concatenate the clips with ffmpeg, and deliver the final video via Cloudinary.
It is aimed at developers who want to self-host AI video generation, educators who need
programmatic access to animated explainers, and content creators building on top of Manim.
Type a prompt, get an animated explainer video.

---

## Architecture

The system is split into four independently deployable services. This keeps the Python rendering
environment isolated from the Node.js orchestration layer, allows each service to scale
separately, and makes it possible to swap out any one component (e.g. a different LLM agent or a
different renderer) without touching the others.

```
Frontend (separate repo)
        │
        ▼
Backend API  (Express/TypeScript, port 3000)
        │
        ├── HTTP handlers — auth, projects, payments, chat
        │
        └── BullMQ Job Queue  (Redis)
                │
                ▼
            Worker process
                │
                ├──► RAG Service           (port 7000)
                │    Retrieves relevant Manim examples from the vector store
                │
                ├──► Agent Service         (port 4000)
                │    Plans scenes, writes Manim code, debugs render failures
                │
                └──► Render Service        (port 8000)
                     Executes Manim inside a bubblewrap sandbox, uploads clips
                             │
                             ▼
                         Cloudinary
                         (CDN — final video URL returned to the client via SSE)
```

**Service responsibilities:**

- **Backend API** — Express/TypeScript. Handles auth (JWT + Google OAuth), project CRUD,
  payments (Razorpay), user-facing chat, and video-generation job dispatch via BullMQ.
  Streams progress events to the frontend over SSE and Socket.IO.
- **RAG Service** — Node/Fastify. Performs vector search (Qdrant or MongoDB Atlas) over a
  corpus of Manim documentation and code examples. Returns ranked snippets used by the agent
  as context.
- **Agent Service** — Node/Fastify + LangGraph. Runs an LLM agent that consumes RAG context
  and the user prompt, produces a scene plan, generates Manim Python code per scene, and
  retries on render failures.
- **Render Service** — Python/FastAPI + bubblewrap. Receives a Manim script, executes it
  inside a sandboxed process, and uploads the rendered video clip to Cloudinary.

---

## Quick Start

### A. Backend only (against your own external services)

**Prerequisites:** Node 20+, MongoDB (local or Atlas), Redis.

```bash
git clone https://github.com/vermarjun/Stitcher.git
cd Stitcher/API
cp .env.example .env
# Edit .env — at minimum set MONGODB_URL, JWT_SECRET, REDIS_*, CLOUDINARY_*,
# and the three service URL + API key pairs.
npm install
npm run build
npm start
```

The API starts on port 3000. The three external services must be running and reachable at the
URLs set in `.env` before job processing will work. See [`API/README.md`](API/README.md) for
the full environment variable reference.

---

### B. Full stack via Docker Compose

**Prerequisites:** Docker Desktop 4.x+ (or Docker Engine + Compose v2 on Linux).

Clone all four repos as siblings in the same parent directory:

```
Desktop/
├── Stitcher_new/Stitcher/     # this repo (Backend API)
├── ManimRAG/                  # RAG service
├── Manim-Agent-Service/       # Agent service
└── manim-render-service/      # Render service
```

**Step 1 — create your env file:**

```bash
cp .env.docker.example API/.env.docker
# Edit API/.env.docker — fill in JWT_SECRET, Cloudinary keys, LLM keys, etc.
```

**Step 2 — choose what to run:**

Infra + API only (most common dev case — no sibling repos needed):

```bash
docker compose up
```

Full stack (all four services — requires sibling repos cloned as above):

```bash
docker compose -f docker-compose.yml -f docker-compose.services.yml up
```

| Compose file | Services started |
|---|---|
| `docker-compose.yml` | `mongo`, `redis`, `qdrant`, `api` (port 3000) |
| `docker-compose.services.yml` (override) | `agent-service` (4000), `render-service` (8000), `rag-service` (7000) |

> **macOS / Windows note:** The render service's bubblewrap sandbox is Linux-only. The env
> example sets `SANDBOX_ENABLED=false` by default so the container starts on Docker Desktop
> without error. Rendering still works; only the seccomp isolation layer is bypassed. On a
> Linux host set `SANDBOX_ENABLED=true`.

---

## Repository Layout

```
Stitcher/
├── API/                          # Express/TypeScript backend (primary codebase)
│   ├── Dockerfile                # Multi-stage Node 20 build
│   └── .env.docker               # Docker Compose env (copy from .env.docker.example)
├── Client/                       # Frontend source (not the active client — kept for reference)
├── docker-compose.yml            # Infra + API (mongo, redis, qdrant, api)
├── docker-compose.services.yml   # External services override (agent, render, rag)
├── .env.docker.example           # Template for API/.env.docker
├── LICENSE
├── CONTRIBUTING.md
└── README.md
```

All active backend code lives under `API/`. See [`API/README.md`](API/README.md) for its
internal structure.

---

## External Service Repos

| Repo | Port | Stack | What it does |
|---|---|---|---|
| [ManimRAG](https://github.com/vermarjun/ManimRAG) | 7000 | Node/Fastify | Vector search over Manim docs and code examples; returns ranked snippets as RAG context |
| [Manim-Agent-Service](https://github.com/vermarjun/Manim-Agent-Service) | 4000 | Node/Fastify + LangGraph | LLM agent that plans scenes, writes Manim Python code, and debugs render failures |
| [manim-render-service](https://github.com/vermarjun/manim-render-service) | 8000 | Python/FastAPI + bubblewrap | Executes Manim scripts in a sandbox, uploads clips to Cloudinary |

Each repo has its own README with setup instructions. Inter-service calls use an `X-Api-Key`
header; generate a shared secret per service and set it in both the service and in `API/.env`.

---

## Configuration

Copy `API/.env.example` to `API/.env` and fill in the values below. The table shows the keys
you must set before the API will start or process jobs correctly.

| Variable | Description |
|---|---|
| `MONGODB_URL` | MongoDB connection string |
| `JWT_SECRET` | Long random string used to sign JWTs — run `openssl rand -hex 32` |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | Redis connection (used for BullMQ queue and pub/sub) |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Cloudinary account credentials for video upload |
| `RAG_SERVICE_URL` / `RAG_API_KEY` | Base URL and shared secret for the RAG service |
| `AGENT_SERVICE_URL` / `AGENT_API_KEY` | Base URL and shared secret for the Agent service |
| `RENDER_SERVICE_URL` / `RENDER_API_KEY` | Base URL and shared secret for the Render service |
| `KEYS_ENCRYPTION_KEY` | 32-byte hex key for encrypting stored API keys — run `openssl rand -hex 32` |

Optional vars (OAuth, payments, email) are documented in [`API/.env.example`](API/.env.example).

---

## Status and Roadmap

> This project is in the middle of a relaunch. The `main` branch is the legacy codebase.
> All active development is on `stitcher_relaunch`.

**Working now:**

- Backend foundation: Express app, auth middleware, rate limiting, helmet, CORS.
- BullMQ generation pipeline: job dispatch, worker, RAG → Agent → Render orchestration.
- ffmpeg scene concatenation.
- Typed HTTP clients for all three external services.
- SSE and Socket.IO progress streaming.
- MongoDB persistence for users, projects, and generated videos.
- Edit-chat endpoint for iterating on existing videos.

**Deferred / in progress:**

- Per-endpoint request validation via Zod (partially done; ~160 controllers still need it).
- Replacing remaining `console.*` calls in controllers with the structured logger.
- Integration test suite and CI pipeline.
- Comprehensive RAG pipeline (HyDE, BM25, reciprocal rank fusion) — Phase 1 retrieval only for now.
- Multi-scene timeline edits beyond single-scene regeneration.
- Narration / TTS integration.
- Multi-scene timeline edits beyond single-scene regeneration (currently only single-scene regeneration is handled in the edit endpoint).

Pull requests and issues are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) before opening one.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the branching model, commit conventions, and
pull-request process.

---

## License

[MIT](LICENSE) — copyright 2024 vermarjun.

---

## Acknowledgments

- [Manim Community](https://www.manim.community/) for the animation engine at the core of this project.
- [LangChain / LangGraph](https://github.com/langchain-ai/langgraph) for the agent orchestration framework.
- The open-source LLM ecosystem — Ollama, vLLM, and the model teams whose work makes local inference viable.
