# Architecture

## Goals

The render service has ONE job: turn Manim Python code into a video URL. Every design decision flows from that.

1. **Stateless.** No DB, no cache, no queue. A single request is self-contained; N replicas scale linearly.
2. **Sandbox-first.** Untrusted code must never touch the host. Everything else is a convenience.
3. **Honest failure modes.** User errors are structured data in a 200 response. Service errors are 5xx. A 503 means "full, retry later" - not "code broken".
4. **No orchestration features.** No retries, no dead-letter queue, no progress callbacks. Those live in the caller.

## Request lifecycle

```
HTTP POST /render
       │
       ▼
┌──────────────────────┐
│ TraceMiddleware      │  generate/echo x-trace-id, bind to contextvar
└──────────────────────┘
       │
       ▼
┌──────────────────────┐
│ ApiKeyMiddleware     │  constant-time compare; 401 on mismatch
└──────────────────────┘
       │
       ▼
┌──────────────────────┐
│ pydantic validation  │  422 on unknown field / wrong type / bad pattern
└──────────────────────┘
       │
       ▼
┌──────────────────────┐
│ semaphore.acquire()  │  503 + Retry-After if saturated
└──────────────────────┘
       │
       ▼
┌──────────────────────┐
│ pipeline.run()       │  validate → sandbox → classify → thumbnail → audio → upload
└──────────────────────┘
       │
       ▼
   JSON response
```

## Pipeline stages

| Stage            | Purpose                                                       | Failure phase        |
| ---------------- | ------------------------------------------------------------- | -------------------- |
| AST pre-guard    | Reject obvious abuse without paying for a sandbox             | `validation`         |
| Sandbox + Manim  | Execute the code inside `bwrap` with rlimits + optional seccomp | `sandbox_setup`, `manim_execution`, `timeout`, `oom` |
| Artifact resolve | Deterministic path inside `/work/media`; fail if missing      | `internal`           |
| Audio mux        | `ffmpeg -c:v copy -c:a aac` if `audio` was provided           | `internal`           |
| Thumbnail        | `ffmpeg -frames:v 1` at `thumbnailAt` fraction                | (non-fatal; logged)  |
| Upload           | Call `Storage.put()`; return URL                              | `upload`             |

Each stage records its duration; the result includes a full per-stage timing breakdown.

## Process model

A single uvicorn process handles all requests. Concurrency is bounded by an async `Semaphore` whose value equals `MAX_CONCURRENT_RENDERS`. When full:

- `QUEUE_FULL_POLICY=reject` (default): return 503 immediately.
- `QUEUE_FULL_POLICY=block`: wait up to `QUEUE_WAIT_TIMEOUT_SEC`, then 503.

We do **not** run a thread or process pool internal to the service. Manim execution is a subprocess (`bwrap ... manim ...`), so concurrency gating happens at the "number of concurrent subprocesses" level - exactly what the semaphore measures.

## Sandbox

See [SANDBOX.md](SANDBOX.md) for the threat model and escape-test battery.

Short version: every render runs inside a bubblewrap child with a fresh mount namespace, no network namespace, a private `/work` directory, rlimits for CPU/RAM/FDs/processes, and (if the policy blob is present) a seccomp-BPF allowlist of syscalls. The only way out is a kernel bug, which is explicitly outside the service's threat model - run recent kernels and keep them patched.

## Storage

Backends implement a `Storage` protocol: `put(local_path, folder, public, content_type) -> (url, bytes)`. The selector picks one by env var and caches it. The cloudinary SDK is a Python extra, so a local-only deployment does not install it. Only `local` and `cloudinary` exist.

Adding a new backend = one file in `app/storage/`, one branch in `selector.py`, one entry in the `[project.optional-dependencies]` table.

## Observability

- Structured JSON logs via `structlog`. Every log line carries the trace ID.
- Four Prometheus series, flat labels, no per-user cardinality.
- `/health` does real dependency probes (subprocess `--version` on manim/ffmpeg, `stat` on storage, `Semaphore` state). Suitable for k8s liveness AND readiness.

## What's deliberately missing

- **No progress streaming.** Manim itself doesn't emit progress in a useful shape; polling `/health` or listening on the trace ID is enough.
- **No per-tenant config.** Everything is process-global. Multi-tenancy belongs in the caller.
- **No job persistence.** A process restart loses in-flight renders. Callers must retry.
- **No webhooks.** The caller waits for the HTTP response. If it takes too long, they hit `timeoutSec` and get a structured failure.

These are features this service will never grow - each one pulls in state, and state belongs in the layer above.
