# manim-render-service

A standalone HTTP service for rendering [Manim](https://www.manim.community/) Python code into video files.

Give it code, get back a video URL — or a structured error if the code is broken. That's it.

> **Status:** under active development. See `docs/` for the full plan and API reference.

## What it is

- A thin HTTP wrapper around the Manim CLI.
- Takes Manim Python code + render config, returns a video URL or a structured failure.
- Isolates every render in a `bubblewrap` sandbox with CPU/memory/network caps.
- Pluggable storage — ships with `local` and `cloudinary` backends; others available via Python extras.
- Stateless. No database, no cache, no queue. One process, one semaphore, N containers horizontally.

## What it is not

- Not an AI agent. Not an LLM. Does not generate code.
- Not a video editor. Does not concatenate, trim, or transcode arbitrary videos.
- Not a job queue. Returns `503` when full; the caller queues.
- Not coupled to any specific upstream system. It's a dumb, single-purpose renderer.

## Quickstart

See [full README after build](#). For now:

```bash
git clone <repo>
cd manim-render-service
cp .env.example .env   # edit RENDER_API_KEY
docker compose up --build
```

Then:

```bash
curl -X POST http://localhost:8000/render \
  -H "X-Api-Key: $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d @examples/hello.json
```

## License

MIT — see [LICENSE](LICENSE).
