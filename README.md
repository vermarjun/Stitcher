# Stitcher

Stitcher is an AI-powered SaaS platform that lets users generate and edit Manim-based mathematical/educational videos through a chat-driven interface. Users describe what they want, and Stitcher orchestrates an LLM agent, a Python Manim render worker, and a vector-search RAG service to produce, iterate on, and deliver high-quality animated videos — all without the user writing a single line of code.

## Services Architecture

| Service | Path / Port | Tech | Purpose |
|---|---|---|---|
| **API** | `API/` · port 3000 | Express + TypeScript | Main backend: auth, projects, payments, BullMQ job dispatch |
| **ManimRAG** | port 7000 *(coming soon)* | Fastify + TypeScript | Vector search over Manim docs; answers agent queries |
| **Manim-Agent-Service** | port 4000 | Fastify + TypeScript | LLM agent that writes & fixes Manim Python code |
| **manim-render-service** | port 8000 | FastAPI + Python | Executes Manim scripts, returns rendered video URLs |

Inter-service communication uses an `X-Api-Key` header for authentication.

## Quickstart

See [API/README.md](API/README.md) for full backend setup instructions.

## License

MIT — see [LICENSE](LICENSE).
