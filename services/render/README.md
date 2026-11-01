# manim-render-service

A standalone HTTP service that renders [Manim](https://www.manim.community/) Python code into video files.

Give it code, get back a video URL - or a structured error if the code is broken. That's it.

---

## What it is

- A thin HTTP wrapper around the Manim CLI.
- Takes Manim Python code + render config, returns a URL to the rendered video (or a structured failure).
- Isolates every render in a `bubblewrap` sandbox: no network, a read-only filesystem except a per-job work directory, and per-process CPU, memory, file size and open-file limits.
- Two storage backends: `local` (files served by this service at `/files`) and `cloudinary`.
- Stateless. No database, no cache, no internal queue. One process, one semaphore, horizontally scalable by running N containers.

## What it is not

- Not an AI agent. Not an LLM. Does not generate code.
- Not a video editor. Does not concatenate, trim, or transcode arbitrary videos.
- Not a job queue. Returns `503 Retry-After` when full; the caller queues.
- Not coupled to any specific upstream system - it's a dumb, single-purpose renderer.

## System requirements

**Host (where the container runs):**
- Linux kernel ≥ 4.18 with user namespaces enabled (`/proc/sys/kernel/unprivileged_userns_clone = 1`)
- Docker 20.10+ or any OCI runtime. The container needs `cap_add: [SYS_ADMIN]` plus `apparmor=unconfined`, `seccomp=unconfined` and `systempaths=unconfined` so `bwrap` can create namespaces and mount `/proc`. It does NOT need `--privileged`. `docker-compose.yml` sets this up.
- ~2 GB RAM minimum per concurrent render (default cap; configurable).

**Inside the image (installed automatically by the Dockerfile):**
- Python 3.11
- Manim Community Edition (pinned in `pyproject.toml`)
- FFmpeg
- TeX Live (base + fonts-recommended + latex-extra + science) - required for `MathTex`
- Six patched Manim plugins, vendored in [`vendor/`](vendor/README.md): manim-astronomy, manim-chemistry, manim-chess, manim-ml, manim-dsa, manim-physics. Generated scenes may import them.
- Bubblewrap + libseccomp

**macOS development** works via Docker Desktop (the sandbox runs in the embedded Linux VM). Running the server directly on macOS requires `SANDBOX_ENABLED=false`, which the service refuses in production.

## Quickstart

```bash
git clone <repo-url>
cd <repo>/services/render
cp .env.example .env
# edit .env - at minimum set RENDER_API_KEY to a long random string
docker compose up --build
```

Then:

```bash
curl -s http://localhost:8000/health | jq .
curl -s http://localhost:8000/capabilities | jq .

curl -s -X POST http://localhost:8000/render \
  -H "X-Api-Key: $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d @examples/hello.json | jq .
```

With `STORAGE_BACKEND=local` the response contains a URL under `/files/`. Open it in a browser or `curl -O` it. That path needs no API key.

### Slim image

The default image installs `texlive-science` and `vedo` (which pulls in vtk). They are large. To skip both:

```bash
docker build --build-arg SLIM=1 -t manim-render-service:slim .
# or: SLIM=1 docker compose up --build
```

A slim image still renders `MathTex`, but drops LaTeX packages such as `siunitx` and `mhchem`, and the astronomy plugin loses `HubbleSpaceTelescope` and `JamesWebbSpaceTelescope`.

If `deb.debian.org` is slow for you, build with `--build-arg APT_MIRROR=http://cdn-aws.deb.debian.org` (any Debian mirror root). The default is unchanged.

## Voiceover

The service can render scenes that use native voiceover, but it never calls a TTS provider. The caller generates the clips and sends them in the request as `voiceover.audio`, a list of `{ "key": <sha256 hex>, "base64": <mp3> }`. The key is the sha256 of the normalized narration text (`stitcher_voiceover.normalize_text`). Before the sandbox starts, the host decodes each clip to `<workdir>/media/voiceovers/<key>.mp3`. Inside the sandbox, `stitcher_voiceover.OfflineTTS` reads them from there, so the sandbox stays offline. Bad base64 is returned as a structured error before Manim runs. A clip that is missing from the bundle makes `OfflineTTS` raise at render time, naming the expected file.

## API (summary)

Full reference: [docs/API.md](docs/API.md).

| Endpoint         | Auth      | Purpose                                                       |
| ---------------- | --------- | ------------------------------------------------------------- |
| `POST /render`   | API key   | Submit Manim code, receive rendered video or structured error |
| `GET /health`    | -         | Liveness + dependency probes (manim, ffmpeg, latex, storage)  |
| `GET /capabilities` | -      | Declared feature set of this deployment                       |
| `GET /metrics`   | -         | Prometheus scrape (opt-out via `METRICS_ENABLED=false`)       |

### The one important contract

`POST /render` returns **HTTP 200** with `success: false` when the user's Manim code is bad (syntax error, timeout, OOM, NameError, etc.). It returns **HTTP 5xx** only when *this service* has a problem (sandbox won't start, storage is down). This keeps caller branching simple:

- Got 200 → parse the body and branch on `success`.
- Got 503 → wait `Retry-After` seconds and retry.
- Got 5xx (other) → alert, don't retry blindly.

## Configuration

Every option is an env var. See [.env.example](.env.example) for the full list. The ones you'll actually touch:

| Variable                  | Default   | Notes                                                    |
| ------------------------- | --------- | -------------------------------------------------------- |
| `RENDER_API_KEY`          | **required** | Single shared secret - rotate with a new container start  |
| `STORAGE_BACKEND`         | `local`   | `local` or `cloudinary`                                  |
| `MAX_CONCURRENT_RENDERS`  | CPU count | Semaphore cap; extra requests get 503                    |
| `SANDBOX_ENABLED`         | `true`    | Never disable in production (service refuses)            |
| `SANDBOX_TIMEOUT_DEFAULT` | `120`     | Seconds; per-request `timeoutSec` can lower but not raise |

## Storage

- `local` (default): files are copied to `LOCAL_STORAGE_PATH` and served by this service under `/files/` without an API key. Anyone who knows a URL can fetch the file. Filenames are random UUIDs.
- `cloudinary`: needs the optional SDK and `CLOUDINARY_URL`.

```bash
pip install manim-render-service                     # local only
pip install "manim-render-service[cloudinary]"       # + cloudinary
```

For Docker, pass `--build-arg STORAGE=cloudinary` (or `STORAGE=cloudinary docker compose up --build`).

## Security model

The sandbox is the boundary between the service and untrusted Manim code. What is enforced:

1. **Namespaces**: `bwrap --unshare-all` gives the render its own network (empty), PID, UTS, IPC, user, cgroup and mount namespaces.
2. **Filesystem**: `/usr`, `/etc`, `/lib`, `/opt` and `/var/lib/texmf` are read-only. `/tmp` is a fresh tmpfs. `/work` is a bind mount of a per-job directory (created under the container's `/tmp`, deleted after the job) and is the only writable place that outlives the process.
3. **Identity and capabilities**: uid/gid 99999, all capabilities dropped.
4. **rlimits** (per process, applied before `bwrap` starts, so everything inside inherits them): CPU time, file size (512 MB), open files (1024), tasks (256), core dumps off, and data segment size equal to the request's memory limit.
5. **Wall-clock**: `asyncio.wait_for` kills the whole process group on timeout.
6. **AST pre-guard**: cheap rejection of obviously hostile code before a sandbox is started. A filter, not a boundary.

What is NOT enforced: there is no seccomp filter (the policy file and build script in the tree are not wired in), no cgroup memory or PID limit, and memory is capped per process, not in total. A fork bomb is bounded to 256 tasks and ended by the wall-clock kill. See [docs/SANDBOX.md](docs/SANDBOX.md) and [SECURITY.md](SECURITY.md).

Test battery at `tests/security/test_sandbox_escape.py` covers network exfil, fs escape, fork bomb, memory bomb, and wall-clock timeout.

## Observability

Two independent layers, both optional and both fail-soft:

- **Prometheus** (`GET /metrics`) - flat counters/histograms, opt-out via `METRICS_ENABLED=false`.
- **OpenTelemetry** - distributed traces + OTLP metrics exported over **HTTP/protobuf** to a
  collector on port 4318. The incoming `traceparent` header (sent by the API) is extracted
  automatically, so each render is a child span of the API's trace. The human-facing
  `X-Trace-Id` is attached as the `stitcher.trace_id` span attribute.

Tracing is initialised **programmatically** in the app factory (`app/observability.py`), so it
works no matter how uvicorn is launched. If the collector is unreachable the batch exporter
silently drops data - nothing escapes into the request path.

```bash
# default launch - OTel inits itself from the env (no collector required)
uvicorn app.main:app --host 0.0.0.0 --port 8000

# ALTERNATIVE: the auto-instrumentation CLI wrapper (also works, not required)
opentelemetry-instrument uvicorn app.main:app --host 0.0.0.0 --port 8000
```

| Env var                       | Default                 | Notes                                  |
| ----------------------------- | ----------------------- | -------------------------------------- |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318` | Collector base URL (OTLP/HTTP)         |
| `OTEL_SERVICE_NAME`           | `stitcher-render`       | `service.name` resource attribute      |
| `OTEL_SDK_DISABLED`           | unset                   | Set `true` to skip OTel init entirely  |

Spans: `render.ast_guard`, `render.manim` (`scene_class`, `quality`, `timeout`, `exit_code`),
`render.ffmpeg_thumbnail`, `render.upload` (`backend`). Metrics: `stitcher.render.duration`
(histogram, ms, attrs `{quality, success}`) and `stitcher.render.active` (live concurrency).

## Testing

```bash
pip install -e ".[dev]"

# fast unit tests (no manim, no bwrap)
pytest -m "not contract and not security"

# contract tests (need manim + ffmpeg)
pytest -m contract
```

The sandbox-escape battery needs Linux and `bwrap`. The Docker image does not contain the tests (they are in `.dockerignore`), so mount the repo, the same way CI does:

```bash
docker build -t manim-render-service:local .
docker run --rm \
  --cap-add SYS_ADMIN --security-opt apparmor=unconfined \
  --security-opt seccomp=unconfined --security-opt systempaths=unconfined \
  -e RENDER_API_KEY=test-key-at-least-sixteen-chars \
  -e SANDBOX_ENABLED=true \
  -v "$PWD":/repo -w /repo \
  manim-render-service:local \
  sh -c "pip install -q --target /tmp/pt pytest pytest-asyncio && PYTHONPATH=/tmp/pt python -m pytest tests/security -m security -q"
```

## Scaling

The service is **stateless**: no shared state between requests, no disk writes that persist across renders. Scale by running more containers. Each container handles up to `MAX_CONCURRENT_RENDERS` jobs at once and returns `503` when full - put a round-robin load balancer in front, and queue in the caller (Redis, SQS, whatever fits).

This is a deliberate design choice. A render service that owns a job queue ends up owning the caller's retry semantics, dead-letter handling, and idempotency - none of which belong here.

## License

MIT. See the [LICENSE](../../LICENSE) at the repository root. Vendored plugins keep their own MIT licenses in [`vendor/`](vendor/README.md).
