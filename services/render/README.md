# manim-render-service

A standalone HTTP service that renders [Manim](https://www.manim.community/) Python code into video files.

Give it code, get back a video URL — or a structured error if the code is broken. That's it.

---

## What it is

- A thin HTTP wrapper around the Manim CLI.
- Takes Manim Python code + render config, returns a URL to the rendered video (or a structured failure).
- Isolates every render in a `bubblewrap` sandbox with CPU, memory, network, and filesystem caps.
- Pluggable storage — ships with `local` and `cloudinary` backends; `s3`, `gcs`, `azure` available via Python extras.
- Stateless. No database, no cache, no internal queue. One process, one semaphore, horizontally scalable by running N containers.

## What it is not

- Not an AI agent. Not an LLM. Does not generate code.
- Not a video editor. Does not concatenate, trim, or transcode arbitrary videos.
- Not a job queue. Returns `503 Retry-After` when full; the caller queues.
- Not coupled to any specific upstream system — it's a dumb, single-purpose renderer.

## System requirements

**Host (where the container runs):**
- Linux kernel ≥ 4.18 with user namespaces enabled (`/proc/sys/kernel/unprivileged_userns_clone = 1`)
- Docker 20.10+ or any OCI runtime. `SYS_ADMIN` capability (NOT full `--privileged`) so `bwrap` can create namespaces.
- ~2 GB RAM minimum per concurrent render (default cap; configurable).

**Inside the image (installed automatically by the Dockerfile):**
- Python 3.11
- Manim Community Edition (pinned in `pyproject.toml`)
- FFmpeg
- TeX Live (base + fonts-recommended + latex-extra + science) — required for `MathTex`
- Bubblewrap + libseccomp

**macOS development** works via Docker Desktop (the sandbox runs in the embedded Linux VM). Running the server directly on macOS requires `SANDBOX_ENABLED=false`, which the service refuses in production.

## Quickstart

```bash
git clone git@github.com:vermarjun/manim-render-service.git
cd manim-render-service
cp .env.example .env
# edit .env — at minimum set RENDER_API_KEY to a long random string
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

## API (summary)

Full reference: [docs/API.md](docs/API.md).

| Endpoint         | Auth      | Purpose                                                       |
| ---------------- | --------- | ------------------------------------------------------------- |
| `POST /render`   | API key   | Submit Manim code, receive rendered video or structured error |
| `GET /health`    | —         | Liveness + dependency probes (manim, ffmpeg, latex, storage)  |
| `GET /capabilities` | —      | Declared feature set of this deployment                       |
| `GET /metrics`   | —         | Prometheus scrape (opt-out via `METRICS_ENABLED=false`)       |

### The one important contract

`POST /render` returns **HTTP 200** with `success: false` when the user's Manim code is bad (syntax error, timeout, OOM, NameError, etc.). It returns **HTTP 5xx** only when *this service* has a problem (sandbox won't start, storage is down). This keeps caller branching simple:

- Got 200 → parse the body and branch on `success`.
- Got 503 → wait `Retry-After` seconds and retry.
- Got 5xx (other) → alert, don't retry blindly.

## Configuration

Every option is an env var. See [.env.example](.env.example) for the full list. The ones you'll actually touch:

| Variable                  | Default   | Notes                                                    |
| ------------------------- | --------- | -------------------------------------------------------- |
| `RENDER_API_KEY`          | **required** | Single shared secret — rotate with a new container start  |
| `STORAGE_BACKEND`         | `local`   | `local` / `cloudinary` / `s3` / `gcs` / `azure`          |
| `MAX_CONCURRENT_RENDERS`  | CPU count | Semaphore cap; extra requests get 503                    |
| `SANDBOX_ENABLED`         | `true`    | Never disable in production (service refuses)            |
| `SANDBOX_TIMEOUT_DEFAULT` | `120`     | Seconds; per-request `timeoutSec` can lower but not raise |

## Storage extras

Cloud SDKs are opt-in via Python extras so local-only deployments don't carry ~150 MB of unused transitive deps.

```bash
pip install manim-render-service                     # local only
pip install "manim-render-service[cloudinary]"       # + cloudinary
pip install "manim-render-service[s3]"               # + boto3
pip install "manim-render-service[gcs,azure]"        # + both
```

For Docker, pass `--build-arg STORAGE=cloudinary` (or a comma-less single extra) to `docker build`.

## Security model

The sandbox is the boundary between the service and untrusted Manim code. The defences, layered:

1. **Namespaces** — `bwrap --unshare-all` drops network, PID, UTS, IPC, user, cgroup, and mount namespaces.
2. **Filesystem** — only `/usr`, `/etc`, `/opt/venv`, `/lib` mounted read-only; a fresh tmpfs `/work` for the job.
3. **UID** — run as uid 99999 which doesn't exist on the host.
4. **rlimits** — `RLIMIT_AS`, `RLIMIT_CPU`, `RLIMIT_FSIZE`, `RLIMIT_NOFILE`, `RLIMIT_NPROC`.
5. **Wall-clock** — `asyncio.wait_for` kills the entire process group on timeout.
6. **Seccomp-BPF** — optional allowlist of syscalls; policy at [`app/assets/seccomp_manim.yaml`](app/assets/seccomp_manim.yaml).

Test battery at `tests/security/test_sandbox_escape.py` covers network exfil, fs escape, fork bomb, memory bomb, and wall-clock timeout. CI runs this gate on every PR.

Full threat model: [docs/SANDBOX.md](docs/SANDBOX.md).

## Testing

```bash
# fast unit tests (no manim, no bwrap)
pytest -m "not contract and not security"

# contract tests (need manim + ffmpeg)
pytest -m contract

# sandbox-escape battery (needs Linux + bwrap — runs inside the container)
docker compose run --rm render pytest -m security
```

## Scaling

The service is **stateless**: no shared state between requests, no disk writes that persist across renders. Scale by running more containers. Each container handles up to `MAX_CONCURRENT_RENDERS` jobs at once and returns `503` when full — put a round-robin load balancer in front, and queue in the caller (Redis, SQS, whatever fits).

This is a deliberate design choice. A render service that owns a job queue ends up owning the caller's retry semantics, dead-letter handling, and idempotency — none of which belong here.

## License

MIT — see [LICENSE](LICENSE).
